
-- 1. cleaning_log: restrict SELECT
DROP POLICY IF EXISTS "cleaning_log_select_auth" ON public.cleaning_log;
CREATE POLICY "cleaning_log_select_involved_or_admin"
  ON public.cleaning_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid() OR done_by = auth.uid());

-- 2. status_transitions: restrict SELECT to admin, actor, or item assignee
DROP POLICY IF EXISTS "auth read transitions" ON public.status_transitions;
CREATE POLICY "status_transitions_select_involved_or_admin"
  ON public.status_transitions FOR SELECT
  TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.item_assignees ia
      WHERE ia.item_id = status_transitions.item_id
        AND ia.user_id = auth.uid()
    )
  );

-- 3. member_goals: restrict SELECT to owner or admin
DROP POLICY IF EXISTS "goals read auth" ON public.member_goals;
CREATE POLICY "member_goals_select_owner_or_admin"
  ON public.member_goals FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()) OR user_id = auth.uid());

-- 4. activity_log: remove client INSERT policy. All inserts happen via SECURITY DEFINER triggers.
DROP POLICY IF EXISTS "auth insert activity" ON public.activity_log;

-- 5. get_public_feed: revoke EXECUTE from authenticated/public, keep only anon (share link viewers).
REVOKE EXECUTE ON FUNCTION public.get_public_feed(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_public_feed(text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_feed(text) TO anon;
