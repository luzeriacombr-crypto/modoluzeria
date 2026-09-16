-- Seleção de Fotos ganha um segundo uso: "entrega" (fotos finais, sem
-- marca d'água, com botão de baixar) além do já existente "selecao"
-- (cliente escolhe favoritas, com marca d'água).
--
-- Coluna chamada `selection_mode`, NÃO `mode` — um `mode` puro quebra
-- QUALQUER query do PostgREST nessa tabela (select, filter, insert) com o
-- erro "WITHIN GROUP is required for ordered-set aggregate mode": o
-- Postgres colide o identificador com a função agregada nativa
-- mode() WITHIN GROUP (ORDER BY ...) quando não encontra uma coluna com
-- esse nome. Descoberto ao vivo antes dessa coluna existir de verdade.

ALTER TABLE public.photo_selections
  ADD COLUMN selection_mode text NOT NULL DEFAULT 'selecao' CHECK (selection_mode IN ('selecao', 'entrega'));

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
  SELECT id, org_id, photo_client_id, title, drive_folder_id, status, deadline, cover_drive_file_id, photo_order, selection_mode
    INTO sel
  FROM public.photo_selections
  WHERE token = _token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'selectionId', sel.id,
    'orgId', sel.org_id,
    'clientId', sel.photo_client_id,
    'title', sel.title,
    'driveFolderId', sel.drive_folder_id,
    'status', sel.status,
    'deadline', sel.deadline,
    'coverDriveFileId', sel.cover_drive_file_id,
    'photoOrder', sel.photo_order,
    'mode', sel.selection_mode,
    'clientName', (SELECT pc.name FROM public.photo_clients pc WHERE pc.id = sel.photo_client_id)
  ) INTO result;
  RETURN result;
END;
$$;
