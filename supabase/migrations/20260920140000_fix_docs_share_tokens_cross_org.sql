-- Fecha vazamento entre agências nos tokens de documentos.
--
-- Como estava (desde 20260918060000):
--   "Authenticated can read docs share tokens"  USING (true)
--   "Admins manage docs share tokens"           USING (is_admin(auth.uid()))
--
-- A primeira deixava QUALQUER pessoa logada — de qualquer agência — listar
-- os tokens de compartilhamento de todas as outras. Com o token na mão, a
-- página pública abre os roteiros e planejamentos dos clientes daquela
-- agência. A segunda tinha o mesmo furo pra admin: sem filtro de org, um
-- admin de uma agência gerenciava tokens de outra.
--
-- Achado numa auditoria em 20/09/2026. As agências clientes competem entre
-- si, então isso é vazamento de material estratégico de cliente.
--
-- A tabela não tem org_id — o vínculo é pelo cliente, então o filtro vai
-- por clients.org_id, no mesmo padrão de client_docs (incluindo a
-- restrição por cliente de client_access_restriction).
--
-- O acesso público por token NÃO passa por aqui: getPublicClientDocs
-- resolve o cliente por get_client_id_for_docs_token, que é
-- SECURITY DEFINER. O link que já está com o cliente continua funcionando.
--
-- Pra reverter: recriar as duas policies como estavam em 20260918060000.

DROP POLICY IF EXISTS "Authenticated can read docs share tokens" ON public.client_docs_share_tokens;
DROP POLICY IF EXISTS "Admins manage docs share tokens" ON public.client_docs_share_tokens;

CREATE POLICY "active read docs share tokens"
  ON public.client_docs_share_tokens FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = client_docs_share_tokens.client_id
         AND c.org_id = public.current_org_id()
         AND public.has_client_access(auth.uid(), c.id)
    )
  );

CREATE POLICY "admin manage docs share tokens"
  ON public.client_docs_share_tokens FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = client_docs_share_tokens.client_id
         AND c.org_id = public.current_org_id()
         AND public.has_client_access(auth.uid(), c.id)
    )
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.clients c
       WHERE c.id = client_docs_share_tokens.client_id
         AND c.org_id = public.current_org_id()
         AND public.has_client_access(auth.uid(), c.id)
    )
  );
