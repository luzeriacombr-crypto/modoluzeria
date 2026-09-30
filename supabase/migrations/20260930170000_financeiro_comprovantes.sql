-- Etapa 3 do Financeiro (30/09): comprovantes (PDF/foto) anexados a um
-- lançamento (cash_flow_entries) ou a uma mensalidade de cliente
-- (client_payments). Numa saída fixa o comprovante é daquele mês
-- (month_key), não da saída pra sempre.
--
-- Arquivos no bucket privado "finance-attachments", caminho
-- "<org_id>/<uuid>-<nome>" — mesmo padrão do "org-knowledge": a pasta
-- raiz é a agência, e só quem acessa o Financeiro dela (master ou cargo
-- "view_financeiro") lê, envia ou apaga.
--
-- Pra reverter (DOWN), rodar (apagar os arquivos do bucket antes, pelo
-- painel do Supabase, senão o DELETE do bucket falha):
--   DROP POLICY IF EXISTS "finance-attachments read" ON storage.objects;
--   DROP POLICY IF EXISTS "finance-attachments insert" ON storage.objects;
--   DROP POLICY IF EXISTS "finance-attachments delete" ON storage.objects;
--   DELETE FROM storage.buckets WHERE id = 'finance-attachments';
--   DROP TABLE IF EXISTS public.finance_attachments;

CREATE TABLE public.finance_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  entry_id uuid REFERENCES public.cash_flow_entries(id) ON DELETE CASCADE,
  client_payment_id uuid REFERENCES public.client_payments(id) ON DELETE CASCADE,
  month_key text NOT NULL CHECK (month_key ~ '^\d{4}-\d{2}$'),
  storage_path text NOT NULL,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 200),
  mime_type text,
  size_bytes integer,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((entry_id IS NULL) <> (client_payment_id IS NULL))
);

GRANT SELECT, INSERT, DELETE ON public.finance_attachments TO authenticated;
GRANT ALL ON public.finance_attachments TO service_role;
ALTER TABLE public.finance_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro read attachments" ON public.finance_attachments FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "financeiro insert attachments" ON public.finance_attachments FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    AND created_by = auth.uid()
    AND split_part(storage_path, '/', 1) = org_id::text
  );

CREATE POLICY "financeiro delete attachments" ON public.finance_attachments FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE INDEX idx_finance_attachments_entry ON public.finance_attachments(entry_id, month_key);
CREATE INDEX idx_finance_attachments_payment ON public.finance_attachments(client_payment_id);
CREATE INDEX idx_finance_attachments_org_month ON public.finance_attachments(org_id, month_key);

-- 10 MB, só PDF e imagem.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('finance-attachments', 'finance-attachments', false, 10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "finance-attachments read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'finance-attachments'
    AND (storage.foldername(name))[1]::uuid = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "finance-attachments insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'finance-attachments'
    AND (storage.foldername(name))[1]::uuid = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "finance-attachments delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'finance-attachments'
    AND (storage.foldername(name))[1]::uuid = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );
