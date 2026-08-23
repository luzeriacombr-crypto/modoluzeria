import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertFinanceiroAccess(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: hasPerm } = await supabase.rpc("has_cargo_permission", { _user_id: userId, _perm: "view_financeiro" });
  if (!hasPerm) throw new Error("Forbidden");
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Próxima ocorrência do dia de vencimento a partir de hoje — se o dia
 * já passou nesse mês, cai pro mês seguinte. Dias 29-31 em meses mais
 * curtos caem no último dia daquele mês. */
function nextDueDate(day: number, now: Date): string {
  const y = now.getFullYear();
  const m = now.getMonth();
  const daysInThisMonth = new Date(y, m + 1, 0).getDate();
  const thisMonthDay = Math.min(day, daysInThisMonth);
  const thisMonthDate = new Date(y, m, thisMonthDay);
  const today = new Date(y, m, now.getDate());
  if (thisMonthDate >= today) return thisMonthDate.toISOString().slice(0, 10);
  const daysInNextMonth = new Date(y, m + 2, 0).getDate();
  const nextMonthDay = Math.min(day, daysInNextMonth);
  return new Date(y, m + 1, nextMonthDay).toISOString().slice(0, 10);
}

export type ClientPaymentRow = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  contractValue: number | null;
  paymentDueDay: number;
  nextDueDate: string;
  paidThisPeriod: boolean;
  paidAt: string | null;
  whatsappPhone: string | null;
  postsDoneThisMonth: number;
};

export const listClientPayments = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);

    const { data: org } = await context.supabase.from("orgs").select("pix_key").eq("id", context.orgId).maybeSingle();

    const { data: clients } = await context.supabase
      .from("clients")
      .select("id, name, color, icon, contract_value, payment_due_day")
      .eq("org_id", context.orgId)
      .eq("archived", false)
      .not("payment_due_day", "is", null)
      .order("name");
    const clientIds = (clients ?? []).map((c: any) => c.id);
    if (clientIds.length === 0) return { pixKey: org?.pix_key ?? null, clients: [] as ClientPaymentRow[] };

    const now = new Date();
    const period = monthKey(now);

    const { data: payments } = await context.supabase
      .from("client_payments").select("client_id, paid_at").eq("period", period).in("client_id", clientIds);
    const paidByClient = new Map<string, string>();
    (payments ?? []).forEach((p: any) => paidByClient.set(p.client_id, p.paid_at));

    const { data: contacts } = await context.supabase
      .from("client_contacts").select("client_id, phone, position").in("client_id", clientIds).order("position");
    const phoneByClient = new Map<string, string>();
    (contacts ?? []).forEach((c: any) => {
      if (c.phone && c.phone.trim() && !phoneByClient.has(c.client_id)) phoneByClient.set(c.client_id, c.phone);
    });

    const { data: months } = await context.supabase
      .from("months").select("id, client_id").eq("key", period).in("client_id", clientIds);
    const monthIdByClient = new Map<string, string>();
    (months ?? []).forEach((m: any) => monthIdByClient.set(m.client_id, m.id));
    const monthIds = [...monthIdByClient.values()];
    const doneCountByMonth = new Map<string, number>();
    if (monthIds.length > 0) {
      const { data: items } = await context.supabase
        .from("content_items").select("month_id, status, type").in("month_id", monthIds).in("type", ["post", "reel"]);
      (items ?? []).forEach((it: any) => {
        if (it.status === "PRONTO_PARA_PUBLICAR" || it.status === "FINALIZADO" || it.status === "CONCLUIDO") {
          doneCountByMonth.set(it.month_id, (doneCountByMonth.get(it.month_id) ?? 0) + 1);
        }
      });
    }

    const rows: ClientPaymentRow[] = (clients ?? []).map((c: any) => {
      const monthId = monthIdByClient.get(c.id);
      const paidAt = paidByClient.get(c.id) ?? null;
      return {
        id: c.id, name: c.name, color: c.color, icon: c.icon,
        contractValue: c.contract_value ?? null,
        paymentDueDay: c.payment_due_day,
        nextDueDate: nextDueDate(c.payment_due_day, now),
        paidThisPeriod: !!paidAt,
        paidAt,
        whatsappPhone: phoneByClient.get(c.id) ?? null,
        postsDoneThisMonth: monthId ? (doneCountByMonth.get(monthId) ?? 0) : 0,
      };
    });

    return { pixKey: org?.pix_key ?? null, clients: rows };
  });

export type ClientPaymentHistoryRow = {
  period: string;
  paidAt: string | null;
  amountCents: number | null;
};

/** Últimos 12 períodos (mês atual incluso) pra um cliente — junta os meses
 * que existem (via `months`) com o que já foi marcado como pago em
 * client_payments, pra mostrar tanto "pago" quanto "pendente"/"sem dado"
 * mês a mês, não só os que têm registro de pagamento. */
export const listClientPaymentHistory = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const now = new Date();
    const periods: string[] = [];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      periods.push(monthKey(d));
    }
    const { data: payments, error } = await context.supabase
      .from("client_payments")
      .select("period, paid_at, amount_cents")
      .eq("client_id", data.clientId)
      .in("period", periods);
    if (error) throw new Error(error.message);
    const byPeriod = new Map<string, { paidAt: string; amountCents: number | null }>();
    (payments ?? []).forEach((p: any) => byPeriod.set(p.period, { paidAt: p.paid_at, amountCents: p.amount_cents }));
    return periods.map((period): ClientPaymentHistoryRow => ({
      period,
      paidAt: byPeriod.get(period)?.paidAt ?? null,
      amountCents: byPeriod.get(period)?.amountCents ?? null,
    }));
  });

export const setOrgPixKey = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { pixKey: string | null }) => z.object({ pixKey: z.string().trim().max(140).nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Forbidden");
    const { error } = await context.supabase.from("orgs")
      .update({ pix_key: data.pixKey?.trim() || null }).eq("id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markClientPaymentReceived = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; period: string; amountCents?: number | null }) =>
    z.object({
      clientId: z.string().uuid(),
      period: z.string().regex(/^\d{4}-\d{2}$/),
      amountCents: z.number().int().min(0).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await context.supabase.from("client_payments")
      .upsert(
        { client_id: data.clientId, org_id: context.orgId, period: data.period, amount_cents: data.amountCents ?? null, marked_by: context.userId, paid_at: new Date().toISOString() },
        { onConflict: "client_id,period" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const unmarkClientPaymentReceived = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; period: string }) =>
    z.object({ clientId: z.string().uuid(), period: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { error } = await context.supabase.from("client_payments")
      .delete().eq("client_id", data.clientId).eq("period", data.period);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
