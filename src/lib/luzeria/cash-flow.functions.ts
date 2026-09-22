// Fluxo de caixa simples da agência (Configurações → Pagamentos): entradas
// e saídas lançadas na mão, cada uma fixa (recorrente) ou variável (só
// daquele mês). As mensalidades de cliente continuam vindo de
// clients.contract_value + client_payments (client-payments.functions.ts)
// — aqui é só o resto. Mockup aprovado: claude.ai/artifact/7UyrDvHKAXxav7d6ay67DP.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertFinanceiroAccess(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: hasPerm } = await supabase.rpc("has_cargo_permission", { _user_id: userId, _perm: "view_financeiro" });
  if (!hasPerm) throw new Error("Forbidden");
}

export type CashFlowEntry = {
  id: string;
  direction: "entrada" | "saida";
  label: string;
  amountCents: number;
  kind: "fixo" | "variavel";
  monthKey: string | null;
  createdAt: string;
};

/** Tudo que vale pro mês pedido: fixas (recorrem sempre, month_key nulo) +
 * variáveis lançadas naquele mês específico. */
export const listCashFlowEntries = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) => z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<CashFlowEntry[]> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("cash_flow_entries")
      .select("id, direction, label, amount_cents, kind, month_key, created_at")
      .eq("org_id", context.orgId)
      .or(`kind.eq.fixo,month_key.eq.${data.monthKey}`)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, direction: r.direction, label: r.label, amountCents: r.amount_cents,
      kind: r.kind, monthKey: r.month_key, createdAt: r.created_at,
    }));
  });

export const addCashFlowEntry = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { direction: "entrada" | "saida"; label: string; amountCents: number; kind: "fixo" | "variavel"; monthKey: string }) =>
    z.object({
      direction: z.enum(["entrada", "saida"]),
      label: z.string().trim().min(1).max(140),
      amountCents: z.number().int().min(1),
      // Entrada avulsa é sempre do mês em que aconteceu — só saída pode
      // ser fixa (recorrente). O front nem oferece a escolha pra entrada,
      // mas força aqui também, pra uma chamada direta não furar a regra.
      kind: z.enum(["fixo", "variavel"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const kind = data.direction === "entrada" ? "variavel" : data.kind;
    const { error } = await (context.supabase as any).from("cash_flow_entries").insert({
      org_id: context.orgId,
      direction: data.direction,
      label: data.label.trim(),
      amount_cents: data.amountCents,
      kind,
      month_key: kind === "fixo" ? null : data.monthKey,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeCashFlowEntry = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("cash_flow_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
