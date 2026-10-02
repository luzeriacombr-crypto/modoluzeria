-- Arquivado (pedido de cliente, 02/10): itens ARQUIVADO / ARQUIVADO_FEED não geram
-- lembrete de prazo, resumo diário nem regra de automação por tempo parado.
-- Só acrescenta os dois status às listas "não está pronto/finalizado/concluído"
-- das 3 funções (definições copiadas do banco no momento da migração).
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
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'CONCLUIDO', 'FINALIZADO', 'ARQUIVADO', 'ARQUIVADO_FEED')
      AND ci.due_date <= CURRENT_DATE + 1
      AND ci.deleted_at IS NULL
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
      AND ci.status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'ARQUIVADO', 'ARQUIVADO_FEED')
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

CREATE OR REPLACE FUNCTION public.run_time_based_automations()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rule public.automation_rules;
  item_rec record;
  client_rec record;
  v_due date;
  v_last_done timestamptz;
  v_period text := to_char(CURRENT_DATE, 'YYYY-MM');
BEGIN
  FOR rule IN
    SELECT * FROM public.automation_rules
     WHERE active AND trigger_type IN ('deadline_days_before', 'deadline_overdue', 'stale_days')
  LOOP
    IF rule.trigger_type = 'deadline_days_before' THEN
      FOR item_rec IN
        SELECT id FROM public.content_items
         WHERE org_id = rule.org_id
           AND due_date = CURRENT_DATE + COALESCE(rule.trigger_days, 1)
           AND status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO', 'ARQUIVADO', 'ARQUIVADO_FEED')
      LOOP
        BEGIN
          INSERT INTO public.automation_rule_fires (rule_id, item_id) VALUES (rule.id, item_rec.id);
          PERFORM public.apply_automation_action(rule, item_rec.id);
        EXCEPTION WHEN unique_violation THEN
        END;
      END LOOP;

    ELSIF rule.trigger_type = 'deadline_overdue' THEN
      FOR item_rec IN
        SELECT id FROM public.content_items
         WHERE org_id = rule.org_id
           AND due_date < CURRENT_DATE
           AND status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO', 'ARQUIVADO', 'ARQUIVADO_FEED')
      LOOP
        BEGIN
          INSERT INTO public.automation_rule_fires (rule_id, item_id) VALUES (rule.id, item_rec.id);
          PERFORM public.apply_automation_action(rule, item_rec.id);
        EXCEPTION WHEN unique_violation THEN
        END;
      END LOOP;

    ELSIF rule.trigger_type = 'stale_days' THEN
      FOR item_rec IN
        SELECT id FROM public.content_items
         WHERE org_id = rule.org_id
           AND last_status_change_at <= now() - (COALESCE(rule.trigger_days, 3) || ' days')::interval
           AND status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO', 'ARQUIVADO', 'ARQUIVADO_FEED')
           AND (rule.trigger_status IS NULL OR status = rule.trigger_status)
      LOOP
        BEGIN
          INSERT INTO public.automation_rule_fires (rule_id, item_id) VALUES (rule.id, item_rec.id);
          PERFORM public.apply_automation_action(rule, item_rec.id);
        EXCEPTION WHEN unique_violation THEN
        END;
      END LOOP;
    END IF;
  END LOOP;

  -- Gatilhos por cliente. Dedupe por janela no log (não por dia): "sem
  -- entrega" repete no máximo 1x/semana; cobrança 1x por mês.
  FOR rule IN
    SELECT * FROM public.automation_rules
     WHERE active AND trigger_type IN ('client_no_post_days', 'payment_days_before', 'payment_overdue')
  LOOP
    FOR client_rec IN
      SELECT c.id, c.name, c.payment_due_day, c.created_at, c.category FROM public.clients c
       WHERE c.org_id = rule.org_id AND NOT c.archived AND c.category <> 'Ex-clientes'
         AND (rule.filter_client_id IS NULL OR c.id = rule.filter_client_id)
    LOOP
      IF rule.trigger_type = 'client_no_post_days' THEN
        SELECT COALESCE(MAX(ci.last_status_change_at), client_rec.created_at) INTO v_last_done
          FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
         WHERE m.client_id = client_rec.id
           AND ci.status IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO')
           AND ci.type IN ('post', 'reel', 'story');
        IF v_last_done <= now() - (COALESCE(rule.trigger_days, 15) || ' days')::interval
           AND NOT EXISTS (SELECT 1 FROM public.automation_rule_log l WHERE l.rule_id = rule.id AND l.client_id = client_rec.id AND l.fired_at > now() - interval '7 days') THEN
          PERFORM public.apply_automation_action_v2(rule, NULL, client_rec.id, 'sem entregas há ' || COALESCE(rule.trigger_days, 15) || ' dias', NULL, NULL);
        END IF;

      ELSIF client_rec.payment_due_day IS NOT NULL
        -- Só mensalidade recorrente, igual à tela de cobrança do Financeiro
        -- (listClientPayments): Avulsos e categorias customizadas não são
        -- cobrança mensal e não devem receber lembrete de pagamento.
        AND client_rec.category IN ('Social Media', 'Pack Digital')
        AND NOT EXISTS (SELECT 1 FROM public.client_payments p WHERE p.client_id = client_rec.id AND p.period = v_period) THEN
        v_due := make_date(
          extract(year FROM CURRENT_DATE)::int, extract(month FROM CURRENT_DATE)::int,
          LEAST(client_rec.payment_due_day, extract(day FROM (date_trunc('month', CURRENT_DATE) + interval '1 month' - interval '1 day'))::int));
        IF (rule.trigger_type = 'payment_days_before' AND v_due - CURRENT_DATE = COALESCE(rule.trigger_days, 3)
            AND NOT EXISTS (SELECT 1 FROM public.automation_rule_log l WHERE l.rule_id = rule.id AND l.client_id = client_rec.id AND l.fired_at > now() - interval '20 days'))
        OR (rule.trigger_type = 'payment_overdue' AND CURRENT_DATE > v_due
            AND NOT EXISTS (SELECT 1 FROM public.automation_rule_log l WHERE l.rule_id = rule.id AND l.client_id = client_rec.id AND l.fired_at > now() - interval '25 days')) THEN
          PERFORM public.apply_automation_action_v2(rule, NULL, client_rec.id, 'mensalidade de ' || v_period, NULL, NULL);
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  DELETE FROM public.automation_rule_log WHERE fired_at < now() - interval '120 days';
  DELETE FROM public.automation_email_queue WHERE sent_at IS NOT NULL AND sent_at < now() - interval '30 days';
END;
$function$;
