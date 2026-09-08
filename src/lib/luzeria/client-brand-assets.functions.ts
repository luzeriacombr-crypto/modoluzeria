import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!ok) throw new Error("Apenas administradores podem gerenciar os arquivos da marca.");
}

export type ClientBrandAsset = {
  id: string;
  label: string | null;
  mimeType: string | null;
  createdAt: string;
  signedUrl: string | null;
};

export const listClientBrandAssets = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientBrandAsset[]> => {
    // `client_brand_assets` é tabela nova — cast até os tipos do Supabase
    // serem regenerados depois da migração rodar.
    const db = context.supabase as any;
    const { data: rows, error } = await db
      .from("client_brand_assets")
      .select("id, storage_path, label, mime_type, created_at")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const paths = (rows ?? []).map((r: any) => r.storage_path as string);
    const signedByPath = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await context.supabase.storage
        .from("client-brand-assets").createSignedUrls(paths, 60 * 60 * 24 * 7);
      (signed ?? []).forEach((s: any) => { if (s?.path && s?.signedUrl) signedByPath.set(s.path, s.signedUrl); });
    }
    return (rows ?? []).map((r: any) => ({
      id: r.id,
      label: r.label,
      mimeType: r.mime_type,
      createdAt: r.created_at,
      signedUrl: signedByPath.get(r.storage_path) ?? null,
    }));
  });

/** O arquivo já foi enviado direto do navegador pro bucket
 * `client-brand-assets`, aqui só grava a linha de metadados. */
export const addClientBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; storagePath: string; label: string | null; mimeType: string | null }) =>
    z.object({
      clientId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
      label: z.string().max(120).nullable(),
      mimeType: z.string().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const { data: row, error } = await db.from("client_brand_assets").insert({
      client_id: data.clientId,
      org_id: context.orgId,
      storage_path: data.storagePath,
      label: data.label,
      mime_type: data.mimeType,
      created_by: context.userId,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const deleteClientBrandAsset = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const { data: row } = await db
      .from("client_brand_assets").select("storage_path").eq("id", data.id).maybeSingle();
    if (!row) return { ok: true };
    const { error } = await db.from("client_brand_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.storage.from("client-brand-assets").remove([row.storage_path]);
    return { ok: true };
  });
