-- Link público pra o CLIENTE conectar o próprio Instagram (pedido do
-- Junior) — hoje quem faz login na tela da Meta é a pessoa da agência,
-- só que precisa da senha do cliente e o código de 2FA cai no celular
-- dele, não no dela. Mesmo padrão de segurança do Contrato por
-- assinatura (client_contract_requests): RLS não dá NENHUM acesso
-- direto pro anon, todo acesso público passa pelas funções SECURITY
-- DEFINER abaixo, que validam o token por dentro.

CREATE TABLE public.instagram_connect_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'conectado', 'expirado', 'cancelado')),
  ig_username text,
  connected_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_connect_requests TO authenticated;
GRANT ALL ON public.instagram_connect_requests TO service_role;
ALTER TABLE public.instagram_connect_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX instagram_connect_requests_token_idx ON public.instagram_connect_requests(token);
CREATE INDEX instagram_connect_requests_client_idx ON public.instagram_connect_requests(client_id);

CREATE POLICY "read instagram connect requests in own org" ON public.instagram_connect_requests FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin manage instagram connect requests" ON public.instagram_connect_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ============ PUBLIC: dados do pedido pelo token ============
CREATE OR REPLACE FUNCTION public.get_public_instagram_connect_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req record;
  result jsonb;
BEGIN
  SELECT icr.status, icr.expires_at, c.name AS client_name, o.name AS org_name, o.logo_path AS org_logo_path
    INTO req
  FROM public.instagram_connect_requests icr
  JOIN public.clients c ON c.id = icr.client_id
  JOIN public.orgs o ON o.id = icr.org_id
  WHERE icr.token = _token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'status', req.status,
    'expiresAt', req.expires_at,
    'clientName', req.client_name,
    'orgName', req.org_name,
    'orgLogoPath', req.org_logo_path
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_instagram_connect_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_instagram_connect_info(text) TO anon, authenticated;

-- ============ PUBLIC: completar a conexão (chamado depois da troca de
-- código OAuth, que acontece na camada de app — essa função só recebe
-- as credenciais já trocadas e grava) ============
CREATE OR REPLACE FUNCTION public.complete_instagram_connect_request(
  _token text, _ig_username text, _ig_business_account_id text,
  _access_token text, _token_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_org_id uuid;
  v_client_id uuid;
  v_status text;
  v_expires_at timestamptz;
  v_client_name text;
  admin_rec record;
BEGIN
  SELECT id, org_id, client_id, status, expires_at INTO v_id, v_org_id, v_client_id, v_status, v_expires_at
  FROM public.instagram_connect_requests WHERE token = _token;
  IF v_id IS NULL OR v_status <> 'aguardando' OR v_expires_at < now() THEN
    RETURN false;
  END IF;

  INSERT INTO public.client_instagram_credentials (client_id, instagram_business_account_id, ig_username, access_token, token_expires_at, connected_by, connected_at)
  VALUES (v_client_id, _ig_business_account_id, _ig_username, _access_token, _token_expires_at, NULL, now())
  ON CONFLICT (client_id) DO UPDATE SET
    instagram_business_account_id = EXCLUDED.instagram_business_account_id,
    ig_username = EXCLUDED.ig_username,
    access_token = EXCLUDED.access_token,
    token_expires_at = EXCLUDED.token_expires_at,
    connected_by = NULL,
    connected_at = now();

  UPDATE public.instagram_connect_requests
  SET status = 'conectado', ig_username = _ig_username, connected_at = now()
  WHERE id = v_id;

  SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;

  FOR admin_rec IN
    SELECT pr.id AS profile_id
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id AND ur.role = 'master'
    WHERE pr.org_id = v_org_id AND pr.active = true
  LOOP
    INSERT INTO public.notifications (user_id, type, client_id, message)
    VALUES (admin_rec.profile_id, 'instagram_connected_by_client', v_client_id, v_client_name || ' conectou o Instagram (@' || _ig_username || ') pelo link.');
  END LOOP;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_instagram_connect_request(text, text, text, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_instagram_connect_request(text, text, text, text, timestamptz) TO anon, authenticated;
