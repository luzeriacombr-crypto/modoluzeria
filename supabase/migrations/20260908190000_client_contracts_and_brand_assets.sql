-- Contrato assinado por cliente (item 1 da reunião com a Beatriz) — hoje
-- não existe nenhum campo pra isso, só "observações" em texto livre.
CREATE TABLE public.client_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  uploaded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contracts TO authenticated;
GRANT ALL ON public.client_contracts TO service_role;
ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read client contracts in own org" ON public.client_contracts FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin manage client contracts" ON public.client_contracts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- Arquivos de marca por cliente (item 2 da reunião) — banco de arquivos
-- fixos (logo em PNG, etc.) que o editor sempre usa daquele cliente,
-- separado da Biblioteca de Referências (que é link/moodboard, editável
-- por qualquer membro ativo) — aqui é arquivo, e só admin gerencia.
CREATE TABLE public.client_brand_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  label text,
  storage_path text NOT NULL,
  mime_type text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_brand_assets TO authenticated;
GRANT ALL ON public.client_brand_assets TO service_role;
ALTER TABLE public.client_brand_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read client brand assets in own org" ON public.client_brand_assets FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin manage client brand assets" ON public.client_brand_assets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- Buckets privados. Caminho sempre "<client_id>/<arquivo>" — a policy do
-- storage confere que o client_id no caminho pertence à org do usuário
-- (mesmo padrão de comment-audio, 20260827120000).
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-contracts', 'client-contracts', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-brand-assets', 'client-brand-assets', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "client-contracts read own org" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-contracts'
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = split_part(name, '/', 1) AND c.org_id = public.current_org_id()
    )
  );
CREATE POLICY "client-contracts admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-contracts'
    AND public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = split_part(name, '/', 1) AND c.org_id = public.current_org_id()
    )
  );
CREATE POLICY "client-contracts admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-contracts'
    AND public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = split_part(name, '/', 1) AND c.org_id = public.current_org_id()
    )
  );

CREATE POLICY "client-brand-assets read own org" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-brand-assets'
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = split_part(name, '/', 1) AND c.org_id = public.current_org_id()
    )
  );
CREATE POLICY "client-brand-assets admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-brand-assets'
    AND public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = split_part(name, '/', 1) AND c.org_id = public.current_org_id()
    )
  );
CREATE POLICY "client-brand-assets admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-brand-assets'
    AND public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id::text = split_part(name, '/', 1) AND c.org_id = public.current_org_id()
    )
  );
