-- Publicação automática no Instagram (Fase 1: só Posts, botão manual
-- "Publicar agora"). Diferente do Drive (uma conexão por agência), o
-- Instagram é uma conexão por CLIENTE — cada cliente tem a própria conta.
--
-- page_access_token nunca deve ser devolvido ao navegador em nenhuma
-- circunstância: a leitura pro botão "Publicar agora" checa só que existe
-- conexão; o server function que realmente publica usa o cliente admin
-- (service role) pra buscar o token, contornando a RLS de propósito.
CREATE TABLE public.client_instagram_credentials (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  facebook_page_id text NOT NULL,
  instagram_business_account_id text NOT NULL,
  ig_username text,
  page_access_token text NOT NULL,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_instagram_credentials TO authenticated;
GRANT ALL ON public.client_instagram_credentials TO service_role;
ALTER TABLE public.client_instagram_credentials ENABLE ROW LEVEL SECURITY;

-- Qualquer perfil ativo da agência pode ler (precisa saber se está
-- conectado pra mostrar/esconder o botão de publicar) — só master pode
-- conectar/desconectar.
CREATE POLICY "active read own org instagram credentials" ON public.client_instagram_credentials FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_instagram_credentials.client_id AND c.org_id = public.current_org_id())
  );

CREATE POLICY "master manage own org instagram credentials" ON public.client_instagram_credentials FOR ALL TO authenticated
  USING (
    public.is_master(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_instagram_credentials.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_master(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_instagram_credentials.client_id AND c.org_id = public.current_org_id())
  );

-- Bucket público (não assinado) só pra re-hospedar temporariamente a
-- imagem que vai ser publicada — a API do Instagram exige uma image_url
-- alcançável sem autenticação, e os arquivos do Drive não são públicos.
-- Nada mais além do publishToInstagram deve escrever aqui; o arquivo pode
-- ficar (o post já linka pra ele de qualquer forma), mas nunca é listado
-- em lugar nenhum da interface.
INSERT INTO storage.buckets (id, name, public)
VALUES ('instagram-publish-temp', 'instagram-publish-temp', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "service role manages instagram publish temp" ON storage.objects FOR ALL TO service_role
  USING (bucket_id = 'instagram-publish-temp')
  WITH CHECK (bucket_id = 'instagram-publish-temp');
