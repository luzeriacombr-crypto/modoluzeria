-- setStoryDone() (api.functions.ts) already lets the scheduled member mark
-- their own Stories day done/undone — but stories_org_admin_write (the only
-- write policy on stories_schedule) is admin-only, so RLS silently blocked
-- every non-admin attempt regardless of the app-level check. Add a narrow
-- self-update policy alongside the existing admin-only management policy,
-- same pattern already used for cleaning_log.
CREATE POLICY "stories_org_self_update" ON public.stories_schedule FOR UPDATE TO authenticated
  USING (org_id = public.current_org_id() AND user_id = auth.uid())
  WITH CHECK (org_id = public.current_org_id() AND user_id = auth.uid());
