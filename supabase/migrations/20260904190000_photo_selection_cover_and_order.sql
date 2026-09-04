-- Duas configurações por seleção: qual foto usar de capa (escolhida pelo
-- admin, em vez de sempre a primeira em ordem alfabética) e em que ordem
-- mostrar as fotos pro cliente (nome do arquivo ou horário real da foto,
-- via EXIF).

ALTER TABLE public.photo_selections ADD COLUMN cover_drive_file_id text;

ALTER TABLE public.photo_selections
  ADD COLUMN photo_order text NOT NULL DEFAULT 'nome'
    CHECK (photo_order IN ('nome', 'horario'));

-- get_public_photo_selection_info passa a devolver os dois campos novos.
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
  SELECT id, org_id, photo_client_id, title, drive_folder_id, status, deadline, cover_drive_file_id, photo_order
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
    'clientName', (SELECT pc.name FROM public.photo_clients pc WHERE pc.id = sel.photo_client_id)
  ) INTO result;
  RETURN result;
END;
$$;
