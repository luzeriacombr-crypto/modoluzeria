-- Roteiros/Planejamento saem do link de preview do feed (que já vinha
-- incluindo eles escondido, sem opção de tirar) e ganham um link público
-- próprio, separado — mesmo mecanismo de feed_share_tokens (1 token por
-- cliente, revogável), tabela própria pra poder rotacionar/revogar sem
-- afetar o link do feed.
CREATE TABLE public.client_docs_share_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_docs_share_tokens TO authenticated;
GRANT ALL ON public.client_docs_share_tokens TO service_role;

ALTER TABLE public.client_docs_share_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage docs share tokens"
  ON public.client_docs_share_tokens FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Authenticated can read docs share tokens"
  ON public.client_docs_share_tokens FOR SELECT TO authenticated
  USING (true);

CREATE INDEX client_docs_share_tokens_token_idx ON public.client_docs_share_tokens(token);

-- Resolve client_id a partir do token, sem profile logado — mesmo padrão
-- de get_client_id_for_token (feed_share_tokens), mas pro token novo.
CREATE OR REPLACE FUNCTION public.get_client_id_for_docs_token(_token text)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.client_id
  FROM public.client_docs_share_tokens t
  WHERE t.token = _token AND t.revoked_at IS NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_client_id_for_docs_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_client_id_for_docs_token(text) TO anon, authenticated;

-- A aprovação do cliente por roteiro passa a valer no link novo, não mais
-- no de feed_share_tokens — mesmo corpo de antes, só troca a tabela de
-- onde resolve o client_id do token.
CREATE OR REPLACE FUNCTION public.set_roteiro_client_status(
  _token text, _doc_id uuid, _roteiro_title text, _client_status text, _client_note text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_doc_client_id uuid;
  v_doc_type text;
  v_org_id uuid;
  v_title text := btrim(_roteiro_title);
  v_row public.client_doc_roteiro_status%ROWTYPE;
BEGIN
  IF _client_status NOT IN ('aprovado', 'ajustar') THEN RETURN NULL; END IF;
  IF v_title IS NULL OR length(v_title) = 0 THEN RETURN NULL; END IF;
  IF _client_note IS NOT NULL AND length(_client_note) > 1000 THEN RETURN NULL; END IF;

  SELECT client_id INTO v_client_id
  FROM public.client_docs_share_tokens
  WHERE token = _token AND revoked_at IS NULL;
  IF v_client_id IS NULL THEN RETURN NULL; END IF;

  SELECT client_id, type, org_id INTO v_doc_client_id, v_doc_type, v_org_id
  FROM public.client_docs WHERE id = _doc_id;
  IF v_doc_client_id IS DISTINCT FROM v_client_id OR v_doc_type IS DISTINCT FROM 'roteiro' THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.client_doc_roteiro_status (doc_id, org_id, roteiro_title, client_status, client_note, client_responded_at)
  VALUES (_doc_id, v_org_id, v_title, _client_status, NULLIF(btrim(COALESCE(_client_note, '')), ''), now())
  ON CONFLICT (doc_id, roteiro_title) DO UPDATE SET
    client_status = EXCLUDED.client_status,
    client_note = EXCLUDED.client_note,
    client_responded_at = EXCLUDED.client_responded_at
  RETURNING * INTO v_row;

  RETURN json_build_object('ok', true, 'clientStatus', v_row.client_status);
END;
$$;
