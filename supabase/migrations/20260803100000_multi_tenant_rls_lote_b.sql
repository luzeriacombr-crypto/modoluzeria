-- Multi-tenant Lote B: closes an RLS gap left over from the earlier
-- multi-tenant rewrite. On 2026-07-10, five tables had their SELECT policy
-- tightened from "any authenticated user" to "any ACTIVE profile" — but
-- Lote A (2026-07-31) only added the org_id boundary to the core tables
-- (profiles, clients, months, content_items, item_assignees, comments,
-- item_files). These five never got the same treatment, so any active
-- user in ANY agency could read (and for client_drive_map, also insert
-- and update) another agency's rows. None of these tables has its own
-- org_id column, so scoping goes through clients.org_id (or profiles.org_id
-- for finalizations, since its item_id is nullable).

-- ---------- client_links ----------
DROP POLICY IF EXISTS "active read client_links" ON public.client_links;
CREATE POLICY "active read client_links" ON public.client_links FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_links.client_id AND c.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "admin manage client_links" ON public.client_links;
CREATE POLICY "admin manage client_links" ON public.client_links FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_links.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_links.client_id AND c.org_id = public.current_org_id())
  );

-- ---------- client_onboarding ----------
DROP POLICY IF EXISTS "active read onboarding" ON public.client_onboarding;
CREATE POLICY "active read onboarding" ON public.client_onboarding FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_onboarding.client_id AND c.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "onboarding admin write" ON public.client_onboarding;
CREATE POLICY "onboarding admin write" ON public.client_onboarding FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_onboarding.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_onboarding.client_id AND c.org_id = public.current_org_id())
  );

-- ---------- recurring_templates ----------
DROP POLICY IF EXISTS "active read recurring" ON public.recurring_templates;
CREATE POLICY "active read recurring" ON public.recurring_templates FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = recurring_templates.client_id AND c.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "recurring admin write" ON public.recurring_templates;
CREATE POLICY "recurring admin write" ON public.recurring_templates FOR ALL TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = recurring_templates.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = recurring_templates.client_id AND c.org_id = public.current_org_id())
  );

-- ---------- client_drive_map ----------
-- Insert/update stay open to any active member (not just admins) — file
-- uploads trigger folder auto-creation for whoever is doing the upload,
-- not just admins. Only the org boundary is being added here.
DROP POLICY IF EXISTS "Active members can read drive map" ON public.client_drive_map;
CREATE POLICY "active read drive map" ON public.client_drive_map FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "Active members can insert drive map" ON public.client_drive_map;
CREATE POLICY "active insert drive map" ON public.client_drive_map FOR INSERT TO authenticated
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "Active members can update drive map" ON public.client_drive_map;
CREATE POLICY "active update drive map" ON public.client_drive_map FOR UPDATE TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id())
  )
  WITH CHECK (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id())
  );

DROP POLICY IF EXISTS "Admins can delete drive map" ON public.client_drive_map;
CREATE POLICY "admin delete drive map" ON public.client_drive_map FOR DELETE TO authenticated
  USING (
    public.is_admin(auth.uid())
    AND EXISTS (SELECT 1 FROM public.clients c WHERE c.id = client_drive_map.client_id AND c.org_id = public.current_org_id())
  );

-- ---------- finalizations ----------
-- item_id can be NULL (ON DELETE SET NULL), so scope via user_id -> profiles
-- instead of joining content_items. Writes are already locked down to the
-- SECURITY DEFINER record_finalizations() trigger (20260629011918), so only
-- SELECT needs the org fix here.
DROP POLICY IF EXISTS "active read finalizations" ON public.finalizations;
CREATE POLICY "active read finalizations" ON public.finalizations FOR SELECT TO authenticated
  USING (
    public.is_active_profile(auth.uid())
    AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = finalizations.user_id AND p.org_id = public.current_org_id())
  );
