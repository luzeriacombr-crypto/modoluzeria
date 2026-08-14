-- "Roteiros" e "Planejamento" apresentados de forma bonita pro cliente na
-- página pública de preview. O time cola um texto já formatado em Markdown
-- (produzido por uma IA externa a partir de um prompt pronto que o app
-- oferece) — este texto é guardado como está, sem reprocessamento por IA
-- dentro do app; a apresentação bonita vem só de renderizar o Markdown com
-- um layout específico por tipo (ver markdown-lite.ts no frontend).
CREATE TABLE public.client_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('roteiro', 'planejamento')),
  title text,
  content text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_docs TO authenticated;
GRANT ALL ON public.client_docs TO service_role;
ALTER TABLE public.client_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage client docs" ON public.client_docs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX idx_client_docs_client ON public.client_docs(client_id, type, created_at DESC);

CREATE TRIGGER client_docs_touch_updated_at BEFORE UPDATE ON public.client_docs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Mesmo padrão de get_org_id_for_token (20260731200000): a página pública
-- de preview não tem profile logado pra resolver client_id, então resolve
-- a partir do próprio token de compartilhamento.
CREATE OR REPLACE FUNCTION public.get_client_id_for_token(_token text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.client_id
  FROM public.feed_share_tokens t
  WHERE t.token = _token AND t.revoked_at IS NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_client_id_for_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_id_for_token(text) TO anon, authenticated;
