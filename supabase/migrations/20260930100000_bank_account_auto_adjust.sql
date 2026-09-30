-- Ajuste atômico do saldo em banco (Financeiro) — usado quando uma entrada
-- é lançada, ou uma saída é marcada como paga, com um banco específico
-- selecionado (não "carteira/espécie"). Soma/subtrai direto via UPDATE no
-- Postgres (não lê-e-escreve do lado do app) pra não perder ajuste se dois
-- lançamentos acontecerem ao mesmo tempo. org_id + permissão verificados
-- dentro da função — sem isso, qualquer usuário autenticado poderia chamar
-- via supabase.rpc() direto e mexer no saldo de banco de outra agência.
CREATE OR REPLACE FUNCTION public.adjust_bank_account_balance(p_account_id uuid, p_delta_cents integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.bank_accounts
  SET balance_cents = balance_cents + p_delta_cents, updated_at = now()
  WHERE id = p_account_id
    AND org_id = public.current_org_id()
    AND (public.is_master(auth.uid()) OR public.has_cargo_permission(auth.uid(), 'view_financeiro'));
$$;

GRANT EXECUTE ON FUNCTION public.adjust_bank_account_balance(uuid, integer) TO authenticated;
