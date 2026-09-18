-- Trava o reenvio do e-mail de nudge de ativação (dia 3 sem cliente
-- importado) — igual client_limit_grace_until, mas pra e-mail: grava uma
-- vez quando manda, nunca reprocessa a mesma org depois disso.
ALTER TABLE public.orgs ADD COLUMN activation_nudge_sent_at timestamptz;
