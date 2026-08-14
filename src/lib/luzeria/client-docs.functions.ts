import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type { ClientDocType } from "./client-doc-templates";

export type ClientDoc = {
  id: string;
  clientId: string;
  type: ClientDocType;
  title: string | null;
  content: string;
  updatedAt: string;
};

async function assertAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!isAdmin) throw new Error("Forbidden");
}

export const listClientDocs = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientDoc[]> => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("client_docs")
      .select("id, client_id, type, title, content, updated_at")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, clientId: r.client_id, type: r.type as ClientDocType,
      title: r.title, content: r.content, updatedAt: r.updated_at,
    }));
  });

export const upsertClientDoc = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; clientId: string; type: ClientDocType; title?: string | null; content: string }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      type: z.enum(["roteiro", "planejamento"]),
      title: z.string().trim().max(160).nullable().optional(),
      content: z.string().trim().min(1).max(20000),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const { error } = await context.supabase
        .from("client_docs")
        .update({ type: data.type, title: data.title ?? null, content: data.content })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("client_docs")
      .insert({
        org_id: context.orgId, client_id: data.clientId, type: data.type,
        title: data.title ?? null, content: data.content, created_by: context.userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteClientDoc = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("client_docs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
