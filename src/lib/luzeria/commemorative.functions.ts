// Datas comemorativas e aniversários por cliente/marca: lista, lembretes,
// "virar post" e entrada por catálogo, IA (por ramo) ou arquivo.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import {
  CATALOG, DATE_RULES, briefingForDate, nextOccurrence, occurrenceOn, addDaysKey,
  type DateKind, type DateRule,
} from "./commemorative";

const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

/** Admin — ou, numa House, qualquer pessoa ativa da equipe. */
async function assertCanEdit(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (isAdmin) return;
  const { data: houseTeam } = await context.supabase.rpc("is_house_team", { _user_id: context.userId });
  if (!houseTeam) throw new Error("Só gestores editam as datas.");
}
async function assertAdminOnly(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
  if (!isAdmin) throw new Error("Só gestores editam as datas.");
}

export type CommemorativeDate = {
  id: string; clientId: string; clientName: string; title: string; kind: DateKind; rule: DateRule | null;
  month: number | null; day: number | null; segment: string | null; note: string | null;
  notifyDaysBefore: number; active: boolean;
  nextDate: string; nextYear: number; daysUntil: number;
  /** Estado da próxima ocorrência: virou post / foi ignorada. */
  itemId: string | null; dismissed: boolean;
};

function mapRow(r: any, clientName: string, occ: Map<string, any>, today: string): CommemorativeDate {
  const next = nextOccurrence({ rule: r.rule, month: r.month, day: r.day }, today);
  const o = occ.get(`${r.id}:${next.year}`);
  return {
    id: r.id, clientId: r.client_id, clientName, title: r.title, kind: r.kind, rule: r.rule ?? null,
    month: r.month ?? null, day: r.day ?? null, segment: r.segment ?? null, note: r.note ?? null,
    notifyDaysBefore: r.notify_days_before, active: r.active,
    nextDate: next.date, nextYear: next.year, daysUntil: next.daysUntil,
    itemId: o?.content_item_id ?? null, dismissed: !!o?.dismissed,
  };
}

async function loadOccurrences(db: any, ids: string[]) {
  const map = new Map<string, any>();
  if (!ids.length) return map;
  const { data } = await db.from("commemorative_occurrences").select("date_id, year, content_item_id, dismissed").in("date_id", ids);
  for (const o of (data ?? []) as any[]) map.set(`${o.date_id}:${o.year}`, o);
  return map;
}

/** Datas de uma marca/cliente, da mais próxima pra mais distante. */
export const listCommemorativeDates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<CommemorativeDate[]> => {
    const db: any = context.supabase;
    const [{ data: rows, error }, { data: client }] = await Promise.all([
      db.from("commemorative_dates").select("*").eq("client_id", data.clientId).eq("org_id", context.orgId),
      db.from("clients").select("name").eq("id", data.clientId).maybeSingle(),
    ]);
    if (error) throw new Error(error.message);
    const occ = await loadOccurrences(db, ((rows ?? []) as any[]).map((r) => r.id));
    const today = todayKey();
    return ((rows ?? []) as any[]).map((r) => mapRow(r, client?.name ?? "", occ, today)).sort((a, b) => a.daysUntil - b.daysUntil);
  });

/** Próximas datas de todas as marcas/clientes que a pessoa enxerga — pro
 * bloco "Datas chegando" (já dentro da janela de aviso de cada uma, ou nos
 * próximos 30 dias, o que for maior). */
export const upcomingCommemorativeDates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { brandId?: string } | undefined) => z.object({ brandId: z.string().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }): Promise<CommemorativeDate[]> => {
    const db: any = context.supabase;
    let q = db.from("commemorative_dates").select("*, clients!inner(name, archived)").eq("org_id", context.orgId).eq("active", true).eq("clients.archived", false);
    if (data.brandId && data.brandId !== "all") q = q.eq("client_id", data.brandId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const occ = await loadOccurrences(db, ((rows ?? []) as any[]).map((r) => r.id));
    const today = todayKey();
    return ((rows ?? []) as any[])
      .map((r) => mapRow(r, r.clients?.name ?? "", occ, today))
      .filter((d) => !d.dismissed && d.daysUntil <= Math.max(30, d.notifyDaysBefore))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 30);
  });

const dateInput = z.object({
  id: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  kind: z.enum(["fixa", "movel", "personalizada", "aniversario"]),
  rule: z.enum(DATE_RULES).nullable().optional(),
  month: z.number().int().min(1).max(12).nullable().optional(),
  day: z.number().int().min(1).max(31).nullable().optional(),
  segment: z.string().trim().max(40).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
  notifyDaysBefore: z.number().int().min(0).max(365),
  active: z.boolean().optional(),
}).refine((d) => !!d.rule || (d.month != null && d.day != null), { message: "Informe o dia e o mês da data." });

export const saveCommemorativeDate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: z.input<typeof dateInput>) => dateInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOnly(context);
    const row = {
      org_id: context.orgId, client_id: data.clientId, title: data.title, kind: data.kind,
      rule: data.rule ?? null, month: data.rule ? null : data.month ?? null, day: data.rule ? null : data.day ?? null,
      segment: data.segment ?? null, note: data.note || null, notify_days_before: data.notifyDaysBefore,
      active: data.active ?? true,
    };
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("commemorative_dates").update(row).eq("id", data.id).eq("org_id", context.orgId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await db.from("commemorative_dates").insert({ ...row, created_by: context.userId }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteCommemorativeDate = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOnly(context);
    const { error } = await (context.supabase as any).from("commemorative_dates").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Adiciona datas do catálogo pronto (ignora as que a marca já tem). */
export const addCatalogDates = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; keys: string[]; notifyDaysBefore: number }) =>
    z.object({ clientId: z.string().uuid(), keys: z.array(z.string()).min(1).max(60), notifyDaysBefore: z.number().int().min(0).max(365) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOnly(context);
    const db: any = context.supabase;
    const { data: existing } = await db.from("commemorative_dates").select("title").eq("client_id", data.clientId);
    const have = new Set(((existing ?? []) as any[]).map((r) => String(r.title).toLowerCase()));
    const rows = CATALOG.filter((c) => data.keys.includes(c.key) && !have.has(c.title.toLowerCase())).map((c) => ({
      org_id: context.orgId, client_id: data.clientId, title: c.title, kind: c.rule ? "movel" : "fixa",
      rule: c.rule ?? null, month: c.rule ? null : c.month!, day: c.rule ? null : c.day!, segment: c.segment,
      notify_days_before: data.notifyDaysBefore, created_by: context.userId,
    }));
    if (rows.length) {
      const { error } = await db.from("commemorative_dates").insert(rows);
      if (error) throw new Error(error.message);
    }
    return { added: rows.length };
  });

/** Copia as datas escolhidas de uma marca/cliente para outras. */
export const copyDatesToClients = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { fromClientId: string; toClientIds: string[]; dateIds?: string[] }) =>
    z.object({ fromClientId: z.string().uuid(), toClientIds: z.array(z.string().uuid()).min(1).max(100), dateIds: z.array(z.string().uuid()).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdminOnly(context);
    const db: any = context.supabase;
    let q = db.from("commemorative_dates").select("*").eq("client_id", data.fromClientId).eq("org_id", context.orgId);
    if (data.dateIds?.length) q = q.in("id", data.dateIds);
    const { data: src, error } = await q;
    if (error) throw new Error(error.message);
    let added = 0;
    for (const to of data.toClientIds.filter((id) => id !== data.fromClientId)) {
      const { data: have } = await db.from("commemorative_dates").select("title").eq("client_id", to);
      const titles = new Set(((have ?? []) as any[]).map((r) => String(r.title).toLowerCase()));
      const rows = ((src ?? []) as any[]).filter((r) => !titles.has(String(r.title).toLowerCase())).map((r) => ({
        org_id: context.orgId, client_id: to, title: r.title, kind: r.kind, rule: r.rule, month: r.month, day: r.day,
        segment: r.segment, note: r.note, notify_days_before: r.notify_days_before, active: r.active, created_by: context.userId,
      }));
      if (rows.length) {
        const { error: iErr } = await db.from("commemorative_dates").insert(rows);
        if (iErr) throw new Error(iErr.message);
        added += rows.length;
      }
    }
    return { added };
  });

/** Ignora (ou volta a considerar) a ocorrência de um ano, sem apagar a data. */
export const dismissOccurrence = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { dateId: string; year: number; dismissed: boolean }) =>
    z.object({ dateId: z.string().uuid(), year: z.number().int().min(2000).max(2200), dismissed: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context);
    const { error } = await (context.supabase as any).from("commemorative_occurrences")
      .upsert({ date_id: data.dateId, year: data.year, dismissed: data.dismissed }, { onConflict: "date_id,year" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** "Virar post": cria o card no mês da data, já com título, prazo e briefing. */
export const turnDateIntoPost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { dateId: string; year: number; type?: "post" | "reel" | "story"; withAi?: boolean }) =>
    z.object({ dateId: z.string().uuid(), year: z.number().int().min(2000).max(2200), type: z.enum(["post", "reel", "story"]).optional(), withAi: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertCanEdit(context);
    const db: any = context.supabase;
    const { data: d } = await db.from("commemorative_dates").select("*").eq("id", data.dateId).eq("org_id", context.orgId).maybeSingle();
    if (!d) throw new Error("Data não encontrada.");
    const { data: prev } = await db.from("commemorative_occurrences").select("content_item_id").eq("date_id", d.id).eq("year", data.year).maybeSingle();
    if (prev?.content_item_id) throw new Error("Essa data já virou um post. Abra o card pelo calendário ou pelas demandas.");

    const date = occurrenceOn({ rule: d.rule, month: d.month, day: d.day }, data.year);
    // Prazo: 2 dias antes da data (mas nunca antes de hoje).
    const t = todayKey();
    const due = addDaysKey(date, -2) < t ? (date < t ? t : date) : addDaysKey(date, -2);
    const monthKey = date.slice(0, 7);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin: any = supabaseAdmin;
    let { data: month } = await admin.from("months").select("id").eq("client_id", d.client_id).eq("key", monthKey).maybeSingle();
    if (!month) {
      const { data: m, error: mErr } = await admin.from("months").insert({ client_id: d.client_id, key: monthKey, org_id: context.orgId }).select("id").single();
      if (mErr) throw new Error(mErr.message);
      month = m;
    }
    const type = data.type ?? "post";
    const { data: maxRow } = await admin.from("content_items").select("idx").eq("month_id", month.id).eq("type", type)
      .order("idx", { ascending: false }).limit(1).maybeSingle();

    let briefing = briefingForDate(d.title, date, d.note);
    let aiUsed = false;
    let aiError: string | null = null;
    if (data.withAi) {
      try {
        const text = await aiDateBriefing(context.orgId, d, date);
        if (text) { briefing = text; aiUsed = true; }
      } catch (e: any) {
        // Sem IA liberada (ou falha dela): o card sai com o briefing padrão.
        aiError = String(e?.message ?? "A IA não respondeu.");
      }
    }
    const { data: item, error } = await admin.from("content_items").insert({
      month_id: month.id, type, idx: (maxRow?.idx ?? 0) + 1, title: d.title, status: "PLANEJAMENTO",
      copy: briefing, due_date: due,
    }).select("id").single();
    if (error) throw new Error(error.message);
    await admin.from("item_assignees").insert({ item_id: item.id, user_id: context.userId }).then(() => {}, () => {});
    await admin.from("commemorative_occurrences").upsert({ date_id: d.id, year: data.year, content_item_id: item.id }, { onConflict: "date_id,year" });
    return { itemId: item.id as string, clientId: d.client_id as string, monthKey, dueDate: due, aiUsed, aiError };
  });

async function aiDateBriefing(orgId: string, d: any, dateKey: string): Promise<string | null> {
  const { resolveAi } = await import("./ai-access.server");
  const ai = await resolveAi(orgId, d.client_id);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: c } = await (supabaseAdmin as any).from("clients").select("name, niche, description, content_briefing").eq("id", d.client_id).maybeSingle();
  const { PLANNING_MODEL } = await import("./ai-client.server");
  const res = await ai.client.messages.create({
    model: PLANNING_MODEL, max_tokens: 700, thinking: { type: "disabled" },
    messages: [{ role: "user", content: [{ type: "text", text: [
      `Escreva o briefing de UM post de Instagram para a data "${d.title}" (${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}).`,
      `Marca: ${c?.name ?? ""}${c?.niche ? ` (${c.niche})` : ""}.`,
      c?.content_briefing ? `Briefing da marca:\n${String(c.content_briefing).slice(0, 2500)}` : "",
      d.note ? `Observação da equipe: ${d.note}` : "",
      "Entregue: 1) a ideia do post em 2 frases, 2) o texto da arte, 3) uma sugestão de legenda curta. Português do Brasil, natural, específico da marca, sem promessa de resultado. PROIBIDO usar o caractere travessão. Responda só com o briefing.",
    ].filter(Boolean).join("\n\n") }] }],
  } as any);
  const text = ((res as any).content.find((b: any) => b.type === "text")?.text ?? "").replace(/\s*—\s*/g, ", ").trim();
  return text ? `Data comemorativa: ${d.title} (${dateKey.slice(8, 10)}/${dateKey.slice(5, 7)}).\n\n${text}` : null;
}

const suggestionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  month: z.number().int().min(1).max(12).optional(),
  day: z.number().int().min(1).max(31).optional(),
  rule: z.enum(DATE_RULES).optional(),
  why: z.string().trim().max(200).optional(),
});
export type DateSuggestion = z.infer<typeof suggestionSchema>;

const SUGGEST_TOOL = {
  name: "report_dates",
  description: "Reporta as datas comemorativas relevantes.",
  input_schema: {
    type: "object" as const,
    properties: {
      datas: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const, description: "Nome da data, ex: Dia do Fisioterapeuta" },
            month: { type: "number" as const, description: "Mês (1 a 12). Omita se usar rule." },
            day: { type: "number" as const, description: "Dia do mês. Omita se usar rule." },
            rule: { type: "string" as const, enum: [...DATE_RULES], description: "Só para datas móveis conhecidas (Páscoa, Carnaval, Dia das Mães, Dia dos Pais, Black Friday, Cyber Monday)" },
            why: { type: "string" as const, description: "Por que importa pra esse ramo, em uma frase curta" },
          },
          required: ["title"],
        },
      },
    },
    required: ["datas"],
  },
};

/** IA sugere datas relevantes pro ramo da marca (a pessoa escolhe quais entram). */
export const suggestDatesForBusiness = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; business: string }) =>
    z.object({ clientId: z.string().uuid(), business: z.string().trim().min(3).max(200) }).parse(d))
  .handler(async ({ data, context }): Promise<DateSuggestion[]> => {
    await assertAdminOnly(context);
    const { resolveAi } = await import("./ai-access.server");
    const ai = await resolveAi(context.orgId, data.clientId);
    const { PLANNING_MODEL } = await import("./ai-client.server");
    const res = await ai.client.messages.create({
      model: PLANNING_MODEL, max_tokens: 3000, thinking: { type: "disabled" },
      tools: [SUGGEST_TOOL], tool_choice: { type: "tool", name: SUGGEST_TOOL.name },
      messages: [{ role: "user", content: [{ type: "text", text: [
        `Liste de 12 a 20 datas comemorativas e de conscientização que valem conteúdo para este negócio no Brasil: "${data.business}".`,
        "Inclua as datas do varejo/serviço que se aplicam (Dia das Mães, Natal, Black Friday etc.) e, principalmente, as específicas do ramo (dia da profissão, campanhas do setor, datas de categoria).",
        "Use SOMENTE datas que você tem certeza que existem e com o dia/mês corretos. Se não tiver certeza do dia, não inclua. Para Páscoa, Carnaval, Dia das Mães, Dia dos Pais, Black Friday e Cyber Monday use o campo rule.",
        "Não repita datas. Ordene da mais importante pra menos.",
      ].join("\n") }] }],
    } as any);
    const toolUse = [...(res as any).content].reverse().find((b: any) => b.type === "tool_use" && b.name === SUGGEST_TOOL.name);
    const raw = (toolUse?.input?.datas ?? []) as unknown[];
    return normalizeSuggestions(raw);
  });

function normalizeSuggestions(raw: unknown[]): DateSuggestion[] {
  const seen = new Set<string>();
  const out: DateSuggestion[] = [];
  for (const r of raw) {
    const p = suggestionSchema.safeParse(r);
    if (!p.success) continue;
    const s = p.data;
    if (!s.rule && (s.month == null || s.day == null)) continue;
    const key = s.title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...s, title: s.title.replace(/\s*—\s*/g, ", ") });
  }
  return out.slice(0, 40);
}

const MAX_FILES = 5;
/** IA lê um arquivo (planilha, PDF, imagem de calendário) e propõe as datas. */
export const extractDatesFromFiles = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string; files: { name: string; mimeType: string; base64: string }[] }) =>
    z.object({
      clientId: z.string().uuid(),
      files: z.array(z.object({ name: z.string().max(200), mimeType: z.string().max(100), base64: z.string().max(20_000_000) })).min(1).max(MAX_FILES),
    }).parse(d))
  .handler(async ({ data, context }): Promise<DateSuggestion[]> => {
    await assertAdminOnly(context);
    const { resolveAi } = await import("./ai-access.server");
    const ai = await resolveAi(context.orgId, data.clientId);
    const { PLANNING_MODEL } = await import("./ai-client.server");
    const blocks: any[] = [];
    let sheetText = "";
    for (const f of data.files) {
      const isSheet = /spreadsheet|csv|ms-excel/i.test(f.mimeType) || /\.(csv|xlsx?|xls)$/i.test(f.name);
      if (isSheet) {
        try {
          const XLSX = await import("xlsx");
          const wb = XLSX.read(Buffer.from(f.base64, "base64"), { type: "buffer" });
          sheetText += `\n\n--- Planilha: ${f.name} ---\n${XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]).slice(0, 20_000)}`;
        } catch { sheetText += `\n\n--- ${f.name}: não consegui ler como planilha ---`; }
      } else if (f.mimeType.startsWith("image/")) {
        blocks.push({ type: "text", text: `Arquivo: ${f.name}` });
        blocks.push({ type: "image", source: { type: "base64", media_type: f.mimeType, data: f.base64 } });
      } else if (f.mimeType === "application/pdf") {
        blocks.push({ type: "text", text: `Arquivo: ${f.name}` });
        blocks.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } });
      }
    }
    if (sheetText) blocks.push({ type: "text", text: `Conteúdo de planilhas:${sheetText}` });
    if (!blocks.length) throw new Error("Envie uma planilha, PDF ou imagem.");
    const res = await ai.client.messages.create({
      model: PLANNING_MODEL, max_tokens: 4000, thinking: { type: "disabled" },
      tools: [SUGGEST_TOOL], tool_choice: { type: "tool", name: SUGGEST_TOOL.name },
      messages: [{ role: "user", content: [
        { type: "text", text: "Leia o material abaixo (calendário, planilha ou lista) e extraia TODAS as datas comemorativas ou importantes que aparecem nele, com dia e mês. Use só o que está no material, sem inventar. Se uma data não tiver dia e mês claros, ignore. Se vier com ano, ignore o ano (a data se repete todo ano)." },
        ...blocks,
      ] }],
    } as any);
    const toolUse = [...(res as any).content].reverse().find((b: any) => b.type === "tool_use" && b.name === SUGGEST_TOOL.name);
    return normalizeSuggestions((toolUse?.input?.datas ?? []) as unknown[]);
  });

/** Datas ativas de um cliente que caem dentro de um mês (pro planejamento com IA). */
export async function datesInMonthForPlanning(supabase: any, clientId: string, monthKey: string): Promise<{ title: string; date: string; note: string | null }[]> {
  const { data } = await supabase.from("commemorative_dates").select("title, kind, rule, month, day, note").eq("client_id", clientId).eq("active", true);
  const year = Number(monthKey.slice(0, 4));
  return ((data ?? []) as any[])
    .map((r) => ({ title: r.title as string, date: occurrenceOn({ rule: r.rule, month: r.month, day: r.day }, year), note: (r.note ?? null) as string | null, kind: r.kind as string }))
    .filter((r) => r.date.startsWith(monthKey))
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ title, date, note }) => ({ title, date, note }));
}

