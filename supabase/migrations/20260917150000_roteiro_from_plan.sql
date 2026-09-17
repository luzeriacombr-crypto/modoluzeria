-- Liga a prévia de planejamento por IA ao fluxo de Roteiros existente:
-- "Aprovar" o planejamento cria um doc de Roteiros de verdade (um "##
-- Roteiro N: título" por sugestão), já sabendo pra qual mês vai
-- (target_month_key) e se cada um é post ou reel (content_type) — assim,
-- aprovar cada roteiro individual (chip "Aprovado" já existente) sabe
-- automaticamente criar o content_item certo, sem precisar do clique
-- manual de "Enviar pro Reels".
ALTER TABLE public.client_docs ADD COLUMN target_month_key text;

ALTER TABLE public.client_doc_roteiro_status
  ADD COLUMN content_type text NOT NULL DEFAULT 'reel' CHECK (content_type IN ('post', 'reel'));
