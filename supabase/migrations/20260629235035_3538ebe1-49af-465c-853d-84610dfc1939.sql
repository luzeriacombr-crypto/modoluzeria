
-- 1) notification_preferences
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  daily_digest boolean NOT NULL DEFAULT true,
  deadline_alerts boolean NOT NULL DEFAULT true,
  digest_hour smallint NOT NULL DEFAULT 8 CHECK (digest_hour BETWEEN 0 AND 23),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_preferences TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own prefs select" ON public.notification_preferences
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own prefs upsert" ON public.notification_preferences
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs update" ON public.notification_preferences
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own prefs delete" ON public.notification_preferences
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER np_touch_updated_at BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) Update send_deadline_reminders to respect preferences
CREATE OR REPLACE FUNCTION public.send_deadline_reminders()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec RECORD;
  kind_text text;
  msg text;
  sent int := 0;
  pref_enabled boolean;
BEGIN
  FOR rec IN
    SELECT ci.id AS item_id, ci.title, ci.due_date, ia.user_id,
           CASE
             WHEN ci.due_date < CURRENT_DATE THEN 'overdue'
             WHEN ci.due_date = CURRENT_DATE THEN 'today'
             WHEN ci.due_date = CURRENT_DATE + 1 THEN 'tomorrow'
           END AS kind
    FROM public.content_items ci
    JOIN public.item_assignees ia ON ia.item_id = ci.id
    WHERE ci.due_date IS NOT NULL
      AND ci.status <> 'FINALIZADO'
      AND ci.due_date <= CURRENT_DATE + 1
  LOOP
    kind_text := rec.kind;
    IF kind_text IS NULL THEN CONTINUE; END IF;

    SELECT COALESCE(deadline_alerts, true) INTO pref_enabled
      FROM public.notification_preferences WHERE user_id = rec.user_id;
    IF pref_enabled IS NULL THEN pref_enabled := true; END IF;
    IF NOT pref_enabled THEN CONTINUE; END IF;

    BEGIN
      INSERT INTO public.deadline_notifications_log (item_id, kind, sent_on)
      VALUES (rec.item_id, kind_text, CURRENT_DATE);
    EXCEPTION WHEN unique_violation THEN
      CONTINUE;
    END;

    msg := CASE kind_text
      WHEN 'today'    THEN '⏰ Vence hoje: "' || rec.title || '"'
      WHEN 'tomorrow' THEN '📅 Vence amanhã: "' || rec.title || '"'
      WHEN 'overdue'  THEN '🚨 Atrasado: "' || rec.title || '"'
    END;

    INSERT INTO public.notifications (user_id, type, item_id, message)
    VALUES (rec.user_id, 'deadline_' || kind_text, rec.item_id, msg);

    sent := sent + 1;
  END LOOP;
  RETURN sent;
END $function$;

-- 3) send_daily_digest
CREATE OR REPLACE FUNCTION public.send_daily_digest()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  p RECORD;
  today_date date := CURRENT_DATE;
  today_weekday int := ((EXTRACT(DOW FROM CURRENT_DATE)::int) - 1);
  due_today int;
  has_stories boolean;
  has_cleaning boolean;
  parts text[];
  msg text;
  sent int := 0;
BEGIN
  FOR p IN
    SELECT pr.id AS user_id
    FROM public.profiles pr
    WHERE pr.active = true
      AND COALESCE(
        (SELECT daily_digest FROM public.notification_preferences WHERE user_id = pr.id),
        true
      ) = true
  LOOP
    -- demandas com prazo hoje
    SELECT COUNT(*) INTO due_today
    FROM public.content_items ci
    JOIN public.item_assignees ia ON ia.item_id = ci.id
    WHERE ia.user_id = p.user_id
      AND ci.due_date = today_date
      AND ci.status <> 'FINALIZADO';

    -- stories do dia
    SELECT EXISTS(
      SELECT 1 FROM public.stories_schedule
      WHERE user_id = p.user_id AND day = today_date AND status = 'pending'
    ) INTO has_stories;

    -- limpeza do dia (Mon..Sat = 0..5)
    has_cleaning := false;
    IF today_weekday BETWEEN 0 AND 5 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.cleaning_schedule cs
        WHERE cs.user_id = p.user_id AND cs.weekday = today_weekday
          AND NOT EXISTS (
            SELECT 1 FROM public.cleaning_log cl
            WHERE cl.task_idx = cs.task_idx AND cl.weekday = cs.weekday
              AND cl.occurrence_date = today_date
          )
      ) INTO has_cleaning;
    END IF;

    IF due_today = 0 AND NOT has_stories AND NOT has_cleaning THEN
      CONTINUE;
    END IF;

    parts := ARRAY[]::text[];
    IF due_today > 0 THEN
      parts := array_append(parts, due_today || ' demanda' || (CASE WHEN due_today > 1 THEN 's' ELSE '' END) || ' p/ hoje');
    END IF;
    IF has_stories THEN parts := array_append(parts, 'Stories do dia'); END IF;
    IF has_cleaning THEN parts := array_append(parts, 'Limpeza do dia'); END IF;

    msg := '📅 Sua agenda de hoje: ' || array_to_string(parts, ' · ');

    -- de-dup: 1 digest por dia por usuário
    IF EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = p.user_id
        AND type = 'daily_digest'
        AND created_at::date = today_date
    ) THEN CONTINUE; END IF;

    INSERT INTO public.notifications (user_id, type, message)
    VALUES (p.user_id, 'daily_digest', msg);

    sent := sent + 1;
  END LOOP;
  RETURN sent;
END $function$;

REVOKE ALL ON FUNCTION public.send_daily_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_daily_digest() TO service_role;

-- 4) Schedule daily digest at 11:00 UTC (08:00 BRT)
SELECT cron.schedule(
  'luzeria_daily_digest',
  '0 11 * * *',
  $$ SELECT public.send_daily_digest(); $$
);

-- 5) Helpful index
CREATE INDEX IF NOT EXISTS idx_content_items_due_date_status
  ON public.content_items (due_date, status)
  WHERE due_date IS NOT NULL;
