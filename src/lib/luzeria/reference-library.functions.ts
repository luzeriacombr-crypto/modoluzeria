import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export const listReferenceLibrary = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId?: string | null }) =>
    z.object({ clientId: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("reference_library_items")
      .select("id, client_id, title, url, notes, tags, created_by, created_at, clients(name, color)")
      .order("created_at", { ascending: false });
    if (data.clientId !== undefined) {
      q = data.clientId === null ? q.is("client_id", null) : q.or(`client_id.eq.${data.clientId},client_id.is.null`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      clientId: r.client_id,
      clientName: r.clients?.name ?? null,
      clientColor: r.clients?.color ?? null,
      title: r.title,
      url: r.url,
      notes: r.notes,
      tags: r.tags ?? [],
      createdBy: r.created_by,
      createdAt: r.created_at,
    }));
  });

export const upsertReferenceLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; clientId: string | null; title: string; url?: string; notes?: string; tags?: string[];
  }) => z.object({
    id: z.string().uuid().optional(),
    clientId: z.string().uuid().nullable(),
    title: z.string().trim().min(1).max(160),
    url: z.string().trim().max(500).optional(),
    notes: z.string().trim().max(2000).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const row = {
      org_id: context.orgId,
      client_id: data.clientId,
      title: data.title,
      url: data.url?.trim() || null,
      notes: data.notes?.trim() || null,
      tags: data.tags ?? [],
      updated_at: new Date().toISOString(),
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("reference_library_items").update(row).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("reference_library_items").insert({ ...row, created_by: context.userId });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteReferenceLibraryItem = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("reference_library_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
