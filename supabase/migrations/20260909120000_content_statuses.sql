-- Status intermediários customizáveis por agência. content_statuses é uma
-- tabela só de override/adição, mesmo padrão de client_journey_stages
-- (20260810020000): sem linha pra uma chave builtin = usa o rótulo padrão
-- (STATUS_META em types.ts); uma linha com key = uma das 10 chaves builtin
-- = a agência renomeou esse passo (a key nunca muda, só o label — renomear
-- é 100% seguro, zero risco de órfão em content_items existentes); uma
-- linha com key fora das 10 builtin = um status novo criado pela agência.
-- Os 5 status protegidos (PRONTO_PARA_PUBLICAR, FINALIZADO, CONCLUIDO,
-- TRAVADO, PENDENTE) nunca são gravados aqui — ficam fixos em código,
-- somente leitura na nova tela de Configurações.
--
-- Um status novo precisa de um valor de content_items.status que não
-- existe no ENUM content_status, e ENUM não suporta bem membro customizado
-- ilimitado por agência — por isso a coluna vira text. Conferido em todas
-- as migrations: só essa coluna e duas funções PL/pgSQL referenciam o tipo
-- content_status — record_finalizations/track_lead_time/
-- track_status_transition/run_automation_rules já comparam contra strings
-- literais ou já fazem ::text, funcionam igual depois da troca.

-- 1. content_items.status: enum -> text
ALTER TABLE public.content_items ALTER COLUMN status DROP DEFAULT;
ALTER TABLE public.content_items ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE public.content_items ALTER COLUMN status SET DEFAULT 'PLANEJAMENTO';

-- 2. tabela por agência (mesmo padrão de client_journey_stages)
CREATE TABLE public.content_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, key)
);

GRANT SELECT ON public.content_statuses TO authenticated;
GRANT ALL ON public.content_statuses TO service_role;
ALTER TABLE public.content_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read content statuses" ON public.content_statuses FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage content statuses" ON public.content_statuses FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_content_statuses_org ON public.content_statuses(org_id, sort_order);

-- 3. set_item_status: remove o cast ::content_status (senão gravar uma
-- chave customizada explode com "invalid input value for enum") — corpo
-- idêntico ao definido em 20260813120000_fix_set_item_status_regression.sql,
-- só a linha do UPDATE muda.
CREATE OR REPLACE FUNCTION public.set_item_status(p_item_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'Conta inativa.';
  END IF;
  IF p_status IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO')
     AND NOT public.is_master(auth.uid())
     AND NOT public.has_setor_permission(auth.uid(), 'approve_finalize') THEN
    RAISE EXCEPTION 'Apenas administradores podem marcar como pronto para publicar ou finalizado.';
  END IF;
  UPDATE public.content_items SET status = p_status WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_item_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_status(uuid, text) TO authenticated;

-- 4. credit_finalization_on_late_assignee: variável local content_status -> text
-- (corpo idêntico ao definido em 20260908180000_credit_finalization_on_late_assignee.sql,
-- só o DECLARE muda — a trigger em si não precisa de DROP/CREATE, assinatura
-- da função é a mesma).
CREATE OR REPLACE FUNCTION public.credit_finalization_on_late_assignee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  item_status text;
BEGIN
  SELECT status INTO item_status FROM public.content_items WHERE id = NEW.item_id;
  IF item_status = 'PRONTO_PARA_PUBLICAR' AND NOT EXISTS (
    SELECT 1 FROM public.finalizations WHERE item_id = NEW.item_id AND user_id = NEW.user_id
  ) THEN
    INSERT INTO public.finalizations (user_id, item_id, finalized_at)
    VALUES (NEW.user_id, NEW.item_id, now());
  END IF;
  RETURN NEW;
END;
$$;
