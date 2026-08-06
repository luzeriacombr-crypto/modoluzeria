-- Staging bucket for direct-from-browser uploads (large files, e.g. Reels
-- video) that then get relayed server-side into the org's Drive — Google
-- Drive's upload API doesn't support direct browser uploads (no CORS), but
-- Supabase Storage does, so the browser lands here first.
-- Path convention: <item_id>/<timestamp>-<filename>
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-uploads-temp', 'item-uploads-temp', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "item-uploads-temp insert by admin or assignee"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'item-uploads-temp'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.item_assignees ia
        WHERE ia.user_id = auth.uid()
          AND ia.item_id::text = split_part(name, '/', 1)
      )
    )
  );

CREATE POLICY "item-uploads-temp delete by admin or assignee"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'item-uploads-temp'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.item_assignees ia
        WHERE ia.user_id = auth.uid()
          AND ia.item_id::text = split_part(name, '/', 1)
      )
    )
  );

-- Read is service-role only (server-side relay to Drive) — no authenticated
-- SELECT policy, since the browser never needs to read this bucket back.
CREATE POLICY "service role reads item uploads temp" ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'item-uploads-temp');
