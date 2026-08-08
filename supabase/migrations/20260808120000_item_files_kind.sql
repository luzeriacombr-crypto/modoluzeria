-- Distingue arquivos de mídia normais (o que já existia — mostrado em
-- "Arquivos" e na prévia de Mídia) de imagens de briefing/referência
-- (novo botão dentro da seção Briefing). Mesma tabela, mesmo relé de
-- upload pro Drive — só muda o rótulo e a pasta de destino.
ALTER TABLE public.item_files
  ADD COLUMN kind text NOT NULL DEFAULT 'media'
  CHECK (kind IN ('media', 'briefing'));

CREATE INDEX idx_item_files_item_kind ON public.item_files(item_id, kind, sort_order);
