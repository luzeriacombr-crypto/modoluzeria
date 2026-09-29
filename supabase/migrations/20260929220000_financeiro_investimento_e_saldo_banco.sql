-- Reformulação da página "Pagamentos" (agora "Financeiro"), a pedido do
-- Junior: (1) "investimento" vira um 3º kind em cash_flow_entries, ao lado
-- de fixo/variável — dinheiro guardado, não conta como gasto no cálculo do
-- saldo (o front que soma separado, não muda a estrutura aqui). Tratado
-- como "variavel" pra fins de month_key (sempre um lançamento específico
-- daquele mês — investir é um evento, não uma assinatura recorrente).
-- (2) "Saldo em banco": registro manual de contas bancárias da agência,
-- sem nenhuma integração real com banco — só uma anotação atualizada à
-- mão, mesmo padrão de RLS (master ou cargo "view_financeiro") já usado
-- em cash_flow_entries/client_payments.

ALTER TABLE public.cash_flow_entries DROP CONSTRAINT cash_flow_entries_kind_check;
ALTER TABLE public.cash_flow_entries ADD CONSTRAINT cash_flow_entries_kind_check
  CHECK (kind IN ('fixo', 'variavel', 'investimento'));

ALTER TABLE public.cash_flow_entries DROP CONSTRAINT cash_flow_entries_check;
ALTER TABLE public.cash_flow_entries ADD CONSTRAINT cash_flow_entries_check CHECK (
  (kind = 'fixo' AND month_key IS NULL) OR
  (kind IN ('variavel', 'investimento') AND month_key IS NOT NULL)
);

CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  balance_cents integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;
GRANT ALL ON public.bank_accounts TO service_role;
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro read bank accounts" ON public.bank_accounts FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "financeiro insert bank accounts" ON public.bank_accounts FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    AND created_by = auth.uid()
  );

CREATE POLICY "financeiro update bank accounts" ON public.bank_accounts FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "financeiro delete bank accounts" ON public.bank_accounts FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE INDEX idx_bank_accounts_org ON public.bank_accounts(org_id);
