-- Multi-tenant Fase 1, passo 3: cada agência conecta o próprio Google Drive.
-- O Client ID/Secret do app OAuth continua compartilhado (é só a identidade
-- do aplicativo no Google); o que muda por agência é o refresh_token —
-- a autorização específica da conta do Drive de cada uma.

CREATE TABLE public.org_google_credentials (
  org_id uuid PRIMARY KEY REFERENCES public.orgs(id) ON DELETE CASCADE,
  refresh_token text NOT NULL,
  drive_email text,
  connected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  connected_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_google_credentials TO authenticated;
GRANT ALL ON public.org_google_credentials TO service_role;
ALTER TABLE public.org_google_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "master manage own org drive credentials" ON public.org_google_credentials FOR ALL TO authenticated
  USING (public.is_master(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_master(auth.uid()) AND org_id = public.current_org_id());

-- Migra a credencial atual da Luzeria (hoje só em variável de ambiente) para
-- a tabela nova, assim que o valor for informado — ver instrução em separado.
-- Até lá, getAccessToken() continua caindo no fallback de env var pra
-- LUZERIA_ORG_ID, então nada quebra mesmo sem rodar esse INSERT agora.
