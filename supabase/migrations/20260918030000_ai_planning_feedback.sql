-- Avaliação de satisfação da prévia de planejamento por IA (feature em
-- beta) — 0 a 5 estrelas + motivo opcional, uma linha por avaliação
-- (não precisa ser única por cliente/mês, a pessoa pode avaliar de novo
-- toda vez que gerar uma prévia nova).
CREATE TABLE public.ai_planning_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 0 AND 5),
  reason text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_planning_feedback TO authenticated;
GRANT ALL ON public.ai_planning_feedback TO service_role;
ALTER TABLE public.ai_planning_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin insert own org feedback" ON public.ai_planning_feedback FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin read own org feedback" ON public.ai_planning_feedback FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_ai_planning_feedback_org ON public.ai_planning_feedback(org_id, created_at DESC);
