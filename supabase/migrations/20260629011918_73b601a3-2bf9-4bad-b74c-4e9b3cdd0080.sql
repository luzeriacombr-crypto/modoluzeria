
-- 1. Remove the anon SELECT policy on avatars storage objects
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- 2. Ensure finalizations writes from clients are explicitly denied.
-- Writes happen only via the SECURITY DEFINER trigger record_finalizations().
REVOKE INSERT, UPDATE, DELETE ON public.finalizations FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.finalizations FROM anon;

CREATE POLICY finalizations_no_client_insert
  ON public.finalizations FOR INSERT TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY finalizations_no_client_update
  ON public.finalizations FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);

CREATE POLICY finalizations_no_client_delete
  ON public.finalizations FOR DELETE TO authenticated, anon
  USING (false);
