-- Lets the CLIENT approve or ask for a change on a roteiro from the public
-- preview page, kept as its own client_status/client_note pair on the same
-- client_doc_roteiro_status row the internal team already uses (20260814020000)
-- — the team's own aprovado/ajustar review and the client's sign-off are
-- independent state, not the same field. Written via a SECURITY DEFINER RPC
-- (same shape as add_public_feedback/approve_public_feed) since the public
-- page has no logged-in profile and the table's RLS is otherwise admin-only.
ALTER TABLE public.client_doc_roteiro_status
  ADD COLUMN client_status text NOT NULL DEFAULT 'pending' CHECK (client_status IN ('pending', 'aprovado', 'ajustar')),
  ADD COLUMN client_note text,
  ADD COLUMN client_responded_at timestamptz;

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
  FROM public.feed_share_tokens
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
REVOKE ALL ON FUNCTION public.set_roteiro_client_status(text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_roteiro_client_status(text, uuid, text, text, text) TO anon, authenticated;

-- Notify the team (master/setor of that org) when the client responds —
-- guarded so it only fires on an actual client_status change, not every
-- time the team's own upsertRoteiroStatus touches the same row.
CREATE OR REPLACE FUNCTION public.notify_roteiro_client_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec record;
  v_client_id uuid;
  v_client_name text;
  v_verb text;
BEGIN
  IF NEW.client_status NOT IN ('aprovado', 'ajustar') THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.client_status IS NOT DISTINCT FROM NEW.client_status THEN RETURN NEW; END IF;

  v_verb := CASE NEW.client_status WHEN 'aprovado' THEN 'aprovou' ELSE 'pediu ajuste em' END;
  SELECT c.id, c.name INTO v_client_id, v_client_name
  FROM public.client_docs cd JOIN public.clients c ON c.id = cd.client_id
  WHERE cd.id = NEW.doc_id;
  IF v_client_id IS NULL THEN RETURN NEW; END IF;

  FOR rec IN
    SELECT ur.user_id FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    WHERE ur.role IN ('master', 'setor') AND p.org_id = NEW.org_id AND p.active = true
  LOOP
    INSERT INTO public.notifications (user_id, type, client_id, message)
    VALUES (
      rec.user_id, 'roteiro_client_status', v_client_id,
      COALESCE(v_client_name, 'Cliente') || ' ' || v_verb || ' o roteiro "' || NEW.roteiro_title || '"'
    );
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_roteiro_client_status ON public.client_doc_roteiro_status;
CREATE TRIGGER trg_notify_roteiro_client_status
  AFTER INSERT OR UPDATE ON public.client_doc_roteiro_status
  FOR EACH ROW EXECUTE FUNCTION public.notify_roteiro_client_status();
