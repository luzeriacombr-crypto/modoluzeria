
REVOKE ALL ON FUNCTION public.send_deadline_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_deadline_reminders() TO service_role;
REVOKE ALL ON FUNCTION public.send_daily_digest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_daily_digest() TO service_role;
