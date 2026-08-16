-- Custo-hora e horas médias por tipo de conteúdo, usados pelo painel de
-- margem/lucratividade por cliente (custo é estimado, não apontamento real
-- de horas — ver src/lib/luzeria/margin.functions.ts).
--
-- Reversível: ALTER TABLE public.orgs DROP COLUMN hourly_cost, DROP COLUMN avg_hours_by_type;
-- Chaves usam os valores reais do enum content_type (post/reel/story/gravacao/outros).
ALTER TABLE public.orgs
  ADD COLUMN hourly_cost numeric,
  ADD COLUMN avg_hours_by_type jsonb NOT NULL DEFAULT '{"post":1,"reel":2,"story":0.5,"gravacao":1.5,"outros":1}'::jsonb;
