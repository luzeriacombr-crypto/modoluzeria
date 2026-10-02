-- Categoria do pedido de ajuste do cliente (estratégia/conteúdo, data e
-- horário, ou design) — antes o ajuste chegava como texto livre, sem dar
-- pra saber de cara pra quem direcionar. Pedido do Junior (02/10), a
-- partir da call de demonstração da Dom (ver raio-X).
ALTER TABLE public.client_feedback
  ADD COLUMN category text CHECK (category IN ('conteudo', 'data_horario', 'design'));

-- add_public_feedback ganha um 5º parâmetro opcional (_category, default
-- NULL) — quem já chama com 4 argumentos (approvePublicItem, por exemplo)
-- continua funcionando sem mudar nada.
CREATE OR REPLACE FUNCTION public.add_public_feedback(_token text, _item_id uuid, _author_name text, _text text, _category text DEFAULT NULL)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
  v_month_id uuid;
  v_item_month_id uuid;
  v_row public.client_feedback%ROWTYPE;
  v_author text := btrim(_author_name);
  v_text text := btrim(_text);
  v_kind text := CASE WHEN btrim(_text) = '✅ APROVADO' THEN 'approval' ELSE 'comment' END;
  v_category text := CASE WHEN _category IN ('conteudo', 'data_horario', 'design') THEN _category ELSE NULL END;
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

  INSERT INTO public.client_feedback(item_id, author_name, text, share_token, kind, category)
  VALUES (_item_id, v_author, v_text, _token, v_kind, v_category)
  RETURNING * INTO v_row;

  -- Aprovação de um item específico: sai de "aguardando aprovação" na hora,
  -- e se já tem data/hora marcada, já liga o "Programar post" sozinho.
  IF v_kind = 'approval' THEN
    UPDATE public.content_items SET status = 'AGENDAMENTO'
    WHERE id = _item_id AND status = 'REVISAO_CLIENTE';

    UPDATE public.content_items SET ig_auto_publish = true
    WHERE id = _item_id AND scheduled_at IS NOT NULL AND type IN ('post', 'reel', 'story');

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
    'created_at', v_row.created_at,
    'category', v_row.category
  );
END;
$function$;
