-- Lote B (pendente desde a migração multi-tenant original): stories_schedule,
-- cleaning_schedule, cleaning_log e cleaning_settings nunca ganharam org_id —
-- hoje são um único conjunto de dados global compartilhado por TODAS as
-- agências da plataforma. Esta migration corrige o isolamento. Também
-- aproveita para adicionar stories_schedule.client_id (Fase 3 do plano —
-- é só uma coluna a mais, sem custo adicional fazer junto).

-- ===== stories_schedule =====
ALTER TABLE public.stories_schedule ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
UPDATE public.stories_schedule SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE public.stories_schedule ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.stories_schedule ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;

DO $$
DECLARE conname text;
BEGIN
  SELECT c.conname INTO conname FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
   WHERE t.relname = 'stories_schedule' AND c.contype = 'u';
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.stories_schedule DROP CONSTRAINT %I', conname);
  END IF;
END $$;
ALTER TABLE public.stories_schedule ADD CONSTRAINT stories_schedule_org_day_key UNIQUE (org_id, day);

DROP POLICY IF EXISTS "stories_read_all" ON public.stories_schedule;
DROP POLICY IF EXISTS "stories_admin_write" ON public.stories_schedule;
CREATE POLICY "stories_org_read" ON public.stories_schedule FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "stories_org_admin_write" ON public.stories_schedule FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX IF NOT EXISTS idx_stories_schedule_org ON public.stories_schedule(org_id);

-- ===== cleaning_schedule =====
ALTER TABLE public.cleaning_schedule ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
UPDATE public.cleaning_schedule SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE public.cleaning_schedule ALTER COLUMN org_id SET NOT NULL;

-- The old UNIQUE(task_idx, weekday) is global — a second org filling in its
-- own grid would collide with Luzeria's existing rows. Widen it now; Fase 2
-- will swap task_idx for task_id and re-tighten this same constraint.
ALTER TABLE public.cleaning_schedule DROP CONSTRAINT IF EXISTS cleaning_schedule_task_idx_weekday_key;
ALTER TABLE public.cleaning_schedule ADD CONSTRAINT cleaning_schedule_org_task_idx_weekday_key UNIQUE (org_id, task_idx, weekday);

DROP POLICY IF EXISTS "cleaning_read_all" ON public.cleaning_schedule;
DROP POLICY IF EXISTS "cleaning_admin_write" ON public.cleaning_schedule;
CREATE POLICY "cleaning_org_read" ON public.cleaning_schedule FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "cleaning_org_admin_write" ON public.cleaning_schedule FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX IF NOT EXISTS idx_cleaning_schedule_org ON public.cleaning_schedule(org_id);

-- ===== cleaning_log =====
ALTER TABLE public.cleaning_log ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
UPDATE public.cleaning_log SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;
ALTER TABLE public.cleaning_log ALTER COLUMN org_id SET NOT NULL;

ALTER TABLE public.cleaning_log DROP CONSTRAINT IF EXISTS cleaning_log_task_idx_weekday_occurrence_date_key;
ALTER TABLE public.cleaning_log ADD CONSTRAINT cleaning_log_org_task_idx_weekday_occ_key UNIQUE (org_id, task_idx, weekday, occurrence_date);

DROP POLICY IF EXISTS "cleaning_log_select_auth" ON public.cleaning_log;
DROP POLICY IF EXISTS "cleaning_log_insert_responsible_or_admin" ON public.cleaning_log;
DROP POLICY IF EXISTS "cleaning_log_update_responsible_or_admin" ON public.cleaning_log;
DROP POLICY IF EXISTS "cleaning_log_delete_responsible_or_admin" ON public.cleaning_log;

CREATE POLICY "cleaning_log_org_select" ON public.cleaning_log FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "cleaning_log_org_insert" ON public.cleaning_log FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      public.is_admin(auth.uid())
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.cleaning_schedule cs
        WHERE cs.task_idx = cleaning_log.task_idx
          AND cs.weekday = cleaning_log.weekday
          AND cs.org_id = cleaning_log.org_id
          AND cs.user_id = auth.uid()
      )
    )
  );
CREATE POLICY "cleaning_log_org_update" ON public.cleaning_log FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_admin(auth.uid()) OR user_id = auth.uid() OR done_by = auth.uid())
  );
CREATE POLICY "cleaning_log_org_delete" ON public.cleaning_log FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_admin(auth.uid()) OR user_id = auth.uid() OR done_by = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_cleaning_log_org ON public.cleaning_log(org_id);

-- ===== cleaning_settings (singleton -> per-org) =====
ALTER TABLE public.cleaning_settings ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.orgs(id);
UPDATE public.cleaning_settings SET org_id = '00000000-0000-0000-0000-000000000001' WHERE id = 1;
ALTER TABLE public.cleaning_settings ALTER COLUMN org_id SET NOT NULL;
ALTER TABLE public.cleaning_settings DROP CONSTRAINT IF EXISTS cleaning_settings_pkey;
ALTER TABLE public.cleaning_settings DROP COLUMN IF EXISTS id;
ALTER TABLE public.cleaning_settings ADD CONSTRAINT cleaning_settings_pkey PRIMARY KEY (org_id);

DROP POLICY IF EXISTS "settings_read_all" ON public.cleaning_settings;
DROP POLICY IF EXISTS "settings_admin_write" ON public.cleaning_settings;
CREATE POLICY "cleaning_settings_org_read" ON public.cleaning_settings FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
CREATE POLICY "cleaning_settings_org_admin_write" ON public.cleaning_settings FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());
