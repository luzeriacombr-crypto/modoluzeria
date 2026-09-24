-- Deixa cada agência trocar a imagem usada como preview (og:image) do link
-- público /planejamento/$token quando compartilhado (WhatsApp, etc), em vez
-- da foto do próprio cliente (ruim pra esse fim) ou da imagem padrão do
-- Modo Criador. Mesmo padrão do feed_preview_image_path.

ALTER TABLE public.orgs ADD COLUMN planejamento_cover_image_path text;

CREATE POLICY "avatars_org_planejamento_cover_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-planejamento-cover'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_planejamento_cover_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-planejamento-cover'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-planejamento-cover'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_planejamento_cover_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-planejamento-cover'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );
