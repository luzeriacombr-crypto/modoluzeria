-- "Traga sua IA": a organização cola a própria chave de API (Anthropic) e
-- passa a usar a IA do app por conta dela, sem limite de clientes. Sem
-- chave, valem só os 2 primeiros clientes/marcas grátis (teste).
-- A chave fica criptografada pelo servidor (AES-256-GCM) e a tabela só é
-- acessível pelo service role: nem o app autenticado consegue ler.
CREATE TABLE IF NOT EXISTS public.org_ai_credentials (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'anthropic' CHECK (provider IN ('anthropic')),
  api_key text NOT NULL,
  key_last4 text NOT NULL,
  verified_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.org_ai_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.org_ai_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.org_ai_credentials TO service_role;
