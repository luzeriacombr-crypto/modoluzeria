
-- ============ app_settings ============
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Masters can upsert settings"
  ON public.app_settings FOR ALL
  TO authenticated
  USING (public.is_master(auth.uid()))
  WITH CHECK (public.is_master(auth.uid()));

INSERT INTO public.app_settings (key, value) VALUES
  ('require_rating_on_finalize', '{"enabled": true}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ============ deadline_notifications_log ============
CREATE TABLE IF NOT EXISTS public.deadline_notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('today','tomorrow','overdue')),
  sent_on date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, kind, sent_on)
);

CREATE INDEX IF NOT EXISTS deadline_log_sent_on_idx ON public.deadline_notifications_log (sent_on DESC);

GRANT SELECT ON public.deadline_notifications_log TO authenticated;
GRANT ALL ON public.deadline_notifications_log TO service_role;

ALTER TABLE public.deadline_notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read deadline log"
  ON public.deadline_notifications_log FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- ============ mention notification trigger ============
-- When a mention row is inserted, also create a notification for the mentioned user.
CREATE OR REPLACE FUNCTION public.notify_on_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item_title text;
  actor_id uuid := auth.uid();
BEGIN
  IF NEW.mentioned_user_id = actor_id THEN RETURN NEW; END IF;
  SELECT title INTO item_title FROM public.content_items WHERE id = NEW.item_id;
  INSERT INTO public.notifications (user_id, type, item_id, message)
  VALUES (NEW.mentioned_user_id, 'mention', NEW.item_id,
          'Você foi mencionado em "' || COALESCE(item_title,'') || '"');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_mention ON public.mentions;
CREATE TRIGGER trg_notify_on_mention
  AFTER INSERT ON public.mentions
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_mention();
