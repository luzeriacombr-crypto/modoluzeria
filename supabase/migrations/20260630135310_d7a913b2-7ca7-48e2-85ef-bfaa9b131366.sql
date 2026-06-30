ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS feed_order int;
CREATE INDEX IF NOT EXISTS idx_content_items_month_feed_order ON public.content_items(month_id, feed_order);