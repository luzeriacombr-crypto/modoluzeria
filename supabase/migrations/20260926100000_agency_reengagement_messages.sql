-- Histórico de mensagens de reativação mandadas pra agências inativas (aba
-- "Mensagens" em Planos e Cobrança, platform-admin only). Uma linha por
-- envio — e-mail é enviado de verdade pelo Resend; WhatsApp é só o link
-- wa.me gerado (não temos como confirmar que a pessoa realmente clicou
-- "enviar" do outro lado), então o histórico de WhatsApp marca "link
-- gerado em", não "entregue em".
-- Sem SELECT/INSERT pra `authenticated` de propósito, mesmo padrão de
-- page_views/ai_planning_feedback: só o platform admin acessa, sempre via
-- supabaseAdmin, nunca pelo client RLS-scoped.
CREATE TABLE public.agency_reengagement_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject text,
  body text NOT NULL,
  sent_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.agency_reengagement_messages TO service_role;
ALTER TABLE public.agency_reengagement_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agency_reengagement_messages_org ON public.agency_reengagement_messages(org_id, sent_at DESC);
