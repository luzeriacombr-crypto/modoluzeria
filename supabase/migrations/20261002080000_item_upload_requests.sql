-- Link público de ENVIO de materiais brutos (pedido do Junior, 02/10): a agência
-- gera um link preso a UM post/reel, manda pro freelancer, e ele sobe imagens e
-- vídeos direto pro Google Drive da agência, sem login. Os arquivos caem na pasta
-- "Materiais Brutos" do cliente e aparecem no bloco "Materiais brutos" do post.
--
-- Nenhum acesso direto pro anon: o link público só é lido/gravado por server
-- functions do app (service role) que validam o token. Os cabeçalhos abaixo
-- servem só pra agência ver e gerenciar os próprios links (RLS por org).

CREATE TABLE public.item_upload_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado')),
  max_file_bytes bigint NOT NULL DEFAULT 3221225472, -- 3 GB por arquivo
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '3 days')
);
GRANT SELECT, UPDATE ON public.item_upload_requests TO authenticated;
GRANT ALL ON public.item_upload_requests TO service_role;
ALTER TABLE public.item_upload_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX item_upload_requests_item_idx ON public.item_upload_requests(item_id);

CREATE POLICY "read item upload requests in own org" ON public.item_upload_requests FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin cancel item upload requests" ON public.item_upload_requests FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE TABLE public.item_upload_request_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.item_upload_requests(id) ON DELETE CASCADE,
  uploader_name text NOT NULL,
  drive_file_id text NOT NULL,
  name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.item_upload_request_files TO authenticated;
GRANT ALL ON public.item_upload_request_files TO service_role;
ALTER TABLE public.item_upload_request_files ENABLE ROW LEVEL SECURITY;
CREATE INDEX item_upload_request_files_request_idx ON public.item_upload_request_files(request_id);

CREATE POLICY "read item upload request files in own org" ON public.item_upload_request_files FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.item_upload_requests r
    WHERE r.id = item_upload_request_files.request_id
      AND public.is_active_profile(auth.uid()) AND r.org_id = public.current_org_id()
  ));
