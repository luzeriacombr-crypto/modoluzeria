import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { BUILTIN_STATUS_KEYS } from "./types";

export type ContentStatusRow = {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
  isCustom: boolean;
};

export const listContentStatuses = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    // content_statuses ainda não está nos tipos gerados do Supabase.
    const { data, error } = await (context.supabase as any)
      .from("content_statuses")
      .select("id, key, label, sort_order")
      .eq("org_id", context.orgId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id, key: r.key, label: r.label, sortOrder: r.sort_order,
      isCustom: !(BUILTIN_STATUS_KEYS as string[]).includes(r.key),
    })) as ContentStatusRow[];
  });

export const upsertContentStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; key?: string; label: string }) =>
    z.object({
      id: z.string().uuid().optional(),
      key: z.string().trim().regex(/^[A-Za-z0-9_]+$/).max(60).optional(),
      label: z.string().trim().min(1).max(80),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;

    if (data.id) {
      // Editando o rótulo de uma linha existente — vale tanto pra override
      // de builtin quanto pra status customizado, a key nunca muda aqui.
      const { error } = await db.from("content_statuses")
        .update({ label: data.label })
        .eq("id", data.id).eq("org_id", context.orgId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    // Linha nova: key presente = primeira renomeação de um builtin (tem
    // que ser uma das chaves conhecidas); key ausente = status novo,
    // servidor gera a chave.
    let key = data.key;
    if (key) {
      if (!(BUILTIN_STATUS_KEYS as string[]).includes(key)) throw new Error("Chave de status inválida.");
    } else {
      key = `custom_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
    }

    const { data: existingMax } = await db.from("content_statuses")
      .select("sort_order").eq("org_id", context.orgId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const nextOrder = (existingMax?.sort_order ?? -1) + 1;

    const { error } = await db.from("content_statuses").insert({
      org_id: context.orgId, key, label: data.label, sort_order: nextOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContentStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;

    const { data: row, error: rowErr } = await db.from("content_statuses")
      .select("key").eq("id", data.id).eq("org_id", context.orgId).single();
    if (rowErr) throw new Error(rowErr.message);

    // Excluir override de builtin só volta pro rótulo padrão — a key
    // continua válida em content_items, sem risco de órfão. Só um status
    // customizado de verdade precisa desse bloqueio (a key some de vez).
    if (!(BUILTIN_STATUS_KEYS as string[]).includes(row.key)) {
      const { count, error: countErr } = await context.supabase
        .from("content_items")
        .select("id", { count: "exact", head: true })
        .eq("org_id", context.orgId)
        .eq("status", row.key);
      if (countErr) throw new Error(countErr.message);
      if ((count ?? 0) > 0) {
        throw new Error(`Não é possível excluir: ${count} conteúdo${count === 1 ? "" : "s"} ainda ${count === 1 ? "está" : "estão"} nesse status. Mova ${count === 1 ? "ele" : "eles"} pra outro status antes.`);
      }
    }

    const { error } = await db.from("content_statuses").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
