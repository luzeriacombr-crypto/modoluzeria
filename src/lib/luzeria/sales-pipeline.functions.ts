import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

/** Etapas com lógica de negócio própria — o resto ("Novos", "Responder
 * agora" hoje, ou qualquer outra a agência adicionar) não carrega nenhuma,
 * são só um degrau no funil. Renomear uma etapa nunca quebra o fluxo de
 * Ganho/Perdido/Follow-up porque o código nunca compara pelo nome, só
 * pelo `kind` — igual client_journey_stages.milestone_type. */
export const STAGE_KINDS = ["followup", "won", "lost"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export type SalesStage = {
  id: string;
  name: string;
  sortOrder: number;
  kind: StageKind | null;
};

/** Semeadas pra toda agência nova, mesmas 5 de sempre — editável depois
 * pela própria agência (adicionar, renomear, apagar). */
const DEFAULT_SALES_STAGES: { name: string; sortOrder: number; kind: StageKind | null }[] = [
  { name: "Novos", sortOrder: 0, kind: null },
  { name: "Responder agora", sortOrder: 1, kind: null },
  { name: "Follow-up", sortOrder: 2, kind: "followup" },
  { name: "Fechado", sortOrder: 3, kind: "won" },
  { name: "Perdido", sortOrder: 4, kind: "lost" },
];

/** Chamado na criação de uma agência nova (signup/reseller) — o seed do
 * migration só cobre as agências que já existiam quando ele rodou. */
export async function seedSalesStagesForOrg(supabase: any, orgId: string): Promise<void> {
  const rows = DEFAULT_SALES_STAGES.map((s) => ({
    org_id: orgId, name: s.name, sort_order: s.sortOrder, kind: s.kind,
  }));
  const { error } = await supabase.from("sales_stages").insert(rows);
  if (error) console.error("[seedSalesStagesForOrg] failed:", error.message);
}

export const listSalesStages = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("sales_stages")
      .select("id, name, sort_order, kind")
      .eq("org_id", context.orgId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return (data ?? []).map((s: any) => ({
      id: s.id, name: s.name, sortOrder: s.sort_order, kind: s.kind ?? null,
    })) as SalesStage[];
  });

export const upsertSalesStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; name: string; kind?: StageKind | null }) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(60),
      kind: z.enum(STAGE_KINDS).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("sales_stages")
        .update({ name: data.name, kind: data.kind ?? null })
        .eq("id", data.id).eq("org_id", context.orgId);
      if (error) throw new Error(error.message);
      return { ok: true };
    }
    const { data: existing } = await db.from("sales_stages")
      .select("sort_order").eq("org_id", context.orgId)
      .order("sort_order", { ascending: false }).limit(1).maybeSingle();
    const nextOrder = (existing?.sort_order ?? -1) + 1;
    const { error } = await db.from("sales_stages").insert({
      org_id: context.orgId, name: data.name, kind: data.kind ?? null, sort_order: nextOrder,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSalesStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { count, error: countErr } = await context.supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("org_id", context.orgId)
      .eq("stage_id", data.id);
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) {
      throw new Error(`Não é possível excluir: ${count} oportunidade${count === 1 ? "" : "s"} ainda ${count === 1 ? "está" : "estão"} nessa etapa. Mova ${count === 1 ? "ela" : "elas"} pra outra etapa antes.`);
    }
    const { error } = await context.supabase.from("sales_stages").delete().eq("id", data.id).eq("org_id", context.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

async function resolveStageKind(supabase: any, orgId: string, stageId: string): Promise<StageKind | null> {
  const { data, error } = await supabase
    .from("sales_stages").select("kind").eq("id", stageId).eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Etapa não encontrada.");
  return data.kind ?? null;
}

export type Lead = {
  id: string;
  name: string;
  contactPhone: string | null;
  contactEmail: string | null;
  source: string | null;
  notes: string | null;
  valueEstimateCents: number | null;
  responsibleIds: string[];
  responsibleNames: string[];
  product: string | null;
  stageId: string;
  archived: boolean;
  wonClientId: string | null;
  lostReason: string | null;
  nextFollowupAt: string | null;
  followUpNote: string | null;
  contactCount: number;
  firstContactAt: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type LeadContact = {
  id: string;
  contactedAt: string;
  note: string | null;
  byName: string | null;
};

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { includeArchived?: boolean }) => z.object({ includeArchived: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("leads")
      .select("id, name, contact_phone, contact_email, source, notes, value_estimate_cents, responsible_ids, product, stage_id, archived, won_client_id, lost_reason, next_followup_at, follow_up_note, created_at, updated_at")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false });
    if (!data.includeArchived) q = q.eq("archived", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const leadIds = (rows ?? []).map((r: any) => r.id);
    const countByLead = new Map<string, number>();
    const lastByLead = new Map<string, string>();
    const firstByLead = new Map<string, string>();
    if (leadIds.length > 0) {
      const { data: contacts } = await context.supabase
        .from("lead_contacts").select("lead_id, contacted_at").in("lead_id", leadIds);
      for (const c of contacts ?? []) {
        countByLead.set(c.lead_id, (countByLead.get(c.lead_id) ?? 0) + 1);
        const prevLast = lastByLead.get(c.lead_id);
        if (!prevLast || c.contacted_at > prevLast) lastByLead.set(c.lead_id, c.contacted_at);
        const prevFirst = firstByLead.get(c.lead_id);
        if (!prevFirst || c.contacted_at < prevFirst) firstByLead.set(c.lead_id, c.contacted_at);
      }
    }

    const profileIds = [...new Set((rows ?? []).flatMap((r: any) => r.responsible_ids ?? []))];
    const nameById = new Map<string, string>();
    if (profileIds.length > 0) {
      const { data: profs } = await context.supabase.from("profiles").select("id, name").in("id", profileIds);
      for (const p of profs ?? []) nameById.set(p.id, p.name);
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id, name: r.name, contactPhone: r.contact_phone, contactEmail: r.contact_email,
      source: r.source, notes: r.notes, valueEstimateCents: r.value_estimate_cents,
      responsibleIds: r.responsible_ids ?? [],
      responsibleNames: (r.responsible_ids ?? []).map((id: string) => nameById.get(id)).filter(Boolean),
      product: r.product,
      stageId: r.stage_id, archived: r.archived, wonClientId: r.won_client_id, lostReason: r.lost_reason,
      nextFollowupAt: r.next_followup_at, followUpNote: r.follow_up_note,
      contactCount: countByLead.get(r.id) ?? 0,
      firstContactAt: firstByLead.get(r.id) ?? null, lastContactAt: lastByLead.get(r.id) ?? null,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })) as Lead[];
  });

/** Registra "marquei contato" — cada clique vira uma linha no histórico,
 * pra contar quantos follow-ups já rolaram com esse lead e saber a data
 * do último de verdade (não confundir com updated_at, que muda em
 * qualquer edição). */
export const logLeadContact = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { leadId: string; note?: string | null }) =>
    z.object({ leadId: z.string().uuid(), note: z.string().trim().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("lead_contacts").insert({
      lead_id: data.leadId, org_id: context.orgId, created_by: context.userId, note: data.note ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listLeadContacts = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { leadId: string }) => z.object({ leadId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("lead_contacts")
      .select("id, contacted_at, note, profiles(name)")
      .eq("lead_id", data.leadId)
      .order("contacted_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, contactedAt: r.contacted_at, note: r.note, byName: r.profiles?.name ?? null,
    })) as LeadContact[];
  });

export const upsertLead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; name: string; contactPhone?: string | null; contactEmail?: string | null;
    source?: string | null; notes?: string | null; valueEstimateCents?: number | null;
    responsibleIds?: string[]; product?: string | null;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(120),
      contactPhone: z.string().trim().max(40).nullable().optional(),
      contactEmail: z.string().trim().max(160).nullable().optional(),
      source: z.string().trim().max(80).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      valueEstimateCents: z.number().int().min(0).nullable().optional(),
      responsibleIds: z.array(z.string().uuid()).optional(),
      product: z.string().trim().max(40).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const db: any = context.supabase;
    const patch: any = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.contactPhone !== undefined) patch.contact_phone = data.contactPhone;
    if (data.contactEmail !== undefined) patch.contact_email = data.contactEmail;
    if (data.source !== undefined) patch.source = data.source;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (data.valueEstimateCents !== undefined) patch.value_estimate_cents = data.valueEstimateCents;
    if (data.responsibleIds !== undefined) patch.responsible_ids = data.responsibleIds;
    if (data.product !== undefined) patch.product = data.product;
    if (data.id) {
      patch.updated_at = new Date().toISOString();
      const { error } = await db.from("leads").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    // Lead novo entra sempre na primeira etapa "normal" (sem kind) da
    // agência, na ordem configurada — não existe mais um "novo" fixo.
    const { data: firstStage, error: stageErr } = await db.from("sales_stages")
      .select("id").eq("org_id", context.orgId).is("kind", null)
      .order("sort_order").limit(1).maybeSingle();
    if (stageErr) throw new Error(stageErr.message);
    if (!firstStage) throw new Error("Nenhuma etapa inicial configurada — cadastre uma etapa em Vendas antes.");
    const { data: created, error } = await db.from("leads").insert({ org_id: context.orgId, stage_id: firstStage.id, ...patch }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Move o card entre etapas "normais" (kind nulo) arrastando manualmente —
 * etapas de follow-up/ganho/perdido têm suas próprias mutations, que pedem
 * data, criam cliente ou pedem motivo. */
export const moveLeadStage = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; stageId: string }) =>
    z.object({ id: z.string().uuid(), stageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const kind = await resolveStageKind(context.supabase, context.orgId, data.stageId);
    if (kind !== null) throw new Error("Essa etapa precisa de uma ação específica (agendar, marcar ganho ou perdido).");
    const { error } = await context.supabase
      .from("leads").update({ stage_id: data.stageId, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Arrastar pro Follow-up abre o calendário no front — isso aqui grava a
 * data escolhida (qualquer dia, não só hoje) junto com a nota. Também é o
 * caminho usado pra reabrir um lead "perdido" (o agendador continua
 * visível mesmo pra leads terminais) — por isso sempre desarquiva e
 * limpa o motivo de perda, mesmo quando o lead já estava ativo antes
 * (não tem efeito nesse caso). */
export const scheduleLeadFollowup = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; stageId: string; followUpAt: string; note?: string | null }) =>
    z.object({
      id: z.string().uuid(), stageId: z.string().uuid(), followUpAt: z.string(),
      note: z.string().trim().max(500).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const kind = await resolveStageKind(context.supabase, context.orgId, data.stageId);
    if (kind !== "followup") throw new Error("Essa etapa não é de follow-up.");
    const { error } = await context.supabase
      .from("leads")
      .update({
        stage_id: data.stageId, next_followup_at: data.followUpAt, follow_up_note: data.note ?? null,
        archived: false, lost_reason: null, updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Arrastar pro Perdido — pede o motivo (opcional) antes de confirmar. */
export const markLeadLost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; stageId: string; reason?: string | null }) =>
    z.object({ id: z.string().uuid(), stageId: z.string().uuid(), reason: z.string().trim().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const kind = await resolveStageKind(context.supabase, context.orgId, data.stageId);
    if (kind !== "lost") throw new Error("Essa etapa não é de perdido.");
    const { error } = await context.supabase
      .from("leads").update({ stage_id: data.stageId, archived: true, lost_reason: data.reason || null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteLead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase.from("leads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Arrastar pro Fechado pergunta o que fazer: criar cliente novo, vincular
 * a um já existente, ou não fazer nada — ver WonLeadModal. Esta função é
 * só o caminho "criar cliente novo": reaproveita a mesma lógica de
 * createClient (api.functions.ts): assertClientLimit, seedMonth pro
 * primeiro mês. Reaproveita essas funções (exportadas de lá
 * especialmente pra isso) em vez de chamar createClient diretamente —
 * não existe precedente no código de um createServerFn chamar outro
 * assim, e o contexto (org/permissão) já foi resolvido aqui pelo
 * próprio middleware. */
export const markLeadWon = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; stageId: string; clientName: string; category?: string; color?: string | null; icon?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      stageId: z.string().uuid(),
      clientName: z.string().trim().min(1).max(80),
      category: z.string().trim().max(40).optional(),
      color: z.string().trim().max(20).nullable().optional(),
      icon: z.string().trim().max(40).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const kind = await resolveStageKind(context.supabase, context.orgId, data.stageId);
    if (kind !== "won") throw new Error("Essa etapa não é de ganho.");

    const { data: lead, error: leadErr } = await context.supabase
      .from("leads").select("id, won_client_id").eq("id", data.id).maybeSingle();
    if (leadErr || !lead) throw new Error("Lead não encontrado.");
    if (lead.won_client_id) throw new Error("Esse lead já virou cliente.");

    const { assertClientLimit, monthKey, seedMonth, buscarModeloDeCliente, aplicarExtrasDoModelo } = await import("./api.functions");
    await assertClientLimit(context.supabase, context.orgId);

    const insert: any = { name: data.clientName, org_id: context.orgId };
    if (data.category) insert.category = data.category;
    if (data.color) insert.color = data.color;
    if (data.icon !== undefined) insert.icon = data.icon;
    const { data: client, error: clientErr } = await context.supabase.from("clients").insert(insert).select().single();
    if (clientErr) throw new Error(clientErr.message);

    // Lead que vira cliente entra igual a um cliente aberto na mão: se a
    // agência configurou modelo pra categoria, é ele que manda.
    const categoria = data.category ?? "Social Media";
    const key = monthKey(new Date());
    const modelo = await buscarModeloDeCliente(context.supabase, context.orgId, categoria);
    if (modelo) {
      await seedMonth(context.supabase, client.id, key, {
        postsCount: modelo.postsCount,
        reelsCount: modelo.reelsCount,
        assigneeId: modelo.defaultAssigneeId,
      });
      await aplicarExtrasDoModelo(context.supabase, {
        orgId: context.orgId, clientId: client.id, clientName: client.name,
        userId: context.userId, modelo,
      });
    } else if (categoria !== "Avulsos") {
      await seedMonth(context.supabase, client.id, key);
    } else {
      await context.supabase.from("months").insert({ client_id: client.id, key, org_id: context.orgId });
    }

    const { error: updErr } = await context.supabase
      .from("leads").update({ stage_id: data.stageId, won_client_id: client.id, archived: true, lost_reason: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { clientId: client.id as string };
  });

/** Caminho "atribuir a um cliente já existente" do WonLeadModal — vincula
 * o lead a um cliente que já existe, sem criar nada novo. */
export const linkLeadToClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; stageId: string; clientId: string }) =>
    z.object({ id: z.string().uuid(), stageId: z.string().uuid(), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const kind = await resolveStageKind(context.supabase, context.orgId, data.stageId);
    if (kind !== "won") throw new Error("Essa etapa não é de ganho.");

    const { data: lead, error: leadErr } = await context.supabase
      .from("leads").select("id, won_client_id").eq("id", data.id).maybeSingle();
    if (leadErr || !lead) throw new Error("Lead não encontrado.");
    if (lead.won_client_id) throw new Error("Esse lead já virou cliente.");

    const { data: client, error: clientErr } = await context.supabase
      .from("clients").select("id").eq("id", data.clientId).maybeSingle();
    if (clientErr || !client) throw new Error("Cliente não encontrado.");

    const { error: updErr } = await context.supabase
      .from("leads").update({ stage_id: data.stageId, won_client_id: data.clientId, archived: true, lost_reason: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { clientId: data.clientId };
  });

/** Caminho "não fazer nada" do WonLeadModal — só marca o lead como
 * fechado/ganho, sem criar nem vincular nenhum cliente. */
export const markLeadWonNoClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; stageId: string }) => z.object({ id: z.string().uuid(), stageId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const kind = await resolveStageKind(context.supabase, context.orgId, data.stageId);
    if (kind !== "won") throw new Error("Essa etapa não é de ganho.");
    const { error } = await context.supabase
      .from("leads").update({ stage_id: data.stageId, archived: true, lost_reason: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
