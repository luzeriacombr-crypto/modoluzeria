-- Recorrências (Rotina/Ficha do cliente) ganham dois ajustes pedidos pelo
-- Junior: (1) escolher VÁRIOS dias da semana pra uma recorrência semanal,
-- não só um; (2) escolher por quanto tempo "Gerar agora" cria itens pra
-- frente (7/14/30/365 dias — "365" é como resolvemos "pra sempre": não dá
-- pra inserir linhas infinitas num clique só, então vira um lote bem
-- grande, guardado como preferência da própria recorrência).

ALTER TABLE public.recurring_templates
  ADD COLUMN days_of_week smallint[],
  ADD COLUMN horizon_days int NOT NULL DEFAULT 14;

-- Preserva o dia já cadastrado de cada recorrência semanal existente.
UPDATE public.recurring_templates
SET days_of_week = ARRAY[day_of_week]::smallint[]
WHERE cadence = 'weekly' AND day_of_week IS NOT NULL;

ALTER TABLE public.recurring_templates DROP COLUMN day_of_week;
