-- CRITICAL: is_admin()/is_master() check membership of user_roles GLOBALLY
-- (any org), with no org filter of their own. Several RLS policies used
-- them as a standalone bypass ("is_admin(auth.uid()) OR ...") without ALSO
-- requiring the row belong to the admin's own org — meaning any admin/
-- master of ANY agency could read (and in some cases write/delete) every
-- OTHER agency's status_transitions, activity_log, client_contacts,
-- client_feedback, client_secrets, deadline_notifications_log,
-- feed_share_tokens, mentions and member_goals. Found while investigating
-- a Histórico report bug: an activity row from a completely different
-- agency ("ORIM ADM" / org 277b7fb4-...) was showing up in Luzeria's own
-- report data, which is what surfaced this.
--
-- Fix: every is_admin()/is_master() clause below is now AND-ed with a
-- lookup confirming the row's org matches current_org_id() — same pattern
-- already used correctly elsewhere (e.g. "admin manage clients").

-- ---- status_transitions (item_id -> content_items.org_id) ----
ALTER POLICY "status_transitions_select_involved_or_admin" ON public.status_transitions
  USING (
    (is_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = status_transitions.item_id AND ci.org_id = public.current_org_id()
    ))
    OR actor_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = status_transitions.item_id AND ia.user_id = auth.uid())
  );

ALTER POLICY "admins update transitions" ON public.status_transitions
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = status_transitions.item_id AND ci.org_id = public.current_org_id()
  ));

ALTER POLICY "admins delete transitions" ON public.status_transitions
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.content_items ci
    WHERE ci.id = status_transitions.item_id AND ci.org_id = public.current_org_id()
  ));

-- ---- activity_log (entity_id -> content_items.org_id, content_item is the only entity_type in use) ----
ALTER POLICY "admin read activity" ON public.activity_log
  USING (
    (is_admin(auth.uid()) AND entity_type = 'content_item' AND EXISTS (
      SELECT 1 FROM public.content_items ci
      WHERE ci.id = activity_log.entity_id AND ci.org_id = public.current_org_id()
    ))
    OR actor_id = auth.uid()
  );

-- ---- client_contacts (client_id -> clients.org_id) ----
ALTER POLICY "admin manage client_contacts" ON public.client_contacts
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_contacts.client_id AND c.org_id = public.current_org_id()
  ))
  WITH CHECK (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_contacts.client_id AND c.org_id = public.current_org_id()
  ));

-- ---- client_feedback (item_id -> content_items.org_id) ----
ALTER POLICY "Admins manage client feedback" ON public.client_feedback
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.content_items ci WHERE ci.id = client_feedback.item_id AND ci.org_id = public.current_org_id()
  ))
  WITH CHECK (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.content_items ci WHERE ci.id = client_feedback.item_id AND ci.org_id = public.current_org_id()
  ));

-- ---- client_secrets (client_id -> clients.org_id) — most sensitive table in this set ----
ALTER POLICY "admin manage client_secrets" ON public.client_secrets
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_secrets.client_id AND c.org_id = public.current_org_id()
  ))
  WITH CHECK (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_secrets.client_id AND c.org_id = public.current_org_id()
  ));

ALTER POLICY "admin read client_secrets" ON public.client_secrets
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = client_secrets.client_id AND c.org_id = public.current_org_id()
  ));

-- ---- deadline_notifications_log (item_id -> content_items.org_id) ----
ALTER POLICY "Admins can read deadline log" ON public.deadline_notifications_log
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.content_items ci WHERE ci.id = deadline_notifications_log.item_id AND ci.org_id = public.current_org_id()
  ));

-- ---- feed_share_tokens (client_id -> clients.org_id) — client-facing approval links ----
ALTER POLICY "Admins manage share tokens" ON public.feed_share_tokens
  USING (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = feed_share_tokens.client_id AND c.org_id = public.current_org_id()
  ))
  WITH CHECK (is_admin(auth.uid()) AND EXISTS (
    SELECT 1 FROM public.clients c WHERE c.id = feed_share_tokens.client_id AND c.org_id = public.current_org_id()
  ));

-- ---- mentions (item_id -> content_items.org_id) ----
ALTER POLICY "mentions self read" ON public.mentions
  USING (
    mentioned_user_id = auth.uid()
    OR (is_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.content_items ci WHERE ci.id = mentions.item_id AND ci.org_id = public.current_org_id()
    ))
  );

-- ---- member_goals (user_id -> profiles.org_id, same pattern "active read finalizations" already uses) ----
ALTER POLICY "member_goals_select_owner_or_admin" ON public.member_goals
  USING (
    user_id = auth.uid()
    OR (is_admin(auth.uid()) AND EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = member_goals.user_id AND p.org_id = public.current_org_id()
    ))
  );
