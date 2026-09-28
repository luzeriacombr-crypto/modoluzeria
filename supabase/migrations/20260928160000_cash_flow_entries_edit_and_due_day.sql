-- Lançamentos de fluxo de caixa (Saídas/Entradas avulsas) ganham: (1) dia
-- de vencimento, pra saber quando aquela conta/recebimento vence; (2)
-- permissão de UPDATE — antes só dava pra criar e excluir, nunca corrigir
-- (ex: valor errado, nome errado), tinha que apagar e lançar de novo.

ALTER TABLE public.cash_flow_entries
  ADD COLUMN due_day smallint CHECK (due_day IS NULL OR (due_day >= 1 AND due_day <= 31));

GRANT UPDATE ON public.cash_flow_entries TO authenticated;

-- Mesmo padrão de acesso das outras policies dessa tabela: master ou cargo
-- com permissão "view_financeiro", só da própria org.
CREATE POLICY "financeiro update cash flow" ON public.cash_flow_entries FOR UPDATE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  )
  WITH CHECK (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
  );
