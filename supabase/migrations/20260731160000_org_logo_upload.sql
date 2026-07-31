-- Lets each agency upload its own logo (stored in the existing public
-- "avatars" bucket, same as profile/client photos, just a new path prefix).
-- Bucket read is already public for everything under "avatars" — only
-- write access needs a new policy, scoped so a master can only write to
-- their own org's folder.

ALTER TABLE public.orgs ADD COLUMN logo_path text;

CREATE POLICY "avatars_org_logo_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-logos'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_logo_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-logos'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-logos'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_logo_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-logos'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );
