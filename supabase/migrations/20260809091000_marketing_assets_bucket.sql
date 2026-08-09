-- Bucket público pras imagens que o master da Luzeria envia pelo editor
-- do site de vendas (aba Configurações > Site). Público porque a URL vai
-- direto no <img src> do site de vendas, visto por gente deslogada.
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-assets', 'marketing-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read marketing assets" ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-assets');

CREATE POLICY "luzeria master writes marketing assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'marketing-assets'
    AND public.is_master(auth.uid())
    AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );

CREATE POLICY "luzeria master updates marketing assets" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'marketing-assets'
    AND public.is_master(auth.uid())
    AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );

CREATE POLICY "luzeria master deletes marketing assets" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'marketing-assets'
    AND public.is_master(auth.uid())
    AND public.current_org_id() = '00000000-0000-0000-0000-000000000001'
  );
