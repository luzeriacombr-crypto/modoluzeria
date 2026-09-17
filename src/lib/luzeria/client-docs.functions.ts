import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { CLIENT_DOC_PROMPT, type ClientDocType } from "./client-doc-templates";

export type ClientDoc = {
  id: string;
  clientId: string;
  type: ClientDocType;
  title: string | null;
  content: string;
  updatedAt: string;
  /** Setado só quando o doc de Roteiros veio de uma prévia de planejamento
   * aprovada — o mês pra onde cada roteiro aprovado deve virar publicação
   * automaticamente (null nos roteiros criados/colados manualmente, que
   * continuam usando o botão manual "Enviar pro Reels"). */
  targetMonthKey: string | null;
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
    const { data: rows, error } = await (context.supabase as any)
      .from("client_docs")
      .select("id, client_id, type, title, content, updated_at, target_month_key")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, clientId: r.client_id, type: r.type as ClientDocType,
      title: r.title, content: r.content, updatedAt: r.updated_at,
      targetMonthKey: r.target_month_key ?? null,
    }));
  });

// Mesmo prompt que CLIENT_DOC_PROMPT oferece pra colar numa IA externa —
// aqui só substitui o placeholder final e manda direto pra Anthropic, sem
// a pessoa precisar sair do Modo Criador. O "copiar modelo" continua
// existindo pra quem preferir usar a IA de fora mesmo assim.
export const formatClientDocWithAI = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { type: ClientDocType; rawMaterial: string }) =>
    z.object({
      type: z.enum(["roteiro", "planejamento"]),
      rawMaterial: z.string().trim().min(1).max(50000),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { getAnthropicClient, IMPORT_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();
    const prompt = CLIENT_DOC_PROMPT[data.type].replace(
      "[COLE AQUI O TEXTO OU ANEXE O ARQUIVO]",
      data.rawMaterial,
    );
    const response = await anthropic.messages.create({
      model: IMPORT_MODEL,
      max_tokens: 8000,
      messages: [{ role: "user", content: prompt }],
    });
    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    if (!textBlock?.text?.trim()) throw new Error("Não consegui formatar — tenta de novo.");
    return { content: textBlock.text.trim() };
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

export type RoteiroStatusValue = "pending" | "aprovado" | "ajustar";

export type RoteiroStatus = {
  roteiroTitle: string;
  status: RoteiroStatusValue;
  adjustNote: string | null;
  gravado: boolean;
  contentItemId: string | null;
  clientStatus: RoteiroStatusValue;
  clientNote: string | null;
  /** Tipo de content_item que esse roteiro deve virar ao ser aprovado —
   * fixado na criação (pela prévia de planejamento), 'reel' por padrão
   * pros roteiros manuais de sempre. */
  contentType: "post" | "reel";
};

/** One row per "## Roteiro N: título" section of a roteiro doc — the
 * per-item approve/ajustar/gravado/enviado-pro-Reels workflow state the
 * team uses, kept out of the pasted content itself. Also carries the
 * client's own aprovado/ajustar decision (set from the public preview
 * page via set_roteiro_client_status) so the team sees both side by side. */
export const listRoteiroStatuses = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { docId: string }) => z.object({ docId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<RoteiroStatus[]> => {
    await assertAdmin(context);
    const { data: rows, error } = await (context.supabase as any)
      .from("client_doc_roteiro_status")
      .select("roteiro_title, status, adjust_note, gravado, content_item_id, client_status, client_note, content_type")
      .eq("doc_id", data.docId);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      roteiroTitle: r.roteiro_title,
      status: r.status as RoteiroStatusValue,
      adjustNote: r.adjust_note,
      gravado: r.gravado,
      contentItemId: r.content_item_id,
      clientStatus: r.client_status as RoteiroStatusValue,
      clientNote: r.client_note,
      contentType: (r.content_type ?? "reel") as "post" | "reel",
    }));
  });

export const upsertRoteiroStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    docId: string;
    roteiroTitle: string;
    status?: RoteiroStatusValue;
    adjustNote?: string | null;
    gravado?: boolean;
    contentItemId?: string;
  }) =>
    z.object({
      docId: z.string().uuid(),
      roteiroTitle: z.string().trim().min(1).max(300),
      status: z.enum(["pending", "aprovado", "ajustar"]).optional(),
      adjustNote: z.string().trim().max(2000).nullable().optional(),
      gravado: z.boolean().optional(),
      contentItemId: z.string().uuid().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row: Record<string, any> = {
      doc_id: data.docId, org_id: context.orgId, roteiro_title: data.roteiroTitle, updated_by: context.userId,
    };
    if (data.status !== undefined) row.status = data.status;
    if (data.adjustNote !== undefined) row.adjust_note = data.adjustNote;
    if (data.gravado !== undefined) row.gravado = data.gravado;
    if (data.contentItemId !== undefined) row.content_item_id = data.contentItemId;
    const { error } = await context.supabase
      .from("client_doc_roteiro_status")
      .upsert(row, { onConflict: "doc_id,roteiro_title" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const MESES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
function formatMonthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return `${MESES_PT[(m ?? 1) - 1] ?? key} ${y ?? ""}`.trim();
}

/** Aprovar a prévia de planejamento por IA cria um doc de Roteiros de
 * verdade — um "## Roteiro N: título" por sugestão — já com o mês de
 * destino (target_month_key) e o tipo (post/reel) de cada um pré-gravados
 * em client_doc_roteiro_status, pra aprovar cada roteiro individual criar
 * o content_item sozinho (ver RoteiroControls.tsx). */
export const createRoteirosFromPlan = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    clientId: string;
    targetMonthKey: string;
    items: { title: string; type: "post" | "reel"; captionDraft: string; pillar?: string; rationale?: string }[];
  }) => z.object({
    clientId: z.string().uuid(),
    targetMonthKey: z.string().regex(/^\d{4}-\d{2}$/),
    items: z.array(z.object({
      title: z.string().trim().min(1).max(200),
      type: z.enum(["post", "reel"]),
      captionDraft: z.string().trim().max(4000),
      pillar: z.string().trim().max(120).optional(),
      rationale: z.string().trim().max(500).optional(),
    })).min(1).max(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const sections = data.items.map((it, i) => {
      const heading = `Roteiro ${i + 1}: ${it.title}`;
      const bodyParts = [it.captionDraft, it.pillar ? `Pilar: ${it.pillar}` : null, it.rationale ?? null].filter(Boolean);
      return { heading, body: bodyParts.join("\n\n") };
    });
    const content = sections.map((s) => `## ${s.heading}\n${s.body}`).join("\n\n");

    const { data: doc, error } = await (context.supabase as any)
      .from("client_docs")
      .insert({
        org_id: context.orgId, client_id: data.clientId, type: "roteiro",
        title: `Roteiros — ${formatMonthLabel(data.targetMonthKey)}`, content,
        target_month_key: data.targetMonthKey, created_by: context.userId,
      })
      .select("id").single();
    if (error) throw new Error(error.message);

    const statusRows = data.items.map((it, i) => ({
      doc_id: doc.id, org_id: context.orgId,
      roteiro_title: sections[i].heading, content_type: it.type,
    }));
    const { error: sErr } = await (context.supabase as any)
      .from("client_doc_roteiro_status").insert(statusRows);
    if (sErr) throw new Error(sErr.message);

    return { docId: doc.id as string };
  });
