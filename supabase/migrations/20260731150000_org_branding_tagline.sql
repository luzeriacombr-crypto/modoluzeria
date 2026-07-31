-- Multi-tenant Fase 1: cada agência pode ter seu próprio nome (já existia em
-- orgs.name) e um slogan curto exibido no lugar do logo/tagline da Luzeria
-- dentro do app (depois do login — a tela de login em si continua genérica
-- pra todas as agências, isso é decisão de arquitetura, não bug).
ALTER TABLE public.orgs ADD COLUMN tagline text;
