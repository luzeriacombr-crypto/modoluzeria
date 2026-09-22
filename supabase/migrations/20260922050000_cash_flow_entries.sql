-- Fluxo de caixa simples da agência (Configurações → Pagamentos): entradas
-- e saídas lançadas na mão, cada uma marcada como fixa (recorrente — entra
-- sozinha todo mês até alguém apagar) ou variável (só daquele mês). As
-- mensalidades de cliente já existentes (clients.contract_value +
-- client_payments) continuam sendo a fonte de "entrada recorrente" — essa
-- tabela é só pro resto: outras entradas avulsas e todas as saídas, que
-- hoje não têm nenhum lançamento no sistema.
--
-- month_key nulo = fixo (recorrente, vale pra qualquer mês corrente
-- enquanto a linha existir); month_key preenchido = variável, vale só
-- naquele mês. Mockup aprovado: claude.ai/artifact/7UyrDvHKAXxav7d6ay67DP.
CREATE TABLE public.cash_flow_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('entrada', 'saida')),
  label text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  kind text NOT NULL CHECK (kind IN ('fixo', 'variavel')),
  month_key text CHECK (month_key ~ '^\d{4}-\d{2}$'),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (kind = 'fixo' AND month_key IS NULL) OR
    (kind = 'variavel' AND month_key IS NOT NULL)
  )
);

GRANT SELECT, INSERT, DELETE ON public.cash_flow_entries TO authenticated;
GRANT ALL ON public.cash_flow_entries TO service_role;
ALTER TABLE public.cash_flow_entries ENABLE ROW LEVEL SECURITY;

-- Mesmo padrão de acesso de client_payments/margem: master ou cargo com
-- permissão "view_financeiro".
CREATE POLICY "financeiro read cash flow" ON public.cash_flow_entries FOR SELECT TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE POLICY "financeiro insert cash flow" ON public.cash_flow_entries FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    AND created_by = auth.uid()
  );

CREATE POLICY "financeiro delete cash flow" ON public.cash_flow_entries FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );

CREATE INDEX idx_cash_flow_entries_org ON public.cash_flow_entries(org_id, kind, month_key);
