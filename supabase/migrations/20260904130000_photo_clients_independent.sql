-- Seleção de Fotos vira uma área independente: em vez de pertencer a um
-- cliente de social media (public.clients), cada seleção agora pertence a
-- um "cliente de fotografia" (public.photo_clients) — entidade nova, mais
-- enxuta, sem nada de posts/reels/meses/Instagram. Não há linhas reais em
-- photo_selections ainda, então a troca de dono é uma migração limpa, sem
-- necessidade de mover dados.

CREATE TABLE public.photo_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_clients TO authenticated;
GRANT ALL ON public.photo_clients TO service_role;
ALTER TABLE public.photo_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin manage photo clients" ON public.photo_clients
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND org_id = public.current_org_id())
  WITH CHECK (public.is_admin(auth.uid()) AND org_id = public.current_org_id());

CREATE INDEX photo_clients_org_idx ON public.photo_clients(org_id);


-- photo_selections passa a pertencer a photo_clients, não a clients.
-- Solta a constraint/renomeia ANTES do backfill abaixo, pra poder repor o
-- vínculo com um id de photo_clients sem esbarrar na FK antiga (que só
-- aceitava ids de clients).
ALTER TABLE public.photo_selections DROP CONSTRAINT photo_selections_client_id_fkey;
ALTER TABLE public.photo_selections RENAME COLUMN client_id TO photo_client_id;

-- Preserva qualquer seleção já criada em produção antes dessa migração
-- (ex: o teste "Andreia" feito ao vivo) — cria o cliente de fotografia
-- correspondente e reaponta o vínculo, em vez de simplesmente perder o
-- histórico na hora de trocar o dono da seleção.
DO $$
DECLARE
  r record;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT c.id AS old_client_id, c.org_id, c.name
    FROM public.clients c
    JOIN public.photo_selections ps ON ps.photo_client_id = c.id
  LOOP
    INSERT INTO public.photo_clients (org_id, name) VALUES (r.org_id, r.name)
    RETURNING id INTO new_id;
    UPDATE public.photo_selections SET photo_client_id = new_id WHERE photo_client_id = r.old_client_id;
  END LOOP;
END $$;

ALTER TABLE public.photo_selections
  ADD CONSTRAINT photo_selections_photo_client_id_fkey
  FOREIGN KEY (photo_client_id) REFERENCES public.photo_clients(id) ON DELETE CASCADE;

-- O índice antigo ficou com o nome antigo mas continua servindo a mesma
-- coluna (só o nome dela mudou) — sem necessidade de recriar.


-- Atualiza a função pública pra buscar o nome em photo_clients.
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
    'clientName', (SELECT pc.name FROM public.photo_clients pc WHERE pc.id = sel.photo_client_id),
    'choices', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('driveFileId', ch.drive_file_id, 'fileName', ch.file_name))
      FROM public.photo_selection_choices ch WHERE ch.selection_id = sel.id
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;


-- Notificação: coluna bolt-on em notifications, mesmo padrão usado quando
-- client_id foi adicionado em notify_stale_client_updates.sql.
ALTER TABLE public.notifications
  ADD COLUMN photo_client_id uuid REFERENCES public.photo_clients(id) ON DELETE CASCADE;
CREATE INDEX idx_notifications_photo_client ON public.notifications(photo_client_id) WHERE photo_client_id IS NOT NULL;


-- finalize_photo_selection agora também avisa a equipe (master/setor
-- ativos da org) quando o cliente termina a seleção — mesmo join usado em
-- notify_stale_client_updates.sql pra "notificar todos os admins da org".
CREATE OR REPLACE FUNCTION public.finalize_photo_selection(_token text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated_id uuid;
  v_org_id uuid;
  v_photo_client_id uuid;
  v_title text;
  v_photo_client_name text;
  v_choice_count int;
  admin_rec record;
  v_message text;
BEGIN
  UPDATE public.photo_selections
  SET status = 'finalizada', finalized_at = now()
  WHERE token = _token AND status = 'aberta'
  RETURNING id, org_id, photo_client_id, title
    INTO v_updated_id, v_org_id, v_photo_client_id, v_title;

  IF v_updated_id IS NULL THEN
    RETURN EXISTS (SELECT 1 FROM public.photo_selections WHERE token = _token);
  END IF;

  SELECT name INTO v_photo_client_name FROM public.photo_clients WHERE id = v_photo_client_id;
  SELECT count(*) INTO v_choice_count FROM public.photo_selection_choices WHERE selection_id = v_updated_id;

  v_message := COALESCE(v_photo_client_name, 'Cliente') || ' finalizou a seleção "' || v_title || '" — '
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
