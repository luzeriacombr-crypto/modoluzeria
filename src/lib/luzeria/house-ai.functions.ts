// House — briefing da marca e ideias de stories geradas por IA com tudo que
// o app sabe da marca (briefing da ficha, base de conhecimento, playbook de
// stories, o que já foi postado e de onde os leads vêm chegando).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { BRAND_BRIEFING_FIELDS, composeBriefingText, type BrandBriefing, type StoryIdea } from "./house-brand";
import { houseDateKey, LEAD_ORIGIN_LABEL } from "./house-checklists";
import { getHouseBrands, pickWriteBrand, pickBrands, brandFilter } from "./house-brands.server";

/** Marca de trabalho: a pedida (se a pessoa tem acesso a ela), senão a principal. */
async function houseBrand(context: { supabase: any; orgId: string }, brandId?: string | null) {
  const { data } = await context.supabase.from("orgs").select("account_type, plan_id, name").eq("id", context.orgId).maybeSingle();
  if (data?.account_type !== "house") throw new Error("Disponível só em contas House.");
  const { brands } = await getHouseBrands(context);
  const brand = pickWriteBrand(brands, brandId);
  return { clientId: brand.id, planId: data.plan_id as string, orgName: data.name as string };
}

/* ============== Briefing da marca ============== */

const briefingSchema = z.object({
  ...(Object.fromEntries(BRAND_BRIEFING_FIELDS.map((f) => [f.key, z.string().max(4000, "Texto muito longo (máximo 4000 caracteres).").optional()])) as Record<string, z.ZodOptional<z.ZodString>>),
  full: z.string().max(20000, "Texto muito longo (máximo 20000 caracteres).").optional(),
});

export const getBrandBriefing = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { brandId?: string } | undefined) => z.object({ brandId: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data: input, context }) => {
    const { clientId } = await houseBrand(context, input.brandId);
    const { data } = await (context.supabase as any).from("clients")
      .select("id, name, niche, description, competitors, brand_briefing").eq("id", clientId).maybeSingle();
    return {
      clientId,
      name: (data?.name ?? "") as string,
      niche: (data?.niche ?? "") as string,
      description: (data?.description ?? "") as string,
      competitors: (data?.competitors ?? "") as string,
      briefing: ((data?.brand_briefing ?? {}) as BrandBriefing),
    };
  });

export const saveBrandBriefing = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { niche?: string; description?: string; competitors?: string; briefing: BrandBriefing; brandId?: string }) =>
    z.object({
      brandId: z.string().uuid().optional(),
      niche: z.string().trim().max(200, "Texto muito longo (máximo 200 caracteres).").optional(),
      description: z.string().trim().max(4000, "Texto muito longo (máximo 4000 caracteres).").optional(),
      competitors: z.string().trim().max(2000, "Texto muito longo (máximo 2000 caracteres).").optional(),
      briefing: briefingSchema,
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { clientId } = await houseBrand(context, data.brandId);
    const briefing = Object.fromEntries(Object.entries(data.briefing).map(([k, v]) => [k, (v ?? "").trim()])) as BrandBriefing;
    // Service role: na House a equipe toda preenche o briefing (o update de
    // clients é só de admin na RLS de agência).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("clients").update({
      niche: data.niche || null,
      description: data.description ?? "",
      competitors: data.competitors || null,
      brand_briefing: briefing,
      content_briefing: composeBriefingText(briefing) || null,
    }).eq("id", clientId).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Colar tudo de uma vez": a IA separa um briefing corrido nos campos
 * (pra pessoa revisar antes de salvar). Não grava nada. */
const ORGANIZE_TOOL = {
  name: "report_briefing_fields",
  description: "Separa o briefing nos campos.",
  input_schema: {
    type: "object",
    properties: {
      segmento: { type: "string", description: "Segmento em poucas palavras, no máximo 80 caracteres. Ex: Clínica médica multiespecialidades" },
      sobre: { type: "string", description: "O que a empresa faz, história, onde fica" },
      concorrentes: { type: "string", description: "Um por linha" },
      ...Object.fromEntries(BRAND_BRIEFING_FIELDS.map((f) => [f.key, { type: "string", description: f.hint }])),
    },
  },
};

export const organizeBriefingWithAI = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { text: string }) => z.object({ text: z.string().trim().min(40).max(20000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { planId } = await houseBrand(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: plan } = await (supabaseAdmin as any).from("plans").select("features").eq("id", planId).maybeSingle();
    if (!plan?.features?.ai_planning) throw new Error("Organizar com IA faz parte do plano House + IA. Você pode salvar o texto como está.");
    const { getAnthropicClient, PLANNING_MODEL } = await import("./ai-client.server");
    const res = await getAnthropicClient().messages.create({
      model: PLANNING_MODEL,
      max_tokens: 3000,
      thinking: { type: "disabled" },
      tools: [ORGANIZE_TOOL],
      tool_choice: { type: "tool", name: ORGANIZE_TOOL.name },
      messages: [{ role: "user", content: [{ type: "text", text: [
        "Separe o briefing abaixo nos campos da ferramenta. Use SOMENTE o que está no texto: não invente nada.",
        "Campo sem informação no texto fica vazio. Mantenha as palavras de quem escreveu, só organize e resuma quando estiver repetitivo.",
        "Nunca use o caractere travessão (—).",
        "",
        "BRIEFING:",
        data.text,
      ].join("\n") }] }],
    } as any);
    const toolUse = [...(res as any).content].reverse().find((b: any) => b.type === "tool_use" && b.name === ORGANIZE_TOOL.name);
    const out = (toolUse?.input ?? {}) as Record<string, string>;
    const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s*—\s*/g, ", ").trim() : "");
    return {
      niche: clean(out.segmento),
      description: clean(out.sobre),
      competitors: clean(out.concorrentes),
      briefing: Object.fromEntries(BRAND_BRIEFING_FIELDS.map((f) => [f.key, clean(out[f.key])])) as BrandBriefing,
    };
  });

/* ============== Ideias de stories ============== */

const IDEAS_TOOL = {
  name: "report_story_ideas",
  description: "Devolve as ideias de stories pra marca.",
  input_schema: {
    type: "object",
    properties: {
      ideias: {
        type: "array",
        items: {
          type: "object",
          properties: {
            momento: { type: "string", enum: ["manha", "tarde", "noite"] },
            formato: { type: "string", description: "Ex: Bastidor, Enquete, Caixinha de perguntas, Dica rápida, Prova social, Convite, Equipe, Curiosidade, Antes e depois" },
            titulo: { type: "string", description: "Nome curto da ideia (até 8 palavras)" },
            roteiro: { type: "string", description: "O que mostrar e o que falar, em 2 a 4 frases, concreto o bastante pra gravar sem pensar" },
            textoNaTela: { type: "string", description: "Texto curto pra escrever no story (opcional)" },
            cta: { type: "string", description: "Chamada pra ação (ex: responder a enquete, mandar QUERO no direct)" },
          },
          required: ["momento", "formato", "titulo", "roteiro"],
        },
      },
    },
    required: ["ideias"],
  },
};

const ideaSchema = z.object({
  momento: z.enum(["manha", "tarde", "noite"]),
  formato: z.string().min(1).max(60),
  titulo: z.string().min(1).max(120),
  roteiro: z.string().min(1).max(1200),
  textoNaTela: z.string().max(300).optional(),
  cta: z.string().max(300).optional(),
});

function cut(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/** Tudo que o app sabe da marca, em texto, pro prompt. */
async function buildBrandContext(admin: any, orgId: string, clientId: string): Promise<string> {
  const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [client, knowledge, playbook, recent, usedIdeas, leads] = await Promise.all([
    admin.from("clients").select("name, niche, description, notes, competitors, content_briefing").eq("id", clientId).maybeSingle(),
    admin.from("org_content_knowledge").select("title, text_content, kind").eq("org_id", orgId).order("created_at", { ascending: false }).limit(10),
    admin.from("playbook_pages").select("title, content, playbook_sections!inner(title)").eq("org_id", orgId).eq("playbook_sections.title", "Stories"),
    admin.from("content_items").select("title, type").eq("org_id", orgId).is("deleted_at", null).neq("title", "").order("updated_at", { ascending: false }).limit(30),
    admin.from("house_story_ideas").select("idea").eq("org_id", orgId).order("created_at", { ascending: false }).limit(30),
    admin.from("instagram_leads").select("origin").eq("org_id", orgId).gte("created_at", since30),
  ]);
  const c = client.data ?? {};
  const parts: string[] = [];
  parts.push(`Marca: ${c.name ?? ""}${c.niche ? ` (${c.niche})` : ""}`);
  if (c.description?.trim()) parts.push(`Sobre a empresa:\n${cut(c.description.trim(), 2000)}`);
  if (c.content_briefing?.trim()) parts.push(`Briefing da marca:\n${cut(c.content_briefing.trim(), 5000)}`);
  if (c.notes?.trim()) parts.push(`Observações internas:\n${cut(c.notes.trim(), 1000)}`);
  if (c.competitors?.trim()) parts.push(`Concorrentes:\n${cut(c.competitors.trim(), 800)}`);
  const kText = ((knowledge.data ?? []) as any[]).filter((k) => k.text_content?.trim()).map((k) => `- ${k.title ?? "Nota"}: ${cut(k.text_content.trim(), 1500)}`);
  if (kText.length) parts.push(`Base de conhecimento da empresa:\n${cut(kText.join("\n"), 6000)}`);
  const { getLuzeriaMethodForOrg } = await import("./luzeria-method.server");
  const method = await getLuzeriaMethodForOrg(orgId, 2500);
  if (method) parts.push(method);
  const pb = ((playbook.data ?? []) as any[]).map((p) => `### ${p.title}\n${p.content}`);
  if (pb.length) parts.push(`Método de stories da casa (playbook):\n${cut(pb.join("\n\n"), 3500)}`);
  const recentTitles = ((recent.data ?? []) as any[]).map((r) => `- ${r.title} (${r.type})`);
  if (recentTitles.length) parts.push(`Conteúdos recentes no fluxo de produção (pra manter coerência):\n${recentTitles.join("\n")}`);
  const used = ((usedIdeas.data ?? []) as any[]).map((r) => `- ${r.idea?.titulo}`).filter(Boolean);
  if (used.length) parts.push(`Ideias de stories já sugeridas antes (NÃO repita):\n${used.join("\n")}`);
  const byOrigin = new Map<string, number>();
  for (const l of (leads.data ?? []) as any[]) byOrigin.set(l.origin, (byOrigin.get(l.origin) ?? 0) + 1);
  if (byOrigin.size) {
    parts.push(`De onde vieram os leads do Instagram nos últimos 30 dias: ${[...byOrigin.entries()].sort((a, b) => b[1] - a[1])
      .map(([o, n]) => `${LEAD_ORIGIN_LABEL[o as keyof typeof LEAD_ORIGIN_LABEL] ?? o}: ${n}`).join(", ")}. Priorize formatos que geram esse tipo de conversa.`);
  }
  return parts.join("\n\n");
}

export type StoryIdeaRow = { id: string; batchId: string; idea: StoryIdea; createdAt: string; usedAt: string | null; usedBy: string | null };

export const listStoryIdeas = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { brandId?: string } | undefined) => z.object({ brandId: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data: input, context }): Promise<StoryIdeaRow[]> => {
    const { brands } = await getHouseBrands(context);
    const selected = pickBrands(brands, input.brandId);
    const { data, error } = await brandFilter((context.supabase as any).from("house_story_ideas")
      .select("id, batch_id, idea, created_at, used_at, used_by")
      .eq("org_id", context.orgId).is("dismissed_at", null), "client_id", selected)
      .order("created_at", { ascending: false }).limit(30);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({ id: r.id, batchId: r.batch_id, idea: r.idea, createdAt: r.created_at, usedAt: r.used_at ?? null, usedBy: r.used_by ?? null }));
  });

export const generateStoryIdeas = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { focus?: string; brandId?: string }) => z.object({ focus: z.string().trim().max(500).optional(), brandId: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const { clientId, planId } = await houseBrand(context, data.brandId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    const { data: plan } = await admin.from("plans").select("features").eq("id", planId).maybeSingle();
    if (!plan?.features?.ai_planning) {
      throw new Error("As ideias com IA fazem parte do plano House + IA. Troque de plano em Financeiro → Meu plano pra liberar.");
    }

    const context_text = await buildBrandContext(admin, context.orgId, clientId);
    const today = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());
    const prompt = [
      "Você é o estrategista de conteúdo interno de uma empresa (não uma agência de fora). Crie ideias de STORIES do Instagram pra hoje, prontas pra alguém da equipe gravar com o celular.",
      `Hoje é ${today}.`,
      "",
      context_text,
      "",
      "Regras:",
      "- 9 ideias: 3 pra manhã, 3 pra tarde, 3 pro fim do dia.",
      "- Misture formatos: bastidor, enquete, caixinha de perguntas, dica rápida, prova social, convite pra agendar, pessoas da equipe.",
      "- Pelo menos 3 ideias precisam gerar conversa no direct (enquete, caixinha ou chamada \"me manda X\").",
      "- Seja concreto e específico da marca (serviços, público, diferenciais do briefing). Nada genérico que serviria pra qualquer empresa.",
      "- Respeite o tom de voz e a lista do que evitar do briefing.",
      "- Nunca prometa resultado, cura ou garantia. Nada de antes e depois se o briefing não permitir.",
      "- Escreva em português do Brasil, natural, sem cara de texto de IA. PROIBIDO usar o caractere travessão (—).",
      data.focus ? `- Foco pedido pela equipe hoje: ${data.focus}` : "",
      !context_text.includes("Briefing da marca") ? "- O briefing da marca ainda está vazio: use o nome e o segmento, e prefira ideias que ajudem a conhecer o público (enquetes e caixinhas)." : "",
      "",
      "Devolva usando a ferramenta report_story_ideas.",
    ].filter((l) => l !== "").join("\n");

    const { getAnthropicClient, PLANNING_MODEL } = await import("./ai-client.server");
    const res = await getAnthropicClient().messages.create({
      model: PLANNING_MODEL,
      max_tokens: 4000,
      thinking: { type: "disabled" },
      tools: [IDEAS_TOOL],
      tool_choice: { type: "tool", name: IDEAS_TOOL.name },
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    } as any);
    const toolUse = [...(res as any).content].reverse().find((b: any) => b.type === "tool_use" && b.name === IDEAS_TOOL.name);
    const raw = (toolUse?.input?.ideias ?? []) as unknown[];
    const ideas = raw.map((r) => ideaSchema.safeParse(r)).filter((p) => p.success).map((p) => (p as any).data as StoryIdea)
      .map((i) => ({ ...i, titulo: i.titulo.replace(/\s*—\s*/g, ", "), roteiro: i.roteiro.replace(/\s*—\s*/g, ", ") }));
    if (ideas.length === 0) throw new Error("A IA não devolveu ideias dessa vez. Tenta de novo.");

    const batchId = crypto.randomUUID();
    const { error } = await admin.from("house_story_ideas").insert(ideas.map((idea) => ({
      org_id: context.orgId, client_id: clientId, batch_id: batchId, idea, created_by: context.userId,
    })));
    if (error) throw new Error(error.message);
    return { count: ideas.length, batchId };
  });

/** "Usei essa": marca a ideia e já conta +1 story pra quem usou. */
export const markStoryIdeaUsed = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; used: boolean }) => z.object({ id: z.string().uuid(), used: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const { data: ideaRow } = await db.from("house_story_ideas").select("client_id").eq("id", data.id).eq("org_id", context.orgId).maybeSingle();
    const ideaClient = (ideaRow?.client_id ?? null) as string | null;
    const { error } = await db.from("house_story_ideas")
      .update(data.used ? { used_at: new Date().toISOString(), used_by: context.userId } : { used_at: null, used_by: null })
      .eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    if (data.used) {
      await db.from("house_activity_logs").insert({ org_id: context.orgId, user_id: context.userId, client_id: ideaClient, day: houseDateKey(), kind: "story", qty: 1 });
    } else {
      const { data: last } = await db.from("house_activity_logs").select("id")
        .eq("user_id", context.userId).eq("day", houseDateKey()).eq("kind", "story").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (last) await db.from("house_activity_logs").delete().eq("id", last.id);
    }
    return { ok: true };
  });

export const dismissStoryIdea = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("house_story_ideas")
      .update({ dismissed_at: new Date().toISOString() }).eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
