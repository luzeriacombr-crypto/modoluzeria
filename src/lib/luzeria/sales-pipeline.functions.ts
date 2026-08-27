import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";

export const LEAD_STATUSES = ["novo", "responder", "followup", "fechado", "perdido"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

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
  status: LeadStatus;
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
      .select("id, name, contact_phone, contact_email, source, notes, value_estimate_cents, responsible_ids, product, status, archived, won_client_id, lost_reason, next_followup_at, follow_up_note, created_at, updated_at")
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
      status: r.status, archived: r.archived, wonClientId: r.won_client_id, lostReason: r.lost_reason,
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
    const { data: created, error } = await db.from("leads").insert({ org_id: context.orgId, status: "novo", ...patch }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Move o card entre as colunas "ativas" arrastando manualmente — não
 * mexe em archived/won_client_id (isso é papel de markLeadWon/Lost). */
export const moveLeadStatus = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; status: "novo" | "responder" | "followup" }) =>
    z.object({ id: z.string().uuid(), status: z.enum(["novo", "responder", "followup"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leads").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id);
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
  .inputValidator((d: { id: string; followUpAt: string; note?: string | null }) =>
    z.object({ id: z.string().uuid(), followUpAt: z.string(), note: z.string().trim().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leads")
      .update({
        status: "followup", next_followup_at: data.followUpAt, follow_up_note: data.note ?? null,
        archived: false, lost_reason: null, updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Arrastar pro Perdido — pede o motivo (opcional) antes de confirmar. */
export const markLeadLost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; reason?: string | null }) =>
    z.object({ id: z.string().uuid(), reason: z.string().trim().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leads").update({ status: "perdido", archived: true, lost_reason: data.reason || null, updated_at: new Date().toISOString() }).eq("id", data.id);
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
  .inputValidator((d: { id: string; clientName: string; category?: string; color?: string | null; icon?: string | null }) =>
    z.object({
      id: z.string().uuid(),
      clientName: z.string().trim().min(1).max(80),
      category: z.string().trim().max(40).optional(),
      color: z.string().trim().max(20).nullable().optional(),
      icon: z.string().trim().max(40).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: lead, error: leadErr } = await context.supabase
      .from("leads").select("id, won_client_id").eq("id", data.id).maybeSingle();
    if (leadErr || !lead) throw new Error("Lead não encontrado.");
    if (lead.won_client_id) throw new Error("Esse lead já virou cliente.");

    const { assertClientLimit, monthKey, seedMonth } = await import("./api.functions");
    await assertClientLimit(context.supabase, context.orgId);

    const insert: any = { name: data.clientName, org_id: context.orgId };
    if (data.category) insert.category = data.category;
    if (data.color) insert.color = data.color;
    if (data.icon !== undefined) insert.icon = data.icon;
    const { data: client, error: clientErr } = await context.supabase.from("clients").insert(insert).select().single();
    if (clientErr) throw new Error(clientErr.message);

    if ((data.category ?? "Social Media") !== "Avulsos") {
      await seedMonth(context.supabase, client.id, monthKey(new Date()));
    } else {
      await context.supabase.from("months").insert({ client_id: client.id, key: monthKey(new Date()), org_id: context.orgId });
    }

    const { error: updErr } = await context.supabase
      .from("leads").update({ status: "fechado", won_client_id: client.id, archived: true, lost_reason: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { clientId: client.id as string };
  });

/** Caminho "atribuir a um cliente já existente" do WonLeadModal — vincula
 * o lead a um cliente que já existe, sem criar nada novo. */
export const linkLeadToClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; clientId: string }) =>
    z.object({ id: z.string().uuid(), clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");

    const { data: lead, error: leadErr } = await context.supabase
      .from("leads").select("id, won_client_id").eq("id", data.id).maybeSingle();
    if (leadErr || !lead) throw new Error("Lead não encontrado.");
    if (lead.won_client_id) throw new Error("Esse lead já virou cliente.");

    const { data: client, error: clientErr } = await context.supabase
      .from("clients").select("id").eq("id", data.clientId).maybeSingle();
    if (clientErr || !client) throw new Error("Cliente não encontrado.");

    const { error: updErr } = await context.supabase
      .from("leads").update({ status: "fechado", won_client_id: data.clientId, archived: true, lost_reason: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { clientId: data.clientId };
  });

/** Caminho "não fazer nada" do WonLeadModal — só marca o lead como
 * fechado/ganho, sem criar nem vincular nenhum cliente. */
export const markLeadWonNoClient = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("leads").update({ status: "fechado", archived: true, lost_reason: null, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
