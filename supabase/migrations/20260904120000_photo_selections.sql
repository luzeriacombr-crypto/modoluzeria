-- Seleção de Fotos: cliente escolhe fotos de uma pasta do Google Drive num
-- link público (sem login), a agência vê a seleção e copia o código pro
-- Lightroom. Mesmo padrão de segurança do feed_share_tokens/preview.$token:
-- RLS não dá NENHUM acesso direto pro anon nessas duas tabelas — todo
-- acesso público passa pelas funções SECURITY DEFINER abaixo, que validam
-- o token internamente antes de ler/escrever.

CREATE TABLE public.photo_selections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  title text NOT NULL,
  drive_folder_id text NOT NULL,
  drive_folder_link text NOT NULL,
  deadline date,
  status text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta', 'finalizada')),
  token text NOT NULL UNIQUE,
  finalized_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_selections TO authenticated;
GRANT ALL ON public.photo_selections TO service_role;
ALTER TABLE public.photo_selections ENABLE ROW LEVEL SECURITY;

-- Sem policy de leitura "true" pra authenticated (diferente do
-- feed_share_tokens original) — só admin da própria org, seguindo o
-- padrão já corrigido em fix_cross_org_admin_rls.sql.
CREATE POLICY "admin manage photo selections" ON public.photo_selections
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX photo_selections_token_idx ON public.photo_selections(token);
CREATE INDEX photo_selections_client_idx ON public.photo_selections(client_id);


CREATE TABLE public.photo_selection_choices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid NOT NULL REFERENCES public.photo_selections(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  file_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selection_id, drive_file_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_selection_choices TO authenticated;
GRANT ALL ON public.photo_selection_choices TO service_role;
ALTER TABLE public.photo_selection_choices ENABLE ROW LEVEL SECURITY;

-- Só leitura/exclusão pra admin da org (via join na seleção-pai) — a
-- escrita do cliente público passa por submit_photo_selection() abaixo,
-- nunca por INSERT direto autenticado.
CREATE POLICY "admin read photo selection choices" ON public.photo_selection_choices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selections ps
    WHERE ps.id = photo_selection_choices.selection_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));

CREATE POLICY "admin delete photo selection choices" ON public.photo_selection_choices
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selections ps
    WHERE ps.id = photo_selection_choices.selection_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));

CREATE INDEX photo_selection_choices_selection_idx ON public.photo_selection_choices(selection_id);


-- ============ PUBLIC: dados da seleção pelo token ============
CREATE OR REPLACE FUNCTION public.get_public_photo_selection_info(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sel record;
  result jsonb;
BEGIN
  SELECT id, org_id, client_id, title, drive_folder_id, status, deadline
    INTO sel
  FROM public.photo_selections
  WHERE token = _token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'selectionId', sel.id,
    'orgId', sel.org_id,
    'clientId', sel.client_id,
    'title', sel.title,
    'driveFolderId', sel.drive_folder_id,
    'status', sel.status,
    'deadline', sel.deadline,
    'clientName', (SELECT c.name FROM public.clients c WHERE c.id = sel.client_id),
    'choices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('driveFileId', ch.drive_file_id, 'fileName', ch.file_name))
      FROM public.photo_selection_choices ch WHERE ch.selection_id = sel.id
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_photo_selection_info(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_photo_selection_info(text) TO anon, authenticated;


-- ============ PUBLIC: salvar seleção (pode ser chamado várias vezes) ============
CREATE OR REPLACE FUNCTION public.submit_photo_selection(_token text, _choices jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_selection_id uuid;
  v_status text;
BEGIN
  SELECT id, status INTO v_selection_id, v_status
  FROM public.photo_selections WHERE token = _token;
  IF v_selection_id IS NULL THEN RETURN false; END IF;
  IF v_status = 'finalizada' THEN RETURN false; END IF;

  DELETE FROM public.photo_selection_choices WHERE selection_id = v_selection_id;

  INSERT INTO public.photo_selection_choices (selection_id, drive_file_id, file_name)
  SELECT v_selection_id, (c ->> 'driveFileId'), (c ->> 'fileName')
  FROM jsonb_array_elements(_choices) AS c
  WHERE (c ->> 'driveFileId') IS NOT NULL AND (c ->> 'fileName') IS NOT NULL;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_photo_selection(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_photo_selection(text, jsonb) TO anon, authenticated;


-- ============ PUBLIC: finalizar seleção (trava novas mudanças) ============
CREATE OR REPLACE FUNCTION public.finalize_photo_selection(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id uuid;
BEGIN
  UPDATE public.photo_selections
  SET status = 'finalizada', finalized_at = now()
  WHERE token = _token AND status = 'aberta'
  RETURNING id INTO v_updated_id;

  IF v_updated_id IS NOT NULL THEN RETURN true; END IF;
  -- Token inválido devolve false; já finalizada antes é idempotente (true).
  RETURN EXISTS (SELECT 1 FROM public.photo_selections WHERE token = _token);
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_photo_selection(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_photo_selection(text) TO anon, authenticated;
