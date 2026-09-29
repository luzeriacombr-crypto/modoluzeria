// Disparo em massa pelo WhatsApp oficial (aba "Mensagens" em Planos e
// Cobrança, platform-admin only). Usa os mesmos filtros/seleção de agências
// do painel, mas envia de verdade por um modelo aprovado na Meta, em vez de
// gerar links wa.me pra mandar um por um.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

async function assertPlatformAdmin(context: any) {
  if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!isMaster) throw new Error("Forbidden");
}

export type WhatsappTemplateOption = { name: string; category: string; body: string; variableCount: number };

export const getWhatsappSetup = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ configured: boolean; templates: WhatsappTemplateOption[]; error: string | null }> => {
    await assertPlatformAdmin(context);
    const wa = await import("./whatsapp.server");
    if (!wa.whatsappConfigured()) return { configured: false, templates: [], error: null };
    try {
      return { configured: true, templates: await wa.listApprovedTemplates(), error: null };
    } catch (e: any) {
      return { configured: true, templates: [], error: e?.message ?? String(e) };
    }
  });

export const sendWhatsappCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: { orgIds: string[]; templateName: string; extraParams: string[] }) =>
    z.object({
      orgIds: z.array(z.string().uuid()).min(1).max(500),
      templateName: z.string().min(1).max(512),
      extraParams: z.array(z.string().max(1000)).max(9),
    }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const wa = await import("./whatsapp.server");
    if (!wa.whatsappConfigured()) throw new Error("O WhatsApp ainda não está configurado.");

    const template = (await wa.listApprovedTemplates()).find((t) => t.name === data.templateName);
    if (!template) throw new Error("Esse modelo não está aprovado (ou não existe) no WhatsApp.");
    if (template.variableCount > 1 && data.extraParams.slice(0, template.variableCount - 1).some((p) => !p.trim())) {
      throw new Error("Preencha todos os campos do modelo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [{ data: orgs }, { data: masterRoles }, { data: profiles }, { data: optOuts }] = await Promise.all([
      db.from("orgs").select("id, name, whatsapp").in("id", data.orgIds),
      db.from("user_roles").select("user_id").eq("role", "master"),
      db.from("profiles").select("id, org_id, name, created_at").in("org_id", data.orgIds),
      db.from("whatsapp_opt_outs").select("phone_key"),
    ]);
    const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
    const ownerNameByOrg = new Map<string, string>();
    (profiles ?? [])
      .filter((p: any) => masterIds.has(p.id))
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((p: any) => { if (!ownerNameByOrg.has(p.org_id)) ownerNameByOrg.set(p.org_id, p.name); });
    const optedOut = new Set((optOuts ?? []).map((r: any) => r.phone_key));

    const { data: campaign, error: campErr } = await db.from("whatsapp_campaigns").insert({
      template_name: template.name,
      params: { extra: data.extraParams },
      total: data.orgIds.length,
      created_by: context.userId,
    }).select("id").single();
    if (campErr) throw new Error(campErr.message);

    const skipped: { orgId: string; orgName: string; reason: string }[] = [];
    const failed: { orgId: string; orgName: string; reason: string }[] = [];
    let sent = 0;

    const queue = [...(orgs ?? [])];
    // 8 envios em paralelo — bem abaixo do limite da Meta (80/s) e rápido o
    // bastante pra algumas centenas de agências caberem numa requisição só.
    async function worker() {
      for (let org = queue.shift(); org; org = queue.shift()) {
        if (!wa.toWaDigits(org.whatsapp)) { skipped.push({ orgId: org.id, orgName: org.name, reason: "sem WhatsApp" }); continue; }
        if (optedOut.has(wa.phoneKey(org.whatsapp))) { skipped.push({ orgId: org.id, orgName: org.name, reason: "pediu pra sair" }); continue; }
        const firstName = ownerNameByOrg.get(org.id)?.trim().split(" ")[0] || "tudo bem";
        const params = [firstName, ...data.extraParams].slice(0, template!.variableCount);
        const r = await wa.sendTemplate(org.whatsapp, template!.name, params, {
          kind: "campaign", orgId: org.id, campaignId: campaign.id,
        });
        if (r.ok) sent++;
        else failed.push({ orgId: org.id, orgName: org.name, reason: r.error });
      }
    }
    await Promise.all(Array.from({ length: 8 }, worker));

    await db.from("whatsapp_campaigns")
      .update({ sent, failed: failed.length, skipped: skipped.length })
      .eq("id", campaign.id);

    // Entra no mesmo histórico do painel ("msg. X atrás" em cada agência).
    const sentOrgIds = (orgs ?? [])
      .map((o: any) => o.id)
      .filter((id: string) => !skipped.some((s) => s.orgId === id) && !failed.some((f) => f.orgId === id));
    if (sentOrgIds.length > 0) {
      await db.from("agency_reengagement_messages").insert(sentOrgIds.map((orgId: string) => ({
        org_id: orgId, channel: "whatsapp", subject: `Modelo: ${template.name}`,
        body: template.body, sent_by: context.userId,
      })));
    }

    return { campaignId: campaign.id as string, sent, failed, skipped };
  });

/** Quantas mensagens da campanha já foram entregues/lidas (atualizado pelo webhook). */
export const getWhatsappCampaignStatus = createServerFn({ method: "GET" })
  .inputValidator((d: { campaignId: string }) => z.object({ campaignId: z.string().uuid() }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await (supabaseAdmin as any)
      .from("whatsapp_messages").select("status").eq("campaign_id", data.campaignId);
    const counts = { sent: 0, delivered: 0, read: 0, failed: 0 };
    (rows ?? []).forEach((r: any) => { if (r.status in counts) counts[r.status as keyof typeof counts]++; });
    return counts;
  });
