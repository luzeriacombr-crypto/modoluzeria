-- MCP do Modo Criador: chaves de API por agência (guardadas só como hash) e
-- registro de uso. Sem políticas de RLS de propósito: tudo passa por server
-- functions com service role (a agência nunca lê essas tabelas direto).
CREATE TABLE public.mcp_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
CREATE INDEX idx_mcp_api_keys_org ON public.mcp_api_keys(org_id);
CREATE INDEX idx_mcp_api_keys_user ON public.mcp_api_keys(user_id);

CREATE TABLE public.mcp_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  key_id uuid REFERENCES public.mcp_api_keys(id) ON DELETE SET NULL,
  tool text NOT NULL,
  ok boolean NOT NULL DEFAULT true,
  summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_mcp_audit_key_created ON public.mcp_audit_log(key_id, created_at DESC);
CREATE INDEX idx_mcp_audit_org_created ON public.mcp_audit_log(org_id, created_at DESC);

ALTER TABLE public.mcp_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mcp_audit_log ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.mcp_api_keys TO service_role;
GRANT ALL ON public.mcp_audit_log TO service_role;
