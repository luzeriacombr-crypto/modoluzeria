
-- Tighten RLS: client_feedback (admin only reads; public reads via SECURITY DEFINER get_public_feed)
DROP POLICY IF EXISTS "Authenticated can read client feedback" ON public.client_feedback;

-- feed_share_tokens: admin only
DROP POLICY IF EXISTS "Authenticated can read share tokens" ON public.feed_share_tokens;

-- client_drive_map: restrict to admins + active members (still needed by app for drive display)
DROP POLICY IF EXISTS "Authenticated users can read drive map" ON public.client_drive_map;
CREATE POLICY "Active members can read drive map" ON public.client_drive_map
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active = true)
  );

-- user_roles: users see own row; admins/masters see all
DROP POLICY IF EXISTS "all authenticated read roles" ON public.user_roles;
CREATE POLICY "users read own role or admins read all" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()) OR public.is_master(auth.uid()));

-- client_contacts: drop redundant SELECT policy (ALL policy already covers admin reads)
DROP POLICY IF EXISTS "admin read client_contacts" ON public.client_contacts;

-- SECURITY DEFINER functions: revoke EXECUTE from anon/authenticated on trigger-only and cron-only functions.
-- Trigger functions (called by triggers as table owner, no direct EXECUTE needed):
REVOKE EXECUTE ON FUNCTION public.on_status_change() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.log_item_activity() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_finalizations() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_lead_time() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_mention() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.track_status_transition() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_client_feedback() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_comment() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_assignment() FROM anon, authenticated, PUBLIC;

-- Cron-only maintenance functions:
REVOKE EXECUTE ON FUNCTION public.send_deadline_reminders() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_daily_digest() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_mark_missed() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_recurring_for_month(text) FROM anon, authenticated, PUBLIC;

-- Anon-only public-feed helpers: revoke from authenticated (still available to anon via token flows)
REVOKE EXECUTE ON FUNCTION public.get_public_feed(text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.add_public_feedback(text, uuid, text, text) FROM authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_public_token_file(text, text) FROM authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_feed(text) TO anon;
GRANT EXECUTE ON FUNCTION public.add_public_feedback(text, uuid, text, text) TO anon;
GRANT EXECUTE ON FUNCTION public.verify_public_token_file(text, text) TO anon;

-- Admin-only helper functions: keep authenticated (internal check via is_admin) but revoke anon
REVOKE EXECUTE ON FUNCTION public.admin_list_profile_emails() FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.luzeria_admin_list_cron_jobs() FROM anon, PUBLIC;

-- has_role/is_admin/is_master are used in RLS policies; keep authenticated EXECUTE, revoke anon
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_master(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_email() FROM anon, PUBLIC;
