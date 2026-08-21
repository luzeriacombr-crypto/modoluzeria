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
  responsibleId: string | null;
  responsibleName: string | null;
  status: LeadStatus;
  archived: boolean;
  wonClientId: string | null;
  nextFollowupAt: string | null;
  followUpNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export const listLeads = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { includeArchived?: boolean }) => z.object({ includeArchived: z.boolean().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("leads")
      .select("id, name, contact_phone, contact_email, source, notes, value_estimate_cents, responsible_id, status, archived, won_client_id, next_followup_at, follow_up_note, created_at, updated_at, profiles(name)")
      .eq("org_id", context.orgId)
      .order("created_at", { ascending: false });
    if (!data.includeArchived) q = q.eq("archived", false);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      id: r.id, name: r.name, contactPhone: r.contact_phone, contactEmail: r.contact_email,
      source: r.source, notes: r.notes, valueEstimateCents: r.value_estimate_cents,
      responsibleId: r.responsible_id, responsibleName: r.profiles?.name ?? null,
      status: r.status, archived: r.archived, wonClientId: r.won_client_id,
      nextFollowupAt: r.next_followup_at, followUpNote: r.follow_up_note,
      createdAt: r.created_at, updatedAt: r.updated_at,
    })) as Lead[];
  });

export const upsertLead = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; name: string; contactPhone?: string | null; contactEmail?: string | null;
    source?: string | null; notes?: string | null; valueEstimateCents?: number | null;
    responsibleId?: string | null;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      name: z.string().trim().min(1).max(120),
      contactPhone: z.string().trim().max(40).nullable().optional(),
      contactEmail: z.string().trim().max(160).nullable().optional(),
      source: z.string().trim().max(80).nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      valueEstimateCents: z.number().int().min(0).nullable().optional(),
      responsibleId: z.string().uuid().nullable().optional(),
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
    if (data.responsibleId !== undefined) patch.responsible_id = data.responsibleId;
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
 * data escolhida (qualquer dia, não só hoje) junto com a nota. */
export const scheduleLeadFollowup = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string; followUpAt: string; note?: string | null }) =>
    z.object({ id: z.string().uuid(), followUpAt: z.string(), note: z.string().trim().max(500).nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leads")
      .update({ status: "followup", next_followup_at: data.followUpAt, follow_up_note: data.note ?? null, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Arrastar pro Perdido — só confirmação, sem motivo (mantido simples). */
export const markLeadLost = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("leads").update({ status: "perdido", archived: true, updated_at: new Date().toISOString() }).eq("id", data.id);
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

/** Arrastar pro Fechado abre o formulário de criar cliente — confirmar
 * aqui cria o cliente de verdade, reaproveitando a mesma lógica de
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
      .from("leads").update({ status: "fechado", won_client_id: client.id, archived: true, updated_at: new Date().toISOString() }).eq("id", data.id);
    if (updErr) throw new Error(updErr.message);
    return { clientId: client.id as string };
  });
