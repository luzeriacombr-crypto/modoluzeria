-- Bug fix: the mentions table (20260629020446) only ever got GRANT SELECT,
-- UPDATE + a "self read"/"self update" RLS policy — no INSERT grant, no
-- INSERT policy. addCommentWithMentions (roadmap.functions.ts) runs as the
-- caller's own JWT (role authenticated, not service_role), so every insert
-- into mentions has been silently rejected since day one — the mention
-- never reached notify_on_mention(), so the mentioned person got no
-- notification unless they were also an item assignee (who gets notified
-- of any new comment regardless of @mention, via the separate
-- notify_on_comment() trigger — that's why this looked like it "worked"
-- for assignees but not for anyone else).
GRANT INSERT ON public.mentions TO authenticated;

DROP POLICY IF EXISTS "auth insert mentions for own comments" ON public.mentions;
CREATE POLICY "auth insert mentions for own comments"
  ON public.mentions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.comments c
      WHERE c.id = comment_id AND c.author_id = auth.uid()
    )
  );
