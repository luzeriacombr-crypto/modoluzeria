-- Per-user Google Calendar OAuth connection (each team member connects their own account).
CREATE TABLE IF NOT EXISTS public.user_calendar_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email text NOT NULL,
  refresh_token text NOT NULL,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- No GRANT/policy allows reading another user's row, and not even admins are
-- exempted here — refresh tokens are credentials, not operational data.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_calendar_tokens TO authenticated;
GRANT ALL ON public.user_calendar_tokens TO service_role;

ALTER TABLE public.user_calendar_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own calendar token select" ON public.user_calendar_tokens
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own calendar token insert" ON public.user_calendar_tokens
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar token update" ON public.user_calendar_tokens
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own calendar token delete" ON public.user_calendar_tokens
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER user_calendar_tokens_touch_updated_at BEFORE UPDATE ON public.user_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
