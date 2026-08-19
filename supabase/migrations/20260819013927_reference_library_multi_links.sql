-- Cada bloco da Biblioteca de Referências passa a aceitar vários links
-- (não só um), cada um com um nome opcional pra identificar depois.
-- Mantém a coluna "url" antiga intacta (não lida/escrita mais pela
-- aplicação) em vez de DROP COLUMN, pra não descartar dado nenhum.
ALTER TABLE public.reference_library_items ADD COLUMN links jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.reference_library_items
SET links = jsonb_build_array(jsonb_build_object('label', null, 'url', url))
WHERE url IS NOT NULL AND btrim(url) <> '';
