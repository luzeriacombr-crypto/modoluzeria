-- Bug real, achado ao vivo: send_daily_digest() ainda compara
-- cl.task_idx = cs.task_idx (join da checagem de "limpeza pendente hoje"),
-- mas a coluna task_idx foi trocada por task_id lá em
-- 20260801180000_cleaning_tasks_editable_list.sql — desde então, TODA
-- execução de send_daily_digest() falhava com "column cl.task_idx does not
-- exist" (o cron silencioso, e agora também o botão "Rodar resumo diário").
-- Corpo idêntico ao de 20260827100000, só corrige esse join.
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
    SELECT COUNT(*) INTO due_today
    FROM public.content_items ci
    JOIN public.item_assignees ia ON ia.item_id = ci.id
    WHERE ia.user_id = p.user_id
      AND ci.due_date = today_date
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO')
      AND ci.deleted_at IS NULL;

    SELECT EXISTS(
      SELECT 1 FROM public.stories_schedule
      WHERE user_id = p.user_id AND day = today_date AND status = 'pending'
    ) INTO has_stories;

    has_cleaning := false;
    IF today_weekday BETWEEN 0 AND 5 THEN
      SELECT EXISTS(
        SELECT 1 FROM public.cleaning_schedule cs
        WHERE cs.user_id = p.user_id AND cs.weekday = today_weekday
          AND NOT EXISTS (
            SELECT 1 FROM public.cleaning_log cl
            WHERE cl.task_id = cs.task_id AND cl.weekday = cs.weekday AND cl.org_id = cs.org_id
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
END;
$function$;
