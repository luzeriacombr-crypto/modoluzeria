-- House: a pessoa da equipe (Member) escreve o planejamento e os roteiros
-- da marca — numa agência isso é só de admin. Aprovar um roteiro (o que
-- cria o item no fluxo de produção) continua sendo do gestor.

CREATE OR REPLACE FUNCTION public.is_house_team(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.orgs o ON o.id = p.org_id
     WHERE p.id = _user_id AND p.active AND o.account_type = 'house'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_house_team(uuid) TO authenticated;

DROP POLICY IF EXISTS "house team manage client docs" ON public.client_docs;
CREATE POLICY "house team manage client docs" ON public.client_docs FOR ALL TO authenticated
  USING (public.is_house_team(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_house_team(auth.uid()) AND org_id = public.current_org_id());

DROP POLICY IF EXISTS "house team manage roteiro status" ON public.client_doc_roteiro_status;
CREATE POLICY "house team manage roteiro status" ON public.client_doc_roteiro_status FOR ALL TO authenticated
  USING (public.is_house_team(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_house_team(auth.uid()) AND org_id = public.current_org_id());
-- (Quem pode MARCAR como aprovado é checado no servidor — upsertRoteiroStatus —
-- porque a equipe ainda precisa editar a linha depois, ex: "Marcar gravado".)

DROP POLICY IF EXISTS "house team insert ai feedback" ON public.ai_planning_feedback;
CREATE POLICY "house team insert ai feedback" ON public.ai_planning_feedback FOR INSERT TO authenticated
  WITH CHECK (public.is_house_team(auth.uid()) AND org_id = public.current_org_id());
