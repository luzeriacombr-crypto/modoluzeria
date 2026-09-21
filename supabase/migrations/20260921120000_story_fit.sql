-- Como encaixar a imagem de um Story que não está em 9:16: fundo desfocado
-- (padrão quando nulo), branco, preto ou recorte no centro.
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS story_fit text CHECK (story_fit IN ('blur', 'white', 'black', 'crop'));
