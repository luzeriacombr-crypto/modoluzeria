// Prévia de planejamento do próximo mês gerada por IA — feature em teste,
// liberada só por cliente (clients.ai_planning_enabled), não por org. Lê
// histórico real de conteúdo, o roteiro/planejamento mais recente já
// escrito, os arquivos de marca do Drive e a lista de concorrentes
// informada, e pede pra IA pesquisar os concorrentes na web (tool nativo
// da Anthropic) antes de sugerir a prévia. Nunca escreve nada sozinha —
// o resultado só vira um client_docs de verdade se a pessoa clicar em
// "Salvar como Planejamento" depois de revisar.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

const WEB_SEARCH_TOOL = {
  type: "web_search_20260209",
  name: "web_search",
  max_uses: 5,
};

const REPORT_PLAN_TOOL = {
  name: "report_monthly_plan",
  description: "Reporta a prévia de planejamento de conteúdo do próximo mês pro cliente.",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string" as const,
        description: "Resumo curto (2-4 frases) da estratégia geral sugerida pro mês, em português.",
      },
      items: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const, description: "Título curto da publicação sugerida" },
            type: { type: "string" as const, enum: ["post", "reel"] },
            pillar: { type: "string" as const, description: "Pilar/tema de conteúdo, ex: bastidores, prova social, educativo" },
            captionDraft: { type: "string" as const, description: "Rascunho curto de legenda em português, no tom real da marca" },
            format: { type: "string" as const, description: "Formato sugerido, ex: carrossel, vídeo lo-fi, estático" },
            rationale: { type: "string" as const, description: "Por que essa publicação faz sentido agora, em 1 frase" },
          },
          required: ["title", "type", "captionDraft"],
        },
      },
      competitorNotes: {
        type: "string" as const,
        description: "O que a pesquisa dos concorrentes trouxe de relevante, em português. Deixe vazio se nenhum concorrente foi informado.",
      },
    },
    required: ["summary", "items"],
  },
};

const PlanItemSchema = z.object({
  title: z.string(),
  type: z.enum(["post", "reel"]),
  pillar: z.string().optional(),
  captionDraft: z.string(),
  format: z.string().optional(),
  rationale: z.string().optional(),
});
const PlanResultSchema = z.object({
  summary: z.string(),
  items: z.array(PlanItemSchema).max(60),
  competitorNotes: z.string().optional(),
});
export type MonthlyPlanItem = z.infer<typeof PlanItemSchema>;
export type MonthlyPlanResult = z.infer<typeof PlanResultSchema>;

export const generateMonthlyPlanPreview = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<MonthlyPlanResult> => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    // ai_planning_enabled/competitors são colunas novas — cast até os tipos
    // do Supabase serem regenerados depois da migração rodar.
    const { data: client, error: clientError } = await (context.supabase as any)
      .from("clients")
      .select("id, name, niche, posts_per_week, reels_per_week, description, notes, competitors, ai_planning_enabled")
      .eq("id", data.clientId)
      .maybeSingle();
    if (clientError) throw new Error(clientError.message);
    if (!client || !client.ai_planning_enabled) {
      throw new Error("Essa feature ainda não está liberada pra esse cliente.");
    }
    const c: any = client;

    const { data: historyRows } = await context.supabase
      .from("content_items")
      .select("title, caption, type, status, post_format, reel_type, months!inner(client_id)")
      .eq("months.client_id", data.clientId)
      .in("type", ["post", "reel"])
      .is("deleted_at", null)
      .order("last_status_change_at", { ascending: false })
      .limit(60);
    const history = (historyRows ?? []) as any[];
    const historyText = history.length
      ? history.map((h) => {
          const format = h.type === "post" ? h.post_format : h.reel_type;
          return `- [${h.type}${format ? `/${format}` : ""}] ${h.title || "(sem título)"} (${h.status})${h.caption ? ` — legenda: ${String(h.caption).slice(0, 200)}` : ""}`;
        }).join("\n")
      : "Nenhum post/reel no histórico ainda.";

    const { data: docRows } = await context.supabase
      .from("client_docs")
      .select("content")
      .eq("client_id", data.clientId)
      .order("updated_at", { ascending: false })
      .limit(1);
    const lastDocContent = (docRows ?? [])[0]?.content as string | undefined;

    const { data: assetRows } = await (context.supabase as any)
      .from("client_brand_assets")
      .select("drive_file_id, mime_type, name")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(5);
    const assets = ((assetRows ?? []) as any[]).filter(
      (a) => a.mime_type?.startsWith("image/") || a.mime_type === "application/pdf",
    );

    const assetBlocks: any[] = [];
    if (assets.length) {
      const { withDriveOrg, downloadDriveFileBase64 } = await import("./drive.functions");
      await withDriveOrg(context.orgId, async () => {
        for (const asset of assets) {
          const file = await downloadDriveFileBase64(asset.drive_file_id);
          if (!file) continue;
          assetBlocks.push({ type: "text", text: `Arquivo de marca: ${asset.name}` });
          if (file.mimeType.startsWith("image/")) {
            assetBlocks.push({ type: "image", source: { type: "base64", media_type: file.mimeType, data: file.base64 } });
          } else if (file.mimeType === "application/pdf") {
            assetBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } });
          }
        }
      });
    }

    // Banco de conhecimento da agência (texto livre + arquivos) — ensina a
    // IA como essa agência cria conteúdo, além do histórico específico
    // desse cliente. PDF entra como document block (a Anthropic extrai
    // sozinha); Markdown/texto entra direto como texto; .doc/.docx é
    // guardado mas ainda não é lido (sem lib de extração instalada).
    const { data: knowledgeRows } = await (context.supabase as any)
      .from("org_content_knowledge")
      .select("kind, title, text_content, storage_path, file_name, mime_type")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    const knowledge = (knowledgeRows ?? []) as any[];
    const knowledgeTextParts: string[] = [];
    const knowledgeBlocks: any[] = [];
    for (const k of knowledge) {
      if (k.kind === "text" && k.text_content) {
        knowledgeTextParts.push(`### ${k.title || "Nota"}\n${String(k.text_content).slice(0, 8000)}`);
        continue;
      }
      if (k.kind === "file" && k.storage_path) {
        const isReadableText = k.mime_type === "text/markdown" || k.mime_type === "text/plain"
          || /\.(md|txt)$/i.test(k.file_name ?? "");
        const isPdf = k.mime_type === "application/pdf" || /\.pdf$/i.test(k.file_name ?? "");
        if (!isReadableText && !isPdf) continue; // .doc/.docx etc — guardado, não lido ainda
        const { data: fileBlob } = await context.supabase.storage.from("org-knowledge").download(k.storage_path);
        if (!fileBlob) continue;
        if (isReadableText) {
          const text = await fileBlob.text();
          knowledgeTextParts.push(`### ${k.title || k.file_name}\n${text.slice(0, 8000)}`);
        } else {
          const buf = Buffer.from(await fileBlob.arrayBuffer());
          knowledgeBlocks.push({ type: "text", text: `Documento da base de conhecimento: ${k.title || k.file_name}` });
          knowledgeBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") } });
        }
      }
    }
    const knowledgeText = knowledgeTextParts.length
      ? `\n\nBase de conhecimento da agência (como ela costuma criar conteúdo, guias de voz/estilo etc — use isso pra escrever no tom certo):\n${knowledgeTextParts.join("\n\n")}`
      : "";

    const briefText = [
      `Cliente: ${c.name}`,
      c.niche ? `Nicho: ${c.niche}` : null,
      `Meta: ${c.posts_per_week ?? 0} posts/mês e ${c.reels_per_week ?? 0} reels/mês`,
      c.description ? `Descrição/briefing: ${c.description}` : null,
      c.notes ? `Observações internas: ${c.notes}` : null,
    ].filter(Boolean).join("\n");

    const competitorsText: string | null = c.competitors?.trim() || null;

    const instruction = [
      "Você é um estrategista de conteúdo de uma agência de social media, ajudando a montar uma PRÉVIA (rascunho pra revisão, não versão final) de planejamento de conteúdo do próximo mês pra um cliente.",
      "",
      briefText,
      "",
      "Histórico recente de posts/reels já produzidos pro cliente (use pra manter o tom de voz e não repetir temas recentes):",
      historyText,
      lastDocContent ? `\n\nDocumento de roteiro/planejamento mais recente já escrito pro cliente (contexto de tom de voz e temas já tratados):\n${lastDocContent.slice(0, 6000)}` : "",
      knowledgeText,
      competitorsText
        ? `\n\nConcorrentes informados pela agência — pesquise na web (use a tool web_search) o que cada um tem postado recentemente, formatos e temas em alta, ANTES de sugerir o planejamento, e cite o que encontrou em competitorNotes:\n${competitorsText}`
        : "\n\nNenhum concorrente foi informado — não pesquise nada, deixe competitorNotes vazio.",
      "",
      `Gere entre 4 e 12 sugestões de posts/reels pro próximo mês, com a mistura de tipos batendo aproximadamente com a meta mensal informada acima. Escreva tudo em português do Brasil, com tom real e específico do nicho do cliente — nunca genérico ou clichê. Termine SEMPRE chamando a tool report_monthly_plan com o resultado final.`,
    ].filter(Boolean).join("\n");

    const { getAnthropicClient, PLANNING_MODEL } = await import("./ai-client.server");
    const anthropic = getAnthropicClient();

    const response = await anthropic.messages.create({
      model: PLANNING_MODEL,
      max_tokens: 8000,
      tools: [WEB_SEARCH_TOOL as any, REPORT_PLAN_TOOL],
      tool_choice: { type: "auto" },
      messages: [{
        role: "user",
        content: [{ type: "text", text: instruction }, ...assetBlocks, ...knowledgeBlocks],
      }],
    } as any);

    const toolUse = [...response.content].reverse().find(
      (b: any) => b.type === "tool_use" && b.name === "report_monthly_plan",
    ) as any;
    if (!toolUse) throw new Error("Não consegui gerar a prévia — tenta de novo.");
    return PlanResultSchema.parse(toolUse.input);
  });
