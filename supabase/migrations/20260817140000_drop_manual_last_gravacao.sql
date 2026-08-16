-- Revertendo 20260817120000: não precisa de um campo manual separado —
-- "Data para gravação" já existe em cada atividade de Gravação (Mais
-- Atividades), então "última gravação" e "vídeos gravados" passam a ser
-- lidos direto de lá (content_items tipo 'gravacao'), sem duplicar a
-- digitação em dois lugares.
-- Reversível: ALTER TABLE public.clients ADD COLUMN last_gravacao_at date;
ALTER TABLE public.clients DROP COLUMN last_gravacao_at;
