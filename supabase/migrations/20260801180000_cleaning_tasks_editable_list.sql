-- Fase 2 do plano "Rotina": a lista de 10 tarefas de limpeza era um array
-- fixo no código (CLEANING_TASKS em CleaningView.tsx), hardcoded pro estúdio
-- físico da Luzeria. Vira uma tabela editável por agência.
-- (Reescrita com IF EXISTS/IF NOT EXISTS pra ser seguro rodar de novo do
-- zero, caso a tentativa anterior tenha parado no meio.)

CREATE TABLE IF NOT EXISTS public.cleaning_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_tasks TO authenticated;
GRANT ALL ON public.cleaning_tasks TO service_role;
ALTER TABLE public.cleaning_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cleaning_tasks_org_read" ON public.cleaning_tasks;
CREATE POLICY "cleaning_tasks_org_read" ON public.cleaning_tasks FOR SELECT TO authenticated
  USING (org_id = public.current_org_id());
DROP POLICY IF EXISTS "cleaning_tasks_org_admin_write" ON public.cleaning_tasks;
CREATE POLICY "cleaning_tasks_org_admin_write" ON public.cleaning_tasks FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());
CREATE INDEX IF NOT EXISTS idx_cleaning_tasks_org ON public.cleaning_tasks(org_id);

-- Backfill Luzeria's 10 hardcoded tasks, preserving the old task_idx 0-9 order.
INSERT INTO public.cleaning_tasks (org_id, name, sort_order)
SELECT '00000000-0000-0000-0000-000000000001', name, sort_order FROM (VALUES
  ('Varrer e passar pano no chão (tudo)', 0),
  ('Varrer calçada', 1),
  ('Limpar espelhos', 2),
  ('Limpar teto e paredes', 3),
  ('Limpar/organizar cozinha', 4),
  ('Lavar banheiro', 5),
  ('Recolher lixo', 6),
  ('Limpar os móveis (Hall, administrativo, escritório e sala de produção)', 7),
  ('Limpar estúdio e organizar equipamentos', 8),
  ('Lavar e trocar panos/toalhas/tapetes', 9)
) AS seed(name, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.cleaning_tasks WHERE org_id = '00000000-0000-0000-0000-000000000001');

-- ===== cleaning_schedule: task_idx -> task_id =====
ALTER TABLE public.cleaning_schedule ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.cleaning_tasks(id) ON DELETE CASCADE;
UPDATE public.cleaning_schedule cs SET task_id = ct.id
  FROM public.cleaning_tasks ct
 WHERE ct.org_id = cs.org_id AND ct.sort_order = cs.task_idx AND cs.task_id IS NULL;

-- The cleaning_log INSERT policy (from Fase 1) reads cs.task_idx via a join —
-- must be dropped before task_idx can be dropped from cleaning_schedule.
DROP POLICY IF EXISTS "cleaning_log_org_insert" ON public.cleaning_log;

ALTER TABLE public.cleaning_schedule ALTER COLUMN task_id SET NOT NULL;
ALTER TABLE public.cleaning_schedule DROP CONSTRAINT IF EXISTS cleaning_schedule_org_task_idx_weekday_key;
ALTER TABLE public.cleaning_schedule DROP COLUMN IF EXISTS task_idx;
ALTER TABLE public.cleaning_schedule DROP CONSTRAINT IF EXISTS cleaning_schedule_org_task_weekday_key;
ALTER TABLE public.cleaning_schedule ADD CONSTRAINT cleaning_schedule_org_task_weekday_key UNIQUE (org_id, task_id, weekday);

-- ===== cleaning_log: task_idx -> task_id =====
ALTER TABLE public.cleaning_log ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.cleaning_tasks(id) ON DELETE CASCADE;
UPDATE public.cleaning_log cl SET task_id = ct.id
  FROM public.cleaning_tasks ct
 WHERE ct.org_id = cl.org_id AND ct.sort_order = cl.task_idx AND cl.task_id IS NULL;
ALTER TABLE public.cleaning_log ALTER COLUMN task_id SET NOT NULL;
ALTER TABLE public.cleaning_log DROP CONSTRAINT IF EXISTS cleaning_log_org_task_idx_weekday_occ_key;
ALTER TABLE public.cleaning_log DROP COLUMN IF EXISTS task_idx;
ALTER TABLE public.cleaning_log DROP CONSTRAINT IF EXISTS cleaning_log_org_task_weekday_occ_key;
ALTER TABLE public.cleaning_log ADD CONSTRAINT cleaning_log_org_task_weekday_occ_key UNIQUE (org_id, task_id, weekday, occurrence_date);

-- Recreate the cleaning_log INSERT policy using task_id.
CREATE POLICY "cleaning_log_org_insert" ON public.cleaning_log FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      public.is_admin(auth.uid())
      OR user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.cleaning_schedule cs
        WHERE cs.task_id = cleaning_log.task_id
          AND cs.weekday = cleaning_log.weekday
          AND cs.org_id = cleaning_log.org_id
          AND cs.user_id = auth.uid()
      )
    )
  );

-- ===== auto_mark_missed(): usa task_id/org_id em vez de task_idx =====
CREATE OR REPLACE FUNCTION public.auto_mark_missed()
  RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  stories_count int;
  cleaning_count int := 0;
  yesterday date := CURRENT_DATE - 1;
  yest_weekday int;
BEGIN
  UPDATE public.stories_schedule
     SET status = 'missed'
   WHERE day < CURRENT_DATE
     AND status = 'pending'
     AND user_id IS NOT NULL;
  GET DIAGNOSTICS stories_count = ROW_COUNT;

  IF EXTRACT(DOW FROM yesterday) BETWEEN 1 AND 6 THEN
    yest_weekday := (EXTRACT(DOW FROM yesterday)::int) - 1;
    INSERT INTO public.cleaning_log (org_id, task_id, weekday, occurrence_date, user_id, status)
    SELECT cs.org_id, cs.task_id, cs.weekday, yesterday, cs.user_id, 'missed'
      FROM public.cleaning_schedule cs
     WHERE cs.weekday = yest_weekday
       AND cs.user_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.cleaning_log cl
          WHERE cl.task_id = cs.task_id
            AND cl.weekday = cs.weekday
            AND cl.occurrence_date = yesterday
            AND cl.org_id = cs.org_id
       );
    GET DIAGNOSTICS cleaning_count = ROW_COUNT;
  END IF;

  RETURN stories_count + cleaning_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.auto_mark_missed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_mark_missed() TO service_role;

-- Esse cron job só existia manualmente no banco (nunca foi versionado) —
-- recria de forma idempotente pra ficar reproduzível daqui pra frente.
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'auto-mark-missed-daily';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule(
  'auto-mark-missed-daily',
  '10 6 * * *',
  $$SELECT public.auto_mark_missed();$$
);
