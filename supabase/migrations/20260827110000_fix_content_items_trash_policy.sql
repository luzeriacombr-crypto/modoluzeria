-- "admin manage items" era FOR ALL — isso também concede SELECT pro
-- admin. Se essa mesma política tivesse "deleted_at is null" (like a
-- versão anterior desta migração tentou), o SELECT dela ficaria mais
-- permissivo que "active read items" pra qualquer OUTRA condição, mas
-- sem o filtro de deleted_at ela vaza itens da lixeira de volta pras
-- telas normais do admin. Separa por comando: INSERT/UPDATE/DELETE do
-- admin não incluem SELECT nenhum, então toda visibilidade de leitura
-- (admin incluso, já que admin também é "active profile") vem só de
-- "active read items", que já filtra deleted_at.
--
-- A escrita de deleted_at/deleted_by em si (soft delete/restaurar) não
-- usa nenhuma dessas políticas — vai por service role em
-- api.functions.ts/trash.functions.ts. Motivo: mesmo com "admin update
-- items" abaixo sem menção nenhuma a deleted_at, a transição desse
-- campo de nulo pra preenchido (ou vice-versa) seguia sendo rejeitada
-- como violação de RLS — não conseguimos isolar a causa exata, então
-- contornamos usando o role que ignora RLS pra essa escrita específica.
drop policy if exists "admin manage items" on public.content_items;

create policy "admin insert items" on public.content_items
  for insert
  with check (
    is_admin(auth.uid())
    and org_id = current_org_id()
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  );

create policy "admin update items" on public.content_items
  for update
  using (
    is_admin(auth.uid())
    and org_id = current_org_id()
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  )
  with check (
    is_admin(auth.uid())
    and org_id = current_org_id()
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  );

create policy "admin delete items" on public.content_items
  for delete
  using (
    is_admin(auth.uid())
    and org_id = current_org_id()
    and exists (
      select 1 from public.months m
      where m.id = content_items.month_id and has_client_access(auth.uid(), m.client_id)
    )
  );

-- Colunas novas não herdam os grants de coluna já existentes na tabela
-- (esse schema usa GRANT por coluna, não por tabela inteira). Não foi a
-- causa do problema de RLS acima, mas sem isso o "authenticated" fica
-- sem privilégio nenhum em deleted_at/deleted_by — mantém por
-- consistência com as demais colunas.
grant select, update (deleted_at, deleted_by), insert (deleted_at, deleted_by)
  on public.content_items to authenticated;
