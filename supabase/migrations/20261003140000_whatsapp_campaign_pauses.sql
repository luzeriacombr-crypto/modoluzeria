-- Pausas das campanhas de ativação no WhatsApp: quando a agência toca em
-- "Já fiz", "Preciso de ajuda" ou "Agora não" num modelo com botões, ela sai
-- dessa campanha até a data em `until` (envio manual e automático de 48h
-- respeitam). Sem acesso pra `authenticated`: só o server via supabaseAdmin.
CREATE TABLE public.whatsapp_campaign_pauses (
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  -- noClients | fewClients | noTeam (ver ACTIVATION_CAMPAIGNS em whatsapp.server.ts)
  campaign_key text NOT NULL,
  until timestamptz NOT NULL,
  -- done | help | later
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, campaign_key)
);
GRANT ALL ON public.whatsapp_campaign_pauses TO service_role;
ALTER TABLE public.whatsapp_campaign_pauses ENABLE ROW LEVEL SECURITY;

-- Pra reverter:
-- DROP TABLE public.whatsapp_campaign_pauses;
