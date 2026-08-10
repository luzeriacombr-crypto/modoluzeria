-- Log de toda mensagem "enviada" pra atualizar o cliente sobre o andamento
-- (via troca de etapa ou lembrete semanal) — best-effort, sem confirmação de
-- entrega, igual todo link wa.me já usado no projeto. Usado tanto pra montar
-- o histórico por cliente quanto pro cron semanal calcular "há quanto tempo
-- não mandamos atualização".

CREATE TABLE public.client_stage_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  stage_id uuid REFERENCES public.client_journey_stages(id) ON DELETE SET NULL,
  trigger text NOT NULL CHECK (trigger IN ('stage_change', 'weekly_nudge', 'manual')),
  message text NOT NULL,
  sent_by uuid NOT NULL REFERENCES public.profiles(id),
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.client_stage_updates TO authenticated;
GRANT ALL ON public.client_stage_updates TO service_role;
ALTER TABLE public.client_stage_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read stage updates" ON public.client_stage_updates FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin insert stage updates" ON public.client_stage_updates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND sent_by = auth.uid());

CREATE INDEX idx_client_stage_updates_client_recent ON public.client_stage_updates(client_id, sent_at DESC);
