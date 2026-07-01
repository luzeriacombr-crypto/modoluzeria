
CREATE OR REPLACE FUNCTION public.verify_public_token_file(_token text, _file_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_month_id uuid;
  v_file_month_id uuid;
BEGIN
  SELECT month_id INTO v_month_id
  FROM public.feed_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_month_id IS NULL THEN RETURN false; END IF;

  SELECT ci.month_id INTO v_file_month_id
  FROM public.item_files f
  JOIN public.content_items ci ON ci.id = f.item_id
  WHERE f.drive_file_id = _file_id
  LIMIT 1;

  RETURN v_file_month_id = v_month_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_public_feedback(_token text, _item_id uuid, _author_name text, _text text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month_id uuid;
  v_item_month_id uuid;
  v_row public.client_feedback%ROWTYPE;
  v_author text := btrim(_author_name);
  v_text text := btrim(_text);
BEGIN
  IF v_author IS NULL OR length(v_author) = 0 OR length(v_author) > 60 THEN RETURN NULL; END IF;
  IF v_text IS NULL OR length(v_text) = 0 OR length(v_text) > 1000 THEN RETURN NULL; END IF;

  SELECT month_id INTO v_month_id
  FROM public.feed_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_month_id IS NULL THEN RETURN NULL; END IF;

  SELECT month_id INTO v_item_month_id
  FROM public.content_items WHERE id = _item_id;
  IF v_item_month_id IS DISTINCT FROM v_month_id THEN RETURN NULL; END IF;

  INSERT INTO public.client_feedback(item_id, author_name, text, share_token)
  VALUES (_item_id, v_author, v_text, _token)
  RETURNING * INTO v_row;

  RETURN json_build_object(
    'id', v_row.id,
    'author_name', v_row.author_name,
    'text', v_row.text,
    'created_at', v_row.created_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.verify_public_token_file(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_public_feedback(text, uuid, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.verify_public_token_file(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_public_feedback(text, uuid, text, text) TO anon, authenticated;
