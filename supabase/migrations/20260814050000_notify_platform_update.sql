-- Completes the platform_update push pipeline: TYPE_TITLE and the
-- Notifications.tsx click handler for "platform_update" were already wired
-- up (push-dispatch.functions.ts, Notifications.tsx) but nothing ever
-- inserted a notifications row when a changelog entry went live — the
-- Atualizações tab (UpdatesTab.tsx) only ever wrote to platform_updates
-- itself. This trigger closes the gap: broadcasts one notification per
-- active profile, across every org, same shape as notify_new_bug_report's
-- loop-and-insert pattern (20260802180000).
CREATE OR REPLACE FUNCTION public.notify_platform_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN SELECT id FROM public.profiles WHERE active = true LOOP
    INSERT INTO public.notifications (user_id, type, message)
    VALUES (rec.id, 'platform_update', NEW.title);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_platform_update ON public.platform_updates;
CREATE TRIGGER trg_notify_platform_update
  AFTER INSERT ON public.platform_updates
  FOR EACH ROW EXECUTE FUNCTION public.notify_platform_update();
