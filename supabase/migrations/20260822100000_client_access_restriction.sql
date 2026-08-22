-- Restrição de acesso por cliente: um admin pode marcar um perfil como
-- "restrito" e escolher exatamente quais clientes ele enxerga. Por padrão
-- (client_access_restricted = false) o comportamento de hoje continua: todo
-- mundo ativo vê todos os clientes da org — isso é essencial pra não quebrar
-- ninguém que já usa o sistema. A restrição vale pra qualquer perfil,
-- inclusive Adm Setor, decidido caso a caso pelo admin (não é automática por
-- papel).

ALTER TABLE public.profiles ADD COLUMN client_access_restricted boolean NOT NULL DEFAULT false;

CREATE TABLE public.client_access (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, client_id)
);

GRANT SELECT ON public.client_access TO authenticated;
GRANT ALL ON public.client_access TO service_role;
ALTER TABLE public.client_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "active read client access" ON public.client_access FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = client_access.profile_id AND p.org_id = public.current_org_id())
  );

CREATE POLICY "admin manage client access" ON public.client_access FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = client_access.profile_id AND p.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = client_access.profile_id AND p.org_id = public.current_org_id())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_access.client_id AND c.org_id = public.current_org_id())
  );

CREATE INDEX idx_client_access_profile ON public.client_access(profile_id);
CREATE INDEX idx_client_access_client ON public.client_access(client_id);

CREATE OR REPLACE FUNCTION public.has_client_access(_user_id uuid, _client_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT COALESCE((SELECT client_access_restricted FROM public.profiles WHERE id = _user_id), false)
    OR EXISTS (SELECT 1 FROM public.client_access WHERE profile_id = _user_id AND client_id = _client_id)
$$;
GRANT EXECUTE ON FUNCTION public.has_client_access(uuid, uuid) TO authenticated;

-- ============ clients ============
DROP POLICY IF EXISTS "active read clients" ON public.clients;
CREATE POLICY "active read clients" ON public.clients FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), id));

DROP POLICY IF EXISTS "admin manage clients" ON public.clients;
CREATE POLICY "admin manage clients" ON public.clients FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), id))
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), id));

-- ============ months ============
DROP POLICY IF EXISTS "active read months" ON public.months;
CREATE POLICY "active read months" ON public.months FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "admin manage months" ON public.months;
CREATE POLICY "admin manage months" ON public.months FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id))
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

-- ============ content_items (via months.client_id) ============
DROP POLICY IF EXISTS "active read items" ON public.content_items;
CREATE POLICY "active read items" ON public.content_items FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid()) AND org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.months m WHERE m.id = content_items.month_id AND public.has_client_access(auth.uid(), m.client_id))
  );

DROP POLICY IF EXISTS "admin manage items" ON public.content_items;
CREATE POLICY "admin manage items" ON public.content_items FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid()) AND org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.months m WHERE m.id = content_items.month_id AND public.has_client_access(auth.uid(), m.client_id))
  )
  WITH CHECK (
    public.is_admin(auth.uid()) AND org_id = public.current_org_id()
    AND EXISTS (SELECT 1 FROM public.months m WHERE m.id = content_items.month_id AND public.has_client_access(auth.uid(), m.client_id))
  );

-- ============ item_assignees (via content_items.month_id -> months.client_id) ============
DROP POLICY IF EXISTS "active read assignees" ON public.item_assignees;
CREATE POLICY "active read assignees" ON public.item_assignees FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "active manage assignees" ON public.item_assignees;
CREATE POLICY "active manage assignees" ON public.item_assignees FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = item_assignees.user_id AND p.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "active unassign" ON public.item_assignees;
CREATE POLICY "active unassign" ON public.item_assignees FOR DELETE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_assignees.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

-- ============ comments (via content_items.month_id -> months.client_id) ============
DROP POLICY IF EXISTS "active read comments" ON public.comments;
CREATE POLICY "active read comments" ON public.comments FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "auth insert own comments" ON public.comments;
CREATE POLICY "auth insert own comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id AND is_system = false
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "author updates own comment" ON public.comments;
CREATE POLICY "author updates own comment" ON public.comments FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id AND is_system = false
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  )
  WITH CHECK (
    auth.uid() = author_id AND is_system = false
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "admin delete comments" ON public.comments;
CREATE POLICY "admin delete comments" ON public.comments FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

-- ============ item_files (via content_items.month_id -> months.client_id) ============
DROP POLICY IF EXISTS "active read item_files" ON public.item_files;
CREATE POLICY "active read item_files" ON public.item_files FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "item_files_write_assignee_or_admin" ON public.item_files;
CREATE POLICY "item_files_write_assignee_or_admin" ON public.item_files FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "item_files_update_assignee_or_admin" ON public.item_files;
CREATE POLICY "item_files_update_assignee_or_admin" ON public.item_files FOR UPDATE TO authenticated
  USING (
    (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  )
  WITH CHECK (
    (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

DROP POLICY IF EXISTS "item_files_delete_assignee_or_admin" ON public.item_files;
CREATE POLICY "item_files_delete_assignee_or_admin" ON public.item_files FOR DELETE TO authenticated
  USING (
    (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = item_files.item_id AND ia.user_id = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.content_items ci JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id = item_files.item_id AND ci.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

-- ============ client_links ============
DROP POLICY IF EXISTS "active read client_links" ON public.client_links;
CREATE POLICY "active read client_links" ON public.client_links FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_links.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "admin manage client_links" ON public.client_links;
CREATE POLICY "admin manage client_links" ON public.client_links FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_links.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_links.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ client_contacts (also fixes a pre-existing gap: SELECT had no org check at all) ============
DROP POLICY IF EXISTS "active read client_contacts" ON public.client_contacts;
CREATE POLICY "active read client_contacts" ON public.client_contacts FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_contacts.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "admin manage client_contacts" ON public.client_contacts;
CREATE POLICY "admin manage client_contacts" ON public.client_contacts FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_contacts.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_contacts.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ client_onboarding ============
DROP POLICY IF EXISTS "active read onboarding" ON public.client_onboarding;
CREATE POLICY "active read onboarding" ON public.client_onboarding FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_onboarding.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "onboarding admin write" ON public.client_onboarding;
CREATE POLICY "onboarding admin write" ON public.client_onboarding FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_onboarding.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_onboarding.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ client_secrets (already admin-only; matters if the restricted profile is itself an admin) ============
DROP POLICY IF EXISTS "admin read client_secrets" ON public.client_secrets;
CREATE POLICY "admin read client_secrets" ON public.client_secrets FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_secrets.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "admin manage client_secrets" ON public.client_secrets;
CREATE POLICY "admin manage client_secrets" ON public.client_secrets FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_secrets.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_secrets.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ client_instagram_credentials ============
DROP POLICY IF EXISTS "active read own org instagram credentials" ON public.client_instagram_credentials;
CREATE POLICY "active read own org instagram credentials" ON public.client_instagram_credentials FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_instagram_credentials.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "master manage own org instagram credentials" ON public.client_instagram_credentials;
CREATE POLICY "master manage own org instagram credentials" ON public.client_instagram_credentials FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_instagram_credentials.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_master(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_instagram_credentials.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ client_drive_map ============
DROP POLICY IF EXISTS "active read drive map" ON public.client_drive_map;
CREATE POLICY "active read drive map" ON public.client_drive_map FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "active insert drive map" ON public.client_drive_map;
CREATE POLICY "active insert drive map" ON public.client_drive_map FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "active update drive map" ON public.client_drive_map;
CREATE POLICY "active update drive map" ON public.client_drive_map FOR UPDATE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "admin delete drive map" ON public.client_drive_map;
CREATE POLICY "admin delete drive map" ON public.client_drive_map FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ recurring_templates ============
DROP POLICY IF EXISTS "active read recurring" ON public.recurring_templates;
CREATE POLICY "active read recurring" ON public.recurring_templates FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = recurring_templates.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

DROP POLICY IF EXISTS "recurring admin write" ON public.recurring_templates;
CREATE POLICY "recurring admin write" ON public.recurring_templates FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = recurring_templates.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)))
  WITH CHECK (public.is_admin(auth.uid()) AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = recurring_templates.client_id AND c.org_id = public.current_org_id() AND public.has_client_access(auth.uid(), c.id)));

-- ============ client_docs (client_id NOT NULL) ============
DROP POLICY IF EXISTS "admin manage client docs" ON public.client_docs;
CREATE POLICY "admin manage client docs" ON public.client_docs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id))
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

-- ============ client_stage_history (client_id NOT NULL, read-only via RLS) ============
DROP POLICY IF EXISTS "active read stage history" ON public.client_stage_history;
CREATE POLICY "active read stage history" ON public.client_stage_history FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

-- ============ client_stage_updates (client_id NOT NULL) ============
DROP POLICY IF EXISTS "active read stage updates" ON public.client_stage_updates;
CREATE POLICY "active read stage updates" ON public.client_stage_updates FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND public.has_client_access(auth.uid(), client_id));

DROP POLICY IF EXISTS "admin insert stage updates" ON public.client_stage_updates;
CREATE POLICY "admin insert stage updates" ON public.client_stage_updates FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND sent_by = auth.uid() AND public.has_client_access(auth.uid(), client_id));

-- ============ reference_library_items (client_id NULLABLE — null = geral, always visible) ============
DROP POLICY IF EXISTS "active read reference library" ON public.reference_library_items;
CREATE POLICY "active read reference library" ON public.reference_library_items FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

DROP POLICY IF EXISTS "active insert reference library" ON public.reference_library_items;
CREATE POLICY "active insert reference library" ON public.reference_library_items FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

DROP POLICY IF EXISTS "author or admin update reference library" ON public.reference_library_items;
CREATE POLICY "author or admin update reference library" ON public.reference_library_items FOR UPDATE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_admin(auth.uid())) AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)))
  WITH CHECK (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_admin(auth.uid())) AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

DROP POLICY IF EXISTS "author or admin delete reference library" ON public.reference_library_items;
CREATE POLICY "author or admin delete reference library" ON public.reference_library_items FOR DELETE TO authenticated
  USING (public.is_active_profile(auth.uid()) AND org_id = public.current_org_id() AND (created_by = auth.uid() OR public.is_admin(auth.uid())) AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

-- ============ stories_schedule (client_id NULLABLE — null = tarefa geral, always visible) ============
DROP POLICY IF EXISTS "stories_org_read" ON public.stories_schedule;
CREATE POLICY "stories_org_read" ON public.stories_schedule FOR SELECT TO authenticated
  USING (org_id = public.current_org_id() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

DROP POLICY IF EXISTS "stories_org_admin_write" ON public.stories_schedule;
CREATE POLICY "stories_org_admin_write" ON public.stories_schedule FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)))
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));

DROP POLICY IF EXISTS "stories_org_self_update" ON public.stories_schedule;
CREATE POLICY "stories_org_self_update" ON public.stories_schedule FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND user_id = auth.uid() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)))
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid() AND (client_id IS NULL OR public.has_client_access(auth.uid(), client_id)));
