-- Aba "E-mails" (Configurações, só a plataforma): textos editados dos
-- e-mails automáticos que as agências recebem (boas-vindas, convite,
-- lembretes de ativação, fim do teste, conta pausada, fatura, senha).
-- Sem linha pra uma chave = usa o texto padrão do código
-- (email-templates.server.ts). Campos null também caem no padrão.
--
-- E orgs.marketing_emails_opt_out_at: quando a agência clica em "não quero
-- mais receber" num e-mail de reativação (aba Mensagens). Só barra esses
-- e-mails de marketing — avisos de conta, teste e fatura continuam.
--
-- Pra reverter (DOWN), rodar:
--   DROP TABLE IF EXISTS public.email_templates;
--   ALTER TABLE public.orgs DROP COLUMN IF EXISTS marketing_emails_opt_out_at;

CREATE TABLE public.email_templates (
  key text PRIMARY KEY CHECK (key IN (
    'welcome', 'team_invite', 'activation_nudge', 'trial_ending',
    'account_paused', 'invoice', 'password_reset', 'footer'
  )),
  subject text,
  heading text,
  body text,
  highlight text,
  button_label text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de message_templates: is_master + org fixa da Luzeria, não
-- is_master genérico (que também seria true pro master de qualquer agência).
CREATE POLICY "platform_admin_email_templates_read" ON public.email_templates FOR SELECT
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

CREATE POLICY "platform_admin_email_templates_write" ON public.email_templates FOR ALL
  USING (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001')
  WITH CHECK (public.is_master(auth.uid()) AND public.current_org_id() = '00000000-0000-0000-0000-000000000001');

ALTER TABLE public.orgs ADD COLUMN IF NOT EXISTS marketing_emails_opt_out_at timestamptz;
