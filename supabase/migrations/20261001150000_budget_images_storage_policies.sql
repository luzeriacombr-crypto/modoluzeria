-- Upload de imagem no Orçamento (cabeçalho/capa/contracapa, pasta
-- "budgets/<org_id>/...") e de foto de produto do catálogo (pasta
-- "budget-products/<org_id>/...") sempre deu "Erro ao enviar a imagem" em
-- produção: o bucket "avatars" só libera INSERT/UPDATE/DELETE pra pastas
-- com política própria (org-logos, org-favicon, clients, etc.) — essas
-- duas nunca tiveram uma. Mesmo critério de quem edita orçamento
-- (financeiro write/update/delete budgets, ver 20260xxxxx): is_master ou
-- cargo com permissão view_financeiro, só dentro da própria agência.

CREATE POLICY "avatars_budget_images_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN ('budgets', 'budget-products')
    AND (storage.foldername(name))[2] = current_org_id()::text
    AND (is_master(auth.uid()) OR has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "avatars_budget_images_update" ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN ('budgets', 'budget-products')
    AND (storage.foldername(name))[2] = current_org_id()::text
    AND (is_master(auth.uid()) OR has_cargo_permission(auth.uid(), 'view_financeiro'))
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN ('budgets', 'budget-products')
    AND (storage.foldername(name))[2] = current_org_id()::text
    AND (is_master(auth.uid()) OR has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "avatars_budget_images_delete" ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] IN ('budgets', 'budget-products')
    AND (storage.foldername(name))[2] = current_org_id()::text
    AND (is_master(auth.uid()) OR has_cargo_permission(auth.uid(), 'view_financeiro'))
  );
