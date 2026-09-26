-- Terceiro valor de item_files.kind: "raw" (materiais brutos) — vídeo/imagem
-- bruta que o editor baixa, edita fora do app e depois sobe o resultado como
-- mídia de verdade do item. Mesmo padrão de "briefing": pasta própria no
-- Drive, fora do feed público, fora das automações de "arquivo anexado".
ALTER TABLE public.item_files DROP CONSTRAINT item_files_kind_check;
ALTER TABLE public.item_files ADD CONSTRAINT item_files_kind_check
  CHECK (kind IN ('media', 'briefing', 'raw'));
