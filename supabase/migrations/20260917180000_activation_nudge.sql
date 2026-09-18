-- Guarda a data/hora do último e-mail de nudge de ativação (cliente/
-- Drive/Instagram) mandado pra essa org — o cron manda de novo todo dia
-- enquanto faltar algo, usando essa coluna só pra não mandar duas vezes
-- no mesmo dia.
ALTER TABLE public.orgs ADD COLUMN activation_nudge_sent_at timestamptz;
