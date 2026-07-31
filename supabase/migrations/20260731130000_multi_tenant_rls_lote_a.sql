-- Multi-tenant Fase 1, passo 2 (Lote A): isolamento de verdade via RLS.
-- Reescreve as políticas das tabelas do núcleo (profiles, clients, months,
-- content_items, item_assignees, comments, item_files, email_role_assignments)
-- pra exigir que a linha pertença à mesma organização de quem está logado.
-- Cada política aqui é a política ATUAL (confirmada lendo o histórico de
-- migrations) com "AND org_id = current_org_id()" (ou o equivalente via
-- EXISTS pra tabelas sem coluna própria) adicionado — a lógica de
-- admin/dono/ativo continua igual, só ganha o filtro de agência.
--
-- Também corrige um detalhe da migration anterior: a tabela `orgs` tinha uma
-- política "master manage orgs" que deixaria QUALQUER master (de qualquer
-- agência) enxergar/editar a lista de agências inteira. Só a Luzeria (dona
-- da plataforma) deve gerenciar `orgs`.

-- ---------- orgs ----------
DROP POLICY IF EXISTS "auth read orgs" ON public.orgs;
DROP POLICY IF EXISTS "master manage orgs" ON public.orgs;

CREATE POLICY "read own org" ON public.orgs FOR SELECT TO authenticated
  USING (id = public.current_org_id());
CREATE POLICY "luzeria manages orgs" ON public.orgs FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- ---------- email_role_assignments ----------
-- Backfill: as 5 linhas hoje existentes são todas da Luzeria.
UPDATE public.email_role_assignments SET org_id = '00000000-0000-0000-0000-000000000001' WHERE org_id IS NULL;

DROP POLICY IF EXISTS "admins can read email role assignments" ON public.email_role_assignments;
CREATE POLICY "admins can read email role assignments" ON public.email_role_assignments FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ---------- profiles ----------
DROP POLICY IF EXISTS "active read profiles" ON public.profiles;
CREATE POLICY "active read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()));

DROP POLICY IF EXISTS "master can update any profile" ON public.profiles;
CREATE POLICY "master can update any profile" ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id());
-- "users update own basic profile" não muda: já é auth.uid() = id, sem risco de cross-org.

-- ---------- clients ----------
DROP POLICY IF EXISTS "active read clients" ON public.clients;
CREATE POLICY "active read clients" ON public.clients FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

DROP POLICY IF EXISTS "admin manage clients" ON public.clients;
CREATE POLICY "admin manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ---------- months ----------
DROP POLICY IF EXISTS "active read months" ON public.months;
CREATE POLICY "active read months" ON public.months FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

DROP POLICY IF EXISTS "admin manage months" ON public.months;
CREATE POLICY "admin manage months" ON public.months FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ---------- content_items ----------
DROP POLICY IF EXISTS "active read items" ON public.content_items;
CREATE POLICY "active read items" ON public.content_items FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id());

DROP POLICY IF EXISTS "admin manage items" ON public.content_items;
CREATE POLICY "admin manage items" ON public.content_items FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

-- ---------- item_assignees (sem org_id própria — checa via content_items) ----------
DROP POLICY IF EXISTS "active read assignees" ON public.item_assignees;
CREATE POLICY "active read assignees" ON public.item_assignees FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "active manage assignees" ON public.item_assignees;
CREATE POLICY "active manage assignees" ON public.item_assignees FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "active unassign" ON public.item_assignees;
CREATE POLICY "active unassign" ON public.item_assignees FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id())
  );

-- ---------- comments (sem org_id própria — checa via content_items) ----------
DROP POLICY IF EXISTS "active read comments" ON public.comments;
CREATE POLICY "active read comments" ON public.comments FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "auth insert own comments" ON public.comments;
CREATE POLICY "auth insert own comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND is_system = false
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "admin delete comments" ON public.comments;
CREATE POLICY "admin delete comments" ON public.comments FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id())
  );

-- ---------- item_files (sem org_id própria — checa via content_items) ----------
DROP POLICY IF EXISTS "active read item_files" ON public.item_files;
CREATE POLICY "active read item_files" ON public.item_files FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "item_files_write_assignee_or_admin" ON public.item_files;
CREATE POLICY "item_files_write_assignee_or_admin" ON public.item_files FOR INSERT TO authenticated
  WITH CHECK (
    (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid())
    )
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "item_files_update_assignee_or_admin" ON public.item_files;
CREATE POLICY "item_files_update_assignee_or_admin" ON public.item_files FOR UPDATE TO authenticated
  USING (
    (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid())
    )
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id())
  )
  WITH CHECK (
    (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid())
    )
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "item_files_delete_assignee_or_admin" ON public.item_files;
CREATE POLICY "item_files_delete_assignee_or_admin" ON public.item_files FOR DELETE TO authenticated
  USING (
    (
      public.is_admin(auth.uid())
      OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid())
    )
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id())
  );
