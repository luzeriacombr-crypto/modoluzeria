-- Second pass of the same cross-org RLS fix (20260819023000): a more
-- careful re-sweep after the first migration found 3 more gaps missed the
-- first time — including a write-side one on user_roles that's a real
-- privilege-escalation risk (any master, any org, could insert/update/
-- delete ANY user's role assignment, including in other orgs).

-- ---- member_goals: write side was still unscoped (read side fixed already) ----
ALTER POLICY "goals master write" ON public.member_goals
  USING (is_master(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = member_goals.user_id AND p.org_id = public.current_org_id()
  ))
  WITH CHECK (is_master(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = member_goals.user_id AND p.org_id = public.current_org_id()
  ));

-- ---- user_roles: both policies unscoped — the write one is the serious one ----
ALTER POLICY "master manages roles" ON public.user_roles
  USING (is_master(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.org_id = public.current_org_id()
  ))
  WITH CHECK (is_master(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.org_id = public.current_org_id()
  ));

ALTER POLICY "users read own role or admins read all" ON public.user_roles
  USING (
    user_id = auth.uid()
    OR (
      (is_admin(auth.uid()) OR is_master(auth.uid()))
      AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = user_roles.user_id AND p.org_id = public.current_org_id())
    )
  );

-- ---- cleaning_log: read side still unscoped for the is_admin() bypass ----
ALTER POLICY "cleaning_log_select_involved_or_admin" ON public.cleaning_log
  USING (
    (is_admin(auth.uid()) AND org_id = public.current_org_id())
    OR user_id = auth.uid()
    OR done_by = auth.uid()
  );
