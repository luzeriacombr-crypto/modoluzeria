-- Missing indexes for frequently-filtered columns (performance audit).
CREATE INDEX IF NOT EXISTS idx_item_assignees_user_id ON public.item_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_finalizations_item_id ON public.finalizations(item_id);
CREATE INDEX IF NOT EXISTS idx_comments_item_id ON public.comments(item_id);

-- Batch feed-order updates into a single statement instead of one UPDATE per
-- dragged item. Runs as the calling role (no SECURITY DEFINER), so it's
-- subject to the same grants/RLS as the direct .update() calls it replaces.
CREATE OR REPLACE FUNCTION public.update_feed_order(p_updates jsonb)
RETURNS void
LANGUAGE sql
AS $$
  UPDATE public.content_items AS ci
  SET feed_order = (u->>'feed_order')::int
  FROM jsonb_array_elements(p_updates) AS u
  WHERE ci.id = (u->>'id')::uuid;
$$;
