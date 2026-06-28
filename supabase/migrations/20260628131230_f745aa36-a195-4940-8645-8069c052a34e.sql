
-- 1. Restrict email_role_assignments SELECT to admins
DROP POLICY IF EXISTS "anyone authenticated can read" ON public.email_role_assignments;
CREATE POLICY "admins can read email role assignments"
ON public.email_role_assignments FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- 2. Comments: prevent forging system messages
DROP POLICY IF EXISTS "auth insert own comments" ON public.comments;
CREATE POLICY "auth insert own comments"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id AND is_system = false);

-- 3. Notifications: only allow inserts targeting self (triggers run as SECURITY DEFINER and bypass this)
DROP POLICY IF EXISTS "auth insert notifications" ON public.notifications;
CREATE POLICY "auth insert own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 4. Lock down SECURITY DEFINER functions
-- Trigger functions: no one should call directly
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_on_comment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.on_status_change() FROM PUBLIC, anon, authenticated;

-- Helper functions used by RLS: revoke from anon/public; keep authenticated (required for RLS policy evaluation)
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_master(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_master(uuid) TO authenticated;
