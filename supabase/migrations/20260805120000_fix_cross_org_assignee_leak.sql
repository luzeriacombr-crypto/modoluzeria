-- Bug real: item_assignees não checava se o usuário atribuído (alvo)
-- pertence à mesma agência do item — só checava se quem estava fazendo a
-- atribuição (auth.uid()) era da agência certa. Resultado: um usuário podia
-- ficar atribuído a itens de outra agência e passar a receber as
-- notificações de aprovação (OneSignal) daquela agência também.
DROP POLICY IF EXISTS "active manage assignees" ON public.item_assignees;
CREATE POLICY "active manage assignees" ON public.item_assignees FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = item_assignees.user_id AND p.org_id = public.current_org_id())
  );

-- Limpeza dos registros já vazados: remove atribuições onde o usuário
-- pertence a uma agência diferente da agência do item.
DELETE FROM public.item_assignees ia
USING public.content_items ci, public.profiles p
WHERE ia.item_id = ci.id
  AND ia.user_id = p.id
  AND p.org_id IS DISTINCT FROM ci.org_id;
