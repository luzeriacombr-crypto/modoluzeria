-- Histórico de contatos por lead: cada clique em "Marquei contato" vira
-- uma linha aqui, pra dar pro Junior contar quantos follow-ups já fez
-- com cada lead e saber a data do último contato (sem depender de
-- updated_at, que muda por qualquer edição, não só contato de verdade).
CREATE TABLE public.lead_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  contacted_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note text
);

GRANT SELECT, INSERT ON public.lead_contacts TO authenticated;
GRANT ALL ON public.lead_contacts TO service_role;
ALTER TABLE public.lead_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read lead contacts" ON public.lead_contacts FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "active write lead contacts" ON public.lead_contacts FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_lead_contacts_lead ON public.lead_contacts(lead_id, contacted_at DESC);
