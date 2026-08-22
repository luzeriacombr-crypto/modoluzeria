import { createServerFn } from "@tanstack/react-start";
import { requireActiveProfile } from "./require-active";
import { z } from "zod";
import type { ContentItem, ContentType } from "./types";

export type Campaign = {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  createdAt: string;
  itemCount: number;
};

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { clientId: string }) => z.object({ clientId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("campaigns").select("id, client_id, name, description, created_at")
      .eq("client_id", data.clientId).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const campaignIds = (rows ?? []).map((c: any) => c.id);
    const countByCampaign = new Map<string, number>();
    if (campaignIds.length > 0) {
      const { data: items } = await context.supabase
        .from("content_items").select("campaign_id").in("campaign_id", campaignIds);
      (items ?? []).forEach((it: any) => countByCampaign.set(it.campaign_id, (countByCampaign.get(it.campaign_id) ?? 0) + 1));
    }
    return (rows ?? []).map((c: any) => ({
      id: c.id, clientId: c.client_id, name: c.name, description: c.description,
      createdAt: c.created_at, itemCount: countByCampaign.get(c.id) ?? 0,
    })) as Campaign[];
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id?: string; clientId: string; name: string; description?: string | null }) =>
    z.object({
      id: z.string().uuid().optional(),
      clientId: z.string().uuid(),
      name: z.string().trim().min(1).max(120),
      description: z.string().trim().max(1000).nullable().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    const db: any = context.supabase;
    if (data.id) {
      const { error } = await db.from("campaigns")
        .update({ name: data.name, description: data.description ?? null }).eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: created, error } = await db.from("campaigns")
      .insert({ client_id: data.clientId, org_id: context.orgId, name: data.name, description: data.description ?? null, created_by: context.userId })
      .select("id").single();
    if (error) throw new Error(error.message);
    return { id: created.id as string };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("Forbidden");
    // Itens perdem a etiqueta (ON DELETE SET NULL) mas continuam existindo
    // normalmente — deletar campanha nunca apaga conteúdo.
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
