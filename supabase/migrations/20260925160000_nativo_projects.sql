-- Nativo (nativo.modocriador.com.br): editor de stories/carrosséis que usa o
-- mesmo login do Modo Criador. Guarda os projetos e templates de cada
-- agência — o conteúdo do editor vai inteiro em `doc` (jsonb) e as fotos no
-- bucket privado `nativo-media`, referenciadas no `doc` pelo caminho.
--
-- Visibilidade:
--   • kind = 'project'  → só quem criou vê e edita (projetos recentes).
--   • kind = 'template' → a agência inteira vê; quem criou ou admin da
--     agência edita/apaga.
-- Nenhuma agência enxerga nada de outra (org_id = current_org_id()).
--
-- Tabela e bucket novos, sem mexer em nada que já existe.

CREATE TABLE public.nativo_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.orgs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'project' CHECK (kind IN ('project', 'template')),
  name text NOT NULL DEFAULT 'Sem título' CHECK (char_length(name) BETWEEN 1 AND 120),
  format text NOT NULL DEFAULT '916' CHECK (format IN ('916', '45')),
  doc jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Miniatura pequena (JPEG em data URL, ~20 KB) pra listar projetos sem
  -- baixar fotos.
  thumb text CHECK (thumb IS NULL OR char_length(thumb) < 300000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Limite de sanidade pro conteúdo (fotos ficam no storage, não aqui).
  CONSTRAINT nativo_projects_doc_size CHECK (pg_column_size(doc) < 2000000)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nativo_projects TO authenticated;
GRANT ALL ON public.nativo_projects TO service_role;
ALTER TABLE public.nativo_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nativo read own projects and org templates" ON public.nativo_projects FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (owner_id = auth.uid() OR kind = 'template')
  );

CREATE POLICY "nativo insert own" ON public.nativo_projects FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND owner_id = auth.uid()
    AND org_id = public.current_org_id()
  );

CREATE POLICY "nativo update own or org admin template" ON public.nativo_projects FOR UPDATE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (owner_id = auth.uid() OR (kind = 'template' AND public.is_admin(auth.uid())))
  )
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "nativo delete own or org admin template" ON public.nativo_projects FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (owner_id = auth.uid() OR (kind = 'template' AND public.is_admin(auth.uid())))
  );

CREATE INDEX idx_nativo_projects_owner ON public.nativo_projects(owner_id, kind, updated_at DESC);
CREATE INDEX idx_nativo_projects_org_templates ON public.nativo_projects(org_id, updated_at DESC) WHERE kind = 'template';

CREATE OR REPLACE FUNCTION public.nativo_projects_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- Dono e agência não mudam depois de criados.
  NEW.owner_id := OLD.owner_id;
  NEW.org_id := OLD.org_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nativo_projects_touch BEFORE UPDATE ON public.nativo_projects
  FOR EACH ROW EXECUTE FUNCTION public.nativo_projects_touch();

-- Fotos: bucket privado, caminho <org_id>/<user_id>/<arquivo>.
-- Quem é da agência lê (templates da equipe usam fotos de quem criou);
-- só o dono envia e apaga dentro da própria pasta.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('nativo-media', 'nativo-media', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "nativo-media read same org" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'nativo-media'
    AND public.is_active_profile(auth.uid())
    AND (storage.foldername(name))[1] = public.current_org_id()::text
  );

CREATE POLICY "nativo-media insert own folder" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'nativo-media'
    AND public.is_active_profile(auth.uid())
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "nativo-media delete own folder" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'nativo-media'
    AND (storage.foldername(name))[1] = public.current_org_id()::text
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Pra reverter (DOWN), rodar:
--   DROP POLICY IF EXISTS "nativo-media read same org" ON storage.objects;
--   DROP POLICY IF EXISTS "nativo-media insert own folder" ON storage.objects;
--   DROP POLICY IF EXISTS "nativo-media delete own folder" ON storage.objects;
--   (esvaziar o bucket 'nativo-media' pelo painel do Storage — o banco não
--   deixa apagar arquivos direto por SQL — e depois:)
--   DELETE FROM storage.buckets WHERE id = 'nativo-media';
--   DROP TABLE IF EXISTS public.nativo_projects;
--   DROP FUNCTION IF EXISTS public.nativo_projects_touch();
