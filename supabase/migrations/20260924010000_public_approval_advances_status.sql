-- Cliente aprova (por item ou o feed inteiro) e a barra de progresso
-- continua mostrando "Aguardando sua aprovação" — porque nenhuma das duas
-- ações de aprovação pública nunca mexeu em content_items.status, só
-- registravam o comentário "✅ APROVADO" (client_feedback) ou a data de
-- aprovação do mês (months.client_approved_at). A barra conta pelo status
-- do item (REVISAO_CLIENTE), então continuava contando ele como pendente
-- pra sempre — só um humano da agência arrastando manualmente no Kanban
-- resolvia. Confirmado: nenhuma organização tem uma regra de automação
-- (gatilho "feed_approved" com ação "set_status") configurada, então isso
-- nunca teria acontecido sozinho por ali.
--
-- Corrige fazendo as duas funções também avançarem o item de REVISAO_CLIENTE
-- pra AGENDAMENTO (que a barra já exibe como "Aprovado, aguardando
-- publicação" — client-stage.ts) — sem depender de nenhuma automação
-- configurada.

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

  -- Aprovação de um item específico: sai de "aguardando aprovação" na hora,
  -- sem esperar alguém da agência mexer no Kanban manualmente.
  IF v_kind = 'approval' THEN
    UPDATE public.content_items SET status = 'AGENDAMENTO'
    WHERE id = _item_id AND status = 'REVISAO_CLIENTE';
  END IF;

  RETURN json_build_object(
    'id', v_row.id,
    'author_name', v_row.author_name,
    'text', v_row.text,
    'created_at', v_row.created_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.approve_public_feed(_token text)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_month_id uuid;
  v_approved_at timestamptz := now();
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.feed_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT active_month_id INTO v_month_id FROM public.clients WHERE id = v_client_id;
  IF v_month_id IS NULL THEN
    SELECT id INTO v_month_id FROM public.months WHERE client_id = v_client_id ORDER BY key DESC LIMIT 1;
  END IF;
  IF v_month_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.months SET client_approved_at = v_approved_at WHERE id = v_month_id;

  -- "Aprovar feed" é o cliente confirmando formalmente que está tudo certo
  -- com o mês inteiro — qualquer item que ainda estivesse esperando
  -- aprovação individual também conta como aprovado aqui.
  UPDATE public.content_items SET status = 'AGENDAMENTO'
  WHERE month_id = v_month_id AND status = 'REVISAO_CLIENTE';

  RETURN v_approved_at;
END;
$$;
