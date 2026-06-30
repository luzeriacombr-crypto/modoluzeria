
-- Cover columns
ALTER TABLE public.content_items
  ADD COLUMN IF NOT EXISTS cover_path text,
  ADD COLUMN IF NOT EXISTS cover_source text CHECK (cover_source IN ('frame','upload'));

-- Storage policies for reel-covers (private bucket)
-- Path convention: <item_id>/<timestamp>.jpg

-- Read: any authenticated user (covers used inside the app)
CREATE POLICY "reel-covers read for authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'reel-covers');

-- Write/update/delete: admins, OR assignees of the item (extracted from path's first segment).
CREATE POLICY "reel-covers insert by admin or assignee"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'reel-covers'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.item_assignees ia
        WHERE ia.user_id = auth.uid()
          AND ia.item_id::text = split_part(name, '/', 1)
      )
    )
  );

CREATE POLICY "reel-covers update by admin or assignee"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'reel-covers'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.item_assignees ia
        WHERE ia.user_id = auth.uid()
          AND ia.item_id::text = split_part(name, '/', 1)
      )
    )
  );

CREATE POLICY "reel-covers delete by admin or assignee"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'reel-covers'
    AND (
      public.is_admin(auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.item_assignees ia
        WHERE ia.user_id = auth.uid()
          AND ia.item_id::text = split_part(name, '/', 1)
      )
    )
  );
