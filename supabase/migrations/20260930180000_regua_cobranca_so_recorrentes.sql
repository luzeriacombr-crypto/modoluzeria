-- Financeiro (30/09): a régua automática de cobrança ("X dias antes do
-- vencimento" e "mensalidade atrasada") cobrava TODOS os clientes com dia
-- de vencimento, inclusive Avulsos — enquanto a tela de cobrança só mostra
-- Social Media e Pack Digital. Agora a régua segue a mesma regra.
--
-- É a função que está no ar (idêntica à de 20260920120001, conferido com
-- pg_get_functiondef) com só duas mudanças: o loop de clientes lê
-- c.category, e os gatilhos de pagamento exigem categoria recorrente.
-- O gatilho "sem entregas há X dias" continua valendo pra todos.
--
-- Pra reverter (DOWN): rodar de novo o bloco
-- "CREATE OR REPLACE FUNCTION public.run_time_based_automations()" da
-- migration 20260920120001_automation_rules_v2.sql.

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
           AND status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO')
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
           AND status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO')
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
           AND status NOT IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO')
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

REVOKE ALL ON FUNCTION public.run_time_based_automations() FROM PUBLIC, anon, authenticated;
