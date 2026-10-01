-- Nativo: devolve só o @ do Instagram dos clientes que a pessoa pode ver no Modo Criador,
-- pro "Kit do cliente" montar o cartão de perfil sozinho. A tabela de credenciais guarda
-- o token de acesso, então o Nativo NÃO lê a tabela: lê só esta função (sem token).
-- Pra reverter: DROP FUNCTION public.nativo_client_ig_handles();

CREATE OR REPLACE FUNCTION public.nativo_client_ig_handles()
RETURNS TABLE (client_id uuid, ig_username text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cr.client_id, cr.ig_username
  FROM public.client_instagram_credentials cr
  JOIN public.clients c ON c.id = cr.client_id
  WHERE public.is_active_profile(auth.uid())
    AND c.org_id = public.current_org_id()
    AND public.has_client_access(auth.uid(), c.id)
    AND cr.ig_username IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.nativo_client_ig_handles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.nativo_client_ig_handles() TO authenticated;
