-- Post-only classification field, mirroring reel_type's role for reels:
-- lets each post be marked as "estático" or "carrossel" from the new card view.
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS post_format text
  CHECK (post_format IS NULL OR post_format IN ('estatico', 'carrossel'));
