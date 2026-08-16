import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

/* ===== PAINEL DE MARGEM / LUCRATIVIDADE POR CLIENTE =====
 * O custo aqui é uma ESTIMATIVA, não apontamento real de horas — não existe
 * controle de tempo trabalhado no sistema. A estimativa usa a mesma base de
 * dados do ranking da equipe (finalizations, com o peso de activity_quantity
 * pra gravação) multiplicada por uma média de horas por tipo de conteúdo e
 * pelo custo-hora da agência, ambos configuráveis. */

async function assertMaster(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (!isMaster) throw new Error("Apenas o Adm Master pode acessar o painel de margem.");
}

export const getOrgCostSettings = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertMaster(context.supabase, context.userId);
    const { data, error } = await context.supabase
      .from("orgs").select("hourly_cost, avg_hours_by_type").eq("id", context.orgId).single();
    if (error) throw new Error(error.message);
    return {
      hourlyCost: data.hourly_cost as number | null,
      avgHoursByType: data.avg_hours_by_type as Record<string, number>,
    };
  });

export const setOrgCostSettings = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { hourlyCost: number | null; avgHoursByType: Record<string, number> }) =>
    z.object({
      hourlyCost: z.number().min(0).nullable(),
      avgHoursByType: z.record(z.string(), z.number().min(0)),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("orgs")
      .update({ hourly_cost: data.hourlyCost, avg_hours_by_type: data.avgHoursByType })
      .eq("id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getClientMargins = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { days: 30 | 90 | 180 }) =>
    z.object({ days: z.union([z.literal(30), z.literal(90), z.literal(180)]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context.supabase, context.userId);

    const { data: org, error: orgErr } = await context.supabase
      .from("orgs").select("hourly_cost, avg_hours_by_type").eq("id", context.orgId).single();
    if (orgErr) throw new Error(orgErr.message);
    const hourlyCost = org.hourly_cost as number | null;
    const avgHoursByType = (org.avg_hours_by_type ?? {}) as Record<string, number>;

    const { data: clients, error: clientsErr } = await context.supabase
      .from("clients")
      .select("id, name, color, icon, category, archived, contract_value")
      .eq("archived", false)
      .neq("category", "Ex-clientes");
    if (clientsErr) throw new Error(clientsErr.message);

    const start = new Date(Date.now() - data.days * 86400000);
    const { data: finals, error: finalsErr } = await context.supabase
      .from("finalizations")
      .select("content_items!inner(type, activity_quantity, months!inner(client_id))")
      .gte("finalized_at", start.toISOString())
      .not("item_id", "is", null);
    if (finalsErr) throw new Error(finalsErr.message);

    const hoursByClient = new Map<string, number>();
    const deliveredByClient = new Map<string, number>();
    (finals ?? []).forEach((f: any) => {
      const it = f.content_items;
      const clientId = it?.months?.client_id;
      if (!clientId) return;
      const weight = it.type === "gravacao" && it.activity_quantity > 0 ? it.activity_quantity : 1;
      const hoursPerUnit = avgHoursByType[it.type] ?? 1;
      hoursByClient.set(clientId, (hoursByClient.get(clientId) ?? 0) + weight * hoursPerUnit);
      deliveredByClient.set(clientId, (deliveredByClient.get(clientId) ?? 0) + weight);
    });

    const rows = (clients ?? []).map((c: any) => {
      const estimatedHours = hoursByClient.get(c.id) ?? 0;
      const estimatedCost = hourlyCost != null ? estimatedHours * hourlyCost : null;
      const contractValue = c.contract_value as number | null;
      const margin = contractValue != null && estimatedCost != null ? contractValue - estimatedCost : null;
      return {
        clientId: c.id,
        clientName: c.name,
        clientColor: c.color,
        clientIcon: c.icon,
        contractValue,
        deliveredCount: deliveredByClient.get(c.id) ?? 0,
        estimatedHours: Math.round(estimatedHours * 10) / 10,
        estimatedCost,
        margin,
      };
    });

    // Pior → melhor margem primeiro; clientes sem valor de contrato definido
    // (margem indefinida) ficam no fim, sem entrar na ordenação por número.
    rows.sort((a, b) => {
      if (a.margin == null && b.margin == null) return 0;
      if (a.margin == null) return 1;
      if (b.margin == null) return -1;
      return a.margin - b.margin;
    });

    return { days: data.days, hourlyCost, avgHoursByType, rows };
  });
