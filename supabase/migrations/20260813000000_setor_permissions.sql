-- Configurable permissions for the "setor" role. Master is always fixed
-- (full access); setor's baseline stays exactly what it is today (is_admin
-- everywhere it already had it) except for four specific capabilities the
-- agency's Master can now toggle per-org from Configurações > Equipe:
--   - approve_finalize: mark a post/reel as "pronto pra publicar" (setor
--     already has this today — default ON so nothing regresses).
--   - instagram_publish: publish/schedule to Instagram (setor is blocked
--     today — default OFF).
--   - team_reports: view the full team report (setor is blocked today —
--     default OFF).
--   - settings_journey: access Configurações > Jornada do cliente (setor
--     has zero Configurações access today — default OFF).
ALTER TABLE public.orgs
  ADD COLUMN setor_permissions text[] NOT NULL DEFAULT ARRAY['approve_finalize'];

CREATE OR REPLACE FUNCTION public.has_setor_permission(_user_id uuid, _perm text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.id = ur.user_id
    JOIN public.orgs o ON o.id = p.org_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'setor'
      AND _perm = ANY(o.setor_permissions)
  );
$$;

REVOKE ALL ON FUNCTION public.has_setor_permission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_setor_permission(uuid, text) TO authenticated;

-- Same PRONTO_PARA_PUBLICAR gate as before, now also honoring the
-- per-org approve_finalize toggle for setor (master is always allowed).
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
  IF p_status = 'PRONTO_PARA_PUBLICAR'
     AND NOT public.is_master(auth.uid())
     AND NOT public.has_setor_permission(auth.uid(), 'approve_finalize') THEN
    RAISE EXCEPTION 'Apenas administradores podem marcar como pronto para publicar.';
  END IF;
  UPDATE public.content_items SET status = p_status WHERE id = p_item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.set_item_status(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_status(uuid, text) TO authenticated;
