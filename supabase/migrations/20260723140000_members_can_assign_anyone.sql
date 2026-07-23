-- item_assignees only allowed a member to assign/unassign THEMSELVES; assigning
-- or removing someone else was admin-only. Open that up to any active member.
DROP POLICY IF EXISTS "self assign" ON public.item_assignees;
DROP POLICY IF EXISTS "self unassign" ON public.item_assignees;
DROP POLICY IF EXISTS "admin assign any" ON public.item_assignees;
DROP POLICY IF EXISTS "admin unassign any" ON public.item_assignees;

CREATE POLICY "active manage assignees" ON public.item_assignees FOR INSERT TO authenticated
  WITH CHECK (public.is_active_profile(auth.uid()));
CREATE POLICY "active unassign" ON public.item_assignees FOR DELETE TO authenticated
  USING (public.is_active_profile(auth.uid()));
