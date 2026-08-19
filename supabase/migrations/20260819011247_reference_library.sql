-- Biblioteca de Referências: banco de inspiração (link + notas + tags) que
-- o time guarda pra puxar depois na hora de escrever roteiro novo. Pode ser
-- de um cliente específico ou "geral" (client_id nulo).
CREATE TABLE public.reference_library_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE, -- NULL = geral
  title text NOT NULL,
  url text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reference_library_org ON public.reference_library_items (org_id, created_at DESC);
CREATE INDEX idx_reference_library_client ON public.reference_library_items (client_id);

ALTER TABLE public.reference_library_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read reference library" ON public.reference_library_items FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

CREATE POLICY "active insert reference library" ON public.reference_library_items FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

-- Só quem criou ou admin pode editar/apagar — evita alguém mexer na
-- referência salva por outra pessoa sem querer.
CREATE POLICY "author or admin update reference library" ON public.reference_library_items FOR UPDATE TO authenticated
  USING (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()
    AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
  )
  WITH CHECK (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()
    AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
  );

CREATE POLICY "author or admin delete reference library" ON public.reference_library_items FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()
    AND (created_by = auth.uid() OR public.is_admin(auth.uid()))
  );
