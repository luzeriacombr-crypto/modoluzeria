-- "Atualizações" tab in Configurações: a changelog Junior (the platform
-- owner) publishes so every agency's master sees what changed in the
-- product and can jump straight to it. Global content (same for every
-- org), not per-agency data — only the Luzeria platform owner can write.
CREATE TABLE public.platform_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  link_path text,
  link_label text,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_updates TO authenticated;
GRANT ALL ON public.platform_updates TO service_role;
ALTER TABLE public.platform_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read platform updates" ON public.platform_updates FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

CREATE POLICY "platform owner manage updates" ON public.platform_updates FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

CREATE INDEX idx_platform_updates_published_at ON public.platform_updates(published_at DESC);
