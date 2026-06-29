
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- ============ generate_recurring_for_month ============
CREATE OR REPLACE FUNCTION public.generate_recurring_for_month(_month_key text DEFAULT to_char(now(),'YYYY-MM'))
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl RECORD;
  m   RECORD;
  next_idx int;
  new_item_id uuid;
  created_count int := 0;
BEGIN
  FOR tpl IN
    SELECT * FROM public.recurring_templates WHERE active = true
  LOOP
    -- ensure month row
    SELECT id, key INTO m FROM public.months
      WHERE client_id = tpl.client_id AND key = _month_key;
    IF m.id IS NULL THEN
      INSERT INTO public.months (client_id, key) VALUES (tpl.client_id, _month_key)
        RETURNING id, key INTO m;
    END IF;

    -- skip if a content_item already exists for this template+month+title
    IF EXISTS (
      SELECT 1 FROM public.content_items
      WHERE month_id = m.id AND title = tpl.title AND type = tpl.type
    ) THEN CONTINUE; END IF;

    SELECT COALESCE(MAX(idx), 0) + 1 INTO next_idx
      FROM public.content_items WHERE month_id = m.id AND type = tpl.type;

    INSERT INTO public.content_items (month_id, type, idx, title, status)
    VALUES (m.id, tpl.type, next_idx, tpl.title, 'PENDENTE')
    RETURNING id INTO new_item_id;

    IF array_length(tpl.default_assignees, 1) > 0 THEN
      INSERT INTO public.item_assignees (item_id, user_id)
      SELECT new_item_id, unnest(tpl.default_assignees)
      ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.recurring_templates SET last_generated_at = now() WHERE id = tpl.id;
    created_count := created_count + 1;
  END LOOP;
  RETURN created_count;
END $$;

REVOKE EXECUTE ON FUNCTION public.generate_recurring_for_month(text) FROM PUBLIC, anon, authenticated;

-- ============ send_deadline_reminders ============
CREATE OR REPLACE FUNCTION public.send_deadline_reminders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  kind_text text;
  msg text;
  sent int := 0;
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

    -- de-dup by (item, kind, day)
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
END $$;

REVOKE EXECUTE ON FUNCTION public.send_deadline_reminders() FROM PUBLIC, anon, authenticated;

-- ============ Schedule cron jobs ============
-- Unschedule any prior runs with same name
DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname IN ('luzeria_recurring_daily','luzeria_deadline_reminders') LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Recurrences: every day at 06:00 UTC (≈03:00 BRT). Cheap idempotent call.
SELECT cron.schedule(
  'luzeria_recurring_daily',
  '0 6 * * *',
  $$SELECT public.generate_recurring_for_month();$$
);

-- Deadline reminders: every day at 12:00 UTC (≈09:00 BRT).
SELECT cron.schedule(
  'luzeria_deadline_reminders',
  '0 12 * * *',
  $$SELECT public.send_deadline_reminders();$$
);
