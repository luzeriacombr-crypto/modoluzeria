-- Nativo: pastas pessoais pra organizar os projetos (só o dono vê e mexe).
-- Apagar uma pasta NÃO apaga os projetos: eles voltam pra tela inicial (ON DELETE SET NULL).
-- Só projetos (kind = 'project') ficam em pasta; modelos e templates não.
-- Pra reverter: ALTER TABLE public.nativo_projects DROP COLUMN folder_id; DROP TABLE public.nativo_folders;

CREATE TABLE public.nativo_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.orgs(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_nativo_folders_owner ON public.nativo_folders(owner_id, created_at);

REVOKE ALL ON public.nativo_folders FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.nativo_folders TO authenticated;
GRANT ALL ON public.nativo_folders TO service_role;
ALTER TABLE public.nativo_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nativo folders read own" ON public.nativo_folders FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND owner_id = auth.uid());
CREATE POLICY "nativo folders insert own" ON public.nativo_folders FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND owner_id = auth.uid());
CREATE POLICY "nativo folders update own" ON public.nativo_folders FOR UPDATE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND owner_id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND owner_id = auth.uid());
CREATE POLICY "nativo folders delete own" ON public.nativo_folders FOR DELETE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND owner_id = auth.uid());

-- Dono e agência não mudam depois de criados.
CREATE OR REPLACE FUNCTION public.nativo_folders_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.owner_id := OLD.owner_id;
  NEW.org_id := OLD.org_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nativo_folders_touch BEFORE UPDATE ON public.nativo_folders
  FOR EACH ROW EXECUTE FUNCTION public.nativo_folders_touch();

ALTER TABLE public.nativo_projects
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.nativo_folders(id) ON DELETE SET NULL;
ALTER TABLE public.nativo_projects
  ADD CONSTRAINT nativo_projects_folder_only_project CHECK (folder_id IS NULL OR kind = 'project');
CREATE INDEX IF NOT EXISTS idx_nativo_projects_folder ON public.nativo_projects(folder_id, updated_at DESC) WHERE folder_id IS NOT NULL;
