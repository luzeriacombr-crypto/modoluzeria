-- send_deadline_reminders() only treated content_items.status = 'PRONTO_PARA_PUBLICAR'
-- as "done". Activity items (gravação/roteiro/sistema/outros) use a separate
-- PENDENTE/CONCLUIDO pipeline, so a completed activity past its due date kept
-- getting a fresh "Atrasado" notification every day.
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
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO')
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
END;
$function$;
