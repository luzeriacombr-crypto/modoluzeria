-- Hoje, quando um post é publicado com sucesso via runInstagramPublish
-- (botão "Publicar agora" ou o cron de programação), nada fica registrado
-- indicando que a publicação passou pelo Modo Criador — só o status muda
-- pra FINALIZADO, que também acontece quando alguém publica manualmente e
-- só atualiza o status. Sem isso não dá pra montar uma tela "publicado pelo
-- aplicativo" de forma confiável.
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS ig_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS ig_media_id text;

CREATE INDEX IF NOT EXISTS idx_content_items_ig_activity
  ON public.content_items (ig_published_at)
  WHERE ig_auto_publish = true OR ig_published_at IS NOT NULL;
