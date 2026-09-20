-- Log simples de navegação (qual página cada usuário abriu, e quando) —
-- ferramenta interna do Junior pra acompanhar uso real de agências novas
-- (ex: uma trial que ainda não configurou nada, mas está navegando no
-- app). Só grava pra frente a partir de quando essa migração rodar —
-- não existe histórico anterior de navegação em nenhum lugar do banco.
-- Sem SELECT pra `authenticated` de propósito: é um dado interno da
-- plataforma sobre o USO do produto, não um dado que a própria agência
-- deveria ver sobre si mesma — só o platform admin lê, via supabaseAdmin
-- (mesmo padrão de ai_planning_feedback).
CREATE TABLE public.page_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.page_views TO authenticated;
GRANT ALL ON public.page_views TO service_role;
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active profile logs own page view" ON public.page_views FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND user_id = auth.uid()
  );

CREATE INDEX idx_page_views_user_created ON public.page_views(user_id, created_at DESC);
CREATE INDEX idx_page_views_org_created ON public.page_views(org_id, created_at DESC);
