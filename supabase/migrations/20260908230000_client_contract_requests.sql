-- Contrato com modelo + variáveis + assinatura por link público (pedido
-- da Beatriz/Aluma Criativa) — mesmo padrão de segurança da Seleção de
-- Fotos: RLS não dá NENHUM acesso direto pro anon, todo acesso público
-- passa pelas funções SECURITY DEFINER abaixo, que validam o token por
-- dentro. Cada linha é um "pedido de assinatura" — o texto já vem com as
-- variáveis substituídas na hora de gerar (snapshot; editar o modelo
-- depois não muda um contrato já enviado).

ALTER TABLE public.clients
  ADD COLUMN cnpj_cpf text,
  ADD COLUMN address text,
  ADD COLUMN legal_responsible_name text;

-- Um modelo de contrato por agência, mesmo padrão de
-- orgs.payment_message_template (texto livre com {chave}, null cai no
-- modelo padrão embutido no front).
ALTER TABLE public.orgs ADD COLUMN contract_template text;

CREATE TABLE public.client_contract_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  contract_text text NOT NULL,
  status text NOT NULL DEFAULT 'aguardando' CHECK (status IN ('aguardando', 'assinado', 'cancelado')),
  signer_name text,
  signer_cpf text,
  signature_data_url text,
  signed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_contract_requests TO authenticated;
GRANT ALL ON public.client_contract_requests TO service_role;
ALTER TABLE public.client_contract_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX client_contract_requests_token_idx ON public.client_contract_requests(token);
CREATE INDEX client_contract_requests_client_idx ON public.client_contract_requests(client_id);

CREATE POLICY "read contract requests in own org" ON public.client_contract_requests FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());
CREATE POLICY "admin manage contract requests" ON public.client_contract_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ============ PUBLIC: dados do contrato pelo token ============
CREATE OR REPLACE FUNCTION public.get_public_contract_request(_token text)
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
  SELECT cr.id, cr.contract_text, cr.status, cr.signer_name, cr.signed_at,
         c.name AS client_name, o.name AS org_name, o.logo_path AS org_logo_path
    INTO req
  FROM public.client_contract_requests cr
  JOIN public.clients c ON c.id = cr.client_id
  JOIN public.orgs o ON o.id = cr.org_id
  WHERE cr.token = _token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'contractText', req.contract_text,
    'status', req.status,
    'signerName', req.signer_name,
    'signedAt', req.signed_at,
    'clientName', req.client_name,
    'orgName', req.org_name,
    'orgLogoPath', req.org_logo_path
  ) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.get_public_contract_request(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_contract_request(text) TO anon, authenticated;

-- ============ PUBLIC: assinar ============
CREATE OR REPLACE FUNCTION public.sign_client_contract_request(_token text, _signer_name text, _signer_cpf text, _signature_data_url text)
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
  v_signer text := btrim(_signer_name);
  v_cpf text := btrim(_signer_cpf);
  v_client_name text;
  v_message text;
  admin_rec record;
BEGIN
  IF v_signer IS NULL OR length(v_signer) = 0 OR length(v_signer) > 120 THEN RETURN false; END IF;
  IF v_cpf IS NULL OR length(v_cpf) = 0 OR length(v_cpf) > 20 THEN RETURN false; END IF;
  IF _signature_data_url IS NULL OR length(_signature_data_url) = 0 THEN RETURN false; END IF;

  SELECT id, org_id, client_id, status INTO v_id, v_org_id, v_client_id, v_status
  FROM public.client_contract_requests WHERE token = _token;
  IF v_id IS NULL OR v_status <> 'aguardando' THEN RETURN false; END IF;

  UPDATE public.client_contract_requests
  SET status = 'assinado', signer_name = v_signer, signer_cpf = v_cpf,
      signature_data_url = _signature_data_url, signed_at = now()
  WHERE id = v_id;

  SELECT name INTO v_client_name FROM public.clients WHERE id = v_client_id;
  v_message := v_client_name || ' assinou o contrato (assinado por ' || v_signer || ').';

  FOR admin_rec IN
    SELECT pr.id AS profile_id
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id AND ur.role IN ('master', 'setor')
    WHERE pr.org_id = v_org_id AND pr.active = true
  LOOP
    INSERT INTO public.notifications (user_id, type, client_id, message)
    VALUES (admin_rec.profile_id, 'contract_signed', v_client_id, v_message);
  END LOOP;

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.sign_client_contract_request(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_client_contract_request(text, text, text, text) TO anon, authenticated;
