-- Pedido do Junior (30/09): ao marcar a mensalidade de um cliente como
-- paga, escolher em qual banco o dinheiro caiu (ou carteira/espécie) — o
-- valor passa a somar no saldo daquela conta (via RPC
-- adjust_bank_account_balance, chamada pelo servidor) e fica gravado em
-- amount_cents, congelando o histórico mesmo se o contrato mudar depois.
-- bank_account_id null = carteira/espécie. Pagamentos antigos ficam como
-- estão (amount_cents null, sem banco) e não entram em saldo nenhum.
--
-- Também cria a policy de DELETE que faltava: "Desfazer pagamento" apagava
-- 0 linhas sem erro nenhum e o cliente continuava "Em dia".
--
-- Pra reverter (DOWN), rodar:
--   DROP POLICY IF EXISTS "financeiro delete client payments" ON public.client_payments;
--   REVOKE DELETE ON public.client_payments FROM authenticated;
--   ALTER TABLE public.client_payments DROP COLUMN IF EXISTS bank_account_id;

ALTER TABLE public.client_payments
  ADD COLUMN bank_account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL;

GRANT DELETE ON public.client_payments TO authenticated;

CREATE POLICY "financeiro delete client payments" ON public.client_payments FOR DELETE TO authenticated
  USING (
    org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'))
    AND public.has_client_access(auth.uid(), client_id)
  );
