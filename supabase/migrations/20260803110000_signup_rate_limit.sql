-- Throttles the public signup endpoint by IP — it previously had only a
-- honeypot field, no limit on how many trial orgs one IP could script-create.
-- Written/read only via the service-role client inside publicSignup(), so no
-- policy grants anything to anon/authenticated (default-deny is correct here).
CREATE TABLE public.signup_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_signup_attempts_ip_time ON public.signup_attempts(ip, created_at);
GRANT ALL ON public.signup_attempts TO service_role;
ALTER TABLE public.signup_attempts ENABLE ROW LEVEL SECURITY;
