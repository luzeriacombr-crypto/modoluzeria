-- Categorias de cliente customizadas por agência — complementa (não
-- substitui) as categorias fixas do código (Social Media, Pack Digital,
-- Avulsos, Ex-clientes — ver CATEGORY_ORDER em Sidebar.tsx), que
-- continuam protegidas por ter lógica especial grudada no nome exato.
-- Só existe linha aqui pra categoria de verdade criada pelo dono da
-- agência — nasce vazia pra toda org (nenhum seed), igual content_statuses.
CREATE TABLE public.client_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

GRANT SELECT ON public.client_categories TO authenticated;
GRANT ALL ON public.client_categories TO service_role;
ALTER TABLE public.client_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read client categories" ON public.client_categories FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "admin manage client categories" ON public.client_categories FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_client_categories_org ON public.client_categories(org_id, sort_order);
