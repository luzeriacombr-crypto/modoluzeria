
CREATE OR REPLACE FUNCTION public.is_active_profile(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _user_id AND active = true)
$$;

-- clients
DROP POLICY IF EXISTS "auth read clients" ON public.clients;
CREATE POLICY "active read clients" ON public.clients FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- client_links
DROP POLICY IF EXISTS "auth read client_links" ON public.client_links;
CREATE POLICY "active read client_links" ON public.client_links FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- client_onboarding
DROP POLICY IF EXISTS "onboarding read auth" ON public.client_onboarding;
CREATE POLICY "active read onboarding" ON public.client_onboarding FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- comments
DROP POLICY IF EXISTS "auth read comments" ON public.comments;
CREATE POLICY "active read comments" ON public.comments FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- content_items
DROP POLICY IF EXISTS "auth read items" ON public.content_items;
CREATE POLICY "active read items" ON public.content_items FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- finalizations
DROP POLICY IF EXISTS "finalizations_read_authenticated" ON public.finalizations;
CREATE POLICY "active read finalizations" ON public.finalizations FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- item_assignees
DROP POLICY IF EXISTS "auth read assignees" ON public.item_assignees;
CREATE POLICY "active read assignees" ON public.item_assignees FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- item_files
DROP POLICY IF EXISTS "item_files_read_all_auth" ON public.item_files;
CREATE POLICY "active read item_files" ON public.item_files FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- months
DROP POLICY IF EXISTS "auth read months" ON public.months;
CREATE POLICY "active read months" ON public.months FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- profiles: keep users able to read their own row, otherwise require active
DROP POLICY IF EXISTS "all authenticated can read profiles" ON public.profiles;
CREATE POLICY "active read profiles" ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_active_profile(auth.uid()));

-- recurring_templates
DROP POLICY IF EXISTS "recurring read auth" ON public.recurring_templates;
CREATE POLICY "active read recurring" ON public.recurring_templates FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));

-- client_contacts: add SELECT for active members (admins already covered by ALL policy)
CREATE POLICY "active read client_contacts" ON public.client_contacts FOR SELECT TO authenticated
  USING (public.is_active_profile(auth.uid()));
