import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertAdmin(supabase: any, userId: string) {
  const { data: ok } = await supabase.rpc("is_admin", { _user_id: userId });
  if (!ok) throw new Error("Apenas administradores podem gerenciar o contrato do cliente.");
}

export type ClientContract = {
  id: string;
  fileName: string;
  mimeType: string | null;
  createdAt: string;
  signedUrl: string | null;
};

export const getClientContract = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ClientContract | null> => {
    // `client_contracts` é tabela nova — cast até os tipos do Supabase
    // serem regenerados depois da migração rodar.
    const db = context.supabase as any;
    const { data: row } = await db
      .from("client_contracts")
      .select("id, storage_path, file_name, mime_type, created_at")
      .eq("client_id", data.clientId)
      .maybeSingle();
    if (!row) return null;
    const { data: signed } = await context.supabase.storage
      .from("client-contracts")
      .createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
    return {
      id: row.id,
      fileName: row.file_name,
      mimeType: row.mime_type,
      createdAt: row.created_at,
      signedUrl: signed?.signedUrl ?? null,
    };
  });

/** Salva (ou substitui) o contrato de um cliente — o arquivo em si já foi
 * enviado direto do navegador pro bucket `client-contracts`, aqui só
 * grava/atualiza a linha de metadados (1 contrato ativo por cliente). */
export const saveClientContract = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; storagePath: string; fileName: string; mimeType: string | null }) =>
    z.object({
      clientId: z.string().uuid(),
      storagePath: z.string().min(1).max(500),
      fileName: z.string().min(1).max(255),
      mimeType: z.string().nullable(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const { data: existing } = await db
      .from("client_contracts").select("storage_path").eq("client_id", data.clientId).maybeSingle();
    const { error } = await db.from("client_contracts").upsert({
      client_id: data.clientId,
      org_id: context.orgId,
      storage_path: data.storagePath,
      file_name: data.fileName,
      mime_type: data.mimeType,
      uploaded_by: context.userId,
    }, { onConflict: "client_id" });
    if (error) throw new Error(error.message);
    // Substituiu um arquivo anterior — remove o antigo do storage pra não
    // deixar lixo acumulando (o path muda a cada upload, tem o timestamp).
    if (existing?.storage_path && existing.storage_path !== data.storagePath) {
      await context.supabase.storage.from("client-contracts").remove([existing.storage_path]);
    }
    return { ok: true };
  });

export const deleteClientContract = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const db = context.supabase as any;
    const { data: row } = await db
      .from("client_contracts").select("storage_path").eq("client_id", data.clientId).maybeSingle();
    if (!row) return { ok: true };
    const { error } = await db.from("client_contracts").delete().eq("client_id", data.clientId);
    if (error) throw new Error(error.message);
    await context.supabase.storage.from("client-contracts").remove([row.storage_path]);
    return { ok: true };
  });
