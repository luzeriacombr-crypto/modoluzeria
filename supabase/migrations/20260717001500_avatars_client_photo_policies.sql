-- The existing avatars-bucket policies only allow writes when the first path
-- segment equals the caller's own auth.uid() (for personal profile photos).
-- Client photos are stored at clients/<client_id>/..., which never matched
-- that rule for anyone — uploading a client photo has never worked. Add
-- admin-only write access for that prefix specifically.

CREATE POLICY "avatars_client_photo_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "avatars_client_photo_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.is_admin(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.is_admin(auth.uid())
  );

CREATE POLICY "avatars_client_photo_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'clients'
    AND public.is_admin(auth.uid())
  );
