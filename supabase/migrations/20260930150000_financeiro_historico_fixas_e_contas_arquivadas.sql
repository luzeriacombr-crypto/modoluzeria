-- Etapa 1 do Financeiro (30/09) — duas correções de histórico:
--
-- (1) Saída fixa ganha início e fim (start_month/end_month, "YYYY-MM").
-- Antes ela aparecia em TODOS os meses, até nos anteriores à criação, e
-- editar/apagar reescrevia o passado. Agora: aparece só de start_month em
-- diante; "excluir" a partir de um mês só encerra (end_month = mês anterior)
-- e mudar valor/conta a partir de um mês cria uma nova versão a partir dali,
-- sem mexer nos meses que já passaram. Backfill: start_month = mês de
-- criação, ou o mês mais antigo em que ela já foi marcada como paga (se a
-- pessoa voltou meses e marcou), o que for menor.
--
-- (2) Conta bancária passa a ser arquivada (archived_at) em vez de apagada.
-- Apagar de verdade fazia os lançamentos ligados a ela virarem
-- bank_account_id nulo (FK com SET NULL) e passarem a somar na Carteira.
--
-- Pra reverter (DOWN), rodar:
--   ALTER TABLE public.cash_flow_entries DROP CONSTRAINT IF EXISTS cash_flow_entries_fixo_months_check;
--   ALTER TABLE public.cash_flow_entries DROP COLUMN IF EXISTS start_month, DROP COLUMN IF EXISTS end_month;
--   ALTER TABLE public.bank_accounts DROP COLUMN IF EXISTS archived_at;

ALTER TABLE public.cash_flow_entries
  ADD COLUMN start_month text CHECK (start_month ~ '^\d{4}-\d{2}$'),
  ADD COLUMN end_month text CHECK (end_month ~ '^\d{4}-\d{2}$');

UPDATE public.cash_flow_entries e
SET start_month = LEAST(
  to_char(e.created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM'),
  COALESCE((SELECT min(p.month_key) FROM public.cash_flow_entry_payments p WHERE p.entry_id = e.id), '9999-12')
)
WHERE e.kind = 'fixo';

ALTER TABLE public.cash_flow_entries ADD CONSTRAINT cash_flow_entries_fixo_months_check CHECK (
  kind <> 'fixo' OR (start_month IS NOT NULL AND (end_month IS NULL OR end_month >= start_month))
);

ALTER TABLE public.bank_accounts ADD COLUMN archived_at timestamptz;
