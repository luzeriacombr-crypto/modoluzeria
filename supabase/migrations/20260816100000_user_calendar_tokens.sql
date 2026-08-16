-- Per-user Google Calendar OAuth connection (each team member connects
-- their own account). A table with this exact shape existed before
-- (20260709030000_user_calendar_tokens.sql) and was dropped
-- (20260711023602_drop_user_calendar_tokens.sql) when the feature was
-- shelved for priority reasons, not a design problem — recreating it here
-- rather than trying to resurrect the dropped migration.
CREATE TABLE public.user_calendar_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- Strictly self-only — not even admins are exempted here, refresh tokens
-- are credentials, not operational data.
CREATE POLICY "own calendar token select" ON public.user_calendar_tokens
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own calendar token insert" ON public.user_calendar_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar token update" ON public.user_calendar_tokens
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "own calendar token delete" ON public.user_calendar_tokens
  FOR DELETE USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_tokens TO authenticated;
GRANT ALL ON public.user_calendar_tokens TO service_role;
