-- Loosens member_can_edit_item (20260814030000): the first version also
-- required the caller to already be an item_assignees row for that item,
-- mirroring the DetailPanel's pre-existing (dead) canSetEditor check. Turns
-- out that's not what was wanted — any member should be able to open a
-- post/reel and set themselves as editor / pick its format once the org
-- has members_can_set_editor_format on, not just members already assigned
-- to that specific item. Drops the assignee requirement; admin still
-- always passes.
CREATE OR REPLACE FUNCTION public.member_can_edit_item(_item_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      JOIN public.clients c ON c.id = m.client_id
      JOIN public.orgs o ON o.id = c.org_id
      WHERE ci.id = _item_id AND o.members_can_set_editor_format
    )
$$;
