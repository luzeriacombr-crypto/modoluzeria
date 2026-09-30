-- House (Fase 2): checklists recorrentes e leads do Instagram.
--
-- Checklists: a Rotina (cleaning_*) é uma grade tarefa × dia da semana
-- (seg–sáb) pensada pra limpeza do estúdio — não tem cadência mensal nem
-- "uma vez por semana até tal dia". Aqui cada item tem cadência própria
-- (diária = dias úteis, semanal, mensal), responsável opcional e histórico
-- por período (period_key). Um job diário (21h de Brasília) avisa o que
-- não foi concluído no prazo.
--
-- Leads: lançamento rápido pelo botão "+ Lead" (nome/@, origem,
-- observação) e kanban de status. As datas de primeira passagem por cada
-- etapa (agendou_at, compareceu_at...) ficam gravadas pra calcular taxa de
-- avanço no painel do dono (Fase 4), mesmo que o card volte de coluna.

-- ===== Checklists =====
CREATE TABLE IF NOT EXISTS public.house_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  description text CHECK (description IS NULL OR length(description) <= 2000),
  cadence text NOT NULL CHECK (cadence IN ('daily', 'weekly', 'monthly')),
  -- Semanal: até que dia da semana precisa estar feito (ISO: 1 = segunda … 7 = domingo).
  due_weekday smallint NOT NULL DEFAULT 5 CHECK (due_weekday BETWEEN 1 AND 7),
  -- Mensal: até que dia do mês (31 = último dia, em meses mais curtos).
  due_day smallint NOT NULL DEFAULT 31 CHECK (due_day BETWEEN 1 AND 31),
  responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_house_checklist_items_org ON public.house_checklist_items(org_id, active, sort_order);

CREATE TABLE IF NOT EXISTS public.house_checklist_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.house_checklist_items(id) ON DELETE CASCADE,
  -- 'YYYY-MM-DD' (diária), 'IYYY-Www' (semanal), 'YYYY-MM' (mensal) — sempre no fuso de Brasília.
  period_key text NOT NULL CHECK (length(period_key) BETWEEN 7 AND 10),
  done_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  done_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_house_checklist_completions_org ON public.house_checklist_completions(org_id, done_at DESC);

-- Um aviso de atraso por item+período, nunca repetido.
CREATE TABLE IF NOT EXISTS public.house_checklist_alerts (
  item_id uuid NOT NULL REFERENCES public.house_checklist_items(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (item_id, period_key)
);
CREATE INDEX IF NOT EXISTS idx_house_checklist_alerts_org ON public.house_checklist_alerts(org_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.house_checklist_items TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.house_checklist_completions TO authenticated;
GRANT SELECT ON public.house_checklist_alerts TO authenticated;
GRANT ALL ON public.house_checklist_items, public.house_checklist_completions, public.house_checklist_alerts TO service_role;
ALTER TABLE public.house_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_checklist_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.house_checklist_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist items org read" ON public.house_checklist_items;
CREATE POLICY "checklist items org read" ON public.house_checklist_items FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "checklist items admin write" ON public.house_checklist_items;
CREATE POLICY "checklist items admin write" ON public.house_checklist_items FOR ALL TO authenticated
  USING (org_id = public.current_org_id() AND public.is_admin(auth.uid()))
  WITH CHECK (org_id = public.current_org_id() AND public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "checklist completions org read" ON public.house_checklist_completions;
CREATE POLICY "checklist completions org read" ON public.house_checklist_completions FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "checklist completions org insert" ON public.house_checklist_completions;
CREATE POLICY "checklist completions org insert" ON public.house_checklist_completions FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND done_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.house_checklist_items i WHERE i.id = item_id AND i.org_id = public.current_org_id())
  );
DROP POLICY IF EXISTS "checklist completions undo" ON public.house_checklist_completions;
CREATE POLICY "checklist completions undo" ON public.house_checklist_completions FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (done_by = auth.uid() OR public.is_admin(auth.uid())));

DROP POLICY IF EXISTS "checklist alerts org read" ON public.house_checklist_alerts;
CREATE POLICY "checklist alerts org read" ON public.house_checklist_alerts FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));

-- Período atual (fuso de Brasília) de cada cadência — mesma regra do app
-- (src/lib/luzeria/house-checklists.ts), que precisa bater com isso.
CREATE OR REPLACE FUNCTION public.house_checklist_period_key(_cadence text, _day date)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE _cadence
    WHEN 'daily' THEN to_char(_day, 'YYYY-MM-DD')
    WHEN 'weekly' THEN to_char(_day, 'IYYY-"W"IW')
    ELSE to_char(_day, 'YYYY-MM')
  END;
$$;

-- Roda às 21h de Brasília: tudo que vencia HOJE e não foi marcado vira
-- aviso pro responsável (ou pra equipe toda, se não tiver) e pros masters.
CREATE OR REPLACE FUNCTION public.notify_overdue_house_checklists()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_isodow int := EXTRACT(ISODOW FROM (now() AT TIME ZONE 'America/Sao_Paulo'))::int;
  v_last_day int := EXTRACT(DAY FROM (date_trunc('month', v_today) + interval '1 month - 1 day'))::int;
  v_count int := 0;
  rec record;
  v_period text;
  v_label text;
BEGIN
  FOR rec IN
    SELECT i.*
      FROM public.house_checklist_items i
      JOIN public.orgs o ON o.id = i.org_id AND o.account_type = 'house'
     WHERE i.active
       AND (
         (i.cadence = 'daily' AND v_isodow BETWEEN 1 AND 5)
         OR (i.cadence = 'weekly' AND i.due_weekday = v_isodow)
         OR (i.cadence = 'monthly' AND LEAST(i.due_day, v_last_day) = EXTRACT(DAY FROM v_today)::int)
       )
  LOOP
    v_period := public.house_checklist_period_key(rec.cadence, v_today);
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.house_checklist_completions c WHERE c.item_id = rec.id AND c.period_key = v_period
    );
    INSERT INTO public.house_checklist_alerts (item_id, period_key, org_id)
    VALUES (rec.id, v_period, rec.org_id)
    ON CONFLICT DO NOTHING;
    CONTINUE WHEN NOT FOUND;

    v_label := CASE rec.cadence WHEN 'daily' THEN 'de hoje' WHEN 'weekly' THEN 'da semana' ELSE 'do mês' END;
    INSERT INTO public.notifications (user_id, type, message)
    SELECT DISTINCT p.id, 'checklist_overdue', 'Checklist ' || v_label || ' não concluído: "' || rec.title || '"'
      FROM public.profiles p
      LEFT JOIN public.user_roles r ON r.user_id = p.id
     WHERE p.org_id = rec.org_id AND p.active
       AND (
         p.id = rec.responsible_id
         OR r.role = 'master'
         OR rec.responsible_id IS NULL
       );
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_overdue_house_checklists() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_overdue_house_checklists() TO service_role;

DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'house-checklists-overdue';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
-- 00:00 UTC = 21:00 em Brasília (ainda "hoje" no fuso da House).
SELECT cron.schedule('house-checklists-overdue', '0 0 * * *', $$SELECT public.notify_overdue_house_checklists();$$);

-- ===== Leads do Instagram =====
CREATE TABLE IF NOT EXISTS public.instagram_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  origin text NOT NULL CHECK (origin IN ('story', 'caixinha', 'comentario', 'direct', 'outro')),
  note text CHECK (note IS NULL OR length(note) <= 1000),
  status text NOT NULL DEFAULT 'conversa' CHECK (status IN ('conversa', 'agendou', 'compareceu', 'nao_avancou')),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  status_changed_at timestamptz NOT NULL DEFAULT now(),
  agendou_at timestamptz,
  compareceu_at timestamptz,
  nao_avancou_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_instagram_leads_org_created ON public.instagram_leads(org_id, created_at DESC);

-- Grava a primeira vez que o lead chegou em cada etapa. Compareceu
-- implica agendou (quem pula direto pra "Compareceu" também agendou).
CREATE OR REPLACE FUNCTION public.instagram_leads_track_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  IF NEW.status IN ('agendou', 'compareceu') AND NEW.agendou_at IS NULL THEN NEW.agendou_at := now(); END IF;
  IF NEW.status = 'compareceu' AND NEW.compareceu_at IS NULL THEN NEW.compareceu_at := now(); END IF;
  IF NEW.status = 'nao_avancou' AND NEW.nao_avancou_at IS NULL THEN NEW.nao_avancou_at := now(); END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_instagram_leads_track_status ON public.instagram_leads;
CREATE TRIGGER trg_instagram_leads_track_status
  BEFORE INSERT OR UPDATE ON public.instagram_leads
  FOR EACH ROW EXECUTE FUNCTION public.instagram_leads_track_status();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_leads TO authenticated;
GRANT ALL ON public.instagram_leads TO service_role;
ALTER TABLE public.instagram_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads org read" ON public.instagram_leads;
CREATE POLICY "leads org read" ON public.instagram_leads FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()));
DROP POLICY IF EXISTS "leads org insert" ON public.instagram_leads;
CREATE POLICY "leads org insert" ON public.instagram_leads FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()) AND created_by = auth.uid());
DROP POLICY IF EXISTS "leads org update" ON public.instagram_leads;
CREATE POLICY "leads org update" ON public.instagram_leads FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND public.is_active_profile(auth.uid()))
  WITH CHECK (org_id = public.current_org_id());
DROP POLICY IF EXISTS "leads delete own or admin" ON public.instagram_leads;
CREATE POLICY "leads delete own or admin" ON public.instagram_leads FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_admin(auth.uid())));
