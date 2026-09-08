-- Os arquivos da marca passam a morar no Google Drive do cliente (pasta
-- "Arquivo da Marca - <Cliente>", dentro da pasta de entregas já
-- configurada), não mais num bucket próprio do Supabase — assim ficam
-- visíveis pra agência também fora do Modo Criador, do jeito que ela já
-- trabalha com o resto dos arquivos de cliente. Tabela ainda vazia
-- (feature recém-lançada), sem necessidade de backfill.
ALTER TABLE public.client_brand_assets
  DROP COLUMN storage_path,
  ADD COLUMN drive_file_id text,
  ADD COLUMN name text,
  ADD COLUMN thumbnail_url text,
  ADD COLUMN icon_url text,
  ADD COLUMN web_view_url text,
  ADD COLUMN size_bytes bigint;
UPDATE public.client_brand_assets SET drive_file_id = '', name = '' WHERE drive_file_id IS NULL;
ALTER TABLE public.client_brand_assets
  ALTER COLUMN drive_file_id SET NOT NULL,
  ALTER COLUMN name SET NOT NULL;

-- Bucket do Supabase que não vai mais ser usado pra isso.
DROP POLICY IF EXISTS "client-brand-assets read own org" ON storage.objects;
DROP POLICY IF EXISTS "client-brand-assets admin write" ON storage.objects;
DROP POLICY IF EXISTS "client-brand-assets admin delete" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'client-brand-assets';
