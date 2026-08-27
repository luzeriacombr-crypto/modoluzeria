import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

const RETENTION_DAYS = 7;

export type TrashedItem = {
  id: string;
  title: string;
  type: "post" | "reel" | "story";
  clientId: string;
  clientName: string;
  clientColor: string | null;
  deletedAt: string;
  deletedByName: string | null;
  daysLeft: number;
};

/** Lista os posts excluídos da agência, mais antigos primeiro purgados
 * de vez. Usa o service role porque a política de RLS de content_items
 * exige deleted_at is null — só assim dá pra enxergar o que está na
 * lixeira sem abrir uma segunda política (que vazaria itens excluídos
 * pras ~50 leituras normais espalhadas pelo app). */
export const listTrash = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const cutoff = new Date(Date.now() - RETENTION_DAYS * 86_400_000).toISOString();

    // Purga de vez (sem volta) o que já passou do prazo — feito aqui,
    // sob demanda, porque o projeto não tem um cron rodando.
    await supabaseAdmin
      .from("content_items")
      .delete()
      .eq("org_id", context.orgId)
      .not("deleted_at", "is", null)
      .lt("deleted_at", cutoff);

    const { data: rows, error } = await supabaseAdmin
      .from("content_items")
      .select("id, title, type, deleted_at, deleted_by, month_id")
      .eq("org_id", context.orgId)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!rows?.length) return [] as TrashedItem[];

    const monthIds = [...new Set(rows.map((r: any) => r.month_id))];
    const { data: months } = await supabaseAdmin.from("months").select("id, client_id").in("id", monthIds);
    const clientIdByMonth = new Map((months ?? []).map((m: any) => [m.id, m.client_id as string]));

    const clientIds = [...new Set([...clientIdByMonth.values()])];
    const { data: clients } = await supabaseAdmin.from("clients").select("id, name, color").in("id", clientIds);
    const clientById = new Map((clients ?? []).map((c: any) => [c.id, c]));

    const deleterIds = [...new Set(rows.map((r: any) => r.deleted_by).filter(Boolean))];
    const { data: deleters } = deleterIds.length
      ? await supabaseAdmin.from("profiles").select("id, name").in("id", deleterIds)
      : { data: [] };
    const deleterNameById = new Map((deleters ?? []).map((p: any) => [p.id, p.name as string]));

    return rows.map((r: any) => {
      const clientId = clientIdByMonth.get(r.month_id) ?? "";
      const client = clientById.get(clientId);
      const deletedAtMs = new Date(r.deleted_at).getTime();
      const daysLeft = Math.max(0, Math.ceil((deletedAtMs + RETENTION_DAYS * 86_400_000 - Date.now()) / 86_400_000));
      return {
        id: r.id,
        title: r.title,
        type: r.type,
        clientId,
        clientName: client?.name ?? "Cliente removido",
        clientColor: client?.color ?? null,
        deletedAt: r.deleted_at,
        deletedByName: r.deleted_by ? (deleterNameById.get(r.deleted_by) ?? null) : null,
        daysLeft,
      };
    }) as TrashedItem[];
  });

export const restoreItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("content_items")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", data.id)
      .eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Apaga de vez, sem esperar os 7 dias — sem volta. */
export const purgeItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("content_items")
      .delete()
      .eq("id", data.id)
      .eq("org_id", context.orgId)
      .not("deleted_at", "is", null);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
