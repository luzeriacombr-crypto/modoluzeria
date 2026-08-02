-- avatars_admin_member_* (20260802130000) referenced storage.foldername(name)
-- inside a subquery against public.profiles, which also has a `name` column —
-- Postgres resolved the bare `name` to profiles.name (the person's display
-- name) instead of storage.objects.name (the file path), so the folder/id
-- match never held and every admin avatar upload was rejected by RLS.
-- Fix: qualify the outer table explicitly as objects.name, same pattern
-- already used by the reel-covers policies.

DROP POLICY IF EXISTS "avatars_admin_member_insert" ON storage.objects;
CREATE POLICY "avatars_admin_member_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(objects.name))[1]
        AND pr.org_id = public.current_org_id()
    )
  );

DROP POLICY IF EXISTS "avatars_admin_member_update" ON storage.objects;
CREATE POLICY "avatars_admin_member_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(objects.name))[1]
        AND pr.org_id = public.current_org_id()
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(objects.name))[1]
        AND pr.org_id = public.current_org_id()
    )
  );

DROP POLICY IF EXISTS "avatars_admin_member_delete" ON storage.objects;
CREATE POLICY "avatars_admin_member_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND public.is_master(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles pr
      WHERE pr.id::text = (storage.foldername(objects.name))[1]
        AND pr.org_id = public.current_org_id()
    )
  );
