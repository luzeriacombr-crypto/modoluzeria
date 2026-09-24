-- Novo gatilho de automação: "quando o cliente aprovar um post específico"
-- (item_approved), separado do "feed_approved" que já existe (esse só
-- dispara quando o cliente aprova o MÊS inteiro de uma vez, pelo botão
-- "Aprovar feed" — a maioria dos clientes aprova post por post, não em
-- lote, então feed_approved sozinho nunca cobria o caso mais comum).
--
-- Motivação real: prometido numa demo de vendas que aprovação do cliente já
-- deixa o post agendado sozinho no Instagram (ação "schedule_instagram",
-- que já existe e só precisa de scheduled_at preenchido) — mas isso só era
-- possível hoje via feed_approved. Com item_approved, a agência pode
-- configurar essa mesma automação pra rodar a cada aprovação individual.

ALTER TABLE public.automation_rules DROP CONSTRAINT IF EXISTS automation_rules_trigger_type_check;
ALTER TABLE public.automation_rules ADD CONSTRAINT automation_rules_trigger_type_check CHECK (
  trigger_type IN (
    'on_create', 'status_change', 'deadline_days_before', 'deadline_overdue',
    'stale_days', 'feed_approved', 'item_approved', 'feed_feedback', 'file_attached',
    'ig_publish_failed', 'roteiro_approved', 'roteiro_adjust',
    'photo_selection_done', 'contract_signed',
    'client_no_post_days', 'payment_days_before', 'payment_overdue'
  )
);

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
  v_org_id uuid;
  v_rule public.automation_rules;
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

  -- Aprovação de um item específico: sai de "aguardando aprovação" na hora,
  -- sem esperar alguém da agência mexer no Kanban manualmente.
  IF v_kind = 'approval' THEN
    UPDATE public.content_items SET status = 'AGENDAMENTO'
    WHERE id = _item_id AND status = 'REVISAO_CLIENTE';

    SELECT org_id INTO v_org_id FROM public.clients WHERE id = v_client_id;
    IF v_org_id IS NOT NULL THEN
      FOR v_rule IN
        SELECT * FROM public.automation_rules
         WHERE org_id = v_org_id AND active AND trigger_type = 'item_approved'
      LOOP
        PERFORM public.apply_automation_action_v2(v_rule, _item_id, v_client_id, NULL, NULL, NULL);
      END LOOP;
    END IF;
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'author_name', v_row.author_name,
    'text', v_row.text,
    'created_at', v_row.created_at
  );
END;
$$;
