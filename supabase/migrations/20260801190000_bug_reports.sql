-- "Reportar erro" button next to the notifications bell: any active user
-- can submit a bug report (message + optional screenshot); only the
-- platform owner (Luzeria master) can read them all, across every agency.

CREATE TABLE public.bug_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id),
  message text NOT NULL,
  screenshot_path text,
  page_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.bug_reports TO authenticated;
GRANT ALL ON public.bug_reports TO service_role;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bug_reports_insert_own" ON public.bug_reports FOR INSERT TO authenticated
  WITH CHECK (org_id = public.current_org_id() AND reported_by = auth.uid());

CREATE POLICY "bug_reports_platform_owner_read" ON public.bug_reports FOR SELECT TO authenticated
  USING (
    public.is_master(auth.uid())
    AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );

CREATE INDEX idx_bug_reports_org ON public.bug_reports(org_id);

-- Storage bucket for screenshots (private — only signed URLs are ever handed out).
INSERT INTO storage.buckets (id, name, public)
VALUES ('bug-reports', 'bug-reports', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "bug_reports_bucket_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'bug-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "bug_reports_bucket_read_platform_owner" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'bug-reports'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (
        public.is_master(auth.uid())
        AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
      )
    )
  );
