
CREATE OR REPLACE FUNCTION public.luzeria_admin_list_cron_jobs()
RETURNS TABLE(jobname text, schedule text, active boolean, last_start timestamptz, last_status text)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, cron
AS $$
  SELECT j.jobname,
         j.schedule,
         j.active,
         d.start_time AS last_start,
         d.status AS last_status
  FROM cron.job j
  LEFT JOIN LATERAL (
    SELECT start_time, status
    FROM cron.job_run_details
    WHERE jobid = j.jobid
    ORDER BY start_time DESC
    LIMIT 1
  ) d ON true
  WHERE j.jobname LIKE 'luzeria_%' OR j.jobname LIKE 'auto-mark%';
$$;

REVOKE ALL ON FUNCTION public.luzeria_admin_list_cron_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.luzeria_admin_list_cron_jobs() TO service_role;
