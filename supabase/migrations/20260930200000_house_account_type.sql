-- House (Fase 1): um tipo de conta novo, no mesmo código do Modo Criador.
-- House = agência interna de uma empresa: uma marca principal (a própria
-- empresa, podendo ter marcas adicionais pagas à parte), um dono (master)
-- que acompanha tudo e uma ou mais pessoas da equipe que executam.
--
-- O que muda por tipo de conta é decidido em código (isHouse em
-- src/lib/luzeria/house.ts) — aqui só a estrutura:
--  1) orgs.account_type + orgs.house_client_id (marca principal)
--  2) planos próprios da house (plans.account_type), que nunca aparecem pra
--     agência nem no cadastro público
--  3) house_settings (metas mínimas + onboarding)
--  4) house_invites (código de uso único que libera /house/criar)
--  5) approve_item_internal: "Aprovação do gestor" — mesmo efeito da
--     aprovação pelo link público, feita pelo master dentro do app

-- ===== 1. orgs =====
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'agency';
DO $$ BEGIN
  ALTER TABLE public.orgs ADD CONSTRAINT orgs_account_type_check CHECK (account_type IN ('agency', 'house'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS house_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_orgs_house_client ON public.orgs(house_client_id);

-- A política "org master updates own org" deixa o master atualizar a
-- própria linha de orgs inteira — sem essa trava, qualquer master viraria
-- house (ou deixaria de ser) por uma chamada direta à API. Só o servidor
-- (service role, usado pelo painel da Luzeria e pelo /house/criar) muda.
CREATE OR REPLACE FUNCTION public.guard_org_account_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF (NEW.account_type IS DISTINCT FROM OLD.account_type
      OR NEW.house_client_id IS DISTINCT FROM OLD.house_client_id)
     AND auth.uid() IS NOT NULL
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Só a Luzeria pode mudar o tipo de conta.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_org_account_type ON public.orgs;
CREATE TRIGGER trg_guard_org_account_type
  BEFORE UPDATE ON public.orgs
  FOR EACH ROW EXECUTE FUNCTION public.guard_org_account_type();

-- ===== 2. planos da house =====
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'agency';

-- max_clients null = sem teto: cada marca além da principal é cobrada à
-- parte (features.extra_brand_cents), não bloqueada.
INSERT INTO public.plans (id, name, price_cents, max_clients, max_collaborators, features, sort_order, account_type) VALUES
  ('house', 'House', 14900, NULL, 5,
    '{"automations": true, "ai_planning": false, "extra_brand_cents": 7990, "reports_tier": "completo", "support_tier": "prioritario"}'::jsonb, 20, 'house'),
  ('house_ia', 'House + IA', 24900, NULL, 5,
    '{"automations": true, "ai_planning": true, "extra_brand_cents": 7990, "reports_tier": "completo", "support_tier": "prioritario"}'::jsonb, 21, 'house')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, price_cents = EXCLUDED.price_cents, max_clients = EXCLUDED.max_clients,
  max_collaborators = EXCLUDED.max_collaborators, features = EXCLUDED.features,
  sort_order = EXCLUDED.sort_order, account_type = EXCLUDED.account_type;

-- ===== 3. house_settings =====
CREATE TABLE IF NOT EXISTS public.house_settings (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  stories_per_workday int NOT NULL DEFAULT 3 CHECK (stories_per_workday BETWEEN 0 AND 50),
  feed_posts_per_week int NOT NULL DEFAULT 3 CHECK (feed_posts_per_week BETWEEN 0 AND 50),
  -- Dia do mês até quando o planejamento do mês seguinte precisa estar pronto.
  planning_deadline_day int NOT NULL DEFAULT 25 CHECK (planning_deadline_day BETWEEN 1 AND 28),
  onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.house_settings TO authenticated;
GRANT ALL ON public.house_settings TO service_role;
ALTER TABLE public.house_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "house settings org read" ON public.house_settings;
CREATE POLICY "house settings org read" ON public.house_settings FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
DROP POLICY IF EXISTS "house settings master insert" ON public.house_settings;
CREATE POLICY "house settings master insert" ON public.house_settings FOR INSERT TO authenticated
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id());
DROP POLICY IF EXISTS "house settings master update" ON public.house_settings;
CREATE POLICY "house settings master update" ON public.house_settings FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id());

-- ===== 4. house_invites =====
CREATE TABLE IF NOT EXISTS public.house_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  plan_id text NOT NULL DEFAULT 'house' REFERENCES public.plans(id),
  note text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  used_at timestamptz,
  used_by_org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL
);
GRANT SELECT ON public.house_invites TO authenticated;
GRANT ALL ON public.house_invites TO service_role;
ALTER TABLE public.house_invites ENABLE ROW LEVEL SECURITY;

-- Só a Luzeria enxerga a lista; criar/usar convite passa sempre pelo
-- servidor (service role), nunca direto do navegador.
DROP POLICY IF EXISTS "luzeria reads house invites" ON public.house_invites;
CREATE POLICY "luzeria reads house invites" ON public.house_invites FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- ===== 5. aprovação do gestor =====
CREATE OR REPLACE FUNCTION public.approve_item_internal(_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_client_id uuid;
  v_title text;
  v_status text;
  v_approver text;
  v_rule public.automation_rules;
  rec record;
BEGIN
  IF NOT public.is_master(auth.uid()) THEN
    RAISE EXCEPTION 'Só o gestor (Adm Master) pode aprovar.';
  END IF;

  SELECT ci.org_id, m.client_id, ci.title, ci.status
    INTO v_org_id, v_client_id, v_title, v_status
  FROM public.content_items ci
  JOIN public.months m ON m.id = ci.month_id
  WHERE ci.id = _item_id AND ci.deleted_at IS NULL;

  IF v_org_id IS NULL OR v_org_id <> public.current_org_id() THEN
    RAISE EXCEPTION 'Item não encontrado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.orgs WHERE id = v_org_id AND account_type = 'house') THEN
    RAISE EXCEPTION 'Aprovação do gestor só existe em contas House.';
  END IF;
  IF v_status <> 'REVISAO_CLIENTE' THEN
    RAISE EXCEPTION 'Esse item não está aguardando aprovação.';
  END IF;

  -- Mesmo efeito de add_public_feedback quando o cliente aprova pelo link.
  UPDATE public.content_items SET status = 'AGENDAMENTO' WHERE id = _item_id;
  UPDATE public.content_items SET ig_auto_publish = true
  WHERE id = _item_id AND scheduled_at IS NOT NULL AND type IN ('post', 'reel', 'story');

  FOR v_rule IN
    SELECT * FROM public.automation_rules
     WHERE org_id = v_org_id AND active AND trigger_type = 'item_approved'
  LOOP
    PERFORM public.apply_automation_action_v2(v_rule, _item_id, v_client_id, NULL, NULL, NULL);
  END LOOP;

  SELECT name INTO v_approver FROM public.profiles WHERE id = auth.uid();
  FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = _item_id AND user_id <> auth.uid() LOOP
    INSERT INTO public.notifications (user_id, type, item_id, message)
    VALUES (rec.user_id, 'client_feedback', _item_id,
      COALESCE(v_approver, 'Gestor') || ' aprovou "' || COALESCE(v_title, '') || '"');
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_item_internal(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.approve_item_internal(uuid) TO authenticated;
