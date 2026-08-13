-- Hotfix: 20260813000000_setor_permissions.sql recreated set_item_status()
-- from an older base and regressed two things fixed since: (1) the
-- p_status::content_status cast (without it Postgres raises 'column
-- "status" is of type content_status but expression is of type text' on
-- every call), and (2) the FINALIZADO admin-only gate (20260805100500 had
-- extended the PRONTO_PARA_PUBLICAR check to also cover FINALIZADO). Restore
-- both, keeping the setor-permission relaxation from 20260813000000 — and
-- extend that relaxation to FINALIZADO too, since "approve_finalize" is
-- meant to cover both per its label ("Aprovar posts e reels").
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
  IF p_status IN ('PRONTO_PARA_PUBLICAR', 'FINALIZADO')
     AND NOT public.is_master(auth.uid())
     AND NOT public.has_setor_permission(auth.uid(), 'approve_finalize') THEN
    RAISE EXCEPTION 'Apenas administradores podem marcar como pronto para publicar ou finalizado.';
  END IF;
  UPDATE public.content_items SET status = p_status::content_status WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_item_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_status(uuid, text) TO authenticated;
