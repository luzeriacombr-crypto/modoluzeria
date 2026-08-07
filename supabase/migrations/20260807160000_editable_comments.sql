-- Deixa quem escreveu um comentário corrigi-lo depois — hoje só dava pra
-- apagar (admin) ou deixar o erro de digitação registrado pra sempre.
-- Comentários de sistema (is_system=true) e de outras pessoas continuam
-- travados; o org check reflete o mesmo padrão de leitura/inserção já
-- usado nessa tabela (comments não tem org_id próprio).
ALTER TABLE public.comments ADD COLUMN edited_at timestamptz;

CREATE POLICY "author updates own comment" ON public.comments FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id AND is_system = false
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id())
  )
  WITH CHECK (
    auth.uid() = author_id AND is_system = false
    AND EXISTS (SELECT 1 FROM public.content_items ci WHERE ci.id = comments.item_id AND ci.org_id = public.current_org_id())
  );
