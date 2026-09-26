// Grupos dentro da grade de Posts/Reels/Stories — hoje só usado em
// clientes Avulsos (ver ClientView.tsx, isAvulso). Mesmo padrão de
// campaigns.functions.ts: RLS via context.supabase (não supabaseAdmin),
// checagem de admin via RPC `is_admin` antes de qualquer escrita.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export type ContentGroup = {
  id: string;
  clientId: string;
  name: string;
  createdAt: string;
  itemCount: number;
};

export const listContentGroups = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ContentGroup[]> => {
    const { data: rows, error } = await context.supabase
      .from("content_groups").select("id, client_id, name, created_at")
      .eq("client_id", data.clientId).order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const groupIds = (rows ?? []).map((g: any) => g.id);
    const countByGroup = new Map<string, number>();
    if (groupIds.length > 0) {
      const { data: items } = await context.supabase
        .from("content_items").select("group_id").in("group_id", groupIds);
      (items ?? []).forEach((it: any) => countByGroup.set(it.group_id, (countByGroup.get(it.group_id) ?? 0) + 1));
    }
    return (rows ?? []).map((g: any) => ({
      id: g.id, clientId: g.client_id, name: g.name, createdAt: g.created_at,
      itemCount: countByGroup.get(g.id) ?? 0,
    }));
  });

export const createContentGroup = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; name: string }) =>
    z.object({ clientId: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { data: created, error } = await (context.supabase as any)
      .from("content_groups")
      .insert({ client_id: data.clientId, org_id: context.orgId, name: data.name, created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const renameContentGroup = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(80) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await (context.supabase as any).from("content_groups").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteContentGroup = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    // Itens perdem o grupo (ON DELETE SET NULL) mas continuam existindo
    // normalmente — apagar grupo nunca apaga conteúdo.
    const { error } = await context.supabase.from("content_groups").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Move um item pra dentro de um grupo (ou tira do grupo, com groupId
 * null) — chamado ao soltar um card arrastado em cima do cabeçalho de um
 * grupo, mesmo gesto de drag-and-drop já usado pra reordenar. */
export const setItemGroup = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; groupId: string | null }) =>
    z.object({ itemId: z.string().uuid(), groupId: z.string().uuid().nullable() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await (context.supabase as any).from("content_items").update({ group_id: data.groupId }).eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
