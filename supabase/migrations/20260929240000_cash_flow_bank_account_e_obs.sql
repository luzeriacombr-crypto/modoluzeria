-- Financeiro, a pedido do Junior: em toda entrada/saída, poder marcar de
-- qual conta bancária (cadastrada em bank_accounts) o dinheiro entrou/saiu
-- — nulo significa "carteira/espécie" (dinheiro fora de qualquer conta).
-- E em investimento especificamente, um campo de observação livre.

ALTER TABLE public.cash_flow_entries
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  ADD COLUMN notes text;

CREATE INDEX idx_cash_flow_entries_bank_account ON public.cash_flow_entries(bank_account_id);
