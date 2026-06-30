
-- ============ feed_share_tokens ============
CREATE TABLE public.feed_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  month_id uuid NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, month_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feed_share_tokens TO authenticated;
GRANT ALL ON public.feed_share_tokens TO service_role;

ALTER TABLE public.feed_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage share tokens"
  ON public.feed_share_tokens FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can read share tokens"
  ON public.feed_share_tokens FOR SELECT TO authenticated
  USING (true);

CREATE INDEX feed_share_tokens_token_idx ON public.feed_share_tokens(token);


-- ============ client_feedback ============
CREATE TABLE public.client_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.content_items(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  text text NOT NULL,
  share_token text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_feedback TO authenticated;
GRANT ALL ON public.client_feedback TO service_role;

ALTER TABLE public.client_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read client feedback"
  ON public.client_feedback FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage client feedback"
  ON public.client_feedback FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX client_feedback_item_idx ON public.client_feedback(item_id);


-- ============ Trigger: notify assignees on new client feedback ============
CREATE OR REPLACE FUNCTION public.notify_on_client_feedback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  item_title text;
BEGIN
  SELECT title INTO item_title FROM public.content_items WHERE id = NEW.item_id;
  FOR rec IN SELECT user_id FROM public.item_assignees WHERE item_id = NEW.item_id LOOP
    INSERT INTO public.notifications (user_id, type, item_id, message)
    VALUES (
      rec.user_id,
      'client_feedback',
      NEW.item_id,
      'Cliente (' || NEW.author_name || ') comentou em "' || COALESCE(item_title,'') || '"'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_on_client_feedback
AFTER INSERT ON public.client_feedback
FOR EACH ROW EXECUTE FUNCTION public.notify_on_client_feedback();
