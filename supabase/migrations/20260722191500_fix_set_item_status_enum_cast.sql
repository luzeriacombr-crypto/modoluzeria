-- set_item_status() assigned p_status (text) directly to content_items.status,
-- which is the content_status enum — Postgres rejected it: "column 'status'
-- is of type content_status but expression is of type text". Cast it.
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
  UPDATE public.content_items SET status = p_status::content_status WHERE id = p_item_id;
END;
$$;
