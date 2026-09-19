-- Substitui o nudge diário genérico (cliente/Drive/Instagram, todo dia) por
-- marcos específicos só sobre "ainda sem cliente" (dia 2 e dia 4 desde o
-- cadastro) — menos chance de parecer spam. `activation_nudge_sent_at`
-- (20260917180000) fica sem uso daqui pra frente, sem problema mantê-la.
ALTER TABLE public.orgs ADD COLUMN client_nudge_day2_sent_at timestamptz;
ALTER TABLE public.orgs ADD COLUMN client_nudge_day4_sent_at timestamptz;

-- Desativação por inatividade: agência que chega no fim do teste sem pelo
-- menos 1 cliente cadastrado E o Google Drive conectado. Avisa 5 e 2 dias
-- antes do fim do teste (trial_ends_at, que já respeita qualquer extensão
-- manual dada via "Dar mais 30 dias de teste"), só desativa depois disso.
-- Desativação = profiles.active = false pra todo mundo da org (mesmo
-- mecanismo que já bloqueia cadastro pendente de aprovação — reversível,
-- só religar o profile de volta) — nunca apaga dado nenhum.
ALTER TABLE public.orgs ADD COLUMN inactivity_warning_5d_sent_at timestamptz;
ALTER TABLE public.orgs ADD COLUMN inactivity_warning_2d_sent_at timestamptz;
ALTER TABLE public.orgs ADD COLUMN deactivated_for_inactivity boolean NOT NULL DEFAULT false;
ALTER TABLE public.orgs ADD COLUMN deactivated_at timestamptz;
