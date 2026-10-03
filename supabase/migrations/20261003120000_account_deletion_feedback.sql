-- Por que as pessoas apagam a conta (motivos padrão + comentário livre), pedido do Junior em 03/10.
-- Sem FK pra orgs/profiles: o registro precisa sobreviver à exclusão. Só o servidor (service role) grava e lê;
-- nenhuma policy pra authenticated/anon.
CREATE TABLE IF NOT EXISTS public.account_deletion_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  scope text NOT NULL CHECK (scope IN ('org', 'me')),
  org_id uuid,
  org_name text,
  account_type text,
  subscription_status text,
  user_name text,
  user_email text,
  user_role text,
  reasons text[] NOT NULL DEFAULT '{}',
  comment text
);
ALTER TABLE public.account_deletion_feedback ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.account_deletion_feedback TO service_role;
CREATE INDEX IF NOT EXISTS account_deletion_feedback_created_idx ON public.account_deletion_feedback (created_at DESC);
