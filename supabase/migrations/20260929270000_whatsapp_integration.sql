-- Integração com a API oficial do WhatsApp (Cloud API da Meta), de uso
-- interno do Junior: boas-vindas no cadastro, alerta de suporte no WhatsApp
-- dele (e a resposta dele volta pra agência) e disparo em massa pelo painel
-- de Mensagens. Mesmo padrão de agency_reengagement_messages: sem acesso pra
-- `authenticated`, só o server via supabaseAdmin (platform admin), nunca RLS
-- aberta.

-- Toda mensagem que entra ou sai pelo número do Modo Criador.
CREATE TABLE public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  direction text NOT NULL CHECK (direction IN ('out', 'in')),
  phone text NOT NULL,
  -- welcome | support_alert | support_reply | campaign | text | inbound
  kind text NOT NULL,
  template_name text,
  body text,
  -- id da mensagem no WhatsApp (wamid) — é por ele que o webhook atualiza
  -- o status e acha a qual alerta o Junior está respondendo.
  wamid text UNIQUE,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed', 'received')),
  error text,
  org_id uuid REFERENCES public.orgs(id) ON DELETE SET NULL,
  campaign_id uuid,
  -- Só em kind='support_alert': pra onde vai a resposta do Junior.
  support_thread_id uuid REFERENCES public.support_threads(id) ON DELETE SET NULL,
  reply_to_phone text,
  reply_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_messages TO service_role;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_whatsapp_messages_campaign ON public.whatsapp_messages(campaign_id) WHERE campaign_id IS NOT NULL;
CREATE INDEX idx_whatsapp_messages_phone ON public.whatsapp_messages(phone, created_at DESC);

-- Um registro por disparo em massa feito pelo painel de Mensagens.
CREATE TABLE public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_name text NOT NULL,
  params jsonb NOT NULL DEFAULT '{}'::jsonb,
  total integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_campaigns TO service_role;
ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.whatsapp_messages
  ADD CONSTRAINT whatsapp_messages_campaign_fk
  FOREIGN KEY (campaign_id) REFERENCES public.whatsapp_campaigns(id) ON DELETE SET NULL;

-- Quem respondeu SAIR não recebe mais nada que não pediu (campanha, resposta
-- de suporte). Chave = número normalizado sem o 9º dígito (o WhatsApp às
-- vezes devolve número brasileiro sem ele), ver phoneKey() em whatsapp.server.ts.
CREATE TABLE public.whatsapp_opt_outs (
  phone_key text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.whatsapp_opt_outs TO service_role;
ALTER TABLE public.whatsapp_opt_outs ENABLE ROW LEVEL SECURITY;

-- Pra reverter:
-- DROP TABLE public.whatsapp_opt_outs;
-- DROP TABLE public.whatsapp_messages;
-- DROP TABLE public.whatsapp_campaigns;
