-- Busca por rosto na Seleção de Fotos: o convidado manda uma selfie e o
-- sistema filtra só as fotos onde ele aparece. Reconhecimento facial é
-- feito pela AWS Rekognition (Collections), não aqui no banco — não
-- guardamos vetor de rosto nenhum, só o registro de QUAIS arquivos do
-- Drive já foram indexados numa collection (pra saber o que falta
-- processar e poder retomar depois de uma pane, sem reprocessar tudo).
--
-- Ativado por seleção (opt-in), nunca por padrão — é dado biométrico
-- (LGPD, dado pessoal sensível). A tela pública só mostra a opção de
-- mandar selfie quando face_search_enabled = true.

ALTER TABLE public.photo_selections
  ADD COLUMN face_search_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN face_index_status text NOT NULL DEFAULT 'idle'
    CHECK (face_index_status IN ('idle', 'pending', 'indexing', 'ready', 'error')),
  ADD COLUMN face_index_total int,
  ADD COLUMN face_index_error text;

CREATE TABLE public.photo_selection_face_index (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid NOT NULL REFERENCES public.photo_selections(id) ON DELETE CASCADE,
  drive_file_id text NOT NULL,
  faces_found int NOT NULL DEFAULT 0,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (selection_id, drive_file_id)
);

GRANT SELECT, INSERT, DELETE ON public.photo_selection_face_index TO authenticated;
GRANT ALL ON public.photo_selection_face_index TO service_role;
ALTER TABLE public.photo_selection_face_index ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de admin-only das outras tabelas de Seleção de Fotos —
-- ninguém autenticado fora da própria org enxerga isso, e o público não
-- tem acesso nenhum (a busca em si acontece via Rekognition, não por
-- aqui; essa tabela só serve o painel interno de progresso).
CREATE POLICY "admin read photo selection face index" ON public.photo_selection_face_index
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selections ps
    WHERE ps.id = photo_selection_face_index.selection_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));

CREATE INDEX photo_selection_face_index_selection_idx ON public.photo_selection_face_index(selection_id);


-- Liga/desliga a busca por rosto numa seleção — só admin da própria org.
CREATE OR REPLACE FUNCTION public.set_photo_selection_face_search(_selection_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.photo_selections
  SET face_search_enabled = _enabled,
      face_index_status = CASE WHEN _enabled THEN 'pending' ELSE 'idle' END
  WHERE id = _selection_id
    AND org_id = public.current_org_id()
    AND public.is_admin(auth.uid());
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.set_photo_selection_face_search(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_photo_selection_face_search(uuid, boolean) TO authenticated;
