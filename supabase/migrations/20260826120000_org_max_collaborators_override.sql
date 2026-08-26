-- Limite de colaboradores personalizado por agência, independente do plano.
-- Usado para exceções pontuais (ex.: agência no Solo que precisa de mais
-- algumas vagas sem fazer upgrade) — o limite de clientes continua sempre
-- vindo do plano.
alter table public.orgs
  add column if not exists max_collaborators_override integer;

comment on column public.orgs.max_collaborators_override is
  'Quando definido, substitui plans.max_collaborators só para essa agência. O limite de clientes sempre vem do plano.';

update public.orgs
set max_collaborators_override = 4
where name = 'MACRO NEGOCIOS';
