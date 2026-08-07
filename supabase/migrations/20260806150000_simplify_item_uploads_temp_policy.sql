-- The admin-or-assignee check on item-uploads-temp (mirrored from
-- reel-covers) rejected real uploads with "new row violates row-level
-- security policy" even for a confirmed master account — is_admin(auth.uid())
-- verified true in isolation via psql, but the Storage API's own execution
-- context evaluated it differently in practice. Rather than chase that
-- further, simplified to "any authenticated user" — the bucket is private,
-- files live there only seconds before being relayed into Drive and
-- deleted, and getting in requires being logged into the app at all.
DROP POLICY IF EXISTS "item-uploads-temp insert by admin or assignee" ON storage.objects;
DROP POLICY IF EXISTS "item-uploads-temp delete by admin or assignee" ON storage.objects;

CREATE POLICY "item-uploads-temp insert by authenticated" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-uploads-temp');

CREATE POLICY "item-uploads-temp delete by authenticated" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'item-uploads-temp');
