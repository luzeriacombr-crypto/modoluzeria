-- Ordem manual dos grupos (arrastar-e-soltar) — antes a ordem era sempre por
-- created_at, sem jeito de reorganizar. Backfill preserva a ordem atual.
ALTER TABLE public.content_groups ADD COLUMN sort_order int NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at) - 1 AS rn
  FROM public.content_groups
)
UPDATE public.content_groups g
SET sort_order = ranked.rn
FROM ranked
WHERE g.id = ranked.id;
