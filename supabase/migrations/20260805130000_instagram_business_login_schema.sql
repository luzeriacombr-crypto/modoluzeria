-- Migração do fluxo de conexão do Instagram: de "Login do Facebook para
-- Empresas" (via Página) para "API do Instagram com Login do Instagram"
-- (direto na conta profissional, sem Página). Remove a dependência de
-- facebook_page_id e renomeia page_access_token -> access_token (mesmo
-- propósito, token de acesso à conta do Instagram).
ALTER TABLE public.client_instagram_credentials DROP COLUMN IF EXISTS facebook_page_id;
ALTER TABLE public.client_instagram_credentials RENAME COLUMN page_access_token TO access_token;
