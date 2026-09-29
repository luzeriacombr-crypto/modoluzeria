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
  kind: "fixo" | "variavel" | "investimento";
  monthKey: string | null;
  /** Dia do mês (1-31) em que essa conta/recebimento vence — opcional,
   * só pra acompanhamento (não dispara nenhuma cobrança sozinho). */
  dueDay: number | null;
  /** Se essa saída já foi paga NO MÊS QUE ESTÁ SENDO VISTO (monthKey do
   * pedido) — uma saída fixa é a mesma linha todo mês, então "pago" tem
   * que ser por mês, não fixo na linha (senão marcava pago pra sempre).
   * Só faz sentido pra direction="saida" (entrada usa client_payments). */
  paidAt: string | null;
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
      .select("id, direction, label, amount_cents, kind, month_key, due_day, created_at")
      .eq("org_id", context.orgId)
      .or(`kind.eq.fixo,month_key.eq.${data.monthKey}`)
      .order("created_at");
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id);
    const { data: payments } = ids.length
      ? await (context.supabase as any)
          .from("cash_flow_entry_payments").select("entry_id, paid_at")
          .eq("month_key", data.monthKey).in("entry_id", ids)
      : { data: [] as any[] };
    const paidByEntry = new Map((payments ?? []).map((p: any) => [p.entry_id, p.paid_at as string]));

    return (rows ?? []).map((r: any) => ({
      id: r.id, direction: r.direction, label: r.label, amountCents: r.amount_cents,
      kind: r.kind, monthKey: r.month_key, dueDay: r.due_day,
      paidAt: paidByEntry.get(r.id) ?? null, createdAt: r.created_at,
    }));
  });

export const addCashFlowEntry = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { direction: "entrada" | "saida"; label: string; amountCents: number; kind: "fixo" | "variavel" | "investimento"; monthKey: string; dueDay?: number | null }) =>
    z.object({
      direction: z.enum(["entrada", "saida"]),
      label: z.string().trim().min(1).max(140),
      amountCents: z.number().int().min(1),
      // Entrada avulsa é sempre do mês em que aconteceu — só saída pode
      // ser fixa (recorrente) ou investimento. O front nem oferece a
      // escolha pra entrada, mas força aqui também, pra uma chamada direta
      // não furar a regra.
      kind: z.enum(["fixo", "variavel", "investimento"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
      dueDay: z.number().int().min(1).max(31).nullable().optional(),
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
      due_day: data.dueDay ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Corrige um lançamento já existente (valor errado, nome errado, quer
 * marcar o dia de vencimento) — antes só dava pra apagar e lançar de novo. */
export const updateCashFlowEntry = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; label: string; amountCents: number; kind: "fixo" | "variavel" | "investimento"; monthKey: string; dueDay?: number | null }) =>
    z.object({
      id: z.string().uuid(),
      label: z.string().trim().min(1).max(140),
      amountCents: z.number().int().min(1),
      kind: z.enum(["fixo", "variavel", "investimento"]),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
      dueDay: z.number().int().min(1).max(31).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data: existing, error: fetchErr } = await (context.supabase as any)
      .from("cash_flow_entries").select("direction").eq("id", data.id).eq("org_id", context.orgId).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("Lançamento não encontrado.");
    // Entrada avulsa é sempre variável — mesma regra do addCashFlowEntry.
    const kind = existing.direction === "entrada" ? "variavel" : data.kind;
    const { error } = await (context.supabase as any).from("cash_flow_entries").update({
      label: data.label.trim(),
      amount_cents: data.amountCents,
      kind,
      month_key: kind === "fixo" ? null : data.monthKey,
      due_day: data.dueDay ?? null,
    }).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Marca/desmarca uma saída como paga NUM MÊS ESPECÍFICO — sempre o mês
 * que a pessoa está vendo na tela, não a saída como um todo (ver comentário
 * em cash_flow_entry_payments). */
export const setCashFlowEntryPaid = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { entryId: string; monthKey: string; paid: boolean }) =>
    z.object({ entryId: z.string().uuid(), monthKey: z.string().regex(/^\d{4}-\d{2}$/), paid: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data: entry, error: fetchErr } = await (context.supabase as any)
      .from("cash_flow_entries").select("id").eq("id", data.entryId).eq("org_id", context.orgId).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!entry) throw new Error("Lançamento não encontrado.");

    if (data.paid) {
      const { error } = await (context.supabase as any)
        .from("cash_flow_entry_payments")
        .upsert({ entry_id: data.entryId, month_key: data.monthKey, marked_by: context.userId }, { onConflict: "entry_id,month_key" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await (context.supabase as any)
        .from("cash_flow_entry_payments").delete()
        .eq("entry_id", data.entryId).eq("month_key", data.monthKey);
      if (error) throw new Error(error.message);
    }
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
