-- Link público "só pra ver" de uma campanha/projeto — mesmo padrão de
-- feed_share_tokens (token opaco, revogável/rotacionável), só que 1 por
-- campanha em vez de 1 por cliente. Não expõe o valor cobrado (é
-- informação financeira interna da agência, não do projeto em si).
CREATE TABLE public.campaign_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id)
);

GRANT SELECT ON public.campaign_share_tokens TO authenticated;
GRANT ALL ON public.campaign_share_tokens TO service_role;
ALTER TABLE public.campaign_share_tokens ENABLE ROW LEVEL SECURITY;

-- Diferente de feed_share_tokens (que deixa qualquer autenticado ler
-- token de qualquer org), aqui já nasce escopado pela org do dono da
-- campanha — sem motivo pra outra agência conseguir ler o token de
-- ninguém.
CREATE POLICY "org read campaign share tokens" ON public.campaign_share_tokens FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_share_tokens.campaign_id AND c.org_id = public.current_org_id())
  );

CREATE POLICY "admin manage campaign share tokens" ON public.campaign_share_tokens FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_share_tokens.campaign_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.campaigns c WHERE c.id = campaign_share_tokens.campaign_id AND c.org_id = public.current_org_id())
  );

CREATE INDEX idx_campaign_share_tokens_campaign ON public.campaign_share_tokens(campaign_id);

-- RPC pública (SECURITY DEFINER) que resolve um token pra os dados de
-- leitura da campanha — nunca inclui value_cents (valor cobrado do
-- cliente é interno da agência, não é pra quem só está vendo o projeto).
CREATE OR REPLACE FUNCTION public.get_public_campaign(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  result jsonb;
BEGIN
  SELECT campaign_id INTO v_campaign_id
  FROM campaign_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_campaign_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'campaign', jsonb_build_object(
      'name', c.name, 'description', c.description,
      'briefing', c.briefing, 'services', c.services, 'materials', c.materials
    ),
    'clientName', cl.name,
    'orgName', o.name,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', ci.id, 'type', ci.type, 'title', ci.title, 'status', ci.status
      ) ORDER BY ci.idx)
      FROM content_items ci WHERE ci.campaign_id = c.id
    ), '[]'::jsonb)
  ) INTO result
  FROM campaigns c
  JOIN clients cl ON cl.id = c.client_id
  JOIN orgs o ON o.id = c.org_id
  WHERE c.id = v_campaign_id;

  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_campaign(text) TO anon, authenticated;
