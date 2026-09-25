-- Publicação no LinkedIn — Página da Empresa (Community Management API) e,
-- futuramente, perfil pessoal (Share on LinkedIn). Mesmo padrão do TikTok:
-- token só é lido/escrito pelo servidor (service_role), sem policy pra
-- authenticated/anon, e o estado por conteúdo fica numa tabela própria em
-- vez de colunas novas em content_items, pra não repetir o incidente da
-- coluna fb_auto_publish que derrubou o SELECT compartilhado de posts de
-- todas as agências quando não confirmada em produção.
--
-- `organization_urn`/`organization_name` valem pra conexão de Página da
-- Empresa; `person_urn` fica pra quando o perfil pessoal for liberado —
-- uma credencial nunca tem os dois preenchidos ao mesmo tempo (uma conexão
-- é ou a página, ou o perfil pessoal de quem conectou).

CREATE TABLE public.client_linkedin_credentials (
  client_id uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  organization_urn text,
  organization_name text,
  person_urn text,
  person_name text,
  access_token text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  refresh_token text,
  refresh_token_expires_at timestamptz,
  scopes text,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_linkedin_credentials_target_check
    CHECK (num_nonnulls(organization_urn, person_urn) = 1)
);
ALTER TABLE public.client_linkedin_credentials ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.client_linkedin_credentials TO service_role;
-- Sem GRANT nem policy pra authenticated/anon de propósito.

CREATE TABLE public.content_item_linkedin (
  item_id uuid PRIMARY KEY REFERENCES public.content_items(id) ON DELETE CASCADE,
  auto_publish boolean NOT NULL DEFAULT false,
  visibility text,
  post_urn text,
  published_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.content_item_linkedin ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.content_item_linkedin TO service_role;

CREATE INDEX idx_content_item_linkedin_auto
  ON public.content_item_linkedin (item_id)
  WHERE auto_publish = true;

-- Pra reverter (DOWN), rodar:
--   DROP TABLE IF EXISTS public.content_item_linkedin;
--   DROP TABLE IF EXISTS public.client_linkedin_credentials;
