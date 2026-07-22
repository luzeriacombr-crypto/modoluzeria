-- content_items UPDATE is currently admin-only ("admin manage items" policy),
-- so regular members can't change a post/reel's status at all. Add a
-- SECURITY DEFINER RPC that lets any active member change status, except
-- into PRONTO_PARA_PUBLICAR — that final "ready to publish" gate stays
-- admin-only. Keeps the blanket admin-only policy on content_items
-- untouched for every other field (title, copy, dates, etc.).
CREATE OR REPLACE FUNCTION public.set_item_status(p_item_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_active_profile(auth.uid()) THEN
    RAISE EXCEPTION 'Conta inativa.';
  END IF;
  IF p_status = 'PRONTO_PARA_PUBLICAR' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem marcar como pronto para publicar.';
  END IF;
  UPDATE public.content_items SET status = p_status WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_item_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_status(uuid, text) TO authenticated;
