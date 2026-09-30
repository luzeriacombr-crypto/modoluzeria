-- Orçamentos (Financeiro → Orçamentos): catálogo de produtos/serviços da
-- agência + orçamentos gerados a partir dele, exportados em PDF (Simples ou
-- Completo). Plano aprovado: claude.ai/artifact/41X9c5BsGyRCCDYvMckid1.
-- Mesmo padrão de acesso do resto do Financeiro (master ou cargo
-- "view_financeiro").
CREATE TABLE public.budget_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL DEFAULT 0,
  -- Variações do mesmo produto (ex: Essencial/Pro/Premium), cada uma com seu
  -- próprio preço e detalhe — [{label, priceCents, description}].
  plans jsonb NOT NULL DEFAULT '[]'::jsonb,
  icon text,
  photo_path text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_name text NOT NULL,
  client_segment text,
  version text NOT NULL CHECK (version IN ('simples', 'completo')),
  -- Itens escolhidos (do catálogo ou linha avulsa) — [{label, description, priceCents}].
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  logo_variant text NOT NULL DEFAULT 'dark' CHECK (logo_variant IN ('light', 'dark')),
  header_image_path text,
  footer_text text,
  -- Só usados na versão "completo":
  cover_phrase text,
  intro_title text,
  intro_text text,
  -- Entregas agrupadas em frentes — [{title, items:[{title, description}]}].
  fronts jsonb NOT NULL DEFAULT '[]'::jsonb,
  payment_terms text,
  cronograma text,
  not_included text,
  after_approval text,
  back_phrase text,
  -- Cores do documento — começam com o degradê/cor de "Marca da agência",
  -- mas ficam salvas por orçamento porque a pessoa pode trocar na hora.
  gradient_from text,
  gradient_to text,
  accent_color text,
  total_cents integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_budget_products_org ON public.budget_products(org_id);
CREATE INDEX idx_budgets_org ON public.budgets(org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.budget_products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.budgets TO authenticated;

ALTER TABLE public.budget_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro read budget products" ON public.budget_products FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
CREATE POLICY "financeiro write budget products" ON public.budget_products FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
CREATE POLICY "financeiro update budget products" ON public.budget_products FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
CREATE POLICY "financeiro delete budget products" ON public.budget_products FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));

CREATE POLICY "financeiro read budgets" ON public.budgets FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
CREATE POLICY "financeiro write budgets" ON public.budgets FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
CREATE POLICY "financeiro update budgets" ON public.budgets FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
CREATE POLICY "financeiro delete budgets" ON public.budgets FOR DELETE TO authenticated
  USING (org_id = public.current_org_id() AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro')));
