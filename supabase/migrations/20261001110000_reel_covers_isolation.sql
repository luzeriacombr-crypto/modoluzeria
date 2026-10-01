-- Capas de Reel (bucket privado reel-covers, caminho "<item_id>/<arquivo>")
-- isoladas por agência. Antes:
-- - qualquer usuário logado, de qualquer agência, lia todas as capas;
-- - escrita/remoção exigia is_admin(), que não olha agência — o admin de
--   uma agência sobrescrevia ou apagava capa de outra.
-- Agora vale a mesma regra de comment-audio: o item do caminho tem que
-- ser da agência de quem chama e de um cliente a que essa pessoa tem
-- acesso. `objects.name` qualificado de propósito (ver
-- 20260802150000_fix_admin_avatar_policy_name_ambiguity.sql).
DROP POLICY IF EXISTS "reel-covers read for authenticated" ON storage.objects;
DROP POLICY IF EXISTS "reel-covers insert by admin or assignee" ON storage.objects;
DROP POLICY IF EXISTS "reel-covers update by admin or assignee" ON storage.objects;
DROP POLICY IF EXISTS "reel-covers delete by admin or assignee" ON storage.objects;

CREATE POLICY "reel-covers read own org items" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'reel-covers'
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id::text = split_part(objects.name, '/', 1)
        AND ci.org_id = public.current_org_id()
        AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

CREATE POLICY "reel-covers insert by admin or assignee" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'reel-covers'
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id::text = split_part(objects.name, '/', 1)
        AND ci.org_id = public.current_org_id()
        AND public.has_client_access(auth.uid(), m.client_id)
        AND (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = ci.id AND ia.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "reel-covers update by admin or assignee" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'reel-covers'
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id::text = split_part(objects.name, '/', 1)
        AND ci.org_id = public.current_org_id()
        AND public.has_client_access(auth.uid(), m.client_id)
        AND (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = ci.id AND ia.user_id = auth.uid())
        )
    )
  );

CREATE POLICY "reel-covers delete by admin or assignee" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'reel-covers'
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id::text = split_part(objects.name, '/', 1)
        AND ci.org_id = public.current_org_id()
        AND public.has_client_access(auth.uid(), m.client_id)
        AND (
          public.is_admin(auth.uid())
          OR EXISTS (SELECT 1 FROM public.item_assignees ia WHERE ia.item_id = ci.id AND ia.user_id = auth.uid())
        )
    )
  );

-- O feed público, a lixeira e a publicação no Instagram assinam a capa
-- com o service role (sem RLS). Sem esta trava, quem edita um item podia
-- gravar em cover_path o caminho da capa de um item de outra agência e
-- lê-la pelo link do feed. NOT VALID: só vale pra escrita nova — as capas
-- existentes já seguem o padrão (uploadItemCover sempre grava
-- "<item_id>/...").
ALTER TABLE public.content_items
  ADD CONSTRAINT content_items_cover_path_own_item
  CHECK (cover_path IS NULL OR split_part(cover_path, '/', 1) = id::text) NOT VALID;
