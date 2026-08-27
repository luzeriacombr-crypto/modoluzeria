-- Comentários em áudio: grava no navegador, sobe pro bucket privado
-- "comment-audio" (caminho "<item_id>/<timestamp>.webm", mesmo padrão de
-- reel-covers), guarda só o caminho na linha do comentário — a URL
-- assinada é gerada na hora de listar.
alter table public.comments
  add column if not exists audio_path text,
  add column if not exists audio_duration_seconds integer;

INSERT INTO storage.buckets (id, name, public)
VALUES ('comment-audio', 'comment-audio', false)
ON CONFLICT (id) DO NOTHING;

-- Mesma regra de "quem pode ver/comentar esse item" que já vale pra
-- tabela comments (active read comments / auth insert own comments).
CREATE POLICY "comment-audio read for client access"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'comment-audio'
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id::text = split_part(name, '/', 1)
        AND ci.org_id = public.current_org_id()
        AND public.has_client_access(auth.uid(), m.client_id)
    )
  );

CREATE POLICY "comment-audio insert for client access"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'comment-audio'
    AND public.is_active_profile(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.content_items ci
      JOIN public.months m ON m.id = ci.month_id
      WHERE ci.id::text = split_part(name, '/', 1)
        AND ci.org_id = public.current_org_id()
        AND public.has_client_access(auth.uid(), m.client_id)
    )
  );
