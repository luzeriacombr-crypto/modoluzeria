-- Mesma mudança que os arquivos da marca: o contrato passa a morar no
-- Google Drive do cliente ("Contrato - <Cliente>", dentro da pasta de
-- entregas já configurada) em vez de um bucket próprio do Supabase —
-- fica visível pra agência fora do Modo Criador também. Tabela ainda
-- vazia (feature recém-lançada), sem necessidade de backfill.
ALTER TABLE public.client_contracts
  DROP COLUMN storage_path,
  ADD COLUMN drive_file_id text,
  ADD COLUMN thumbnail_url text,
  ADD COLUMN icon_url text,
  ADD COLUMN web_view_url text,
  ADD COLUMN size_bytes bigint;
UPDATE public.client_contracts SET drive_file_id = '' WHERE drive_file_id IS NULL;
ALTER TABLE public.client_contracts ALTER COLUMN drive_file_id SET NOT NULL;

DROP POLICY IF EXISTS "client-contracts read own org" ON storage.objects;
DROP POLICY IF EXISTS "client-contracts admin write" ON storage.objects;
DROP POLICY IF EXISTS "client-contracts admin delete" ON storage.objects;
DELETE FROM storage.buckets WHERE id = 'client-contracts';
