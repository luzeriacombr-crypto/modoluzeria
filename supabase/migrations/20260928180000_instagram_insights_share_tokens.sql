-- Link público "só pra ver" dos Insights do Instagram de um cliente — pra
-- agência mandar pro próprio cliente acompanhar as métricas sem precisar
-- de login. Mesmo padrão de campaign_share_tokens (token opaco,
-- revogável/rotacionável, 1 por cliente).
CREATE TABLE public.insights_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

GRANT SELECT ON public.insights_share_tokens TO authenticated;
GRANT ALL ON public.insights_share_tokens TO service_role;
ALTER TABLE public.insights_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org read insights share tokens" ON public.insights_share_tokens FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = insights_share_tokens.client_id AND c.org_id = public.current_org_id())
  );

CREATE POLICY "admin manage insights share tokens" ON public.insights_share_tokens FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = insights_share_tokens.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = insights_share_tokens.client_id AND c.org_id = public.current_org_id())
  );

CREATE INDEX idx_insights_share_tokens_client ON public.insights_share_tokens(client_id);

-- RPC pública (SECURITY DEFINER) — só valida o token e devolve o que a
-- página pública precisa pra montar o cabeçalho (nome do cliente, marca da
-- agência). Os números de métricas em si vêm depois, ao vivo da Graph API
-- da Meta (não ficam guardados no banco), buscados server-side pelo
-- server fn público usando supabaseAdmin depois de validar esse token.
CREATE OR REPLACE FUNCTION public.get_public_instagram_insights_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'clientId', t.client_id,
    'clientName', c.name,
    'orgName', o.name,
    'orgLogoPath', COALESCE(o.logo_path_light, o.logo_path),
    'colorPrimary', o.color_primary
  ) INTO result
  FROM insights_share_tokens t
  JOIN clients c ON c.id = t.client_id
  JOIN orgs o ON o.id = c.org_id
  WHERE t.token = _token AND t.revoked_at IS NULL;

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_instagram_insights_info(text) TO anon, authenticated;
