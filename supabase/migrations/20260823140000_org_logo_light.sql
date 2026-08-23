-- Segunda variante da logo, opcional, usada no modo claro. Quando null, o
-- app continua usando logo_path (a de sempre) nos dois temas — nada muda
-- pra quem nunca enviar uma logo específica pro claro.
ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS logo_path_light text;
