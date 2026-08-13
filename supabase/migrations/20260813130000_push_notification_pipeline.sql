-- Users reported push notifications arriving inconsistently. Root cause:
-- push was only ever wired up for 2 of the ~10 notification types (assigned,
-- and status→PRONTO_PARA_PUBLICAR), via two ad-hoc OneSignal calls inline in
-- setItemStatus/addAssignee — everything else (comment, mention, other
-- status changes, client feedback, bug reports, deadlines, digest, stale
-- client) only ever populated the in-app bell. This migration adds the
-- plumbing for a uniform push pipeline: a `push_sent_at` marker so an
-- external cron (src/routes/api.cron.send-push-notifications.ts, same
-- pattern as the Instagram publish cron) can find and dispatch every
-- unsent notification, and per-type push toggles alongside the existing
-- daily_digest/deadline_alerts prefs.

ALTER TABLE public.notifications
  ADD COLUMN push_sent_at timestamptz;

-- Existing rows predate this feature — mark them as already handled so the
-- cron's first run doesn't suddenly push a backlog of old notifications.
UPDATE public.notifications SET push_sent_at = now() WHERE push_sent_at IS NULL;

ALTER TABLE public.notification_preferences
  ADD COLUMN push_assigned boolean NOT NULL DEFAULT true,
  ADD COLUMN push_status boolean NOT NULL DEFAULT true,
  ADD COLUMN push_comment boolean NOT NULL DEFAULT true,
  ADD COLUMN push_mention boolean NOT NULL DEFAULT true,
  ADD COLUMN push_client_feedback boolean NOT NULL DEFAULT true,
  ADD COLUMN push_bug_report boolean NOT NULL DEFAULT true;

CREATE INDEX idx_notifications_unsent_push ON public.notifications (created_at)
  WHERE push_sent_at IS NULL;
