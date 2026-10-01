-- Endurecimento de acesso aos dados, depois da auditoria motivada pela
-- pesquisa da UpGuard (set/2026) sobre bancos Supabase expostos. Nenhuma
-- tabela estava aberta pro anon; aqui o foco é vazamento DENTRO do app
-- (entre membros de uma agência, ou entre agências).

-- ============ 1. Tokens de Instagram/Facebook ============
-- access_token só é lido pelo servidor (service role). Antes, qualquer
-- membro ativo com acesso ao cliente lia o token pela API e podia postar
-- como o cliente — inclusive depois de sair da agência, guardando o token.
-- A sessão do usuário continua lendo as outras colunas (status "conectado",
-- @ do perfil, nome da Página) e continua podendo inserir/atualizar/apagar
-- conforme a RLS de master.
REVOKE ALL ON public.client_instagram_credentials FROM anon;
REVOKE SELECT ON public.client_instagram_credentials FROM authenticated;
GRANT SELECT (client_id, instagram_business_account_id, ig_username, connected_by, connected_at, token_expires_at)
  ON public.client_instagram_credentials TO authenticated;

REVOKE ALL ON public.client_facebook_credentials FROM anon;
REVOKE SELECT ON public.client_facebook_credentials FROM authenticated;
GRANT SELECT (client_id, facebook_page_id, page_name, connected_by, connected_at, token_expires_at)
  ON public.client_facebook_credentials TO authenticated;

-- Facebook não tinha o filtro por acesso ao cliente que o Instagram ganhou
-- em 20260822100000 — quem tem acesso restrito via a conexão de qualquer
-- cliente da agência.
DROP POLICY IF EXISTS "active read own org facebook credentials" ON public.client_facebook_credentials;
CREATE POLICY "active read own org facebook credentials" ON public.client_facebook_credentials FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_facebook_credentials.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "master manage own org facebook credentials" ON public.client_facebook_credentials;
CREATE POLICY "master manage own org facebook credentials" ON public.client_facebook_credentials FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_facebook_credentials.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_master(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_facebook_credentials.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ 2. app_settings ============
-- A tabela não tem org_id e a escrita só exigia is_master() — que não olha
-- agência. O master de QUALQUER agência podia mudar ajustes globais e a
-- pasta raiz do Drive de outra agência; e todo mundo lia tudo.
-- Convenção: chave sem ":" é global; "<chave>:<org_id>" é da agência.
DROP POLICY IF EXISTS "Authenticated can read settings" ON public.app_settings;
CREATE POLICY "read global or own org settings" ON public.app_settings FOR SELECT TO authenticated
  USING (position(':' in key) = 0 OR split_part(key, ':', 2) = public.current_org_id()::text);

DROP POLICY IF EXISTS "Masters can upsert settings" ON public.app_settings;
CREATE POLICY "master manage own org settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND split_part(key, ':', 2) = public.current_org_id()::text)
  WITH CHECK (public.is_master(auth.uid()) AND split_part(key, ':', 2) = public.current_org_id()::text);
CREATE POLICY "luzeria master manage global settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001' AND position(':' in key) = 0)
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001' AND position(':' in key) = 0);

-- ============ 3. run_month_rollover ============
-- SECURITY DEFINER sem checar quem chama, roda pra todas as agências. Só o
-- pg_cron (dono da função) precisa chamar.
REVOKE EXECUTE ON FUNCTION public.run_month_rollover() FROM PUBLIC, anon, authenticated;

-- ============ 4. Contratos: CPF e assinatura ============
-- signer_cpf e signature_data_url eram lidos por qualquer membro ativo da
-- agência. A tela de contrato já é só de admin; a leitura passa a ser só
-- pela política de admin, agora também respeitando o acesso ao cliente.
DROP POLICY IF EXISTS "read contract requests in own org" ON public.client_contract_requests;
DROP POLICY IF EXISTS "admin manage contract requests" ON public.client_contract_requests;
CREATE POLICY "admin manage contract requests" ON public.client_contract_requests FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id))
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

-- ============ 5. Bucket item-uploads-temp ============
-- Não é mais usado (upload temporário foi pro reel-covers — ver
-- drive.functions.ts), mas deixava qualquer usuário logado subir e apagar
-- arquivo de qualquer agência. Sem política, só o service role mexe.
DROP POLICY IF EXISTS "item-uploads-temp insert by authenticated" ON storage.objects;
DROP POLICY IF EXISTS "item-uploads-temp delete by authenticated" ON storage.objects;
