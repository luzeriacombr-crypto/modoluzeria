
-- Stories: add status tracking columns
ALTER TABLE public.stories_schedule
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','missed')),
  ADD COLUMN IF NOT EXISTS done_at timestamptz,
  ADD COLUMN IF NOT EXISTS done_by uuid;

-- Cleaning log table (per occurrence)
CREATE TABLE IF NOT EXISTS public.cleaning_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_idx int NOT NULL,
  weekday int NOT NULL,
  occurrence_date date NOT NULL,
  user_id uuid,
  status text NOT NULL CHECK (status IN ('done','missed')),
  done_at timestamptz,
  done_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_idx, weekday, occurrence_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaning_log TO authenticated;
GRANT ALL ON public.cleaning_log TO service_role;

ALTER TABLE public.cleaning_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cleaning_log_select_auth" ON public.cleaning_log
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cleaning_log_insert_responsible_or_admin" ON public.cleaning_log
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin(auth.uid())
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.cleaning_schedule cs
      WHERE cs.task_idx = cleaning_log.task_idx
        AND cs.weekday = cleaning_log.weekday
        AND cs.user_id = auth.uid()
    )
  );

CREATE POLICY "cleaning_log_update_responsible_or_admin" ON public.cleaning_log
  FOR UPDATE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR user_id = auth.uid()
    OR done_by = auth.uid()
  );

CREATE POLICY "cleaning_log_delete_responsible_or_admin" ON public.cleaning_log
  FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR user_id = auth.uid()
    OR done_by = auth.uid()
  );

CREATE TRIGGER trg_cleaning_log_updated_at
  BEFORE UPDATE ON public.cleaning_log
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Auto-mark "missed" function
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
  -- Stories: mark any past 'pending' day with a responsible as missed
  UPDATE public.stories_schedule
     SET status = 'missed'
   WHERE day < CURRENT_DATE
     AND status = 'pending'
     AND user_id IS NOT NULL;
  GET DIAGNOSTICS stories_count = ROW_COUNT;

  -- Cleaning: yesterday only. Weekday convention here is Mon..Sat = 0..5
  -- Postgres DOW: 0=Sun..6=Sat. Map Mon..Sat => 0..5; skip Sunday.
  IF EXTRACT(DOW FROM yesterday) BETWEEN 1 AND 6 THEN
    yest_weekday := (EXTRACT(DOW FROM yesterday)::int) - 1;
    INSERT INTO public.cleaning_log (task_idx, weekday, occurrence_date, user_id, status)
    SELECT cs.task_idx, cs.weekday, yesterday, cs.user_id, 'missed'
      FROM public.cleaning_schedule cs
     WHERE cs.weekday = yest_weekday
       AND cs.user_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.cleaning_log cl
          WHERE cl.task_idx = cs.task_idx
            AND cl.weekday = cs.weekday
            AND cl.occurrence_date = yesterday
       );
    GET DIAGNOSTICS cleaning_count = ROW_COUNT;
  END IF;

  RETURN stories_count + cleaning_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.auto_mark_missed() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_mark_missed() TO service_role;
