-- Link público pra o CLIENTE conectar o próprio TikTok (pedido do Junior, 02/10) —
-- mesmo desenho do link do Instagram (20260912000000_instagram_connect_requests):
-- RLS não dá NENHUM acesso direto pro anon, todo acesso público passa pelas
-- funções SECURITY DEFINER abaixo, que validam o token por dentro. A troca do
-- código OAuth com o TikTok acontece na camada de app (precisa do client
-- secret); a função só recebe as credenciais já trocadas e grava.

CREATE TABLE public.tiktok_connect_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'conectado', 'expirado', 'cancelado')),
  tt_display_name text,
  connected_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tiktok_connect_requests TO authenticated;
GRANT ALL ON public.tiktok_connect_requests TO service_role;
ALTER TABLE public.tiktok_connect_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX tiktok_connect_requests_token_idx ON public.tiktok_connect_requests(token);
CREATE INDEX tiktok_connect_requests_client_idx ON public.tiktok_connect_requests(client_id);

CREATE POLICY "read tiktok connect requests in own org" ON public.tiktok_connect_requests FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin manage tiktok connect requests" ON public.tiktok_connect_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ============ PUBLIC: dados do pedido pelo token ============
CREATE OR REPLACE FUNCTION public.get_public_tiktok_connect_info(_token text)
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
  SELECT t.status, t.expires_at, c.name AS client_name, o.name AS org_name, o.logo_path AS org_logo_path
    INTO req
  FROM public.tiktok_connect_requests t
  JOIN public.clients c ON c.id = t.client_id
  JOIN public.orgs o ON o.id = t.org_id
  WHERE t.token = _token;
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
REVOKE ALL ON FUNCTION public.get_public_tiktok_connect_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_tiktok_connect_info(text) TO anon, authenticated;

-- ============ PUBLIC: completar a conexão ============
CREATE OR REPLACE FUNCTION public.complete_tiktok_connect_request(
  _token text, _open_id text, _display_name text, _avatar_url text,
  _access_token text, _access_token_expires_at timestamptz,
  _refresh_token text, _refresh_token_expires_at timestamptz, _scopes text
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
  FROM public.tiktok_connect_requests WHERE token = _token;
  IF v_id IS NULL OR v_status <> 'aguardando' OR v_expires_at < now() THEN
    RETURN false;
  END IF;

  INSERT INTO public.client_tiktok_credentials (
    client_id, open_id, display_name, avatar_url, access_token, access_token_expires_at,
    refresh_token, refresh_token_expires_at, scopes, connected_by, connected_at
  ) VALUES (
    v_client_id, _open_id, _display_name, _avatar_url, _access_token, _access_token_expires_at,
    _refresh_token, _refresh_token_expires_at, _scopes, NULL, now()
  )
  ON CONFLICT (client_id) DO UPDATE SET
    open_id = EXCLUDED.open_id,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    access_token = EXCLUDED.access_token,
    access_token_expires_at = EXCLUDED.access_token_expires_at,
    refresh_token = EXCLUDED.refresh_token,
    refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
    scopes = EXCLUDED.scopes,
    connected_by = NULL,
    connected_at = now();

  UPDATE public.tiktok_connect_requests
  SET status = 'conectado', tt_display_name = _display_name, connected_at = now()
  WHERE id = v_id;

  SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;

  FOR admin_rec IN
    SELECT pr.id AS profile_id
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id AND ur.role = 'master'
    WHERE pr.org_id = v_org_id AND pr.active = true
  LOOP
    INSERT INTO public.notifications (user_id, type, client_id, message)
    VALUES (admin_rec.profile_id, 'tiktok_connected_by_client', v_client_id,
            v_client_name || ' conectou o TikTok' || COALESCE(' (' || _display_name || ')', '') || ' pelo link.');
  END LOOP;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_tiktok_connect_request(text, text, text, text, text, timestamptz, text, timestamptz, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_tiktok_connect_request(text, text, text, text, text, timestamptz, text, timestamptz, text) TO anon, authenticated;
