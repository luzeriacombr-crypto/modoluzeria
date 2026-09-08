import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertReportAccess(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: allowed } = await supabase.rpc("has_setor_permission", { _user_id: userId, _perm: "team_reports" });
  if (!allowed) throw new Error("Forbidden");
}

type AuditItem = { id: string; title: string; date: string };
type AuditClientRow = { clientId: string; clientName: string; clientColor: string; count: number; items: AuditItem[] };
export type ProductionAudit = {
  edited: { total: number; byClient: AuditClientRow[] };
  finalized: { total: number; byClient: AuditClientRow[] };
};

/** Reencontra, sob demanda, a mesma comparação feita "na mão" na auditoria
 * de produção com o Calebe (planilha dele vs Modo Criador) — só que pra
 * qualquer editor e qualquer mês, direto na tela, sem precisar eu rodar
 * consulta nenhuma. Duas contagens, a mesma dupla usada em "Minhas
 * Demandas" (getMyEditingStats), só que aqui um admin pode olhar
 * qualquer pessoa da equipe:
 *  - "editados": reels em que a pessoa fez upload de arquivo no mês
 *    (independente do mês do calendário de conteúdo do item).
 *  - "finalizados": reels em que a pessoa tem uma finalização registrada
 *    no mês (mesma tabela usada no ranking/ranking por meta). */
export const getProductionAudit = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { userId: string; monthKey: string }) =>
    z.object({ userId: z.string().uuid(), monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<ProductionAudit> => {
    await assertReportAccess(context.supabase, context.userId);

    const [y, m] = data.monthKey.split("-").map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1, 3, 0, 0)).toISOString();
    const end = new Date(Date.UTC(y, m, 1, 3, 0, 0)).toISOString();

    function group(rows: { id: string; title: string; date: string; clientId: string; clientName: string; clientColor: string }[]) {
      const byClient = new Map<string, AuditClientRow>();
      for (const r of rows) {
        const row = byClient.get(r.clientId) ?? { clientId: r.clientId, clientName: r.clientName, clientColor: r.clientColor, count: 0, items: [] };
        row.count++;
        row.items.push({ id: r.id, title: r.title || "(sem título)", date: r.date });
        byClient.set(r.clientId, row);
      }
      const list = [...byClient.values()].sort((a, b) => b.count - a.count);
      return { total: rows.length, byClient: list };
    }

    const [uploadsRes, finalizationsRes] = await Promise.all([
      context.supabase
        .from("item_files")
        .select("created_at, content_items!inner(id, title, editor_id, type, months!inner(client_id, clients!months_client_id_fkey!inner(id, name, color)))")
        .eq("added_by", data.userId)
        .eq("kind", "media")
        .eq("content_items.type", "reel")
        .eq("content_items.editor_id", data.userId)
        .gte("created_at", start)
        .lt("created_at", end),
      context.supabase
        .from("finalizations")
        .select("finalized_at, content_items!inner(id, title, type, months!inner(client_id, clients!months_client_id_fkey!inner(id, name, color)))")
        .eq("user_id", data.userId)
        .eq("content_items.type", "reel")
        .gte("finalized_at", start)
        .lt("finalized_at", end),
    ]);
    if (uploadsRes.error) throw new Error(uploadsRes.error.message);
    if (finalizationsRes.error) throw new Error(finalizationsRes.error.message);

    // Uploads: pode ter mais de um arquivo por item no mesmo mês (retrabalho)
    // — dedupe por item antes de agrupar.
    const editedByItem = new Map<string, any>();
    for (const r of (uploadsRes.data ?? []) as any[]) {
      const it = r.content_items;
      if (!editedByItem.has(it.id)) editedByItem.set(it.id, { it, date: r.created_at });
    }
    const editedRows = [...editedByItem.values()].map(({ it, date }) => ({
      id: it.id, title: it.title, date,
      clientId: it.months.clients.id, clientName: it.months.clients.name, clientColor: it.months.clients.color,
    }));

    const finalizedByItem = new Map<string, any>();
    for (const r of (finalizationsRes.data ?? []) as any[]) {
      const it = r.content_items;
      if (!finalizedByItem.has(it.id)) finalizedByItem.set(it.id, { it, date: r.finalized_at });
    }
    const finalizedRows = [...finalizedByItem.values()].map(({ it, date }) => ({
      id: it.id, title: it.title, date,
      clientId: it.months.clients.id, clientName: it.months.clients.name, clientColor: it.months.clients.color,
    }));

    return { edited: group(editedRows), finalized: group(finalizedRows) };
  });
