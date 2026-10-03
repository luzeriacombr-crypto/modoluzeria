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

/** Quantos dias uma agência fica "protegida" depois de receber uma campanha
 * no WhatsApp — mandar de novo antes disso é o que mais gera bloqueio/
 * denúncia e derruba a nota de qualidade do número. */
const CAMPAIGN_COOLDOWN_DAYS = 3;

export type WhatsappHealth = { quality: "GREEN" | "YELLOW" | "RED" | "UNKNOWN"; limitTier: string | null };

export const getWhatsappSetup = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ configured: boolean; templates: WhatsappTemplateOption[]; health: WhatsappHealth | null; error: string | null }> => {
    await assertPlatformAdmin(context);
    const wa = await import("./whatsapp.server");
    if (!wa.whatsappConfigured()) return { configured: false, templates: [], health: null, error: null };
    const health = await wa.getPhoneHealth().catch(() => null);
    try {
      return { configured: true, templates: await wa.listApprovedTemplates(), health, error: null };
    } catch (e: any) {
      return { configured: true, templates: [], health, error: e?.message ?? String(e) };
    }
  });

async function recentlyMessagedOrgIds(db: any, orgIds: string[]): Promise<Set<string>> {
  const since = new Date(Date.now() - CAMPAIGN_COOLDOWN_DAYS * 86_400_000).toISOString();
  const { data } = await db
    .from("whatsapp_messages").select("org_id")
    .eq("kind", "campaign").neq("status", "failed").gte("created_at", since)
    .in("org_id", orgIds);
  return new Set((data ?? []).map((r: any) => r.org_id as string));
}

/** Quais das agências selecionadas já receberam campanha no WhatsApp nos
 * últimos dias — o painel avisa antes de disparar. */
export const getRecentWhatsappRecipients = createServerFn({ method: "POST" })
  .inputValidator((d: { orgIds: string[] }) => z.object({ orgIds: z.array(z.string().uuid()).max(500) }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    if (data.orgIds.length === 0) return { orgIds: [] as string[], days: CAMPAIGN_COOLDOWN_DAYS };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recent = await recentlyMessagedOrgIds(supabaseAdmin, data.orgIds);
    return { orgIds: Array.from(recent), days: CAMPAIGN_COOLDOWN_DAYS };
  });

export const sendWhatsappCampaign = createServerFn({ method: "POST" })
  .inputValidator((d: { orgIds: string[]; templateName: string; extraParams: string[]; ignoreCooldown?: boolean }) =>
    z.object({
      orgIds: z.array(z.string().uuid()).min(1).max(500),
      templateName: z.string().min(1).max(512),
      extraParams: z.array(z.string().max(1000)).max(9),
      ignoreCooldown: z.boolean().optional(),
    }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const wa = await import("./whatsapp.server");
    if (!wa.whatsappConfigured()) throw new Error("O WhatsApp ainda não está configurado.");
    // Nota vermelha = a Meta está a um passo de limitar/suspender o número.
    // Disparo em massa aqui só piora — bloqueia até a nota melhorar.
    const health = await wa.getPhoneHealth().catch(() => null);
    if (health?.quality === "RED") {
      throw new Error("A nota de qualidade do número está vermelha. Segure os disparos por alguns dias até ela melhorar.");
    }

    const template = (await wa.listApprovedTemplates()).find((t) => t.name === data.templateName);
    if (!template) throw new Error("Esse modelo não está aprovado (ou não existe) no WhatsApp.");
    if (template.variableCount > 1 && data.extraParams.slice(0, template.variableCount - 1).some((p) => !p.trim())) {
      throw new Error("Preencha todos os campos do modelo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [{ data: orgs }, { data: masterRoles }, { data: profiles }, { data: optOuts }, { data: clientRows }] = await Promise.all([
      db.from("orgs").select("id, name, whatsapp").in("id", data.orgIds),
      db.from("user_roles").select("user_id").eq("role", "master"),
      db.from("profiles").select("id, org_id, name, created_at").in("org_id", data.orgIds),
      db.from("whatsapp_opt_outs").select("phone_key"),
      db.from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes").in("org_id", data.orgIds),
    ]);
    const clientsByOrg = new Map<string, number>();
    (clientRows ?? []).forEach((c: any) => clientsByOrg.set(c.org_id, (clientsByOrg.get(c.org_id) ?? 0) + 1));
    const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
    const ownerNameByOrg = new Map<string, string>();
    (profiles ?? [])
      .filter((p: any) => masterIds.has(p.id))
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((p: any) => { if (!ownerNameByOrg.has(p.org_id)) ownerNameByOrg.set(p.org_id, p.name); });
    const optedOut = new Set((optOuts ?? []).map((r: any) => r.phone_key));
    const recent = data.ignoreCooldown ? new Set<string>() : await recentlyMessagedOrgIds(db, data.orgIds);
    // Modelos de ativação (com botões): quem tocou em "Já fiz/Ajuda/Agora não" fica de fora.
    const activationKey = wa.activationKeyForTemplate(template.name);
    const paused = activationKey ? await wa.pausedOrgIds(activationKey, data.orgIds) : new Set<string>();

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
        if (paused.has(org.id)) { skipped.push({ orgId: org.id, orgName: org.name, reason: "pediu pausa nessa campanha" }); continue; }
        if (recent.has(org.id)) { skipped.push({ orgId: org.id, orgName: org.name, reason: `recebeu nos últimos ${CAMPAIGN_COOLDOWN_DAYS} dias` }); continue; }
        const firstName = ownerNameByOrg.get(org.id)?.trim().split(" ")[0] || "tudo bem";
        // "{clientes}" vira "2 clientes" por agência (usado pelo modelo ativacao_poucos_clientes).
        const n = clientsByOrg.get(org.id) ?? 0;
        const extras = data.extraParams.map((p) => p.replaceAll("{clientes}", `${n} cliente${n === 1 ? "" : "s"}`));
        const params = [firstName, ...extras].slice(0, template!.variableCount);
        const r = await wa.sendTemplate(org.whatsapp, template!.name, params, {
          kind: "campaign", orgId: org.id, campaignId: campaign.id,
          ...(activationKey && { buttonPayloads: wa.activationButtonPayloads(activationKey, org.id) }),
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

/** Chaves liga/desliga das mensagens automáticas (ver whatsapp.server.ts):
 * "welcome" = boas-vindas no cadastro; "support" = alerta de suporte no
 * WhatsApp do Junior + cópia da resposta na agência; "activation" = mensagens
 * de ativação 48h depois do cadastro (sem clientes / poucos / equipe). */
const SETTING_BY_NAME = async () => {
  const wa = await import("./whatsapp.server");
  return { welcome: wa.WELCOME_SETTING_KEY, support: wa.AUTO_SETTING_KEY, activation: wa.ACTIVATION_SETTING_KEY } as const;
};

export const getWhatsappAutoSettings = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const keys = await SETTING_BY_NAME();
    const { data } = await (supabaseAdmin as any).from("app_settings").select("key, value").in("key", Object.values(keys));
    const on = (k: string) => (data ?? []).find((r: any) => r.key === k)?.value?.enabled === true;
    return { welcome: on(keys.welcome), support: on(keys.support), activation: on(keys.activation) };
  });

export const setWhatsappAutoSetting = createServerFn({ method: "POST" })
  .inputValidator((d: { which: "welcome" | "support" | "activation"; enabled: boolean }) =>
    z.object({ which: z.enum(["welcome", "support", "activation"]), enabled: z.boolean() }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const keys = await SETTING_BY_NAME();
    const key = keys[data.which];
    const db = supabaseAdmin as any;
    // Guarda desde quando está ligado — o painel de agências usa isso pra
    // marcar "não recebeu" só em quem se cadastrou depois.
    const { data: prev } = await db.from("app_settings").select("value").eq("key", key).maybeSingle();
    const since = data.enabled ? ((prev?.value as any)?.since ?? new Date().toISOString()) : (prev?.value as any)?.since ?? null;
    const { error } = await db.from("app_settings").upsert({
      key, value: { enabled: data.enabled, since }, updated_at: new Date().toISOString(), updated_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { which: data.which, enabled: data.enabled };
  });

export type WelcomeStatus = { status: "sent" | "delivered" | "read" | "failed"; at: string; error: string | null };

/** Último envio de boas-vindas por agência (pro painel de Agências). `since`
 * = quando a boas-vindas foi ligada: cadastro depois disso sem registro =
 * "não recebeu". */
export const getWhatsappWelcomeStatuses = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<{ since: string; byOrg: Record<string, WelcomeStatus> }> => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const wa = await import("./whatsapp.server");
    const [{ data: rows }, { data: setting }] = await Promise.all([
      db.from("whatsapp_messages").select("org_id, status, error, created_at")
        .eq("kind", "welcome").eq("direction", "out").not("org_id", "is", null).order("created_at", { ascending: false }).limit(2000),
      db.from("app_settings").select("value, updated_at").eq("key", wa.WELCOME_SETTING_KEY).maybeSingle(),
    ]);
    const byOrg: Record<string, WelcomeStatus> = {};
    // Mais recente primeiro; uma tentativa que entregou vale mais que uma que falhou antes.
    (rows ?? []).forEach((r: any) => { if (!byOrg[r.org_id]) byOrg[r.org_id] = { status: r.status, at: r.created_at, error: r.error }; });
    // Sem `since` gravado (chave ligada antes desse campo existir), vale o
    // horário da última mudança da chave — e nunca a meia-noite, que marcaria
    // como "não enviada" quem se cadastrou antes de a boas-vindas ser ligada.
    return { since: (setting?.value as any)?.since ?? setting?.updated_at ?? new Date().toISOString(), byOrg };
  });

/** Reenvia a boas-vindas pra uma agência (ação manual do Junior — ignora a chave). */
export const resendWhatsappWelcome = createServerFn({ method: "POST" })
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const wa = await import("./whatsapp.server");
    if (!wa.whatsappConfigured()) throw new Error("O WhatsApp ainda não está configurado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const { data: org } = await db.from("orgs").select("id, name, whatsapp").eq("id", data.orgId).maybeSingle();
    if (!org?.whatsapp) throw new Error("Essa agência não tem WhatsApp cadastrado.");
    if (await wa.isOptedOut(org.whatsapp)) throw new Error("Essa agência pediu pra não receber mais mensagens (respondeu SAIR).");
    const [{ data: roles }, { data: profiles }] = await Promise.all([
      db.from("user_roles").select("user_id").eq("role", "master"),
      db.from("profiles").select("id, name, created_at").eq("org_id", org.id),
    ]);
    const masters = new Set((roles ?? []).map((r: any) => r.user_id));
    const owner = (profiles ?? []).filter((p: any) => masters.has(p.id)).sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))[0];
    const firstName = owner?.name?.trim().split(" ")[0] || "tudo bem";
    const r = await wa.sendTemplate(org.whatsapp, wa.WA_TEMPLATES.welcome, [firstName, org.name], { kind: "welcome", orgId: org.id });
    if (!r.ok) throw new Error(r.error);
    return { ok: true };
  });
