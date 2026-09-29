-- Marcar uma saída como paga ou não. Saída fixa é uma linha só reusada
-- todo mês (month_key nulo) — um paid_at direto na linha marcaria "pago"
-- pra sempre, não só nesse mês. Por isso o status de pago é por (saída,
-- mês), numa tabela à parte — mesma ideia de client_payments.period.
ALTER TABLE public.cash_flow_entries DROP COLUMN paid_at;

CREATE TABLE public.cash_flow_entry_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL REFERENCES public.cash_flow_entries(id) ON DELETE CASCADE,
  month_key text NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (entry_id, month_key)
);

GRANT SELECT, INSERT, DELETE ON public.cash_flow_entry_payments TO authenticated;
ALTER TABLE public.cash_flow_entry_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "financeiro read cash flow payments" ON public.cash_flow_entry_payments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cash_flow_entries e WHERE e.id = cash_flow_entry_payments.entry_id
      AND e.org_id = public.current_org_id()
      AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    )
  );

CREATE POLICY "financeiro mark cash flow payments" ON public.cash_flow_entry_payments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cash_flow_entries e WHERE e.id = cash_flow_entry_payments.entry_id
      AND e.org_id = public.current_org_id()
      AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    )
  );

CREATE POLICY "financeiro unmark cash flow payments" ON public.cash_flow_entry_payments FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.cash_flow_entries e WHERE e.id = cash_flow_entry_payments.entry_id
      AND e.org_id = public.current_org_id()
      AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    )
  );

CREATE INDEX idx_cash_flow_entry_payments_month ON public.cash_flow_entry_payments(entry_id, month_key);
