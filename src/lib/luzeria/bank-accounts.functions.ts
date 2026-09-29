// "Saldo em banco" (Configurações → Financeiro): registro manual de contas
// bancárias da agência — SEM nenhuma integração bancária real (não é Open
// Finance, não lê extrato nenhum). É só uma anotação: a agência atualiza o
// saldo à mão de vez em quando. Mesmo padrão de RLS/acesso das outras
// tabelas do Financeiro (master ou cargo "view_financeiro").
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertFinanceiroAccess(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: hasPerm } = await supabase.rpc("has_cargo_permission", { _user_id: userId, _perm: "view_financeiro" });
  if (!hasPerm) throw new Error("Forbidden");
}

export type BankAccount = {
  id: string;
  name: string;
  balanceCents: number;
  updatedAt: string;
};

export const listBankAccounts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<BankAccount[]> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data, error } = await (context.supabase as any)
      .from("bank_accounts")
      .select("id, name, balance_cents, updated_at")
      .eq("org_id", context.orgId)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, balanceCents: r.balance_cents, updatedAt: r.updated_at }));
  });

export const addBankAccount = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; balanceCents: number }) =>
    z.object({ name: z.string().trim().min(1).max(60), balanceCents: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("bank_accounts").insert({
      org_id: context.orgId,
      name: data.name.trim(),
      balance_cents: data.balanceCents,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateBankAccount = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; name: string; balanceCents: number }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(60), balanceCents: z.number().int() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("bank_accounts")
      .update({ name: data.name.trim(), balance_cents: data.balanceCents, updated_at: new Date().toISOString() })
      .eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeBankAccount = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("bank_accounts").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
