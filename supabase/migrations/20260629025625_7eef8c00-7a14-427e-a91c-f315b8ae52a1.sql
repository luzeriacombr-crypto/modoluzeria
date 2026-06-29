
-- 1) client_contacts: restrict SELECT to admins
DROP POLICY IF EXISTS "auth read client_contacts" ON public.client_contacts;
CREATE POLICY "admin read client_contacts" ON public.client_contacts
  FOR SELECT USING (public.is_admin(auth.uid()));

-- 2) profiles: hide email from non-admins via column-level revoke
REVOKE SELECT (email) ON public.profiles FROM authenticated, anon;
-- service_role retains full access.

-- Admin-only RPC to fetch emails (id -> email) for team management UIs.
CREATE OR REPLACE FUNCTION public.admin_list_profile_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE public.is_admin(auth.uid());
$$;
REVOKE ALL ON FUNCTION public.admin_list_profile_emails() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_profile_emails() TO authenticated;

-- Self email lookup (so users can see their own email without exposing the column).
CREATE OR REPLACE FUNCTION public.get_my_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_email() TO authenticated;

-- 3) avatars bucket: allow any authenticated user to read avatar files
DROP POLICY IF EXISTS "avatars_authenticated_select" ON storage.objects;
CREATE POLICY "avatars_authenticated_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
