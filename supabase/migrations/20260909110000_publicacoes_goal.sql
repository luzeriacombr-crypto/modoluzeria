-- Meta de "Publicação responsável" — pra quem cuida do planejamento/
-- entrega do feed (social media), não da edição em si. Mesmo padrão dos
-- outros campos de member_goals.
ALTER TABLE public.member_goals ADD COLUMN publicacoes_goal integer NOT NULL DEFAULT 0;
