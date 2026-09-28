-- "Stories / mês" passa a existir como campo próprio (igual posts_per_week/
-- reels_per_week, mesma convenção de nome apesar do rótulo ser mensal) pra
-- poder ser preenchido já na criação do cliente.

ALTER TABLE public.clients
  ADD COLUMN stories_per_week integer NOT NULL DEFAULT 0;
