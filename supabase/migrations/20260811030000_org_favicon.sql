-- Deixa cada agência trocar o ícone (favicon da aba + apple-touch-icon,
-- usado quando o cliente adiciona o app à tela inicial no iOS) em vez do
-- ícone padrão do Modo Criador. Mesmo bucket/padrão do logo (org-logos)
-- e da imagem de preview de feed (org-feed-preview).

ALTER TABLE public.orgs ADD COLUMN favicon_path text;

CREATE POLICY "avatars_org_favicon_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-favicon'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_favicon_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-favicon'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-favicon'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );

CREATE POLICY "avatars_org_favicon_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = 'org-favicon'
    AND (storage.foldername(name))[2] = public.current_org_id()::text
    AND public.is_master(auth.uid())
  );
