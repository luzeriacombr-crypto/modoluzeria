-- Correção urgente: a política "reseller manages resold orgs" (migration
-- anterior) fazia um EXISTS consultando a própria tabela orgs dentro da
-- política de orgs — Postgres detecta isso como recursão infinita
-- (42P17) e derruba QUALQUER leitura de orgs pra QUALQUER usuário, não só
-- pra quem mexe com revenda. Foi isso que zerou a marca (logo/cores) de
-- todas as agências: getMe() lê orgs, a query falhava, e o código não
-- checava o erro — silenciosamente virava tudo null.
--
-- Fix: mesmo padrão já usado por current_org_id()/is_master() — uma
-- função SECURITY DEFINER, que bypassa RLS internamente, evita a política
-- ter que reconsultar a tabela que ela mesma protege.
CREATE OR REPLACE FUNCTION public.is_org_reseller(_org_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_reseller FROM public.orgs WHERE id = _org_id), false)
$$;
REVOKE ALL ON FUNCTION public.is_org_reseller(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_org_reseller(uuid) TO authenticated;

DROP POLICY IF EXISTS "reseller manages resold orgs" ON public.orgs;
CREATE POLICY "reseller manages resold orgs" ON public.orgs FOR ALL TO authenticated
  USING (
    public.is_master(auth.uid())
    AND reseller_org_id IS NOT NULL
    AND reseller_org_id = public.current_org_id()
    AND public.is_org_reseller(public.current_org_id())
  )
  WITH CHECK (
    public.is_master(auth.uid())
    AND reseller_org_id IS NOT NULL
    AND reseller_org_id = public.current_org_id()
    AND public.is_org_reseller(public.current_org_id())
  );
