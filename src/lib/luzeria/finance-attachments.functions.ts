// Comprovantes do Financeiro (Etapa 3, 30/09): PDF/foto anexado a um
// lançamento (num mês específico — saída fixa tem um comprovante por mês) ou
// a uma mensalidade de cliente. O arquivo sobe direto do navegador pro
// bucket privado "finance-attachments" (pasta = org_id, ver migration
// 20260930170000); aqui só grava/lista/apaga o registro e gera link
// temporário pra abrir.
import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

async function assertFinanceiroAccess(supabase: any, userId: string) {
  const { data: isMaster } = await supabase.rpc("is_master", { _user_id: userId });
  if (isMaster) return;
  const { data: hasPerm } = await supabase.rpc("has_cargo_permission", { _user_id: userId, _perm: "view_financeiro" });
  if (!hasPerm) throw new Error("Forbidden");
}

export const FINANCE_ATTACHMENTS_BUCKET = "finance-attachments";

export type FinanceAttachment = {
  id: string;
  entryId: string | null;
  clientPaymentId: string | null;
  /** Cliente da mensalidade (só quando clientPaymentId está preenchido). */
  clientId: string | null;
  monthKey: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  createdAt: string;
};

/** Todos os comprovantes do mês — de lançamentos e de mensalidades. */
export const listFinanceAttachments = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { monthKey: string }) => z.object({ monthKey: z.string().regex(/^\d{4}-\d{2}$/) }).parse(d))
  .handler(async ({ data, context }): Promise<FinanceAttachment[]> => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const { data: rows, error } = await (context.supabase as any)
      .from("finance_attachments")
      .select("id, entry_id, client_payment_id, month_key, file_name, mime_type, size_bytes, created_at, client_payments(client_id)")
      .eq("org_id", context.orgId).eq("month_key", data.monthKey)
      .order("created_at");
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, entryId: r.entry_id, clientPaymentId: r.client_payment_id,
      clientId: r.client_payments?.client_id ?? null,
      monthKey: r.month_key, fileName: r.file_name, mimeType: r.mime_type,
      sizeBytes: r.size_bytes, createdAt: r.created_at,
    }));
  });

/** Grava o registro depois que o navegador subiu o arquivo. Pra mensalidade,
 * recebe o cliente + mês e acha a linha de client_payments (precisa estar
 * marcada como paga). */
export const saveFinanceAttachment = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { entryId?: string | null; clientId?: string | null; monthKey: string; storagePath: string; fileName: string; mimeType?: string | null; sizeBytes?: number | null }) =>
    z.object({
      entryId: z.string().uuid().nullable().optional(),
      clientId: z.string().uuid().nullable().optional(),
      monthKey: z.string().regex(/^\d{4}-\d{2}$/),
      storagePath: z.string().min(1).max(400),
      fileName: z.string().trim().min(1).max(200),
      mimeType: z.string().max(100).nullable().optional(),
      sizeBytes: z.number().int().min(0).nullable().optional(),
    }).refine((v) => !!v.entryId !== !!v.clientId, "Informe o lançamento ou o cliente.").parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const sb = context.supabase as any;
    if (!data.storagePath.startsWith(`${context.orgId}/`)) throw new Error("Caminho de arquivo inválido.");

    let clientPaymentId: string | null = null;
    if (data.entryId) {
      const { data: entry } = await sb.from("cash_flow_entries").select("id").eq("id", data.entryId).eq("org_id", context.orgId).maybeSingle();
      if (!entry) throw new Error("Lançamento não encontrado.");
    } else {
      const { data: payment } = await sb.from("client_payments").select("id")
        .eq("client_id", data.clientId).eq("period", data.monthKey).eq("org_id", context.orgId).maybeSingle();
      if (!payment) throw new Error("Marque a mensalidade como paga antes de anexar o comprovante.");
      clientPaymentId = payment.id;
    }

    const { error } = await sb.from("finance_attachments").insert({
      org_id: context.orgId,
      entry_id: data.entryId ?? null,
      client_payment_id: clientPaymentId,
      month_key: data.monthKey,
      storage_path: data.storagePath,
      file_name: data.fileName,
      mime_type: data.mimeType ?? null,
      size_bytes: data.sizeBytes ?? null,
      created_by: context.userId,
    });
    if (error) {
      // Registro falhou: não deixa o arquivo solto no bucket.
      await sb.storage.from(FINANCE_ATTACHMENTS_BUCKET).remove([data.storagePath]);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeFinanceAttachment = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const sb = context.supabase as any;
    const { data: deleted, error } = await sb.from("finance_attachments").delete()
      .eq("id", data.id).eq("org_id", context.orgId).select("storage_path");
    if (error) throw new Error(error.message);
    const paths = (deleted ?? []).map((r: any) => r.storage_path);
    if (paths.length) await sb.storage.from(FINANCE_ATTACHMENTS_BUCKET).remove(paths);
    return { ok: true };
  });

/** Link temporário (5 min) pra abrir o comprovante numa aba nova. */
export const getFinanceAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertFinanceiroAccess(context.supabase, context.userId);
    const sb = context.supabase as any;
    const { data: row } = await sb.from("finance_attachments").select("storage_path")
      .eq("id", data.id).eq("org_id", context.orgId).maybeSingle();
    if (!row) throw new Error("Comprovante não encontrado.");
    const { data: signed, error } = await sb.storage.from(FINANCE_ATTACHMENTS_BUCKET).createSignedUrl(row.storage_path, 300);
    if (error || !signed?.signedUrl) throw new Error(error?.message ?? "Não foi possível abrir o comprovante.");
    return { url: signed.signedUrl as string };
  });

/** Apaga do bucket os arquivos dos comprovantes que vão sumir junto com um
 * lançamento ou mensalidade (a linha some por cascade, o arquivo não). */
export async function removeAttachmentFiles(supabase: any, filter: { entryId?: string; clientPaymentId?: string; fromMonth?: string }) {
  let q = supabase.from("finance_attachments").select("storage_path");
  if (filter.entryId) q = q.eq("entry_id", filter.entryId);
  if (filter.clientPaymentId) q = q.eq("client_payment_id", filter.clientPaymentId);
  if (filter.fromMonth) q = q.gte("month_key", filter.fromMonth);
  const { data } = await q;
  const paths = (data ?? []).map((r: any) => r.storage_path);
  if (paths.length) await supabase.storage.from(FINANCE_ATTACHMENTS_BUCKET).remove(paths);
  if (filter.fromMonth && filter.entryId) {
    await supabase.from("finance_attachments").delete().eq("entry_id", filter.entryId).gte("month_key", filter.fromMonth);
  }
}
