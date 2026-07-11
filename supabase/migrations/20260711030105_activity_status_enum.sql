-- Step 1 of 2 — run this first, then run the next migration file.
-- New simplified two-state status for activity items (gravação/roteiro/
-- sistema/outros): they aren't "published", so the post/reel funnel doesn't
-- apply — just whether the activity happened or not.
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'PENDENTE';
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'CONCLUIDO';
