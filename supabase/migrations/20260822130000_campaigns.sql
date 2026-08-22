-- Campanhas: etiqueta que agrupa posts/reels/materiais de um cliente (ex:
-- "Campanha de aniversário"). Cada item marcado com uma campanha decide
-- individualmente se é "público" (continua aparecendo normal em
-- Posts/Reels/Preview de Feed, só carregando a etiqueta) ou "interno"
-- (some dessas telas, só existe dentro da própria campanha).
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT ON public.campaigns TO authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read campaigns" ON public.campaigns FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "admin manage campaigns" ON public.campaigns FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) AND org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), client_id)
  )
  WITH CHECK (
    public.is_admin(auth.uid()) AND org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), client_id)
  );

CREATE INDEX idx_campaigns_client ON public.campaigns(client_id);

ALTER TABLE public.content_items ADD COLUMN campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL;
ALTER TABLE public.content_items ADD COLUMN campaign_internal boolean NOT NULL DEFAULT false;
CREATE INDEX idx_content_items_campaign ON public.content_items(campaign_id);
