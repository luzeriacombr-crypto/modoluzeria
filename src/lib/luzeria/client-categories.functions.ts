import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

// Categorias fixas do código (Sidebar.tsx's CATEGORY_ORDER) — protegidas,
// nunca viram linha em client_categories (têm lógica especial grudada no
// nome exato: Avulsos pula o seed de mês, Ex-clientes some das contagens
// de limite de plano, etc.). Um nome novo não pode colidir com nenhuma.
const PROTECTED_CATEGORY_NAMES = ["Social Media", "Pack Digital", "Avulsos", "Ex-clientes"];

export type ClientCategoryRow = { id: string; name: string; sortOrder: number };

export const listClientCategories = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<ClientCategoryRow[]> => {
    const { data, error } = await (context.supabase as any)
      .from("client_categories")
      .select("id, name, sort_order")
      .eq("org_id", context.orgId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({ id: r.id, name: r.name, sortOrder: r.sort_order }));
  });

export const createClientCategory = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string }) => z.object({ name: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;

    if (PROTECTED_CATEGORY_NAMES.some((n) => n.toLowerCase() === data.name.toLowerCase())) {
      throw new Error(`"${data.name}" já existe como categoria padrão.`);
    }

    const { data: existingMax } = await db.from("client_categories")
      .select("sort_order").eq("org_id", context.orgId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const nextOrder = (existingMax?.sort_order ?? -1) + 1;

    const { data: row, error } = await db.from("client_categories")
      .insert({ org_id: context.orgId, name: data.name, sort_order: nextOrder })
      .select("id, name, sort_order").single();
    if (error) {
      if (error.code === "23505") throw new Error(`Você já tem uma categoria chamada "${data.name}".`);
      throw new Error(error.message);
    }
    return { id: row.id, name: row.name, sortOrder: row.sort_order } as ClientCategoryRow;
  });

export const renameClientCategory = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; name: string }) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;

    if (PROTECTED_CATEGORY_NAMES.some((n) => n.toLowerCase() === data.name.toLowerCase())) {
      throw new Error(`"${data.name}" já existe como categoria padrão.`);
    }

    const { data: row, error: rowErr } = await db.from("client_categories")
      .select("name").eq("id", data.id).eq("org_id", context.orgId).single();
    if (rowErr) throw new Error(rowErr.message);

    // Clientes já usando o nome antigo mudam junto — category é o texto
    // literal, não uma chave separada, então renomear a categoria e
    // atualizar todo mundo que a usa precisa acontecer junto.
    const { error: clientsErr } = await context.supabase
      .from("clients").update({ category: data.name }).eq("org_id", context.orgId).eq("category", row.name);
    if (clientsErr) throw new Error(clientsErr.message);

    const { error } = await db.from("client_categories").update({ name: data.name }).eq("id", data.id);
    if (error) {
      if (error.code === "23505") throw new Error(`Você já tem uma categoria chamada "${data.name}".`);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteClientCategory = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;

    const { data: row, error: rowErr } = await db.from("client_categories")
      .select("name").eq("id", data.id).eq("org_id", context.orgId).single();
    if (rowErr) throw new Error(rowErr.message);

    const { count, error: countErr } = await context.supabase
      .from("clients").select("id", { count: "exact", head: true })
      .eq("org_id", context.orgId).eq("category", row.name);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(`Não é possível excluir: ${count} cliente${count === 1 ? "" : "s"} ainda ${count === 1 ? "está" : "estão"} nessa categoria. Mova ${count === 1 ? "ele" : "eles"} pra outra categoria antes.`);
    }

    const { error } = await db.from("client_categories").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
