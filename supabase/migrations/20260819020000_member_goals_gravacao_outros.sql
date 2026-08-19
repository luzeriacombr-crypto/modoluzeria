-- Metas da equipe passam a cobrir Gravação e Outros também (além de
-- Posts/Reels/Stories). Rotina não ganha meta aqui — só é contada, não
-- faz sentido definir "meta de X rotinas" por mês.
ALTER TABLE public.member_goals
  ADD COLUMN IF NOT EXISTS gravacao_goal integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outros_goal integer NOT NULL DEFAULT 0;
