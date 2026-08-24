-- get_public_feed só devolvia post/reel — Stories nunca apareciam no link
-- público. Adiciona uma chave "stories" própria, mesmo formato de "items",
-- ordenada por data agendada (não por feed_order/idx, que só faz sentido
-- pra post/reel) já que a ideia é ver na ordem que vão ao ar, como no
-- próprio Instagram.
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

  SELECT active_month_id INTO v_month_id FROM public.clients WHERE id = tok.client_id;
  IF v_month_id IS NULL THEN
    SELECT id INTO v_month_id FROM public.months WHERE client_id = tok.client_id ORDER BY key DESC LIMIT 1;
  END IF;
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
    ), '[]'::jsonb),
    'stories', COALESCE((
      SELECT jsonb_agg(item_obj ORDER BY sort_scheduled NULLS LAST, sort_idx)
      FROM (
        SELECT
          ci.scheduled_at AS sort_scheduled,
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
        WHERE ci.month_id = v_month_id AND ci.type = 'story'
      ) sub
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
