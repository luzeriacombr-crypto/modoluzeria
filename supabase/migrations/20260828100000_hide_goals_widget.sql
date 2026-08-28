-- Opção por membro pra ocultar a barra "Meta do mês" na home de Minhas
-- Demandas — mesmo padrão de exclude_from_ranking (coluna simples em
-- profiles, admin-only via setHideGoalsWidget).
alter table public.profiles add column if not exists hide_goals_widget boolean not null default false;
