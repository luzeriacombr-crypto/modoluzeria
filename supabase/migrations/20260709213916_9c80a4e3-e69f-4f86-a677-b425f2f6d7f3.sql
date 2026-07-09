CREATE TABLE IF NOT EXISTS public.user_calendar_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_tokens TO authenticated;
GRANT ALL ON public.user_calendar_tokens TO service_role;
ALTER TABLE public.user_calendar_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar token select" ON public.user_calendar_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own calendar token insert" ON public.user_calendar_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar token update" ON public.user_calendar_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar token delete" ON public.user_calendar_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER user_calendar_tokens_touch_updated_at BEFORE UPDATE ON public.user_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.record_finalizations()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  rec record;
BEGIN
  IF NEW.status = 'PRONTO_PARA_PUBLICAR' AND (OLD.status IS DISTINCT FROM 'PRONTO_PARA_PUBLICAR') THEN
    FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.id LOOP
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (rec.user_id, NEW.id, now());
    END LOOP;
    IF NEW.editor_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.item_assignees WHERE item_id = NEW.id AND user_id = NEW.editor_id
    ) THEN
      INSERT INTO public.finalizations (user_id, item_id, finalized_at)
      VALUES (NEW.editor_id, NEW.id, now());
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_public_feed(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tok record;
  result jsonb;
BEGIN
  SELECT client_id, month_id, revoked_at
    INTO tok
  FROM public.feed_share_tokens
  WHERE token = _token;
  IF NOT FOUND OR tok.revoked_at IS NOT NULL THEN
    RETURN NULL;
  END IF;
  SELECT jsonb_build_object(
    'client', (
      SELECT jsonb_build_object('name', c.name, 'color', c.color, 'description', c.description)
      FROM public.clients c WHERE c.id = tok.client_id
    ),
    'month', (
      SELECT jsonb_build_object('key', m.key) FROM public.months m WHERE m.id = tok.month_id
    ),
    'items', COALESCE((
      SELECT jsonb_agg(item_obj ORDER BY sort_feed_order, sort_type_rank, sort_idx)
      FROM (
        SELECT
          ci.feed_order AS sort_feed_order,
          CASE ci.type WHEN 'reel' THEN 1 ELSE 0 END AS sort_type_rank,
          ci.idx AS sort_idx,
          jsonb_build_object(
            'id', ci.id, 'type', ci.type, 'idx', ci.idx, 'title', ci.title,
            'caption', COALESCE(ci.caption, ''),
            'scheduled_at', ci.scheduled_at,
            'feed_order', ci.feed_order,
            'cover_path', ci.cover_path,
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
        WHERE ci.month_id = tok.month_id AND ci.status IN ('REVISAO_CLIENTE', 'PRONTO_PARA_PUBLICAR')
      ) sub
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_feed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_feed(text) TO anon, authenticated;