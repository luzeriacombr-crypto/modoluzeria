-- Publicação no TikTok (Content Posting API, Direct Post) — Login Kit +
-- video.publish. Diferente do Instagram/Facebook, que guardam o token numa
-- tabela legível por qualquer membro ativo da org, aqui NENHUMA policy é
-- criada pra `authenticated`: o token só é lido/escrito pelo servidor
-- (service_role), depois de checar org e permissão nas server functions.
--
-- O estado por conteúdo (programação, opções de privacidade, erro) fica numa
-- tabela própria em vez de colunas novas em content_items, pra não mexer no
-- SELECT compartilhado de content_items (mesma lição do incidente de
-- fb_auto_publish: coluna nova não confirmada em produção derrubou a query
-- de posts de todas as agências).

CREATE TABLE public.client_tiktok_credentials (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  open_id text NOT NULL,
  display_name text,
  avatar_url text,
  access_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  refresh_token text NOT NULL,
  refresh_token_expires_at timestamptz NOT NULL,
  scopes text,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.client_tiktok_credentials ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_tiktok_credentials TO service_role;
-- Sem GRANT nem policy pra authenticated/anon de propósito.

CREATE TABLE public.content_item_tiktok (
  item_id uuid PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  auto_publish boolean NOT NULL DEFAULT false,
  -- Escolhas do usuário exigidas pelas regras de UX do TikTok: sem valor
  -- padrão de privacidade, comentário/duet/stitch começam desligados.
  privacy_level text,
  allow_comment boolean NOT NULL DEFAULT false,
  allow_duet boolean NOT NULL DEFAULT false,
  allow_stitch boolean NOT NULL DEFAULT false,
  brand_organic boolean NOT NULL DEFAULT false,
  brand_content boolean NOT NULL DEFAULT false,
  publish_id text,
  published_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_item_tiktok ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.content_item_tiktok TO service_role;

CREATE INDEX idx_content_item_tiktok_auto
  ON public.content_item_tiktok (item_id)
  WHERE auto_publish = true;

-- Pra reverter (DOWN), rodar:
--   DROP TABLE IF EXISTS public.content_item_tiktok;
--   DROP TABLE IF EXISTS public.client_tiktok_credentials;
