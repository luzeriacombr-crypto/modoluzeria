-- Responsável passa a aceitar mais de uma pessoa por lead (o time queria
-- dividir oportunidades) — troca o FK único por um array de ids. Produto
-- de interesse vira campo próprio do lead (mesmas opções usadas ao virar
-- cliente), pra já registrar isso antes do "ganho".
ALTER TABLE public.leads ADD COLUMN responsible_ids uuid[] NOT NULL DEFAULT '{}';
UPDATE public.leads SET responsible_ids = ARRAY[responsible_id] WHERE responsible_id IS NOT NULL;
ALTER TABLE public.leads DROP COLUMN responsible_id;

ALTER TABLE public.leads ADD COLUMN product text;
