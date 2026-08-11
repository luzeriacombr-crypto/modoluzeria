-- Deixa cada agência trocar a imagem usada como preview (og:image) do link
-- público /preview/$token quando compartilhado (WhatsApp, etc), em vez da
-- imagem padrão do Modo Criador. Mesmo bucket/padrão do logo (org-logos).

ALTER TABLE public.orgs ADD COLUMN feed_preview_image_path text;

CREATE POLICY "avatars_org_feed_preview_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-feed-preview'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_feed_preview_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-feed-preview'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-feed-preview'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_feed_preview_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-feed-preview'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );
