
-- 1) client_contacts: restrict admin read policy to authenticated role
DROP POLICY IF EXISTS "admin read client_contacts" ON public.client_contacts;
CREATE POLICY "admin read client_contacts" ON public.client_contacts
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2) status_transitions: add write policies
CREATE POLICY "users insert own transitions" ON public.status_transitions
  FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "admins update transitions" ON public.status_transitions
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "admins delete transitions" ON public.status_transitions
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3) Convert SECURITY DEFINER functions callable by authenticated to SECURITY INVOKER.
-- profiles RLS allows authenticated to read all rows, so invoker is safe.
CREATE OR REPLACE FUNCTION public.get_my_email()
 RETURNS text
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT email FROM public.profiles WHERE id = auth.uid();
$function$;

CREATE OR REPLACE FUNCTION public.admin_list_profile_emails()
 RETURNS TABLE(id uuid, email text)
 LANGUAGE sql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE public.is_admin(auth.uid());
$function$;
