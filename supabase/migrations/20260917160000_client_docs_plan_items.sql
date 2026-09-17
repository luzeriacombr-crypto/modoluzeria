-- Guarda os itens estruturados da prévia de planejamento por IA junto do
-- doc salvo (além do Markdown já existente) — sem isso, "Aprovar e enviar
-- pros Roteiros" só funcionava na hora de gerar, nunca num Planejamento
-- (IA) já salvo antes, porque reconstruir os itens a partir do Markdown
-- editado seria frágil. Fica null pra qualquer planejamento manual/colado
-- (sem botão de aprovar nesses).
ALTER TABLE public.client_docs ADD COLUMN plan_items jsonb;
