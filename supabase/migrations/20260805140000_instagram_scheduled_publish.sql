-- "Programar publicação": marca um post pra ser publicado sozinho no
-- Instagram quando bater o scheduled_at, em vez de precisar clicar em
-- "Publicar agora" na hora. Um job externo (GitHub Actions, ver
-- .github/workflows/publish-instagram-cron.yml) chama a cada poucos
-- minutos um endpoint que varre por itens com essa flag ligada e
-- scheduled_at já passado.
ALTER TABLE public.content_items ADD COLUMN IF NOT EXISTS ig_auto_publish boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_content_items_ig_auto_publish
  ON public.content_items (scheduled_at)
  WHERE ig_auto_publish = true AND status = 'PRONTO_PARA_PUBLICAR';
