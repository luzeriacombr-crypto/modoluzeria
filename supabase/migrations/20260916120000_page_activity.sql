-- Rastreamento de uso: qual rota cada pessoa visitou e por quanto tempo,
-- pra montar um ranking de páginas mais/menos usadas (sem rastrear
-- mouse/toque — só entrada/saída de rota). Escrita é feita pelo próprio
-- usuário (RLS restrita à própria org/perfil); a leitura agregada pra
-- todas as agências acontece via service-role dentro de uma função de
-- servidor gated por LUZERIA_ORG_ID (mesmo padrão de listOrgsBilling).
CREATE TABLE public.page_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.page_activity TO authenticated;
GRANT ALL ON public.page_activity TO service_role;
ALTER TABLE public.page_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own org insert page activity" ON public.page_activity FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());

CREATE POLICY "master read own org page activity" ON public.page_activity FOR SELECT TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_page_activity_created ON public.page_activity(created_at DESC);
CREATE INDEX idx_page_activity_path ON public.page_activity(path);
