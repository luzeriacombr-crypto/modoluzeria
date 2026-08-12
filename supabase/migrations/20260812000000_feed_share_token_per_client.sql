-- O link público de preview de feed era um por CLIENTE+MÊS: toda virada de
-- mês a agência tinha que gerar e reenviar um link novo pro cliente. Passa
-- a ser um link fixo por CLIENTE — sempre resolve pro mês mais recente
-- daquele cliente (maior `months.key`, formato "YYYY-MM", então ordena
-- certo por string). A aprovação do cliente ("Aprovar feed") deixa de
-- morar em feed_share_tokens (que agora é 1 linha por cliente, não por
-- mês) e passa pra months.client_approved_at, senão a aprovação de um mês
-- ficaria "vazando" pro mês seguinte por causa do mesmo link.

ALTER TABLE public.months ADD COLUMN client_approved_at timestamptz;

-- Migra aprovações já registradas nos tokens existentes pro mês certo.
UPDATE public.months m
SET client_approved_at = t.client_approved_at
FROM public.feed_share_tokens t
WHERE t.month_id = m.id AND t.client_approved_at IS NOT NULL;

-- Um cliente podia ter várias linhas (uma por mês já compartilhado) —
-- mantém só a mais recente antes de trocar pra unique(client_id).
DELETE FROM public.feed_share_tokens t
USING public.feed_share_tokens t2
WHERE t.client_id = t2.client_id
  AND t.id <> t2.id
  AND (t2.created_at, t2.id) > (t.created_at, t.id);

ALTER TABLE public.feed_share_tokens DROP CONSTRAINT feed_share_tokens_client_id_month_id_key;
ALTER TABLE public.feed_share_tokens ALTER COLUMN month_id DROP NOT NULL;
ALTER TABLE public.feed_share_tokens ADD CONSTRAINT feed_share_tokens_client_id_key UNIQUE (client_id);
ALTER TABLE public.feed_share_tokens DROP COLUMN client_approved_at;

CREATE OR REPLACE FUNCTION public.get_public_feed(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok record;
  v_month_id uuid;
  v_feed_mode text;
  v_feed_dir text;
  result jsonb;
BEGIN
  SELECT client_id, revoked_at
    INTO tok
  FROM public.feed_share_tokens
  WHERE token = _token;
  IF NOT FOUND OR tok.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_month_id
  FROM public.months
  WHERE client_id = tok.client_id
  ORDER BY key DESC
  LIMIT 1;
  IF v_month_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT feed_order_mode, feed_order_direction INTO v_feed_mode, v_feed_dir
  FROM public.months WHERE id = v_month_id;

  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object('name', c.name, 'color', c.color, 'description', c.description, 'photo_path', c.photo_url)
      FROM public.clients c WHERE c.id = tok.client_id
    ),
    'month', (
      SELECT jsonb_build_object('key', m.key) FROM public.months m WHERE m.id = v_month_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(item_obj ORDER BY
        CASE WHEN v_feed_mode = 'cronologica' AND v_feed_dir = 'desc' THEN -1 ELSE 1 END
          * (CASE WHEN v_feed_mode = 'cronologica' THEN extract(epoch FROM sort_scheduled) END),
        CASE WHEN v_feed_mode = 'cronologica' THEN NULL ELSE sort_feed_order END,
        sort_type_rank, sort_idx)
      FROM (
        SELECT
          ci.feed_order AS sort_feed_order,
          ci.scheduled_at AS sort_scheduled,
          CASE ci.type WHEN 'reel' THEN 1 ELSE 0 END AS sort_type_rank,
          ci.idx AS sort_idx,
          jsonb_build_object(
            'id', ci.id, 'type', ci.type, 'idx', ci.idx, 'title', ci.title,
            'caption', COALESCE(ci.caption, ''),
            'scheduled_at', ci.scheduled_at,
            'feed_order', ci.feed_order,
            'cover_path', ci.cover_path,
            'status', ci.status,
            'blocked_reason', ci.blocked_reason,
            'files', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', f.id, 'drive_file_id', f.drive_file_id, 'mime_type', f.mime_type, 'web_view_url', f.web_view_url, 'sort_order', f.sort_order) ORDER BY f.sort_order, f.created_at)
              FROM public.item_files f WHERE f.item_id = ci.id AND f.kind = 'media'
            ), '[]'::jsonb),
            'feedback', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', fb.id, 'author_name', fb.author_name, 'text', fb.text, 'created_at', fb.created_at) ORDER BY fb.created_at DESC)
              FROM public.client_feedback fb WHERE fb.item_id = ci.id
            ), '[]'::jsonb)
          ) AS item_obj
        FROM public.content_items ci
        WHERE ci.month_id = v_month_id AND ci.type IN ('post', 'reel')
      ) sub
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_public_token_file(_token text, _file_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_month_id uuid;
  v_file_month_id uuid;
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.feed_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_client_id IS NULL THEN RETURN false; END IF;

  SELECT id INTO v_month_id
  FROM public.months WHERE client_id = v_client_id ORDER BY key DESC LIMIT 1;
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
  v_client_id uuid;
  v_month_id uuid;
  v_item_month_id uuid;
  v_row public.client_feedback%ROWTYPE;
  v_author text := btrim(_author_name);
  v_text text := btrim(_text);
BEGIN
  IF v_author IS NULL OR length(v_author) = 0 OR length(v_author) > 60 THEN RETURN NULL; END IF;
  IF v_text IS NULL OR length(v_text) = 0 OR length(v_text) > 1000 THEN RETURN NULL; END IF;

  SELECT client_id INTO v_client_id
  FROM public.feed_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO v_month_id
  FROM public.months WHERE client_id = v_client_id ORDER BY key DESC LIMIT 1;
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

-- Novo: aprovar o feed atual do cliente (substitui o update direto em
-- feed_share_tokens.client_approved_at, que não existe mais).
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

  SELECT id INTO v_month_id
  FROM public.months WHERE client_id = v_client_id ORDER BY key DESC LIMIT 1;
  IF v_month_id IS NULL THEN RETURN NULL; END IF;

  UPDATE public.months SET client_approved_at = v_approved_at WHERE id = v_month_id;
  RETURN v_approved_at;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_public_feed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.approve_public_feed(text) TO anon, authenticated;
