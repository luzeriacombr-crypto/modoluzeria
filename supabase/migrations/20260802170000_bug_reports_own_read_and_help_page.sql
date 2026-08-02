-- The /ajuda page lets each user see their own submitted reports ("Minhas
-- solicitações"), in addition to the existing platform-owner-only read of
-- every agency's reports. bug_reports only had a write policy for the
-- reporter and a read policy for the platform owner — add self-read.
CREATE POLICY "bug_reports_own_read" ON public.bug_reports FOR SELECT TO authenticated
  USING (reported_by = auth.uid());

-- "Todas as solicitações" (platform-owner tab): profiles/orgs are org-scoped
-- by RLS, so a plain join as the platform owner would only see Luzeria's own
-- org. This SECURITY DEFINER function does the cross-org join explicitly,
-- gated on the same is_master + Luzeria-org check as the bug_reports read
-- policy above.
CREATE OR REPLACE FUNCTION public.platform_list_bug_reports()
RETURNS TABLE(
  id uuid, message text, page_url text, screenshot_path text, created_at timestamptz,
  org_name text, reporter_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT br.id, br.message, br.page_url, br.screenshot_path, br.created_at,
         o.name AS org_name, p.name AS reporter_name
  FROM public.bug_reports br
  JOIN public.orgs o ON o.id = br.org_id
  JOIN public.profiles p ON p.id = br.reported_by
  WHERE public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  ORDER BY br.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.platform_list_bug_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_bug_reports() TO authenticated;
