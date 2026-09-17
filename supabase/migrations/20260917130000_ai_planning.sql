-- Prévia de planejamento do próximo mês gerada por IA — feature em teste,
-- escopada por cliente (não por org) pra dar pra ligar só na Luzeria
-- Estúdio primeiro, sem afetar nenhum cliente real de nenhuma agência.
ALTER TABLE public.clients ADD COLUMN ai_planning_enabled boolean NOT NULL DEFAULT false;

-- Lista livre de concorrentes (um por linha, preenchido manualmente na
-- Ficha do Cliente) — usada como contexto pra IA pesquisar na web antes de
-- gerar a prévia.
ALTER TABLE public.clients ADD COLUMN competitors text;
