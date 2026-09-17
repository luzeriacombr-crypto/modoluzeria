-- Banco de conhecimento de conteúdo por agência — texto livre ou arquivos
-- (PDF/Markdown/texto lidos pela IA; .doc/.docx guardados mas ainda não
-- lidos, não existe lib de extração instalada) que ensinam a IA como
-- aquela agência cria conteúdo. Alimenta generateMonthlyPlanPreview
-- (ai-planning.functions.ts) além do histórico já usado por cliente.
-- Diferente de client_brand_assets/client_contracts (que moraram no
-- bucket e migraram pro Drive pra ficar visível fora do app), esse
-- artefato é insumo interno só pra IA — não precisa viver no Drive da
-- agência, então fica num bucket próprio do Supabase (mesmo padrão de
-- bug-reports/comment-audio).
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-knowledge', 'org-knowledge', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "org-knowledge read own org" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'org-knowledge'
    AND public.is_active_profile(auth.uid())
    AND (storage.foldername(name))[1]::uuid = public.current_org_id()
  );
CREATE POLICY "org-knowledge admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-knowledge'
    AND public.is_admin(auth.uid())
    AND (storage.foldername(name))[1]::uuid = public.current_org_id()
  );
CREATE POLICY "org-knowledge admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-knowledge'
    AND public.is_admin(auth.uid())
    AND (storage.foldername(name))[1]::uuid = public.current_org_id()
  );

CREATE TABLE public.org_content_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('text', 'file')),
  title text,
  text_content text,
  storage_path text,
  file_name text,
  mime_type text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_content_knowledge TO authenticated;
GRANT ALL ON public.org_content_knowledge TO service_role;
ALTER TABLE public.org_content_knowledge ENABLE ROW LEVEL SECURITY;
CREATE POLICY "active read org knowledge" ON public.org_content_knowledge FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin manage org knowledge" ON public.org_content_knowledge FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());
CREATE INDEX idx_org_content_knowledge_org ON public.org_content_knowledge(org_id, created_at DESC);
