-- Publicação em Página do Facebook — espelha 1:1 client_instagram_credentials
-- (20260805110000) e as colunas ig_* de content_items, só que pro Facebook
-- Login clássico (graph.facebook.com), que não reaproveita o fluxo de
-- Instagram Business Login. Mesmo App da Meta, produto novo ("Facebook
-- Login for Business"), redirect_uri própria.

CREATE TABLE public.client_facebook_credentials (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  facebook_page_id text NOT NULL,
  page_name text,
  access_token text NOT NULL,
  token_expires_at timestamptz,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_facebook_credentials TO authenticated;
GRANT ALL ON public.client_facebook_credentials TO service_role;
ALTER TABLE public.client_facebook_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read own org facebook credentials" ON public.client_facebook_credentials FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_facebook_credentials.client_id AND c.org_id = public.current_org_id())
  );

CREATE POLICY "master manage own org facebook credentials" ON public.client_facebook_credentials FOR ALL TO authenticated
  USING (
    public.is_master(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_facebook_credentials.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_master(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_facebook_credentials.client_id AND c.org_id = public.current_org_id())
  );

-- v1: só post de feed (foto/vídeo único ou carrossel) — sem Stories/Reels
-- do Facebook (APIs mais instáveis/complexas, fora de escopo por ora).
ALTER TABLE public.content_items ADD COLUMN fb_auto_publish boolean NOT NULL DEFAULT false;
ALTER TABLE public.content_items ADD COLUMN fb_media_id text;
ALTER TABLE public.content_items ADD COLUMN fb_last_error text;
ALTER TABLE public.content_items ADD COLUMN fb_last_error_at timestamptz;

CREATE INDEX idx_content_items_fb_auto_publish
  ON public.content_items (scheduled_at)
  WHERE fb_auto_publish = true AND status = 'PRONTO_PARA_PUBLICAR';
