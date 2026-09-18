import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import { CLIENT_DOC_PROMPT, type ClientDocType } from "./client-doc-templates";
import { HOUSE_STYLE_GUIDE, safeTruncate } from "./ai-planning.functions";

const PlanItemLiteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  type: z.enum(["post", "reel"]),
  captionDraft: z.string().trim().max(4000),
  publishCaption: z.string().trim().max(2200).optional(),
  postFormat: z.enum(["estatico", "carrossel"]).optional(),
  pillar: z.string().trim().max(120).optional(),
  format: z.string().trim().max(120).optional(),
  rationale: z.string().trim().max(500).optional(),
});
export type PlanItemLite = z.infer<typeof PlanItemLiteSchema>;

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
  /** Itens estruturados da prévia de planejamento por IA, se esse doc veio
   * de lá — permite "Aprovar e enviar pros Roteiros" num Planejamento (IA)
   * já salvo, sem depender de reconstruir os itens a partir do Markdown
   * (que pode ter sido editado). Null pra qualquer planejamento manual/colado. */
  planItems: PlanItemLite[] | null;
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
      .select("id, client_id, type, title, content, updated_at, target_month_key, plan_items")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, clientId: r.client_id, type: r.type as ClientDocType,
      title: r.title, content: r.content, updatedAt: r.updated_at,
      targetMonthKey: r.target_month_key ?? null,
      planItems: r.plan_items ?? null,
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
  .inputValidator((d: { id?: string; clientId: string; type: ClientDocType; title?: string | null; content: string; planItems?: PlanItemLite[] }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      type: z.enum(["roteiro", "planejamento"]),
      title: z.string().trim().max(160).nullable().optional(),
      content: z.string().trim().min(1).max(20000),
      planItems: z.array(PlanItemLiteSchema).max(60).optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.id) {
      const patch: Record<string, any> = { type: data.type, title: data.title ?? null, content: data.content };
      if (data.planItems !== undefined) patch.plan_items = data.planItems;
      const { error } = await (context.supabase as any).from("client_docs").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await (context.supabase as any)
      .from("client_docs")
      .insert({
        org_id: context.orgId, client_id: data.clientId, type: data.type,
        title: data.title ?? null, content: data.content, created_by: context.userId,
        plan_items: data.planItems ?? null,
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
  /** Só quando contentType='post' e veio da prévia — estatico/carrossel,
   * grava direto no botão de formato real do content_item ao aprovar. */
  postFormat: "estatico" | "carrossel" | null;
  /** Legenda de verdade a publicar — diferente do corpo do roteiro/doc
   * (que é o texto de produção/Briefing). Null nos roteiros manuais. */
  publishCaption: string | null;
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
      .select("roteiro_title, status, adjust_note, gravado, content_item_id, client_status, client_note, content_type, post_format, publish_caption")
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
      postFormat: (r.post_format ?? null) as "estatico" | "carrossel" | null,
      publishCaption: r.publish_caption ?? null,
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
    items: { title: string; type: "post" | "reel"; captionDraft: string; publishCaption?: string; postFormat?: "estatico" | "carrossel"; pillar?: string; rationale?: string }[];
  }) => z.object({
    clientId: z.string().uuid(),
    targetMonthKey: z.string().regex(/^\d{4}-\d{2}$/),
    items: z.array(z.object({
      title: z.string().trim().min(1).max(200),
      type: z.enum(["post", "reel"]),
      captionDraft: z.string().trim().max(4000),
      publishCaption: z.string().trim().max(2200).optional(),
      postFormat: z.enum(["estatico", "carrossel"]).optional(),
      pillar: z.string().trim().max(120).optional(),
      rationale: z.string().trim().max(500).optional(),
    })).min(1).max(60),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    // Pilar e rationale são anotação estratégica INTERNA (referencia "a
    // reunião", "o briefing" etc) — nunca embutir no content, que é o mesmo
    // texto mostrado no link público pro cliente.
    const sections = data.items.map((it, i) => {
      const formatLabel = it.type === "reel" ? "Reel" : it.postFormat === "carrossel" ? "Carrossel" : "Post";
      const heading = `Roteiro ${i + 1}: ${it.title} (${formatLabel})`;
      const bodyParts = [
        it.captionDraft,
        it.publishCaption ? `Legenda: ${it.publishCaption}` : null,
      ].filter(Boolean);
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
      post_format: it.type === "post" ? (it.postFormat ?? null) : null,
      publish_caption: it.publishCaption ?? null,
    }));
    const { error: sErr } = await (context.supabase as any)
      .from("client_doc_roteiro_status").insert(statusRows);
    if (sErr) throw new Error(sErr.message);

    return { docId: doc.id as string };
  });

/** Reescreve um documento de Roteiros já salvo — mesmo formato de casa e
 * base de conhecimento da agência usados na prévia de planejamento por IA,
 * pra melhorar tom/profundidade sem precisar recriar do zero. Mantém os
 * mesmos "## Roteiro N: título" e a linha "Pilar:" de cada um; só reescreve
 * o corpo (captionDraft) e a "Legenda:" (publishCaption). Recusa se algum
 * item já foi gravado/virou content_item — nesse caso a reescrita em massa
 * pisaria em trabalho já feito. */
export const regenerateRoteiroDoc = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { docId: string }) => z.object({ docId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    const { data: doc, error: docErr } = await (context.supabase as any)
      .from("client_docs")
      .select("id, type, content")
      .eq("id", data.docId).single();
    if (docErr || !doc) throw new Error("Documento não encontrado.");
    if (doc.type !== "roteiro") throw new Error("Só dá pra regenerar documentos de Roteiros.");

    const { data: statusRows } = await (context.supabase as any)
      .from("client_doc_roteiro_status")
      .select("roteiro_title, gravado, content_item_id")
      .eq("doc_id", data.docId);
    const alreadyStarted = ((statusRows ?? []) as any[]).some((r) => r.gravado || r.content_item_id);
    if (alreadyStarted) {
      throw new Error("Algum roteiro desse documento já foi gravado ou virou publicação — não dá pra reescrever tudo de uma vez. Edite manualmente o que ainda não avançou.");
    }

    const { data: knowledgeRows } = await (context.supabase as any)
      .from("org_content_knowledge")
      .select("title, text_content")
      .eq("org_id", context.orgId)
      .eq("kind", "text")
      .order("created_at", { ascending: false })
      .limit(20);
    const knowledgeParts = ((knowledgeRows ?? []) as any[])
      .filter((k) => k.text_content)
      .map((k) => `### ${k.title || "Nota"}\n${safeTruncate(String(k.text_content), 6000)}`);
    const knowledgeText = knowledgeParts.length
      ? `\n\nBase de conhecimento da agência (como ela costuma criar conteúdo, use fatos e detalhes concretos daqui pra aprofundar, não só o tom):\n${knowledgeParts.join("\n\n")}`
      : "";

    const instruction = [
      "Você vai REESCREVER um documento de roteiros já existente, melhorando a qualidade sem perder a substância de cada um.",
      "",
      HOUSE_STYLE_GUIDE,
      knowledgeText,
      "",
      "REGRAS OBRIGATÓRIAS pra essa reescrita:",
      '- Mantenha exatamente os mesmos "## Roteiro N: título" de cada seção, na mesma ordem e quantidade. Só ajuste o sufixo de formato entre parênteses no final do título se necessário: " (Carrossel)" se o roteiro usa SLIDE N:, " (Post)" se usa TEXTO:, ou " (Reel)" se for roteiro corrido de vídeo sem SLIDE/TEXTO.',
      '- Se houver uma linha "Pilar: ..." ou qualquer nota interna de racional/estratégia (referenciando reunião, briefing etc) no corpo do roteiro, REMOVA essa linha por completo. Esse documento é visível pro cliente final, nada de anotação interna nele.',
      '- Reescreva o corpo do roteiro (captionDraft, no mesmo formato TEXTO:/SLIDE N:/roteiro corrido que já está usado) e a linha "Legenda: ..." de cada um. Mesmo tema/fatos de cada roteiro, mas seguindo à risca o formato de casa acima (tom natural, aprofundado com fatos concretos, emoji ocasional, sem cara de texto gerado por IA, sem travessão).',
      "- Não mude a quantidade de roteiros, não adicione nem remova nenhum.",
      "- Não use blocos de código (```), não escreva nada fora da estrutura dos roteiros (sem introdução, sem comentários, sem despedida).",
      "",
      "Documento atual (reescreva a partir dele):",
      doc.content,
    ].filter(Boolean).join("\n");

    const { getAnthropicClient, PLANNING_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();
    const response = await anthropic.messages.create({
      model: PLANNING_MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: instruction }],
    });
    const textBlock = response.content.find((b: any) => b.type === "text") as any;
    const newContent: string | undefined = textBlock?.text?.trim();
    if (!newContent) throw new Error("Não consegui regenerar — tenta de novo.");

    const oldTitles = [...doc.content.matchAll(/^## (.+)$/gm)].map((m: any) => m[1].trim());
    const newTitles = [...newContent.matchAll(/^## (.+)$/gm)].map((m: any) => m[1].trim());
    if (newTitles.length !== oldTitles.length) {
      throw new Error(`A reescrita saiu com número de roteiros diferente (${newTitles.length} em vez de ${oldTitles.length}) — tenta de novo.`);
    }

    const { error: updErr } = await (context.supabase as any)
      .from("client_docs").update({ content: newContent }).eq("id", data.docId);
    if (updErr) throw new Error(updErr.message);

    // O sufixo de formato pode mudar o texto do título — sincroniza
    // client_doc_roteiro_status casando pela ORDEM (mesma contagem já
    // validada acima), não por igualdade de string.
    for (let i = 0; i < oldTitles.length; i++) {
      if (oldTitles[i] !== newTitles[i]) {
        await (context.supabase as any)
          .from("client_doc_roteiro_status")
          .update({ roteiro_title: newTitles[i] })
          .eq("doc_id", data.docId).eq("roteiro_title", oldTitles[i]);
      }
    }

    return { content: newContent };
  });
