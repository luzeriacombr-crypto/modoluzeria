-- Automações v2: mais gatilhos (falha de publicação no Instagram, roteiro
-- aprovado/ajuste, seleção de fotos finalizada, contrato assinado, cliente
-- sem entrega, cobrança a vencer/vencida), mais ações (criar tarefa,
-- comentar, mover pro próximo mês, e-mail), filtro por cliente/tipo de
-- conteúdo, log de disparos e fila de e-mails.
-- Também corrige o whatsapp_link (usava clients.phone, coluna que não
-- existe — telefone mora em client_contacts).

-- ===================== 1. automation_rules =====================

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check CHECK (
  trigger_type IN (
    'on_create', 'status_change', 'deadline_days_before', 'deadline_overdue',
    'stale_days', 'feed_approved', 'feed_feedback', 'file_attached',
    'ig_publish_failed', 'roteiro_approved', 'roteiro_adjust',
    'photo_selection_done', 'contract_signed',
    'client_no_post_days', 'payment_days_before', 'payment_overdue'
  )
);
ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_action_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_action_type_check CHECK (
  action_type IN (
    'set_status', 'assign_member', 'notify', 'whatsapp_link', 'schedule_instagram',
    'create_item', 'add_comment', 'move_next_month', 'send_email'
  )
);

ALTER TABLE public.automation_rules
  ADD COLUMN IF NOT EXISTS filter_client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS filter_content_type text,
  ADD COLUMN IF NOT EXISTS action_audience text,
  ADD COLUMN IF NOT EXISTS action_subject text;

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_filter_content_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_filter_content_type_check
  CHECK (filter_content_type IS NULL OR filter_content_type IN ('post', 'reel', 'story'));
ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_action_audience_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_action_audience_check
  CHECK (action_audience IS NULL OR action_audience IN ('team', 'client'));

-- ===================== 2. Log de disparos =====================

CREATE TABLE IF NOT EXISTS public.automation_rule_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  org_id uuid NOT NULL,
  item_id uuid,
  client_id uuid,
  fired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_rule_log_rule ON public.automation_rule_log(rule_id, fired_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_rule_log_org ON public.automation_rule_log(org_id, fired_at DESC);
GRANT SELECT ON public.automation_rule_log TO authenticated;
GRANT ALL ON public.automation_rule_log TO service_role;
ALTER TABLE public.automation_rule_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin reads own automation log" ON public.automation_rule_log;
CREATE POLICY "admin reads own automation log" ON public.automation_rule_log FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ===================== 3. Fila de e-mails =====================
-- A ação "enviar e-mail" só enfileira aqui; quem envia de verdade é a rota
-- /api/cron/send-automation-emails (Resend), igual aos outros crons.

CREATE TABLE IF NOT EXISTS public.automation_email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL,
  rule_id uuid REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  to_email text NOT NULL,
  from_name text,
  subject text NOT NULL,
  body text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_automation_email_queue_pending ON public.automation_email_queue(created_at) WHERE sent_at IS NULL;
GRANT ALL ON public.automation_email_queue TO service_role;
ALTER TABLE public.automation_email_queue ENABLE ROW LEVEL SECURITY;

-- ===================== 4. Helpers =====================

CREATE OR REPLACE FUNCTION public.automation_log(_rule public.automation_rules, _item_id uuid, _client_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.automation_rule_log (rule_id, org_id, item_id, client_id)
  VALUES (_rule.id, _rule.org_id, _item_id, _client_id);
$$;
REVOKE ALL ON FUNCTION public.automation_log(public.automation_rules, uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.automation_filter_ok(_rule public.automation_rules, _client_id uuid, _type text)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (_rule.filter_client_id IS NULL OR _rule.filter_client_id IS NOT DISTINCT FROM _client_id)
     AND (_rule.filter_content_type IS NULL OR _type IS NULL OR _rule.filter_content_type = _type);
$$;

-- Quem recebe notificação/e-mail de equipe: a pessoa escolhida na regra;
-- senão os responsáveis do item; senão os masters da agência.
CREATE OR REPLACE FUNCTION public.automation_recipients(_rule public.automation_rules, _item_id uuid)
RETURNS SETOF uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF _rule.action_user_id IS NOT NULL THEN
    RETURN NEXT _rule.action_user_id;
    RETURN;
  END IF;
  IF _item_id IS NOT NULL THEN
    RETURN QUERY SELECT ia.user_id FROM public.item_assignees ia WHERE ia.item_id = _item_id;
    IF FOUND THEN RETURN; END IF;
  END IF;
  RETURN QUERY
    SELECT p.id FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'master'
    WHERE p.org_id = _rule.org_id AND p.active;
END;
$$;
REVOKE ALL ON FUNCTION public.automation_recipients(public.automation_rules, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.automation_client_phone(_client_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT cc.phone FROM public.client_contacts cc
  WHERE cc.client_id = _client_id AND btrim(cc.phone) <> ''
  ORDER BY cc.position LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.automation_client_phone(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.automation_render(_msg text, _client text, _title text, _extra text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT replace(replace(replace(_msg, '{cliente}', COALESCE(_client, '')), '{titulo}', COALESCE(_title, '')), '{erro}', COALESCE(_extra, ''));
$$;

-- Próximo mês do mesmo cliente (cria se não existir) + próximo idx livre
-- pro tipo — usado tanto pelos triggers BEFORE (que mutam NEW) quanto pela
-- ação chamada de fora.
CREATE OR REPLACE FUNCTION public.automation_next_month_slot(_month_id uuid, _type text, OUT next_month_id uuid, OUT next_idx integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  m record;
  v_key text;
BEGIN
  SELECT client_id, key, org_id INTO m FROM public.months WHERE id = _month_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_key := to_char((m.key || '-01')::date + interval '1 month', 'YYYY-MM');
  INSERT INTO public.months (client_id, key, org_id) VALUES (m.client_id, v_key, m.org_id)
    ON CONFLICT (client_id, key) DO NOTHING;
  SELECT id INTO next_month_id FROM public.months WHERE client_id = m.client_id AND key = v_key;
  SELECT COALESCE(MAX(idx), 0) + 1 INTO next_idx FROM public.content_items
   WHERE month_id = next_month_id AND type::text = _type;
END;
$$;
REVOKE ALL ON FUNCTION public.automation_next_month_slot(uuid, text) FROM PUBLIC, anon, authenticated;

-- ===================== 5. Ação (v2) =====================

CREATE OR REPLACE FUNCTION public.apply_automation_action_v2(
  _rule public.automation_rules, _item_id uuid, _client_id uuid,
  _subject text DEFAULT NULL, _type text DEFAULT NULL, _extra text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_client_id uuid := _client_id;
  v_client_name text;
  v_title text := _subject;
  v_type text := _type;
  v_month_id uuid;
  v_msg text;
  v_uid uuid;
  v_phone text;
  v_slot record;
  v_mid uuid;
  v_idx integer;
  v_new_id uuid;
  v_email text;
  v_org_name text;
  v_subject text;
BEGIN
  IF _item_id IS NOT NULL THEN
    SELECT ci.title, ci.type::text, ci.month_id, m.client_id
      INTO v_title, v_type, v_month_id, v_client_id
    FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
    WHERE ci.id = _item_id;
    IF NOT FOUND THEN
      v_title := _subject; v_type := _type; v_client_id := _client_id;
    END IF;
  END IF;

  IF NOT public.automation_filter_ok(_rule, v_client_id, v_type) THEN RETURN; END IF;

  IF v_client_id IS NOT NULL THEN
    SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;
  END IF;

  IF _rule.action_type = 'set_status' THEN
    IF _item_id IS NULL THEN RETURN; END IF;
    UPDATE public.content_items SET status = _rule.action_status WHERE id = _item_id;

  ELSIF _rule.action_type = 'assign_member' THEN
    IF _item_id IS NULL THEN RETURN; END IF;
    INSERT INTO public.item_assignees (item_id, user_id) VALUES (_item_id, _rule.action_user_id)
      ON CONFLICT DO NOTHING;

  ELSIF _rule.action_type = 'schedule_instagram' THEN
    IF _item_id IS NULL THEN RETURN; END IF;
    UPDATE public.content_items SET ig_auto_publish = true
     WHERE id = _item_id AND scheduled_at IS NOT NULL AND type IN ('post', 'reel', 'story');

  ELSIF _rule.action_type = 'notify' THEN
    v_msg := public.automation_render(
      COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Automação: ' || COALESCE(NULLIF(v_title, ''), NULLIF(v_client_name, ''), 'um evento')),
      v_client_name, v_title, _extra);
    FOR v_uid IN SELECT public.automation_recipients(_rule, _item_id) LOOP
      INSERT INTO public.notifications (user_id, type, item_id, client_id, message)
      VALUES (v_uid, 'automation_notify', _item_id, v_client_id, v_msg);
    END LOOP;

  ELSIF _rule.action_type = 'whatsapp_link' THEN
    v_phone := public.automation_client_phone(v_client_id);
    v_msg := public.automation_render(
      COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Oi {cliente}! Sobre "{titulo}"...'),
      v_client_name, v_title, _extra);
    FOR v_uid IN SELECT public.automation_recipients(_rule, _item_id) LOOP
      IF v_phone IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, type, item_id, client_id, message, whatsapp_phone)
        VALUES (v_uid, 'automation_whatsapp_ready', _item_id, v_client_id, v_msg, v_phone);
      ELSE
        INSERT INTO public.notifications (user_id, type, item_id, client_id, message)
        VALUES (v_uid, 'automation_notify', _item_id, v_client_id,
          v_msg || ' (sem telefone cadastrado pra ' || COALESCE(v_client_name, 'esse cliente') || ' — cadastre um contato na Ficha do Cliente)');
      END IF;
    END LOOP;

  ELSIF _rule.action_type = 'create_item' THEN
    -- Trava de loop: um item criado por automação não dispara outra criação em cascata.
    IF pg_trigger_depth() > 3 OR v_client_id IS NULL THEN RETURN; END IF;
    SELECT COALESCE(c.active_month_id, (SELECT m.id FROM public.months m WHERE m.client_id = c.id ORDER BY m.key DESC LIMIT 1))
      INTO v_mid FROM public.clients c WHERE c.id = v_client_id;
    IF v_mid IS NULL THEN RETURN; END IF;
    SELECT COALESCE(MAX(idx), 0) + 1 INTO v_idx FROM public.content_items WHERE month_id = v_mid AND type = 'outros';
    v_msg := left(public.automation_render(
      COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Tarefa automática — {cliente}'),
      v_client_name, v_title, _extra), 200);
    INSERT INTO public.content_items (month_id, type, idx, title, status, org_id)
    VALUES (v_mid, 'outros', v_idx, v_msg, 'PENDENTE', _rule.org_id)
    RETURNING id INTO v_new_id;
    IF _rule.action_user_id IS NOT NULL THEN
      INSERT INTO public.item_assignees (item_id, user_id) VALUES (v_new_id, _rule.action_user_id)
        ON CONFLICT DO NOTHING;
    END IF;

  ELSIF _rule.action_type = 'add_comment' THEN
    IF _item_id IS NULL THEN RETURN; END IF;
    v_msg := public.automation_render(
      COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Automação executada.'),
      v_client_name, v_title, _extra);
    INSERT INTO public.comments (item_id, author_id, text, is_system) VALUES (_item_id, NULL, v_msg, true);

  ELSIF _rule.action_type = 'move_next_month' THEN
    IF _item_id IS NULL OR v_month_id IS NULL THEN RETURN; END IF;
    SELECT * INTO v_slot FROM public.automation_next_month_slot(v_month_id, v_type);
    IF v_slot.next_month_id IS NULL THEN RETURN; END IF;
    UPDATE public.content_items SET month_id = v_slot.next_month_id, idx = v_slot.next_idx WHERE id = _item_id;

  ELSIF _rule.action_type = 'send_email' THEN
    SELECT name INTO v_org_name FROM public.orgs WHERE id = _rule.org_id;
    v_msg := public.automation_render(
      COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Atualização sobre "{titulo}".'),
      v_client_name, v_title, _extra);
    v_subject := left(public.automation_render(
      COALESCE(NULLIF(btrim(_rule.action_subject), ''), 'Atualização — {cliente}'),
      v_client_name, v_title, _extra), 150);
    IF _rule.action_audience = 'client' THEN
      IF v_client_id IS NULL THEN RETURN; END IF;
      FOR v_email IN SELECT DISTINCT lower(btrim(cc.email)) FROM public.client_contacts cc
        WHERE cc.client_id = v_client_id AND btrim(cc.email) <> '' LOOP
        INSERT INTO public.automation_email_queue (org_id, rule_id, to_email, from_name, subject, body)
        VALUES (_rule.org_id, _rule.id, v_email, v_org_name, v_subject, v_msg);
      END LOOP;
    ELSE
      FOR v_uid IN SELECT public.automation_recipients(_rule, _item_id) LOOP
        SELECT p.email INTO v_email FROM public.profiles p WHERE p.id = v_uid;
        IF v_email IS NOT NULL THEN
          INSERT INTO public.automation_email_queue (org_id, rule_id, to_email, from_name, subject, body)
          VALUES (_rule.org_id, _rule.id, v_email, v_org_name, v_subject, v_msg);
        END IF;
      END LOOP;
    END IF;
  END IF;

  PERFORM public.automation_log(_rule, _item_id, v_client_id);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_automation_action_v2(public.automation_rules, uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- A função antiga vira wrapper (feed_approved / feed_feedback / file_attached
-- e os gatilhos por tempo de item continuam chamando com a mesma assinatura).
CREATE OR REPLACE FUNCTION public.apply_automation_action(_rule public.automation_rules, _item_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM public.apply_automation_action_v2(_rule, _item_id, NULL, NULL, NULL, NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.apply_automation_action(public.automation_rules, uuid) FROM PUBLIC, anon, authenticated;

-- ===================== 6. Triggers nativos de content_items =====================

CREATE OR REPLACE FUNCTION public.run_automation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule public.automation_rules;
  v_client uuid;
  v_slot record;
BEGIN
  IF pg_trigger_depth() > 6 THEN RETURN NEW; END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT client_id INTO v_client FROM public.months WHERE id = NEW.month_id;
    FOR rule IN
      SELECT * FROM public.automation_rules
       WHERE org_id = NEW.org_id AND active AND trigger_type = 'status_change' AND trigger_status = NEW.status
    LOOP
      CONTINUE WHEN NOT public.automation_filter_ok(rule, v_client, NEW.type::text);
      IF rule.action_type = 'set_status' THEN
        NEW.status := rule.action_status;
        PERFORM public.automation_log(rule, NEW.id, v_client);
      ELSIF rule.action_type = 'assign_member' THEN
        INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, rule.action_user_id)
          ON CONFLICT DO NOTHING;
        PERFORM public.automation_log(rule, NEW.id, v_client);
      ELSIF rule.action_type = 'schedule_instagram' THEN
        IF NEW.scheduled_at IS NOT NULL AND NEW.type IN ('post', 'reel', 'story') THEN
          NEW.ig_auto_publish := true;
          PERFORM public.automation_log(rule, NEW.id, v_client);
        END IF;
      ELSIF rule.action_type = 'move_next_month' THEN
        SELECT * INTO v_slot FROM public.automation_next_month_slot(NEW.month_id, NEW.type::text);
        IF v_slot.next_month_id IS NOT NULL THEN
          NEW.month_id := v_slot.next_month_id;
          NEW.idx := v_slot.next_idx;
          PERFORM public.automation_log(rule, NEW.id, v_client);
        END IF;
      ELSE
        PERFORM public.apply_automation_action_v2(rule, NEW.id, v_client, NEW.title, NEW.type::text, NULL);
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_automation_rules_on_create()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule public.automation_rules;
  v_org_id uuid := NEW.org_id;
  v_client uuid;
  v_slot record;
BEGIN
  -- Item criado por outra automação (create_item) não dispara "quando for criado".
  IF pg_trigger_depth() > 1 THEN RETURN NEW; END IF;

  SELECT m.client_id, COALESCE(v_org_id, m.org_id) INTO v_client, v_org_id FROM public.months m WHERE m.id = NEW.month_id;

  FOR rule IN
    SELECT * FROM public.automation_rules
     WHERE org_id = v_org_id AND active AND trigger_type = 'on_create'
  LOOP
    CONTINUE WHEN NOT public.automation_filter_ok(rule, v_client, NEW.type::text);
    IF rule.action_type = 'set_status' THEN
      NEW.status := rule.action_status;
      PERFORM public.automation_log(rule, NEW.id, v_client);
    ELSIF rule.action_type = 'assign_member' THEN
      INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, rule.action_user_id)
        ON CONFLICT DO NOTHING;
      PERFORM public.automation_log(rule, NEW.id, v_client);
    ELSIF rule.action_type = 'schedule_instagram' THEN
      IF NEW.scheduled_at IS NOT NULL AND NEW.type IN ('post', 'reel', 'story') THEN
        NEW.ig_auto_publish := true;
        PERFORM public.automation_log(rule, NEW.id, v_client);
      END IF;
    ELSIF rule.action_type = 'move_next_month' THEN
      SELECT * INTO v_slot FROM public.automation_next_month_slot(NEW.month_id, NEW.type::text);
      IF v_slot.next_month_id IS NOT NULL THEN
        NEW.month_id := v_slot.next_month_id;
        NEW.idx := v_slot.next_idx;
        PERFORM public.automation_log(rule, NEW.id, v_client);
      END IF;
    ELSE
      PERFORM public.apply_automation_action_v2(rule, NEW.id, v_client, NEW.title, NEW.type::text, NULL);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ===================== 7. Gatilho: falha ao publicar no Instagram =====================

CREATE OR REPLACE FUNCTION public.run_automation_rules_ig_failed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
  v_client uuid;
BEGIN
  IF pg_trigger_depth() > 6 THEN RETURN NEW; END IF;
  SELECT client_id INTO v_client FROM public.months WHERE id = NEW.month_id;
  FOR rule IN
    SELECT * FROM public.automation_rules WHERE org_id = NEW.org_id AND active AND trigger_type = 'ig_publish_failed'
  LOOP
    PERFORM public.apply_automation_action_v2(rule, NEW.id, v_client, NEW.title, NEW.type::text, left(NEW.ig_last_error, 300));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_run_automation_rules_ig_failed ON public.content_items;
CREATE TRIGGER trg_run_automation_rules_ig_failed
  AFTER UPDATE OF ig_last_error ON public.content_items
  FOR EACH ROW
  WHEN (NEW.ig_last_error IS NOT NULL AND NEW.ig_last_error IS DISTINCT FROM OLD.ig_last_error)
  EXECUTE FUNCTION public.run_automation_rules_ig_failed();

-- ===================== 8. Gatilho: cliente aprovou / pediu ajuste num roteiro =====================

CREATE OR REPLACE FUNCTION public.run_automation_rules_roteiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
  v_client uuid;
  v_trigger text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.client_status IS NOT DISTINCT FROM NEW.client_status THEN RETURN NEW; END IF;
  v_trigger := CASE NEW.client_status WHEN 'aprovado' THEN 'roteiro_approved' WHEN 'ajustar' THEN 'roteiro_adjust' ELSE NULL END;
  IF v_trigger IS NULL THEN RETURN NEW; END IF;
  SELECT client_id INTO v_client FROM public.client_docs WHERE id = NEW.doc_id;
  FOR rule IN
    SELECT * FROM public.automation_rules WHERE org_id = NEW.org_id AND active AND trigger_type = v_trigger
  LOOP
    PERFORM public.apply_automation_action_v2(rule, NULL, v_client, NEW.roteiro_title, NULL, NEW.client_note);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_run_automation_rules_roteiro ON public.client_doc_roteiro_status;
CREATE TRIGGER trg_run_automation_rules_roteiro
  AFTER INSERT OR UPDATE OF client_status ON public.client_doc_roteiro_status
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_roteiro();

-- ===================== 9. Gatilho: seleção de fotos finalizada =====================

CREATE OR REPLACE FUNCTION public.run_automation_rules_photo_selection()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
  sel record;
BEGIN
  SELECT org_id, title INTO sel FROM public.photo_selections WHERE id = NEW.selection_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  FOR rule IN
    SELECT * FROM public.automation_rules WHERE org_id = sel.org_id AND active AND trigger_type = 'photo_selection_done'
  LOOP
    PERFORM public.apply_automation_action_v2(rule, NULL, NULL, sel.title || ' (' || NEW.respondent_name || ')', NULL, NULL);
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_run_automation_rules_photo_selection ON public.photo_selection_submissions;
CREATE TRIGGER trg_run_automation_rules_photo_selection
  AFTER INSERT ON public.photo_selection_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_photo_selection();

-- ===================== 10. Gatilho: contrato assinado =====================

CREATE OR REPLACE FUNCTION public.run_automation_rules_contract_signed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
BEGIN
  IF NEW.status = 'assinado' AND OLD.status IS DISTINCT FROM 'assinado' THEN
    FOR rule IN
      SELECT * FROM public.automation_rules WHERE org_id = NEW.org_id AND active AND trigger_type = 'contract_signed'
    LOOP
      PERFORM public.apply_automation_action_v2(rule, NULL, NEW.client_id, NEW.signer_name, NULL, NULL);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_run_automation_rules_contract_signed ON public.client_contract_requests;
CREATE TRIGGER trg_run_automation_rules_contract_signed
  AFTER UPDATE OF status ON public.client_contract_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_contract_signed();

-- ===================== 11. Cron diário: por tempo (item + cliente) =====================
-- Mesma função já agendada (luzeria_time_based_automations, 12:30 UTC) —
-- só ganha "parado N dias EM um status", gatilhos por cliente e limpeza do log.

CREATE OR REPLACE FUNCTION public.run_time_based_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
      SELECT c.id, c.name, c.payment_due_day, c.created_at FROM public.clients c
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
$$;
REVOKE ALL ON FUNCTION public.run_time_based_automations() FROM PUBLIC, anon, authenticated;

-- ===================== 12. Gatilhos antigos: variável de loop tipada =====================
-- `rule record` genérico não converte pra automation_rules ao chamar
-- apply_automation_action ("cannot cast type record to automation_rules").
-- Mesmos corpos de 20260919010000, só com a variável tipada.

CREATE OR REPLACE FUNCTION public.run_automation_rules_feed_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
  item_rec record;
  v_org_id uuid := NEW.org_id;
BEGIN
  IF NEW.client_approved_at IS NOT NULL AND OLD.client_approved_at IS NULL THEN
    IF v_org_id IS NULL THEN
      SELECT org_id INTO v_org_id FROM public.clients WHERE id = NEW.client_id;
    END IF;
    FOR rule IN
      SELECT * FROM public.automation_rules
       WHERE org_id = v_org_id AND active AND trigger_type = 'feed_approved'
    LOOP
      FOR item_rec IN
        SELECT id FROM public.content_items WHERE month_id = NEW.id AND status = 'REVISAO_CLIENTE'
      LOOP
        PERFORM public.apply_automation_action(rule, item_rec.id);
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_automation_rules_feed_feedback()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
  v_org_id uuid;
BEGIN
  IF NEW.kind = 'comment' THEN
    SELECT ci.org_id INTO v_org_id FROM public.content_items ci WHERE ci.id = NEW.item_id;
    IF v_org_id IS NULL THEN
      SELECT m.org_id INTO v_org_id
      FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = NEW.item_id;
    END IF;
    FOR rule IN
      SELECT * FROM public.automation_rules
       WHERE org_id = v_org_id AND active AND trigger_type = 'feed_feedback'
    LOOP
      PERFORM public.apply_automation_action(rule, NEW.item_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_automation_rules_file_attached()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  rule public.automation_rules;
  v_org_id uuid;
BEGIN
  IF NEW.kind = 'media' THEN
    SELECT ci.org_id INTO v_org_id FROM public.content_items ci WHERE ci.id = NEW.item_id;
    IF v_org_id IS NULL THEN
      SELECT m.org_id INTO v_org_id
      FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = NEW.item_id;
    END IF;
    FOR rule IN
      SELECT * FROM public.automation_rules
       WHERE org_id = v_org_id AND active AND trigger_type = 'file_attached'
    LOOP
      PERFORM public.apply_automation_action(rule, NEW.item_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
