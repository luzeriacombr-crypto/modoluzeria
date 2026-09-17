// Importação de clientes assistida por IA — complementa o import.functions.ts
// existente (Trello/ClickUp/Notion via token). Aqui a pessoa manda qualquer
// arquivo (planilha, PDF, print de tela) e um modelo com visão extrai uma
// lista revisável de clientes, nunca inserida direto — sempre passa por
// confirmImportedClients depois que a pessoa revisa/edita no front.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

const MAX_FILES = 10;

const ExtractedClientSchema = z.object({
  name: z.string(),
  niche: z.string().optional(),
  notes: z.string().optional(),
  postsPerWeek: z.number().optional(),
  reelsPerWeek: z.number().optional(),
  whatsapp: z.string().optional(),
  confidence: z.enum(["high", "low"]).optional(),
  source: z.string().optional(),
});
export type ExtractedClient = z.infer<typeof ExtractedClientSchema>;

const PLACEHOLDER_VALUES = new Set([
  "", "-", "—", "n/a", "na", "null", "none", "unknown", "<unknown>",
  "desconhecido", "não informado", "nao informado", "não sei", "nao sei",
]);

/** Defesa em profundidade contra o modelo preencher um campo vazio com um
 * valor-placeholder em vez de simplesmente omitir a chave (visto ao testar:
 * "<UNKNOWN>" apareceu mesmo com a instrução dizendo pra omitir) — filtra
 * qualquer string reconhecidamente vazia antes de devolver pro front. */
function sanitizeExtracted(clients: ExtractedClient[]): ExtractedClient[] {
  return clients.map((c) => {
    const clean: any = { name: c.name };
    for (const [key, value] of Object.entries(c)) {
      if (key === "name") continue;
      if (typeof value === "string" && PLACEHOLDER_VALUES.has(value.trim().toLowerCase())) continue;
      if (value !== undefined) clean[key] = value;
    }
    return clean as ExtractedClient;
  });
}

/** Admin-only: lê os arquivos enviados (planilha processada localmente,
 * imagem/PDF mandados direto pro modelo com visão) e devolve uma lista de
 * clientes candidatos — nunca cria nada no banco. */
export const extractClientsFromFiles = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { files: { name: string; mimeType: string; base64: string }[] }) =>
    z.object({
      files: z.array(z.object({
        name: z.string().max(200),
        mimeType: z.string().max(100),
        base64: z.string().max(20_000_000),
      })).min(1).max(MAX_FILES),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { getAnthropicClient, IMPORT_MODEL } = await import("./ai-client.server");
    const XLSX = await import("xlsx");
    const anthropic = getAnthropicClient();

    const contentBlocks: any[] = [];
    let sheetText = "";

    for (const file of data.files) {
      const isSpreadsheet = /spreadsheet|csv|ms-excel/i.test(file.mimeType) || /\.(csv|xlsx?|xls)$/i.test(file.name);
      const isImage = file.mimeType.startsWith("image/");
      const isPdf = file.mimeType === "application/pdf";

      if (isSpreadsheet) {
        try {
          const buf = Buffer.from(file.base64, "base64");
          const wb = XLSX.read(buf, { type: "buffer" });
          const sheetName = wb.SheetNames[0];
          const csv = XLSX.utils.sheet_to_csv(wb.Sheets[sheetName]);
          sheetText += `\n\n--- Planilha: ${file.name} ---\n${csv.slice(0, 20_000)}`;
        } catch {
          sheetText += `\n\n--- ${file.name}: não consegui ler como planilha ---`;
        }
      } else if (isImage) {
        contentBlocks.push({ type: "text", text: `Arquivo: ${file.name}` });
        contentBlocks.push({ type: "image", source: { type: "base64", media_type: file.mimeType, data: file.base64 } });
      } else if (isPdf) {
        contentBlocks.push({ type: "text", text: `Arquivo: ${file.name}` });
        contentBlocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: file.base64 } });
      }
    }
    if (sheetText) contentBlocks.push({ type: "text", text: `Conteúdo de planilhas enviadas:${sheetText}` });

    const tool = {
      name: "report_clients",
      description: "Reporta a lista de clientes de agência identificados nos arquivos enviados.",
      input_schema: {
        type: "object" as const,
        properties: {
          clients: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: {
                name: { type: "string" as const, description: "Nome do cliente/empresa" },
                niche: { type: "string" as const, description: "Ramo de atuação do cliente, ex: Estética, Gastronomia, Advocacia — NUNCA 'Social Media' (isso não é um nicho, é o tipo de serviço da agência)" },
                notes: { type: "string" as const },
                postsPerWeek: { type: "number" as const, description: "Posts por semana combinados — só se estiver explícito no material" },
                reelsPerWeek: { type: "number" as const },
                whatsapp: { type: "string" as const, description: "Telefone/WhatsApp de contato do cliente, se aparecer" },
                confidence: { type: "string" as const, enum: ["high", "low"] },
                source: { type: "string" as const, description: "Nome do arquivo de onde veio essa informação" },
              },
              required: ["name"],
            },
          },
        },
        required: ["clients"],
      },
    };

    const response = await anthropic.messages.create({
      model: IMPORT_MODEL,
      max_tokens: 4096,
      tools: [tool],
      tool_choice: { type: "tool", name: "report_clients" },
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: "Você está ajudando a importar clientes pro Modo Criador, um sistema de gestão pra agências de social media — todo cliente importado entra na mesma categoria interna 'Social Media' (isso é fixo, não é algo que você define). Analise os arquivos abaixo (planilha, PDF, print de sistema como Trello/ClickUp/Notion/Monday) e identifique cada cliente/empresa mencionado. Preencha só os campos que encontrar com razoável certeza no material. Se um campo estiver vazio, em branco ou você não tiver certeza, NÃO inclua essa chave no objeto — nunca escreva valores como \"desconhecido\", \"não informado\", \"N/A\", \"unknown\", \"-\" ou qualquer texto de preenchimento; simplesmente omita a chave. Marque confidence 'low' quando a info vier de um print/imagem que pode ter erro de leitura, e 'high' quando vier de texto/planilha clara.",
          },
          ...contentBlocks,
        ],
      }],
    });

    const toolUse = response.content.find((b: any) => b.type === "tool_use") as any;
    if (!toolUse) throw new Error("Não consegui ler os arquivos enviados.");
    const parsed = z.object({ clients: z.array(ExtractedClientSchema) }).parse(toolUse.input);
    return { clients: sanitizeExtracted(parsed.clients).slice(0, 200) };
  });

/** Admin-only: cria de fato os clientes já revisados/editados pela pessoa —
 * mesma trava de limite de plano do createClient/importClients, parando
 * (sem erro pro front) assim que o limite é atingido no meio do lote. */
export const confirmImportedClients = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    clients: {
      name: string; niche?: string; notes?: string;
      postsPerWeek?: number; reelsPerWeek?: number; whatsapp?: string;
    }[];
  }) => z.object({
    clients: z.array(z.object({
      name: z.string().trim().min(1).max(80),
      niche: z.string().trim().max(60).optional(),
      notes: z.string().trim().max(1000).optional(),
      postsPerWeek: z.number().min(0).max(100).optional(),
      reelsPerWeek: z.number().min(0).max(100).optional(),
      whatsapp: z.string().trim().max(60).optional(),
    })).min(1).max(50),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { monthKey, seedMonth, LUZERIA_ORG_ID } = await import("./api.functions");
    const key = monthKey(new Date());
    let imported = 0;
    for (const c of data.clients) {
      const notes = [c.notes, c.whatsapp ? `Contato: ${c.whatsapp}` : null, "Importado por IA"]
        .filter(Boolean).join(" · ");
      // Nunca escreve `category` aqui — é o campo que agrupa pastas na
      // barra lateral (ex: "Social Media"), e um cliente importado deve
      // sempre cair na mesma pasta de todos os outros, igual criação
      // manual. O que a IA detecta de ramo/atuação vira `niche` (campo
      // exibido na Ficha do Cliente), nunca uma pasta nova.
      const insert: any = { name: c.name, org_id: context.orgId, notes };
      if (c.niche) insert.niche = c.niche;
      if (c.postsPerWeek != null) insert.posts_per_week = c.postsPerWeek;
      if (c.reelsPerWeek != null) insert.reels_per_week = c.reelsPerWeek;
      const { data: client, error } = await context.supabase
        .from("clients").insert(insert).select("id").single();
      if (error) throw new Error(error.message);
      await seedMonth(context.supabase, client.id, key);
      imported++;
    }

    // A importação nunca para no limite do plano — traz todo mundo que a
    // pessoa confirmou. Se isso deixar a agência acima do limite, abre um
    // prazo de 30 dias pra fazer upgrade (gravado só na primeira vez;
    // getOrgPlanStatus limpa sozinho quando a contagem volta a caber).
    let overLimit = false;
    let graceUntil: string | null = null;
    if (context.orgId !== LUZERIA_ORG_ID) {
      const { data: org } = await context.supabase
        .from("orgs").select("plan_id, client_limit_grace_until").eq("id", context.orgId).maybeSingle();
      const { data: plan } = await context.supabase
        .from("plans").select("max_clients").eq("id", (org as any)?.plan_id ?? "solo").maybeSingle();
      const maxClients = (plan as any)?.max_clients ?? null;
      if (maxClients != null) {
        const { count } = await context.supabase
          .from("clients").select("id", { count: "exact", head: true }).eq("archived", false).neq("category", "Ex-clientes");
        if ((count ?? 0) > maxClients) {
          overLimit = true;
          graceUntil = (org as any)?.client_limit_grace_until ?? null;
          if (!graceUntil) {
            graceUntil = new Date(Date.now() + 30 * 86_400_000).toISOString();
            await context.supabase.from("orgs").update({ client_limit_grace_until: graceUntil }).eq("id", context.orgId);
          }
        }
      }
    }

    return { imported, overLimit, graceUntil };
  });
