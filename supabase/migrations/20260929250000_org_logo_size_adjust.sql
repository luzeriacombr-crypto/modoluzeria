-- A centralização óptica automática (commit 8c614a9/05823e3) calcula o
-- tamanho "ideal" da logo sozinha, mas o Junior quer poder afinar esse
-- tamanho manualmente por agência (diminuir uns pixels até ficar do jeito
-- que acha bonito) — a conta automática é só o ponto de partida.
ALTER TABLE public.orgs ADD COLUMN logo_size_adjust_px integer NOT NULL DEFAULT 0;
