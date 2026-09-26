-- Nativo: "Kit do cliente" — cores, fontes, @ e logo de cada cliente da agência,
-- pra aplicar num post com um clique. Parte vem do Modo Criador (nome, cor,
-- foto do cliente); o resto fica aqui. client_id nulo = kit da própria agência.
-- Quem vê o cliente no MC (has_client_access) vê e edita o kit dele.
-- Pra reverter: DROP TABLE public.nativo_brand_kits;

CREATE TABLE public.nativo_brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL DEFAULT public.current_org_id() REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Kit' CHECK (char_length(name) BETWEEN 1 AND 120),
  -- Até 6 cores em hex (#RRGGBB).
  colors jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(colors) = 'array' AND jsonb_array_length(colors) <= 6),
  title_font text CHECK (title_font IS NULL OR char_length(title_font) < 40),
  body_font text CHECK (body_font IS NULL OR char_length(body_font) < 40),
  handle text CHECK (handle IS NULL OR char_length(handle) < 60),
  -- Logo enviado no Nativo (bucket nativo-media); sem ele usa a foto do cliente no MC.
  logo_path text CHECK (logo_path IS NULL OR char_length(logo_path) < 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX nativo_brand_kits_client ON public.nativo_brand_kits(org_id, client_id) WHERE client_id IS NOT NULL;
CREATE UNIQUE INDEX nativo_brand_kits_org ON public.nativo_brand_kits(org_id) WHERE client_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nativo_brand_kits TO authenticated;
GRANT ALL ON public.nativo_brand_kits TO service_role;
ALTER TABLE public.nativo_brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nativo kits read" ON public.nativo_brand_kits FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id))
  );

CREATE POLICY "nativo kits insert" ON public.nativo_brand_kits FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (client_id IS NULL OR (
      public.has_client_access(auth.uid(), client_id)
      AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_id AND c.org_id = public.current_org_id())
    ))
  );

CREATE POLICY "nativo kits update" ON public.nativo_brand_kits FOR UPDATE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id))
  )
  WITH CHECK (org_id = public.current_org_id());

CREATE POLICY "nativo kits delete" ON public.nativo_brand_kits FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND org_id = public.current_org_id()
    AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id))
  );

CREATE OR REPLACE FUNCTION public.nativo_brand_kits_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- Agência e cliente não mudam depois de criados.
  NEW.org_id := OLD.org_id;
  NEW.client_id := OLD.client_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER nativo_brand_kits_touch BEFORE UPDATE ON public.nativo_brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.nativo_brand_kits_touch();
