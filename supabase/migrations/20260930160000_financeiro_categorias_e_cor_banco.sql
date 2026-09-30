-- Etapa 2 do Financeiro (30/09):
-- (1) Categoria nos lançamentos (ex: "Ferramentas e assinaturas",
-- "Impostos e taxas") — texto livre com lista sugerida no front, pra dar pra
-- ver pra onde o dinheiro vai. Lançamentos antigos ficam sem categoria.
-- (2) Cor escolhida pra cada conta bancária (ícone). Null = cor automática
-- (cor oficial se o nome bater com um banco conhecido).
--
-- Pra reverter (DOWN), rodar:
--   ALTER TABLE public.cash_flow_entries DROP COLUMN IF EXISTS category;
--   ALTER TABLE public.bank_accounts DROP COLUMN IF EXISTS color;

ALTER TABLE public.cash_flow_entries
  ADD COLUMN category text CHECK (char_length(category) BETWEEN 1 AND 40);

ALTER TABLE public.bank_accounts
  ADD COLUMN color text CHECK (color ~ '^#[0-9A-Fa-f]{6}$');
