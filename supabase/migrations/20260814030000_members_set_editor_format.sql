-- Lets an org opt in to letting regular members (not just admin/setor) set
-- themselves/others as editor and pick the video format (reel_type on
-- reels, post_format on posts) on items they're assigned to. The DetailPanel
-- UI already had app-level logic gating this to assignees (canSetEditor),
-- but it was dead code: content_items UPDATE is admin-only via RLS
-- ("admin manage items", 20260731130000), so a member's write was always
-- rejected regardless of the UI check. These SECURITY DEFINER RPCs mirror
-- set_item_status's escape-hatch pattern (20260722190000 /
-- 20260813000000) to give members a narrow, explicit path in — gated by
-- this new org toggle, and only for items they're an assignee of.
ALTER TABLE public.orgs ADD COLUMN members_can_set_editor_format boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.member_can_edit_item(_item_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM public.content_items ci
        JOIN public.months m ON m.id = ci.month_id
        JOIN public.clients c ON c.id = m.client_id
        JOIN public.orgs o ON o.id = c.org_id
        WHERE ci.id = _item_id AND o.members_can_set_editor_format
      )
      AND EXISTS (
        SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = _item_id AND ia.user_id = auth.uid()
      )
    )
$$;
REVOKE ALL ON FUNCTION public.member_can_edit_item(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_can_edit_item(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_item_editor(_item_id uuid, _editor_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_profile(auth.uid()) THEN RAISE EXCEPTION 'Conta inativa.'; END IF;
  IF NOT public.member_can_edit_item(_item_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.content_items SET editor_id = _editor_id WHERE id = _item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_item_editor(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_editor(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_item_reel_type(_item_id uuid, _reel_type text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_profile(auth.uid()) THEN RAISE EXCEPTION 'Conta inativa.'; END IF;
  IF NOT public.member_can_edit_item(_item_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.content_items SET reel_type = _reel_type WHERE id = _item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_item_reel_type(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_reel_type(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_item_post_format(_item_id uuid, _post_format text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_active_profile(auth.uid()) THEN RAISE EXCEPTION 'Conta inativa.'; END IF;
  IF NOT public.member_can_edit_item(_item_id) THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.content_items SET post_format = _post_format WHERE id = _item_id;
END;
$$;
REVOKE ALL ON FUNCTION public.set_item_post_format(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_item_post_format(uuid, text) TO authenticated;
