-- Expõe só o nome da agência indicadora pra um código de indicação válido —
-- usado pela página pública /r/<code> pra personalizar "Fulano te convidou"
-- (visitante anônimo, ainda sem conta). Mesmo padrão de
-- get_public_contract_request: SECURITY DEFINER, sem abrir leitura geral
-- da tabela orgs pra anon.
CREATE OR REPLACE FUNCTION public.get_public_referrer_name(_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT name FROM public.orgs WHERE referral_code = lower(_code) LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_referrer_name(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_referrer_name(text) TO anon, authenticated;
