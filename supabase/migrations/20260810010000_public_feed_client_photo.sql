-- The public preview page (/preview/$token) shows a colored circle with the
-- client's initial instead of their real profile photo, even though clients
-- already have one (clients.photo_url, same "avatars" storage bucket used
-- for team member photos). Expose the raw storage path so the frontend can
-- sign it into a URL.

CREATE OR REPLACE FUNCTION public.get_public_feed(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok record;
  v_feed_mode text;
  v_feed_dir text;
  result jsonb;
BEGIN
  SELECT client_id, month_id, revoked_at
    INTO tok
  FROM public.feed_share_tokens
  WHERE token = _token;
  IF NOT FOUND OR tok.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  SELECT feed_order_mode, feed_order_direction INTO v_feed_mode, v_feed_dir
  FROM public.months WHERE id = tok.month_id;

  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object('name', c.name, 'color', c.color, 'description', c.description, 'photo_path', c.photo_url)
      FROM public.clients c WHERE c.id = tok.client_id
    ),
    'month', (
      SELECT jsonb_build_object('key', m.key) FROM public.months m WHERE m.id = tok.month_id
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
              FROM public.item_files f WHERE f.item_id = ci.id
            ), '[]'::jsonb),
            'feedback', COALESCE((
              SELECT jsonb_agg(jsonb_build_object('id', fb.id, 'author_name', fb.author_name, 'text', fb.text, 'created_at', fb.created_at) ORDER BY fb.created_at DESC)
              FROM public.client_feedback fb WHERE fb.item_id = ci.id
            ), '[]'::jsonb)
          ) AS item_obj
        FROM public.content_items ci
        WHERE ci.month_id = tok.month_id AND ci.type IN ('post', 'reel')
      ) sub
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
