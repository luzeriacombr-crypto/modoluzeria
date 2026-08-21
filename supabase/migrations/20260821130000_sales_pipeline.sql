-- CRM de vendas simples em kanban: etapas customizáveis por agência (mesmo
-- padrão de client_journey_stages) + leads que passam por elas. Quando um
-- lead é "ganho" ele vira um cliente de verdade (won_client_id aponta pra
-- lá); "perdido" só arquiva. Ferramenta de time — qualquer perfil ativo lê/
-- cria/edita lead (igual content_items), só admin mexe na estrutura das
-- etapas ou apaga um lead de vez.
CREATE TABLE public.sales_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sales_stages TO authenticated;
GRANT ALL ON public.sales_stages TO service_role;
ALTER TABLE public.sales_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read sales stages" ON public.sales_stages FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage sales stages" ON public.sales_stages FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_sales_stages_org ON public.sales_stages(org_id, sort_order);

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact_phone text,
  contact_email text,
  source text,
  notes text,
  value_estimate_cents integer,
  stage_id uuid REFERENCES public.sales_stages(id) ON DELETE SET NULL,
  responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  archived boolean NOT NULL DEFAULT false,
  won_client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read leads" ON public.leads FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "active write leads" ON public.leads FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "active update leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin delete leads" ON public.leads FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_leads_org ON public.leads(org_id, archived, stage_id);

-- Seed de etapas padrão pras agências já existentes — editável depois.
INSERT INTO public.sales_stages (org_id, name, sort_order)
SELECT o.id, v.name, v.sort_order
FROM public.orgs o
CROSS JOIN (VALUES
  ('Novo', 0),
  ('Contato feito', 1),
  ('Proposta enviada', 2),
  ('Fechado', 3),
  ('Perdido', 4)
) AS v(name, sort_order);
