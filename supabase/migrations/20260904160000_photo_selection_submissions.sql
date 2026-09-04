-- Vários respondentes por link de Seleção de Fotos: cada pessoa escolhe
-- suas próprias fotos e finaliza com o nome dela, em vez de um único
-- "finalizada" travando o link pra sempre. `status` passa a ser um
-- controle manual do admin (aberta = aceita respostas / encerrada = não
-- aceita mais), não algo setado por quem responde.

CREATE TABLE public.photo_selection_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  selection_id uuid NOT NULL REFERENCES public.photo_selections(id) ON DELETE CASCADE,
  respondent_name text NOT NULL,
  finalized_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_selection_submissions TO authenticated;
GRANT ALL ON public.photo_selection_submissions TO service_role;
ALTER TABLE public.photo_selection_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read photo selection submissions" ON public.photo_selection_submissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selections ps
    WHERE ps.id = photo_selection_submissions.selection_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));

CREATE POLICY "admin delete photo selection submissions" ON public.photo_selection_submissions
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selections ps
    WHERE ps.id = photo_selection_submissions.selection_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));

CREATE INDEX photo_selection_submissions_selection_idx ON public.photo_selection_submissions(selection_id);


-- photo_selection_choices passa a pertencer a uma resposta, não à seleção.
ALTER TABLE public.photo_selection_choices ADD COLUMN submission_id uuid REFERENCES public.photo_selection_submissions(id) ON DELETE CASCADE;

-- Preserva qualquer escolha já feita em produção antes dessa migração (o
-- teste "Andreia") — cria uma resposta com o nome do cliente de
-- fotografia e o finalized_at que já existia, e repõe o vínculo.
DO $$
DECLARE
  r record;
  new_sub_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT ps.id AS selection_id, ps.finalized_at, pc.name AS client_name
    FROM public.photo_selections ps
    JOIN public.photo_clients pc ON pc.id = ps.photo_client_id
    WHERE EXISTS (SELECT 1 FROM public.photo_selection_choices ch WHERE ch.selection_id = ps.id)
  LOOP
    INSERT INTO public.photo_selection_submissions (selection_id, respondent_name, finalized_at)
    VALUES (r.selection_id, r.client_name, COALESCE(r.finalized_at, now()))
    RETURNING id INTO new_sub_id;

    UPDATE public.photo_selection_choices SET submission_id = new_sub_id WHERE selection_id = r.selection_id;
  END LOOP;
END $$;

-- As policies antigas referenciam selection_id diretamente — precisam
-- sair ANTES de soltar a coluna, senão o Postgres recusa o DROP COLUMN.
DROP POLICY "admin read photo selection choices" ON public.photo_selection_choices;
DROP POLICY "admin delete photo selection choices" ON public.photo_selection_choices;

ALTER TABLE public.photo_selection_choices DROP CONSTRAINT photo_selection_choices_selection_id_fkey;
ALTER TABLE public.photo_selection_choices DROP COLUMN selection_id;
ALTER TABLE public.photo_selection_choices ALTER COLUMN submission_id SET NOT NULL;
ALTER TABLE public.photo_selection_choices DROP CONSTRAINT IF EXISTS photo_selection_choices_selection_id_drive_file_id_key;
ALTER TABLE public.photo_selection_choices ADD CONSTRAINT photo_selection_choices_submission_file_key UNIQUE (submission_id, drive_file_id);

CREATE POLICY "admin read photo selection choices" ON public.photo_selection_choices
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selection_submissions sub
    JOIN public.photo_selections ps ON ps.id = sub.selection_id
    WHERE sub.id = photo_selection_choices.submission_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));

CREATE POLICY "admin delete photo selection choices" ON public.photo_selection_choices
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.photo_selection_submissions sub
    JOIN public.photo_selections ps ON ps.id = sub.selection_id
    WHERE sub.id = photo_selection_choices.submission_id
      AND public.is_admin(auth.uid()) AND ps.org_id = public.current_org_id()
  ));


-- status vira um controle manual do admin (aberta/encerrada), não algo
-- setado por quem responde — todo mundo que já estava "finalizada" volta
-- pra "aberta" (a resposta em si já foi preservada acima como submission).
ALTER TABLE public.photo_selections DROP CONSTRAINT photo_selections_status_check;
UPDATE public.photo_selections SET status = 'aberta';
ALTER TABLE public.photo_selections ADD CONSTRAINT photo_selections_status_check CHECK (status IN ('aberta', 'encerrada'));
ALTER TABLE public.photo_selections DROP COLUMN finalized_at;


-- Metadados públicos simplificados: sem mais "escolhas já feitas antes"
-- (cada visita é de uma pessoa nova).
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
  SELECT id, org_id, photo_client_id, title, drive_folder_id, status, deadline
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
    'clientName', (SELECT pc.name FROM public.photo_clients pc WHERE pc.id = sel.photo_client_id)
  ) INTO result;
  RETURN result;
END;
$$;

DROP FUNCTION IF EXISTS public.submit_photo_selection(text, jsonb);
DROP FUNCTION IF EXISTS public.finalize_photo_selection(text);

-- Uma pessoa finaliza sua resposta: cria a submission, grava as escolhas
-- já ligadas a ela, e avisa os admins da org citando o nome dela.
CREATE OR REPLACE FUNCTION public.submit_photo_selection_response(_token text, _respondent_name text, _choices jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_selection_id uuid;
  v_org_id uuid;
  v_photo_client_id uuid;
  v_title text;
  v_status text;
  v_respondent text := btrim(_respondent_name);
  v_submission_id uuid;
  v_photo_client_name text;
  v_choice_count int;
  admin_rec record;
  v_message text;
BEGIN
  IF v_respondent IS NULL OR length(v_respondent) = 0 OR length(v_respondent) > 80 THEN
    RETURN false;
  END IF;

  SELECT id, org_id, photo_client_id, title, status
    INTO v_selection_id, v_org_id, v_photo_client_id, v_title, v_status
  FROM public.photo_selections
  WHERE token = _token;
  IF v_selection_id IS NULL OR v_status <> 'aberta' THEN
    RETURN false;
  END IF;

  INSERT INTO public.photo_selection_submissions (selection_id, respondent_name)
  VALUES (v_selection_id, v_respondent)
  RETURNING id INTO v_submission_id;

  INSERT INTO public.photo_selection_choices (submission_id, drive_file_id, file_name)
  SELECT v_submission_id, (c ->> 'driveFileId'), (c ->> 'fileName')
  FROM jsonb_array_elements(_choices) AS c
  WHERE (c ->> 'driveFileId') IS NOT NULL AND (c ->> 'fileName') IS NOT NULL;

  SELECT name INTO v_photo_client_name FROM public.photo_clients WHERE id = v_photo_client_id;
  SELECT count(*) INTO v_choice_count FROM public.photo_selection_choices WHERE submission_id = v_submission_id;

  v_message := v_respondent || ' finalizou a seleção "' || v_title || '" (' || COALESCE(v_photo_client_name, 'cliente') || ') — '
    || v_choice_count || ' foto' || (CASE WHEN v_choice_count = 1 THEN '' ELSE 's' END)
    || ' escolhida' || (CASE WHEN v_choice_count = 1 THEN '' ELSE 's' END) || '.';

  FOR admin_rec IN
    SELECT pr.id AS profile_id
    FROM public.profiles pr
    JOIN public.user_roles ur ON ur.user_id = pr.id AND ur.role IN ('master', 'setor')
    WHERE pr.org_id = v_org_id AND pr.active = true
  LOOP
    INSERT INTO public.notifications (user_id, type, photo_client_id, message)
    VALUES (admin_rec.profile_id, 'photo_selection_finalized', v_photo_client_id, v_message);
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_photo_selection_response(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_photo_selection_response(text, text, jsonb) TO anon, authenticated;
