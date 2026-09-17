-- Faltava propagar o formato do post (estático/carrossel) da prévia de
-- planejamento pro campo de verdade content_items.post_format — a IA já
-- decidia isso (no texto do captionDraft), mas o botão real do board
-- ficava sem valor, obrigando a pessoa a escolher na mão depois.
ALTER TABLE public.client_doc_roteiro_status
  ADD COLUMN post_format text CHECK (post_format IN ('estatico', 'carrossel'));

-- Legenda real de publicação, separada do roteiro/texto de produção (que
-- fica no corpo do doc e vira o Briefing) — sem essa separação, a Legenda
-- do content_item nascia como uma cópia do Briefing, o que não faz
-- sentido pra publicar de verdade.
ALTER TABLE public.client_doc_roteiro_status ADD COLUMN publish_caption text;
