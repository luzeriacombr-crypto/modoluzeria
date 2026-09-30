-- Nova página /avulsos: cada demanda avulsa (clients.category = 'Avulsos')
-- é um "projeto" que pode estar em aberto ou já entregue — pedido do Junior
-- (30/09) pra separar as duas pastas na tela em vez da lista única de hoje.
-- Marcação manual (não deriva de nenhum status de item de conteúdo).
alter table public.clients add column if not exists avulso_delivered_at timestamptz;
