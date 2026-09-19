-- Expande o motor de Automações: de 2 gatilhos/2 ações fixos pra um
-- catálogo maior, generalizando o schema (trigger_type/action_type em vez
-- de colunas boolean+enum dedicadas) e adicionando gatilhos que não são
-- eventos na própria content_items (aprovação de feed, comentário do
-- cliente, arquivo anexado) e gatilhos baseados em tempo (prazo, item
-- parado) via um cron novo, seguindo o mesmo padrão de
-- send_deadline_reminders (pg_cron nativo + tabela de dedupe por dia).

-- ===================== 1. Schema de automation_rules =====================

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_check;
DROP INDEX IF EXISTS public.idx_automation_rules_org_oncreate;
DROP INDEX IF EXISTS public.idx_automation_rules_org_trigger;

ALTER TABLE public.automation_rules ADD COLUMN trigger_type text;
UPDATE public.automation_rules SET trigger_type = CASE WHEN on_create THEN 'on_create' ELSE 'status_change' END;
ALTER TABLE public.automation_rules ALTER COLUMN trigger_type SET NOT NULL;
ALTER TABLE public.automation_rules DROP COLUMN on_create;

ALTER TABLE public.automation_rules ADD COLUMN trigger_days integer;
ALTER TABLE public.automation_rules ADD COLUMN action_message text;

ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check CHECK (
  trigger_type IN (
    'on_create', 'status_change', 'deadline_days_before', 'deadline_overdue',
    'stale_days', 'feed_approved', 'feed_feedback', 'file_attached'
  )
);
ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_action_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_action_type_check CHECK (
  action_type IN ('set_status', 'assign_member', 'notify', 'whatsapp_link', 'schedule_instagram')
);

CREATE INDEX idx_automation_rules_org_trigger_type ON public.automation_rules(org_id, trigger_type) WHERE active;

-- ===================== 2. client_feedback ganha `kind` =====================

ALTER TABLE public.client_feedback ADD COLUMN kind text NOT NULL DEFAULT 'comment' CHECK (kind IN ('comment', 'approval'));
UPDATE public.client_feedback SET kind = 'approval' WHERE text = '✅ APROVADO';

-- ===================== 3. notifications ganha whatsapp_phone =====================
-- Quando a ação é "link de WhatsApp pronto", a notificação já carrega o
-- texto (em `message`) e o telefone — o front monta o link wa.me na hora
-- de abrir (mesmo helper `waLink` que Pagamentos já usa), sem precisar de
-- nenhuma API de envio.

ALTER TABLE public.notifications ADD COLUMN whatsapp_phone text;

-- ===================== 4. Log de disparo (dedupe pros gatilhos por tempo) =====================

CREATE TABLE public.automation_rule_fires (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.automation_rules(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  fired_on date NOT NULL DEFAULT CURRENT_DATE,
  UNIQUE (rule_id, item_id, fired_on)
);
GRANT ALL ON public.automation_rule_fires TO service_role;
ALTER TABLE public.automation_rule_fires ENABLE ROW LEVEL SECURITY;

-- ===================== 5. add_public_feedback grava `kind` de verdade =====================
-- Corpo idêntico ao de 20260812010000, só acrescenta o kind (aprovação
-- continua entrando com o texto "✅ APROVADO" vindo de approvePublicItem,
-- sem mudar nenhum código do lado do app — só passa a também gravar o
-- kind certo, que é o que os novos gatilhos de automação usam).
CREATE OR REPLACE FUNCTION public.add_public_feedback(_token text, _item_id uuid, _author_name text, _text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_month_id uuid;
  v_item_month_id uuid;
  v_row public.client_feedback%ROWTYPE;
  v_author text := btrim(_author_name);
  v_text text := btrim(_text);
  v_kind text := CASE WHEN btrim(_text) = '✅ APROVADO' THEN 'approval' ELSE 'comment' END;
BEGIN
  IF v_author IS NULL OR length(v_author) = 0 OR length(v_author) > 60 THEN RETURN NULL; END IF;
  IF v_text IS NULL OR length(v_text) = 0 OR length(v_text) > 1000 THEN RETURN NULL; END IF;

  SELECT client_id INTO v_client_id
  FROM public.feed_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT active_month_id INTO v_month_id FROM public.clients WHERE id = v_client_id;
  IF v_month_id IS NULL THEN
    SELECT id INTO v_month_id FROM public.months WHERE client_id = v_client_id ORDER BY key DESC LIMIT 1;
  END IF;
  IF v_month_id IS NULL THEN RETURN NULL; END IF;

  SELECT month_id INTO v_item_month_id
  FROM public.content_items WHERE id = _item_id;
  IF v_item_month_id IS DISTINCT FROM v_month_id THEN RETURN NULL; END IF;

  INSERT INTO public.client_feedback(item_id, author_name, text, share_token, kind)
  VALUES (_item_id, v_author, v_text, _token, v_kind)
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'author_name', v_row.author_name,
    'text', v_row.text,
    'created_at', v_row.created_at
  );
END;
$$;

-- ===================== 6. apply_automation_action — ações que escrevem em OUTRAS tabelas =====================
-- Usada pelos gatilhos que não são eventos na própria content_items
-- (feed_approved, feed_feedback, file_attached) e pelo cron de gatilhos
-- por tempo — todos fazem UPDATE/INSERT de verdade (não mutam um NEW de
-- trigger). Os dois triggers nativos de content_items (status_change,
-- on_create) continuam mutando NEW direto pra set_status/assign_member/
-- schedule_instagram (mais barato, e evita reentrar no próprio trigger),
-- só chamando essa função pra notify/whatsapp_link.
CREATE OR REPLACE FUNCTION public.apply_automation_action(_rule public.automation_rules, _item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_item_title text;
  v_client_id uuid;
  v_client_name text;
  v_client_phone text;
  v_msg text;
BEGIN
  IF _rule.action_type = 'set_status' THEN
    UPDATE public.content_items SET status = _rule.action_status WHERE id = _item_id;

  ELSIF _rule.action_type = 'assign_member' THEN
    INSERT INTO public.item_assignees (item_id, user_id) VALUES (_item_id, _rule.action_user_id)
      ON CONFLICT DO NOTHING;

  ELSIF _rule.action_type = 'schedule_instagram' THEN
    -- Só entra na fila que o cron de publicação já processa — nunca chama
    -- a API do Instagram direto daqui. Exige scheduled_at já preenchido,
    -- mesma validação de setInstagramAutoPublish.
    UPDATE public.content_items
       SET ig_auto_publish = true
     WHERE id = _item_id AND scheduled_at IS NOT NULL AND type IN ('post', 'reel', 'story');

  ELSIF _rule.action_type = 'notify' THEN
    SELECT ci.title INTO v_item_title FROM public.content_items ci WHERE ci.id = _item_id;
    v_msg := COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Automação: ' || COALESCE(v_item_title, 'um item'));
    v_msg := replace(v_msg, '{titulo}', COALESCE(v_item_title, ''));
    IF _rule.action_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, item_id, message)
      VALUES (_rule.action_user_id, 'automation_notify', _item_id, v_msg);
    ELSE
      INSERT INTO public.notifications (user_id, type, item_id, message)
      SELECT ia.user_id, 'automation_notify', _item_id, v_msg
      FROM public.item_assignees ia WHERE ia.item_id = _item_id;
    END IF;

  ELSIF _rule.action_type = 'whatsapp_link' THEN
    SELECT ci.title, cl.id, cl.name, cl.phone
      INTO v_item_title, v_client_id, v_client_name, v_client_phone
    FROM public.content_items ci
    JOIN public.months m ON m.id = ci.month_id
    JOIN public.clients cl ON cl.id = m.client_id
    WHERE ci.id = _item_id;

    v_msg := COALESCE(NULLIF(btrim(_rule.action_message), ''), 'Oi {cliente}! Sobre "{titulo}"...');
    v_msg := replace(replace(v_msg, '{cliente}', COALESCE(v_client_name, '')), '{titulo}', COALESCE(v_item_title, ''));

    IF _rule.action_user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, type, item_id, client_id, message, whatsapp_phone)
      VALUES (_rule.action_user_id, 'automation_whatsapp_ready', _item_id, v_client_id, v_msg, v_client_phone);
    ELSE
      INSERT INTO public.notifications (user_id, type, item_id, client_id, message, whatsapp_phone)
      SELECT ia.user_id, 'automation_whatsapp_ready', _item_id, v_client_id, v_msg, v_client_phone
      FROM public.item_assignees ia WHERE ia.item_id = _item_id;
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_automation_action(public.automation_rules, uuid) FROM PUBLIC, anon, authenticated;

-- ===================== 7. Generaliza os 2 triggers nativos de content_items =====================

CREATE OR REPLACE FUNCTION public.run_automation_rules()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    FOR rule IN
      SELECT * FROM public.automation_rules
       WHERE org_id = NEW.org_id AND active AND trigger_type = 'status_change' AND trigger_status = NEW.status
    LOOP
      IF rule.action_type = 'set_status' THEN
        NEW.status := rule.action_status;
      ELSIF rule.action_type = 'assign_member' THEN
        INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, rule.action_user_id)
          ON CONFLICT DO NOTHING;
      ELSIF rule.action_type = 'schedule_instagram' THEN
        IF NEW.scheduled_at IS NOT NULL AND NEW.type IN ('post', 'reel', 'story') THEN
          NEW.ig_auto_publish := true;
        END IF;
      ELSIF rule.action_type IN ('notify', 'whatsapp_link') THEN
        PERFORM public.apply_automation_action(rule, NEW.id);
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
  rule record;
  v_org_id uuid := NEW.org_id;
BEGIN
  IF v_org_id IS NULL THEN
    SELECT org_id INTO v_org_id FROM public.months WHERE id = NEW.month_id;
  END IF;

  FOR rule IN
    SELECT * FROM public.automation_rules
     WHERE org_id = v_org_id AND active AND trigger_type = 'on_create'
  LOOP
    IF rule.action_type = 'set_status' THEN
      NEW.status := rule.action_status;
    ELSIF rule.action_type = 'assign_member' THEN
      INSERT INTO public.item_assignees (item_id, user_id) VALUES (NEW.id, rule.action_user_id)
        ON CONFLICT DO NOTHING;
    ELSIF rule.action_type = 'schedule_instagram' THEN
      IF NEW.scheduled_at IS NOT NULL AND NEW.type IN ('post', 'reel', 'story') THEN
        NEW.ig_auto_publish := true;
      END IF;
    ELSIF rule.action_type IN ('notify', 'whatsapp_link') THEN
      PERFORM public.apply_automation_action(rule, NEW.id);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- ===================== 8. Gatilho novo: feed aprovado pelo cliente =====================
-- Aplica a ação só nos itens do mês que ainda estão em "Revisão cliente" —
-- não mexe em item que já passou dessa etapa.

CREATE OR REPLACE FUNCTION public.run_automation_rules_feed_approved()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
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
DROP TRIGGER IF EXISTS trg_run_automation_rules_feed_approved ON public.months;
CREATE TRIGGER trg_run_automation_rules_feed_approved
  AFTER UPDATE ON public.months
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_feed_approved();

-- ===================== 9. Gatilho novo: cliente comentou/pediu ajuste =====================
-- Só dispara pra kind='comment' (aprovação, kind='approval', não conta
-- como "pediu ajuste" — tem o gatilho feed_approved pra isso).

CREATE OR REPLACE FUNCTION public.run_automation_rules_feed_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
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
DROP TRIGGER IF EXISTS trg_run_automation_rules_feed_feedback ON public.client_feedback;
CREATE TRIGGER trg_run_automation_rules_feed_feedback
  AFTER INSERT ON public.client_feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_feed_feedback();

-- ===================== 10. Gatilho novo: arquivo de mídia anexado =====================
-- Só kind='media' (briefing/referência não conta).

CREATE OR REPLACE FUNCTION public.run_automation_rules_file_attached()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
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
DROP TRIGGER IF EXISTS trg_run_automation_rules_file_attached ON public.item_files;
CREATE TRIGGER trg_run_automation_rules_file_attached
  AFTER INSERT ON public.item_files
  FOR EACH ROW
  EXECUTE FUNCTION public.run_automation_rules_file_attached();

-- ===================== 11. Cron novo: gatilhos por tempo =====================
-- Prazo (N dias antes / vencido) e "parado há N dias" não são eventos —
-- precisam de varredura periódica. Dedupe por automation_rule_fires
-- (rule_id, item_id, fired_on) evita disparar de novo no mesmo dia pro
-- mesmo item, mesmo padrão de deadline_notifications_log já usado em
-- send_deadline_reminders.

CREATE OR REPLACE FUNCTION public.run_time_based_automations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rule record;
  item_rec record;
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
          -- já disparou hoje pra esse item, ignora
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
      LOOP
        BEGIN
          INSERT INTO public.automation_rule_fires (rule_id, item_id) VALUES (rule.id, item_rec.id);
          PERFORM public.apply_automation_action(rule, item_rec.id);
        EXCEPTION WHEN unique_violation THEN
        END;
      END LOOP;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.run_time_based_automations() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE jid bigint;
BEGIN
  FOR jid IN SELECT jobid FROM cron.job WHERE jobname = 'luzeria_time_based_automations' LOOP
    PERFORM cron.unschedule(jid);
  END LOOP;
END $$;

-- Todo dia às 12:30 UTC (≈09:30 BRT) — logo depois do deadline_reminders (09:00).
SELECT cron.schedule('luzeria_time_based_automations', '30 12 * * *', $$SELECT public.run_time_based_automations();$$);
