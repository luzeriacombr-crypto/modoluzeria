-- Junior wants to track/communicate progress on reported issues:
-- a status (novo/em_andamento/resolvido) he can set, a WhatsApp number
-- the reporter can leave for follow-up, and in-app notifications both
-- ways (him when something new comes in, the reporter when he updates it).

ALTER TABLE public.bug_reports
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'novo'
    CHECK (status IN ('novo', 'em_andamento', 'resolvido')),
  ADD COLUMN IF NOT EXISTS whatsapp text;

CREATE POLICY "bug_reports_platform_owner_update" ON public.bug_reports FOR UPDATE TO authenticated
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

-- Re-published with the two new columns (status, whatsapp) added to the select list.
CREATE OR REPLACE FUNCTION public.platform_list_bug_reports()
RETURNS TABLE(
  id uuid, message text, page_url text, screenshot_path text, created_at timestamptz,
  org_name text, reporter_name text, status text, whatsapp text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT br.id, br.message, br.page_url, br.screenshot_path, br.created_at,
         o.name AS org_name, p.name AS reporter_name, br.status, br.whatsapp
  FROM public.bug_reports br
  JOIN public.orgs o ON o.id = br.org_id
  JOIN public.profiles p ON p.id = br.reported_by
  WHERE public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  ORDER BY br.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.platform_list_bug_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_list_bug_reports() TO authenticated;

-- Notify every Luzeria master when a new report comes in from any agency.
CREATE OR REPLACE FUNCTION public.notify_new_bug_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  org_name text;
BEGIN
  SELECT name INTO org_name FROM public.orgs WHERE id = NEW.org_id;
  FOR rec IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role = 'master' AND p.org_id = '00000000-0000-0000-0000-000000000001'
  LOOP
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (rec.user_id, 'bug_report_new', 'Nova solicitação de ' || COALESCE(org_name, 'uma agência'));
  END LOOP;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_new_bug_report ON public.bug_reports;
CREATE TRIGGER trg_notify_new_bug_report
  AFTER INSERT ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_bug_report();

-- Notify the reporter when the platform owner changes the status.
CREATE OR REPLACE FUNCTION public.notify_bug_report_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (
      NEW.reported_by,
      'bug_report_status',
      CASE NEW.status
        WHEN 'em_andamento' THEN 'Sua solicitação está sendo resolvida'
        WHEN 'resolvido' THEN 'Sua solicitação foi resolvida'
        ELSE 'Sua solicitação foi atualizada'
      END
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_bug_report_status ON public.bug_reports;
CREATE TRIGGER trg_notify_bug_report_status
  AFTER UPDATE ON public.bug_reports
  FOR EACH ROW EXECUTE FUNCTION public.notify_bug_report_status_change();
