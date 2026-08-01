-- Fixes a regression from the multi-tenant Drive refactor: the public
-- client-facing preview page (unauthenticated, token-based) fetches
-- thumbnails via getAccessToken(), which now needs to know which org's
-- Google Drive credentials to use. There's no logged-in profile on that
-- page to read org_id from, so we resolve it from the share token itself.
CREATE OR REPLACE FUNCTION public.get_org_id_for_token(_token text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.org_id
  FROM public.feed_share_tokens t
  JOIN public.clients c ON c.id = t.client_id
  WHERE t.token = _token AND t.revoked_at IS NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_org_id_for_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_id_for_token(text) TO anon, authenticated;
