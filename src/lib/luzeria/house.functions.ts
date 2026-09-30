// House (Fase 1) — tudo que cria, converte ou configura uma conta House.
// Regras de UI (o que esconder, que palavra usar) ficam em house.ts; aqui
// só servidor. Três portas de entrada criam uma House, todas passando por
// provisionHouseOrg pra nascer igual:
//  - adminCreateHouse (painel da Luzeria): dono recebe e-mail "Criar minha senha"
//  - createHouseFromInvite (/house/criar, com código de uso único): dono
//    escolhe a senha na hora e já entra
//  - adminConvertToHouse: agência existente vira House sem apagar nada
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { HOUSE_APPROVAL_STATUS_LABEL, HOUSE_DEFAULT_GOALS } from "./house";

const APP_URL = process.env.VITE_APP_URL ?? "https://www.modocriador.com.br";
const HOUSE_TRIAL_DAYS = 7;
const HOUSE_PLAN_IDS = ["house", "house_ia"] as const;

async function assertPlatformAdmin(context: { supabase: any; userId: string; orgId: string }) {
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!isMaster) throw new Error("Forbidden");
}

async function assertMaster(context: { supabase: any; userId: string }) {
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!isMaster) throw new Error("Só o gestor (Adm Master) pode fazer isso.");
}

function slugify(name: string) {
  return name.trim().toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "house";
}

/** E-mail já usado como login (profiles) ou já pré-cadastrado numa conta
 * (email_role_assignments, chave primária — inserir de novo estoura). */
async function emailTaken(supabaseAdmin: any, email: string) {
  const { emailExistsAnywhere } = await import("./referrals.functions");
  if (await emailExistsAnywhere(supabaseAdmin, email)) return true;
  const { data } = await supabaseAdmin.from("email_role_assignments").select("email").eq("email", email).maybeSingle();
  return !!data;
}

/** "@Minha.Marca", "instagram.com/minha.marca/" → "minha.marca". */
function normalizeInstagramHandle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const h = raw.trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(h) ? h : null;
}

/** Código legível, sem caracteres ambíguos (0/O, 1/I/L). */
function generateInviteCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

/** Aplica o que faz uma org "ser" House, dado a org e a marca principal.
 * Idempotente — usado tanto na criação quanto na conversão. */
async function applyHouseSetup(supabaseAdmin: any, orgId: string, clientId: string) {
  const { error: orgErr } = await supabaseAdmin.from("orgs")
    .update({ account_type: "house", house_client_id: clientId }).eq("id", orgId);
  if (orgErr) throw new Error(orgErr.message);

  // Metas mínimas com valor padrão — o dono ajusta no onboarding.
  const { error: hsErr } = await supabaseAdmin.from("house_settings").upsert({
    org_id: orgId,
    stories_per_workday: HOUSE_DEFAULT_GOALS.storiesPerWorkday,
    feed_posts_per_week: HOUSE_DEFAULT_GOALS.feedPostsPerWeek,
    planning_deadline_day: HOUSE_DEFAULT_GOALS.planningDeadlineDay,
  }, { onConflict: "org_id", ignoreDuplicates: true });
  if (hsErr) throw new Error(hsErr.message);

  // "Revisão cliente" vira "Aprovação do gestor" — só se a org ainda não
  // renomeou esse status por conta própria.
  const { data: existing } = await supabaseAdmin.from("content_statuses")
    .select("id").eq("org_id", orgId).eq("key", "REVISAO_CLIENTE").maybeSingle();
  if (!existing) {
    const { data: maxRow } = await supabaseAdmin.from("content_statuses")
      .select("sort_order").eq("org_id", orgId).order("sort_order", { ascending: false }).limit(1).maybeSingle();
    await supabaseAdmin.from("content_statuses").insert({
      org_id: orgId, key: "REVISAO_CLIENTE", label: HOUSE_APPROVAL_STATUS_LABEL, sort_order: (maxRow?.sort_order ?? -1) + 1,
    });
  }

  // Playbook modelo global → cópia própria da House (só se ainda não tiver).
  const { error: pbErr } = await supabaseAdmin.rpc("copy_playbook_template", { _org_id: orgId });
  if (pbErr) console.error("Falha ao copiar o playbook modelo:", pbErr.message);
  // Base de conhecimento inicial (método da Luzeria, versão geral).
  const { error: kbErr } = await supabaseAdmin.rpc("copy_knowledge_template", { _org_id: orgId });
  if (kbErr) console.error("Falha ao copiar a base de conhecimento modelo:", kbErr.message);
}

/** Cria org + marca principal + configurações da House. Não cria usuário —
 * cada porta de entrada cuida do acesso do dono do seu jeito. Em caso de
 * erro no meio, apaga a org (e com ela, em cascata, o que já foi criado). */
async function provisionHouseOrg(supabaseAdmin: any, params: {
  companyName: string; planId: string; segment?: string | null; instagram?: string | null;
}): Promise<{ orgId: string; clientId: string }> {
  const { data: plan } = await supabaseAdmin.from("plans").select("*").eq("id", params.planId).maybeSingle();
  if (!plan || plan.account_type !== "house") throw new Error("Plano House inválido.");

  const trialEndsAt = new Date(Date.now() + HOUSE_TRIAL_DAYS * 86_400_000);
  const { data: org, error: orgErr } = await supabaseAdmin.from("orgs").insert({
    name: params.companyName.trim(),
    slug: `${slugify(params.companyName)}-${Date.now().toString(36)}`,
    plan_id: plan.id,
    subscription_status: "trialing",
    trial_ends_at: trialEndsAt.toISOString(),
    account_type: "house",
  }).select("id").single();
  if (orgErr) throw new Error(orgErr.message);

  try {
    const { seedJourneyStagesForOrg } = await import("./journey-stages.functions");
    await seedJourneyStagesForOrg(supabaseAdmin, org.id);
    const { seedSalesStagesForOrg } = await import("./sales-pipeline.functions");
    await seedSalesStagesForOrg(supabaseAdmin, org.id);
    const { seedCargosForOrg } = await import("./cargos.functions");
    await seedCargosForOrg(supabaseAdmin, org.id);

    const { data: client, error: clientErr } = await supabaseAdmin.from("clients").insert({
      org_id: org.id,
      name: params.companyName.trim(),
      category: "Social Media",
      niche: params.segment?.trim() || null,
      ai_planning_enabled: !!plan.features?.ai_planning,
    }).select("id").single();
    if (clientErr) throw new Error(clientErr.message);

    const { seedMonth, monthKey } = await import("./api.functions");
    await seedMonth(supabaseAdmin, client.id, monthKey(new Date()));

    const handle = normalizeInstagramHandle(params.instagram);
    if (handle) {
      await supabaseAdmin.from("client_links").insert({
        client_id: client.id, label: "Instagram", url: `https://instagram.com/${handle}`, position: 0,
      });
    }

    await applyHouseSetup(supabaseAdmin, org.id, client.id);
    return { orgId: org.id, clientId: client.id };
  } catch (e) {
    await supabaseAdmin.from("orgs").delete().eq("id", org.id);
    throw e;
  }
}

/* ============== Painel da Luzeria ============== */

export const adminCreateHouse = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { companyName: string; ownerName: string; ownerEmail: string; planId: string }) =>
    z.object({
      companyName: z.string().trim().min(2).max(80),
      ownerName: z.string().trim().min(2).max(80),
      ownerEmail: z.string().trim().toLowerCase().email(),
      planId: z.enum(HOUSE_PLAN_IDS),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (await emailTaken(supabaseAdmin, data.ownerEmail)) throw new Error("Já existe uma conta com esse e-mail.");

    const { orgId } = await provisionHouseOrg(supabaseAdmin, { companyName: data.companyName, planId: data.planId });
    try {
      const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
        email: data.ownerEmail, role: "master", name: data.ownerName, org_id: orgId,
      });
      if (earErr) throw new Error(earErr.message);

      // Mesmo fluxo da revenda: cria o usuário sem senha e manda um link
      // pra ele mesmo definir.
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "invite", email: data.ownerEmail, options: { data: { name: data.ownerName } },
      });
      if (linkErr || !linkData?.user) throw new Error(linkErr?.message ?? "Não foi possível criar o acesso do dono.");

      const actionLink = (linkData.properties as any)?.action_link as string | undefined;
      if (actionLink) {
        const { sendEmail } = await import("./resend.server");
        await sendEmail({
          to: data.ownerEmail,
          subject: `Sua House ${data.companyName} no Modo Criador está pronta`,
          html: `
            <p>Olá, ${escapeHtml(data.ownerName)}!</p>
            <p>A House da <strong>${escapeHtml(data.companyName)}</strong> foi criada no Modo Criador. Clique no link abaixo pra definir sua senha e fazer a configuração inicial (leva uns 2 minutos):</p>
            <p><a href="${actionLink}">Criar minha senha</a></p>
          `,
        }).catch((e) => console.error("Falha ao enviar convite da House:", e.message));
      }
    } catch (e) {
      await supabaseAdmin.from("email_role_assignments").delete().eq("email", data.ownerEmail).eq("org_id", orgId);
      await supabaseAdmin.from("orgs").delete().eq("id", orgId);
      throw e;
    }
    return { orgId };
  });

export const adminCreateHouseInvite = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { planId: string; note?: string }) =>
    z.object({ planId: z.enum(HOUSE_PLAN_IDS), note: z.string().trim().max(200).optional() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const code = generateInviteCode();
    const { data: row, error } = await (supabaseAdmin as any).from("house_invites").insert({
      code, plan_id: data.planId, note: data.note || null, created_by: context.userId,
    }).select("code, expires_at").single();
    if (error) throw new Error(error.message);
    return { code: row.code as string, expiresAt: row.expires_at as string, url: `${APP_URL}/house/criar?c=${row.code}` };
  });

export const adminListHouseInvites = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    await assertPlatformAdmin(context);
    const { data, error } = await (context.supabase as any).from("house_invites")
      .select("id, code, plan_id, note, created_at, expires_at, used_at, used_by_org_id, orgs:used_by_org_id(name)")
      .order("created_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return ((data ?? []) as any[]).map((r) => ({
      id: r.id as string,
      code: r.code as string,
      url: `${APP_URL}/house/criar?c=${r.code}`,
      planId: r.plan_id as string,
      note: (r.note ?? null) as string | null,
      createdAt: r.created_at as string,
      expiresAt: r.expires_at as string,
      usedAt: (r.used_at ?? null) as string | null,
      usedByOrgName: (r.orgs?.name ?? null) as string | null,
    }));
  });

/** Lista as marcas de uma agência qualquer — pro seletor de "marca
 * principal" do Converter em house. */
export const adminListOrgClients = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.from("clients")
      .select("id, name, category, archived").eq("org_id", data.orgId).order("name");
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[])
      .filter((c) => !c.archived && c.category !== "Ex-clientes")
      .map((c) => ({ id: c.id as string, name: c.name as string, category: c.category as string }));
  });

/** Agência existente vira House. Não apaga nada: clientes que não são a
 * marca principal continuam lá (e passam a contar como marca adicional na
 * cobrança), os módulos escondidos só somem da tela. */
export const adminConvertToHouse = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { orgId: string; clientId: string; planId: string }) =>
    z.object({ orgId: z.string().uuid(), clientId: z.string().uuid(), planId: z.enum(HOUSE_PLAN_IDS) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertPlatformAdmin(context);
    const { LUZERIA_ORG_ID, syncHouseSubscriptionValue } = await import("./api.functions");
    if (data.orgId === LUZERIA_ORG_ID) throw new Error("A Luzeria não pode virar House.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: client } = await supabaseAdmin.from("clients")
      .select("id, org_id").eq("id", data.clientId).maybeSingle();
    if (!client || client.org_id !== data.orgId) throw new Error("Essa marca não pertence a essa agência.");

    const { data: plan } = await supabaseAdmin.from("plans").select("features").eq("id", data.planId).maybeSingle();
    await applyHouseSetup(supabaseAdmin, data.orgId, data.clientId);
    const { error } = await supabaseAdmin.from("orgs").update({ plan_id: data.planId }).eq("id", data.orgId);
    if (error) throw new Error(error.message);
    if ((plan as any)?.features?.ai_planning) {
      await supabaseAdmin.from("clients").update({ ai_planning_enabled: true }).eq("id", data.clientId);
    }
    await syncHouseSubscriptionValue(data.orgId);
    return { ok: true };
  });

/* ============== /house/criar (público, com código) ============== */

async function findUsableInvite(supabaseAdmin: any, code: string) {
  const { data } = await supabaseAdmin.from("house_invites")
    .select("id, plan_id, expires_at, used_at").eq("code", code.trim().toUpperCase()).maybeSingle();
  if (!data || data.used_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as { id: string; plan_id: string };
}

export const getHouseInvite = createServerFn({ method: "GET" })
  .inputValidator((d: { code: string }) => z.object({ code: z.string().trim().min(4).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const invite = await findUsableInvite(supabaseAdmin, data.code);
    if (!invite) return { valid: false as const };
    const { data: plan } = await supabaseAdmin.from("plans").select("name").eq("id", invite.plan_id).maybeSingle();
    return { valid: true as const, planName: (plan as any)?.name ?? "House" };
  });

const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const createHouseFromInvite = createServerFn({ method: "POST" })
  .inputValidator((d: {
    code: string; companyName: string; segment?: string; instagram?: string;
    ownerName: string; email: string; password: string; logoDataUrl?: string | null; website?: string;
  }) =>
    z.object({
      code: z.string().trim().min(4).max(40),
      companyName: z.string().trim().min(2).max(80),
      segment: z.string().trim().max(80).optional(),
      instagram: z.string().trim().max(120).optional(),
      ownerName: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email(),
      password: z.string().min(8).max(72),
      logoDataUrl: z.string().max(3_000_000).nullable().optional(),
      website: z.string().max(0).optional().or(z.literal("")), // honeypot
    }).parse(d))
  .handler(async ({ data }) => {
    if (data.website) return { ok: true };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { checkSignupRateLimit } = await import("./signup-rate-limit.server");
    await checkSignupRateLimit(supabaseAdmin);

    if (await emailTaken(supabaseAdmin, data.email)) {
      throw new Error("Já existe uma conta com esse e-mail. Entre pela tela de login.");
    }

    // Reserva o código numa operação só (used_at ainda nulo + não vencido)
    // — dois envios ao mesmo tempo com o mesmo código não criam duas Houses.
    const code = data.code.trim().toUpperCase();
    const { data: claimed } = await (supabaseAdmin as any).from("house_invites")
      .update({ used_at: new Date().toISOString() })
      .eq("code", code).is("used_at", null).gt("expires_at", new Date().toISOString())
      .select("id, plan_id").maybeSingle();
    if (!claimed) throw new Error("Esse convite não é válido, já foi usado ou venceu. Peça um novo link pra Luzeria.");

    let orgId: string | null = null;
    let earInserted = false;
    try {
      const provisioned = await provisionHouseOrg(supabaseAdmin, {
        companyName: data.companyName, planId: claimed.plan_id, segment: data.segment, instagram: data.instagram,
      });
      orgId = provisioned.orgId;

      if (data.logoDataUrl) {
        const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/.exec(data.logoDataUrl);
        if (m) {
          const bytes = Buffer.from(m[3], "base64");
          if (bytes.length <= LOGO_MAX_BYTES) {
            const ext = m[2] === "jpeg" ? "jpg" : m[2];
            const path = `org-logos/${orgId}/logo-${Date.now()}.${ext}`;
            const { error: upErr } = await supabaseAdmin.storage.from("avatars").upload(path, bytes, { contentType: m[1], upsert: true });
            if (!upErr) {
              await supabaseAdmin.from("orgs").update({ logo_path: path }).eq("id", orgId);
              await supabaseAdmin.from("clients").update({ photo_url: path }).eq("id", provisioned.clientId);
            } else {
              console.error("Falha ao subir logo da House:", upErr.message);
            }
          }
        }
      }

      const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
        email: data.email, role: "master", name: data.ownerName, org_id: orgId,
      });
      if (earErr) throw new Error(earErr.message);
      earInserted = true;

      // O convite já é de uso único e veio da Luzeria — sem confirmação de
      // e-mail: a pessoa sai daqui e já entra.
      const { data: created, error: userErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email, password: data.password, email_confirm: true, user_metadata: { name: data.ownerName },
      });
      if (userErr || !created?.user) throw new Error(userErr?.message ?? "Não foi possível criar sua conta.");

      await (supabaseAdmin as any).from("house_invites").update({ used_by_org_id: orgId }).eq("id", claimed.id);

      try {
        const { sendEmail } = await import("./resend.server");
        await sendEmail({
          to: "junioreisfoto2@gmail.com",
          subject: `Nova House no Modo Criador — ${data.companyName}`,
          html: `<p><strong>House:</strong> ${escapeHtml(data.companyName)}</p><p><strong>Responsável:</strong> ${escapeHtml(data.ownerName)} (${escapeHtml(data.email)})</p>`,
        });
      } catch (e) {
        console.error("Falha ao avisar nova House:", e);
      }
      return { ok: true };
    } catch (e) {
      if (earInserted) await supabaseAdmin.from("email_role_assignments").delete().eq("email", data.email).eq("org_id", orgId!);
      if (orgId) await supabaseAdmin.from("orgs").delete().eq("id", orgId);
      // Devolve o código — a falha não foi culpa de quem estava usando.
      await (supabaseAdmin as any).from("house_invites").update({ used_at: null }).eq("id", claimed.id);
      throw e;
    }
  });

/* ============== Dentro da House ============== */

export type HouseSettings = {
  storiesPerWorkday: number;
  feedPostsPerWeek: number;
  planningDeadlineDay: number;
  onboardingCompletedAt: string | null;
};

export const getHouseSettings = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<HouseSettings | null> => {
    const { data, error } = await (context.supabase as any).from("house_settings")
      .select("stories_per_workday, feed_posts_per_week, planning_deadline_day, onboarding_completed_at")
      .eq("org_id", context.orgId).maybeSingle();
    if (error || !data) return null;
    return {
      storiesPerWorkday: data.stories_per_workday,
      feedPostsPerWeek: data.feed_posts_per_week,
      planningDeadlineDay: data.planning_deadline_day,
      onboardingCompletedAt: data.onboarding_completed_at ?? null,
    };
  });

export const updateHouseSettings = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { storiesPerWorkday?: number; feedPostsPerWeek?: number; planningDeadlineDay?: number; onboardingCompleted?: boolean }) =>
    z.object({
      storiesPerWorkday: z.number().int().min(0).max(50).optional(),
      feedPostsPerWeek: z.number().int().min(0).max(50).optional(),
      planningDeadlineDay: z.number().int().min(1).max(28).optional(),
      onboardingCompleted: z.boolean().optional(),
    }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const patch: Record<string, unknown> = { org_id: context.orgId, updated_at: new Date().toISOString() };
    if (data.storiesPerWorkday !== undefined) patch.stories_per_workday = data.storiesPerWorkday;
    if (data.feedPostsPerWeek !== undefined) patch.feed_posts_per_week = data.feedPostsPerWeek;
    if (data.planningDeadlineDay !== undefined) patch.planning_deadline_day = data.planningDeadlineDay;
    if (data.onboardingCompleted) patch.onboarding_completed_at = new Date().toISOString();
    const { error } = await (context.supabase as any).from("house_settings").upsert(patch, { onConflict: "org_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Onboarding da House: o dono convida a pessoa da equipe (papel Member),
 * que recebe um link pra criar a própria senha. */
export const inviteHouseMember = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { name: string; email: string }) =>
    z.object({ name: z.string().trim().min(2).max(80), email: z.string().trim().toLowerCase().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { assertCollaboratorLimit } = await import("./api.functions");
    await assertCollaboratorLimit(context.supabase, context.orgId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (await emailTaken(supabaseAdmin, data.email)) throw new Error("Esse e-mail já tem uma conta no Modo Criador.");

    const { data: org } = await supabaseAdmin.from("orgs").select("name").eq("id", context.orgId).maybeSingle();
    const { error: earErr } = await supabaseAdmin.from("email_role_assignments").insert({
      email: data.email, role: "member", name: data.name, org_id: context.orgId,
    });
    if (earErr) throw new Error(earErr.message);

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite", email: data.email, options: { data: { name: data.name } },
    });
    if (linkErr || !linkData?.user) {
      await supabaseAdmin.from("email_role_assignments").delete().eq("email", data.email).eq("org_id", context.orgId);
      throw new Error(linkErr?.message ?? "Não foi possível criar o acesso.");
    }
    const actionLink = (linkData.properties as any)?.action_link as string | undefined;
    const { data: inviter } = await supabaseAdmin.from("profiles").select("name").eq("id", context.userId).maybeSingle();
    if (actionLink) {
      const { sendEmail } = await import("./resend.server");
      await sendEmail({
        to: data.email,
        subject: `Você foi convidado(a) pra House ${(org as any)?.name ?? ""} no Modo Criador`,
        html: `
          <p>Olá, ${escapeHtml(data.name)}!</p>
          <p>${escapeHtml((inviter as any)?.name ?? "O gestor")} te convidou pra equipe da <strong>${escapeHtml((org as any)?.name ?? "House")}</strong> no Modo Criador. Clique no link abaixo pra criar sua senha e entrar:</p>
          <p><a href="${actionLink}">Criar minha senha</a></p>
        `,
      }).catch((e) => console.error("Falha ao enviar convite de membro da House:", e.message));
    }
    return { ok: true };
  });

export const approveItemInternal = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { itemId: string }) => z.object({ itemId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).rpc("approve_item_internal", { _item_id: data.itemId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Trava no servidor pros módulos que a House não tem (esconder só na tela
 * não impede uma chamada direta). Tolerante: sem a coluna ainda, é agência. */
export async function assertNotHouse(supabase: any, orgId: string, message: string) {
  const { data, error } = await supabase.from("orgs").select("account_type").eq("id", orgId).maybeSingle();
  if (!error && data?.account_type === "house") throw new Error(message);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
