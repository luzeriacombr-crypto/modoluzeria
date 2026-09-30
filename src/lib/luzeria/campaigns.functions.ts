import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type { ContentItem, ContentType } from "./types";
import { upsertCampaignCalendarEvent, deleteCampaignCalendarEvent } from "./calendar.functions";

export type Campaign = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  /** Briefing completo do projeto — todas as informações, prazo, contexto. */
  briefing: string | null;
  /** O que vai ser produzido (ex.: "3 reels, 1 cobertura em stories"). */
  materials: string | null;
  /** O que vai ser prestado de serviço (ex.: "Cobertura em forma de entrevista"). */
  services: string | null;
  /** Valor cobrado pelo trabalho, em centavos — null quando ainda não definido. */
  valueCents: number | null;
  /** Link da pasta no Google Drive com os arquivos/materiais dessa campanha. */
  driveFolderUrl: string | null;
  /** Data em que o material vai ser gravado/captado — null quando ainda não definida. */
  captureDate: string | null;
  /** Item ligado à data de captação (aparece em Minhas Demandas) — null antes da 1ª data definida. */
  captureItemId: string | null;
  /** Quem está marcado como responsável pela captação (mesmas pessoas que recebem o evento na Google Agenda). */
  captureAssigneeIds: string[];
  createdAt: string;
  itemCount: number;
};

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("campaigns")
      .select("id, client_id, name, description, briefing, materials, services, value_cents, drive_folder_url, capture_date, capture_item_id, created_at")
      .eq("client_id", data.clientId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const campaignIds = (rows ?? []).map((c: any) => c.id);
    const countByCampaign = new Map<string, number>();
    if (campaignIds.length > 0) {
      const { data: items } = await context.supabase
        .from("content_items").select("campaign_id").in("campaign_id", campaignIds);
      (items ?? []).forEach((it: any) => countByCampaign.set(it.campaign_id, (countByCampaign.get(it.campaign_id) ?? 0) + 1));
    }
    const captureItemIds = (rows ?? []).map((c: any) => c.capture_item_id).filter(Boolean) as string[];
    const assigneesByItem = new Map<string, string[]>();
    if (captureItemIds.length > 0) {
      const { data: assignRows } = await context.supabase
        .from("item_assignees").select("item_id, user_id").in("item_id", captureItemIds);
      (assignRows ?? []).forEach((a: any) => {
        const list = assigneesByItem.get(a.item_id) ?? [];
        list.push(a.user_id);
        assigneesByItem.set(a.item_id, list);
      });
    }
    return (rows ?? []).map((c: any) => ({
      id: c.id, clientId: c.client_id, name: c.name, description: c.description,
      briefing: c.briefing, materials: c.materials, services: c.services, valueCents: c.value_cents,
      driveFolderUrl: c.drive_folder_url, captureDate: c.capture_date, captureItemId: c.capture_item_id,
      captureAssigneeIds: c.capture_item_id ? (assigneesByItem.get(c.capture_item_id) ?? []) : [],
      createdAt: c.created_at, itemCount: countByCampaign.get(c.id) ?? 0,
    })) as Campaign[];
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: {
    id?: string; clientId: string; name: string; description?: string | null;
    briefing?: string | null; materials?: string | null; services?: string | null; valueCents?: number | null;
    driveFolderUrl?: string | null;
  }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(1000).nullable().optional(),
      briefing: z.string().trim().max(5000).nullable().optional(),
      materials: z.string().trim().max(2000).nullable().optional(),
      services: z.string().trim().max(2000).nullable().optional(),
      valueCents: z.number().int().min(0).nullable().optional(),
      driveFolderUrl: z.string().trim().url().max(500).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    const patch = {
      name: data.name,
      description: data.description ?? null,
      briefing: data.briefing ?? null,
      materials: data.materials ?? null,
      services: data.services ?? null,
      value_cents: data.valueCents ?? null,
      drive_folder_url: data.driveFolderUrl ?? null,
    };
    if (data.id) {
      const { error } = await db.from("campaigns").update(patch).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await db.from("campaigns")
      .insert({ ...patch, client_id: data.clientId, org_id: context.orgId, created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

/** Define (ou limpa) a data de captação de uma campanha:
 * 1. Cria (1ª vez) ou atualiza o item "Gravação" ligado à campanha, que já
 *    aparece em Minhas Demandas dos responsáveis (due_date = data de
 *    captação).
 * 2. Sincroniza os responsáveis desse item com a lista marcada aqui.
 * 3. Pra cada responsável com Google Agenda conectada, cria/atualiza um
 *    evento de dia inteiro; quem sai da lista tem o evento apagado. Quem
 *    não conectou a agenda é ignorado silenciosamente (decisão do Junior).
 * Nunca apaga o item em si (mesmo limpando a data) — só zera due_date,
 * pra não perder um registro de conteúdo por engano. */
export const setCampaignCapture = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { campaignId: string; clientId: string; monthKey: string; date: string | null; assigneeIds: string[] }) =>
    z.object({
      campaignId: z.string().uuid(),
      clientId: z.string().uuid(),
      monthKey: z.string(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
      assigneeIds: z.array(z.string().uuid()).max(20),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    const { supabaseAdmin: supabaseAdminTyped } = await import("@/integrations/supabase/client.server");
    // campaign_calendar_events é nova demais pros tipos gerados do Supabase
    // — mesmo cast "as any" já usado em outras tabelas novas neste projeto.
    const supabaseAdmin: any = supabaseAdminTyped;

    const { data: campaign, error: campaignErr } = await db
      .from("campaigns").select("id, name, capture_item_id").eq("id", data.campaignId).single();
    if (campaignErr) throw new Error(campaignErr.message);

    let itemId: string | null = campaign.capture_item_id;

    if (data.date === null) {
      // Limpa a data: zera due_date do item (se existir) mas não apaga
      // nada — só o vínculo de agenda em si some, já que sem data não faz
      // sentido nenhum evento continuar marcado.
      if (itemId) {
        await db.from("content_items").update({ due_date: null }).eq("id", itemId);
      }
      await db.from("campaigns").update({ capture_date: null }).eq("id", data.campaignId);
      const { data: eventRows } = await supabaseAdmin
        .from("campaign_calendar_events").select("user_id, google_event_id").eq("campaign_id", data.campaignId);
      await Promise.all((eventRows ?? []).map(async (r: any) => {
        try { await deleteCampaignCalendarEvent(supabaseAdmin, r.user_id, r.google_event_id); }
        catch (err) { console.error("[campaign-capture] falha ao apagar evento ao limpar data", r.user_id, err); }
      }));
      await supabaseAdmin.from("campaign_calendar_events").delete().eq("campaign_id", data.campaignId);
    } else {
      if (!itemId) {
        // 1ª vez: cria o item de gravação ligado à campanha, seguindo o
        // mesmo padrão de month/idx que addContentItem usa.
        let { data: month } = await db
          .from("months").select("id").eq("client_id", data.clientId).eq("key", data.monthKey).maybeSingle();
        if (!month) {
          const { data: m, error } = await db
            .from("months").insert({ client_id: data.clientId, key: data.monthKey, org_id: context.orgId }).select("id").single();
          if (error) throw new Error(error.message);
          month = m;
        }
        const { data: maxRow } = await db
          .from("content_items").select("idx").eq("month_id", month.id).eq("type", "gravacao")
          .order("idx", { ascending: false }).limit(1).maybeSingle();
        const nextIdx = ((maxRow as any)?.idx ?? 0) + 1;
        const { data: created, error } = await db.from("content_items").insert({
          month_id: month.id, type: "gravacao", idx: nextIdx,
          title: `Gravação — ${campaign.name}`.slice(0, 200),
          status: "PENDENTE", due_date: data.date,
          campaign_id: data.campaignId, campaign_internal: true,
        }).select("id").single();
        if (error) throw new Error(error.message);
        itemId = created.id as string;
        await db.from("campaigns").update({ capture_item_id: itemId, capture_date: data.date }).eq("id", data.campaignId);
      } else {
        await db.from("content_items").update({ due_date: data.date }).eq("id", itemId);
        await db.from("campaigns").update({ capture_date: data.date }).eq("id", data.campaignId);
      }

      // Sincroniza responsáveis do item com a lista marcada aqui.
      const { data: currentAssignRows } = await db.from("item_assignees").select("user_id").eq("item_id", itemId);
      const currentAssignees = new Set<string>((currentAssignRows ?? []).map((r: any) => r.user_id as string));
      const wantedAssignees = new Set(data.assigneeIds);
      const toAdd = data.assigneeIds.filter((id) => !currentAssignees.has(id));
      const toRemove = [...currentAssignees].filter((id) => !wantedAssignees.has(id));
      if (toAdd.length > 0) {
        await db.from("item_assignees").insert(toAdd.map((user_id) => ({ item_id: itemId, user_id })));
      }
      if (toRemove.length > 0) {
        await db.from("item_assignees").delete().eq("item_id", itemId).in("user_id", toRemove);
      }

      // Google Agenda: melhor esforço, nunca derruba a resposta principal.
      const eventTitle = `Gravação — ${campaign.name}`.slice(0, 200);
      const { data: eventRows } = await supabaseAdmin
        .from("campaign_calendar_events").select("user_id, google_event_id").eq("campaign_id", data.campaignId);
      const eventByUser = new Map<string, string>((eventRows ?? []).map((r: any): [string, string] => [r.user_id, r.google_event_id]));
      await Promise.all([
        ...data.assigneeIds.map(async (userId) => {
          try {
            const newEventId = await upsertCampaignCalendarEvent(
              supabaseAdmin, userId, eventByUser.get(userId) ?? null, { title: eventTitle, date: data.date as string },
            );
            if (newEventId) {
              await supabaseAdmin.from("campaign_calendar_events")
                .upsert({ campaign_id: data.campaignId, user_id: userId, google_event_id: newEventId });
            }
          } catch (err) {
            console.error("[campaign-capture] falha ao sincronizar Google Agenda", userId, err);
          }
        }),
        ...toRemove.map(async (userId) => {
          const eventId = eventByUser.get(userId);
          if (!eventId) return;
          try {
            await deleteCampaignCalendarEvent(supabaseAdmin, userId, eventId);
          } catch (err) {
            console.error("[campaign-capture] falha ao apagar evento da Google Agenda", userId, err);
          }
          await supabaseAdmin.from("campaign_calendar_events").delete().eq("campaign_id", data.campaignId).eq("user_id", userId);
        }),
      ]);
    }

    return { ok: true, itemId };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    // Itens públicos perdem a etiqueta (ON DELETE SET NULL) mas continuam
    // existindo normalmente — deletar campanha nunca apaga conteúdo real.
    // Já os internos (campaign_internal) só existem como rascunho de
    // planejamento da própria campanha — sem ela, viram órfãos invisíveis
    // (não aparecem em Posts/Reels nem em Campanhas), então são apagados
    // junto.
    const { error: internalErr } = await context.supabase
      .from("content_items").delete().eq("campaign_id", data.id).eq("campaign_internal", true);
    if (internalErr) throw new Error(internalErr.message);
    const { error } = await context.supabase.from("campaigns").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCampaignItems = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { campaignId: string }) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("content_items")
      .select("id, type, idx, title, status, campaign_internal, updated_at, month_id")
      .eq("campaign_id", data.campaignId).order("idx");
    if (error) throw new Error(error.message);
    // Busca o mês de cada item numa consulta separada (não embutida) — um
    // embed teria virado INNER JOIN por content_items.month_id ser NOT
    // NULL, e se a RLS de "months" barrasse uma linha por qualquer motivo
    // o item inteiro sumiria do resultado, não só o campo do mês.
    const monthIds = [...new Set((rows ?? []).map((it: any) => it.month_id))];
    const monthKeyById = new Map<string, string>();
    if (monthIds.length > 0) {
      const { data: months } = await context.supabase.from("months").select("id, key").in("id", monthIds);
      (months ?? []).forEach((m: any) => monthKeyById.set(m.id, m.key));
    }
    return (rows ?? []).map((it: any) => ({
      id: it.id, type: it.type as ContentType, idx: it.idx, title: it.title,
      status: it.status, campaignInternal: it.campaign_internal, updatedAt: it.updated_at,
      monthKey: monthKeyById.get(it.month_id) ?? null,
    }));
  });

/** Marca/desmarca um item já existente (criado em Posts/Reels/Mais) como
 * parte de uma campanha, e/ou muda se ele é público ou interno. Também é
 * usado por addContentItem pra já nascer dentro de uma campanha. */
export const setItemCampaign = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string; campaignId: string | null; campaignInternal?: boolean }) =>
    z.object({
      itemId: z.string().uuid(),
      campaignId: z.string().uuid().nullable(),
      campaignInternal: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const patch: any = { campaign_id: data.campaignId };
    if (data.campaignId === null) patch.campaign_internal = false;
    else if (data.campaignInternal !== undefined) patch.campaign_internal = data.campaignInternal;
    const { error } = await context.supabase.from("content_items").update(patch).eq("id", data.itemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
