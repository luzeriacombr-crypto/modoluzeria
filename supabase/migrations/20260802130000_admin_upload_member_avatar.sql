-- Avatars-bucket write policies only allow (storage.foldername(name))[1] =
-- auth.uid()::text (self-upload). A master needs to be able to set a photo
-- for a teammate who hasn't uploaded one yet — add master-only write access
-- scoped to teammates in the same org, mirroring avatars_client_photo_* (20260717001500).

CREATE POLICY "avatars_admin_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(name))[1]
        AND pr.org_id = public.current_org_id()
    )
  );

CREATE POLICY "avatars_admin_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(name))[1]
        AND pr.org_id = public.current_org_id()
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(name))[1]
        AND pr.org_id = public.current_org_id()
    )
  );

CREATE POLICY "avatars_admin_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(name))[1]
        AND pr.org_id = public.current_org_id()
    )
  );
