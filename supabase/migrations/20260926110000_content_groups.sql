-- Grupos dentro da grade de Posts/Reels/Stories de um cliente — hoje só
-- usado pra clientes "Avulsos" (que não têm meses de verdade, então não
-- tinham nenhuma forma de organizar o conteúdo além da ordem manual).
-- Diferente de "campaigns" (etiqueta que atravessa meses, com sub-aba
-- própria): grupo é uma seção que aparece direto na grade, com
-- arrastar-e-soltar pra mover item pra dentro. Mesmo padrão de RLS/grant
-- de campaigns.sql.
CREATE TABLE public.content_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT ON public.content_groups TO authenticated;
GRANT ALL ON public.content_groups TO service_role;
ALTER TABLE public.content_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read content_groups" ON public.content_groups FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), client_id)
  );

CREATE POLICY "admin manage content_groups" ON public.content_groups FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) AND org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), client_id)
  )
  WITH CHECK (
    public.is_admin(auth.uid()) AND org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), client_id)
  );

CREATE INDEX idx_content_groups_client ON public.content_groups(client_id);

-- Apagar um grupo só desagrupa os itens (ON DELETE SET NULL) — nunca apaga
-- conteúdo, mesmo padrão de campaign_id.
ALTER TABLE public.content_items ADD COLUMN group_id uuid REFERENCES public.content_groups(id) ON DELETE SET NULL;
CREATE INDEX idx_content_items_group ON public.content_items(group_id);
