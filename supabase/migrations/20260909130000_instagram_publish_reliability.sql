-- Instagram: renovação automática de token + registro de falha na
-- publicação programada. Diagnosticado: o token de acesso (Meta,
-- Instagram Business Login) é "long-lived" e expira em ~60 dias — nada no
-- código renovava, então qualquer cliente conectado há mais de 60 dias
-- tinha TODA publicação (manual ou programada) falhando silenciosamente.
-- Combinado com nenhuma notificação de falha, a agência só via "não
-- publicou", sem saber por quê.

-- token_expires_at fica NULL pras conexões já existentes de propósito —
-- o cron de renovação trata NULL como "precisa renovar agora", então toda
-- conexão já feita (inclusive as já quebradas) é verificada no primeiro
-- run depois do deploy, não só as novas.
ALTER TABLE public.client_instagram_credentials ADD COLUMN token_expires_at timestamptz;

ALTER TABLE public.content_items ADD COLUMN ig_last_error text;
ALTER TABLE public.content_items ADD COLUMN ig_last_error_at timestamptz;
