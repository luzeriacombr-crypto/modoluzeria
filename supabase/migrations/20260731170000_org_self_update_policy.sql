-- Faltava permitir que o master de uma agência (não-Luzeria) atualize o
-- próprio registro em `orgs` (nome/slogan/logo). A política existente
-- "luzeria manages orgs" só cobre a Luzeria gerenciando QUALQUER agência;
-- essa aqui cobre uma agência gerenciando A SI MESMA.
CREATE POLICY "org master updates own org" ON public.orgs FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND id = public.current_org_id())
  WITH CHECK (public.is_master(auth.uid()) AND id = public.current_org_id());
