import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";

const MAX_REFERRAL_CREDIT = 3;
const REFERRED_VALIDATION_DAYS_ACTIVE = 60;

/** Verdadeiro se o e-mail já existe em QUALQUER conta do sistema — dono de
 * agência ou membro de qualquer agência. `profiles.email` é preenchido por
 * handle_new_user() em todo cadastro (senha ou Google), então cobre os dois
 * casos que o check antigo (email_role_assignments, só donos) não pegava.
 * Precisa do client de service-role: authenticated/anon não tem SELECT na
 * coluna email (REVOKE de 20260629025625), mas service_role ignora RLS.
 *
 * `excludeUserId` existe pro fluxo do Google: nesse caso o profile da PRÓPRIA
 * pessoa já existe (inativo, na org coringa da Luzeria — handle_new_user()
 * roda antes de completeGoogleSignup) — sem excluir esse id, todo cadastro
 * via Google acharia o próprio e-mail e bloquearia o bônus mesmo sendo a
 * primeira vez de verdade. */
export async function emailExistsAnywhere(supabaseAdmin: any, email: string, excludeUserId?: string): Promise<boolean> {
  let query = supabaseAdmin.from("profiles").select("id").ilike("email", email);
  if (excludeUserId) query = query.neq("id", excludeUserId);
  const { data } = await query.limit(1).maybeSingle();
  return !!data;
}

export const getMyReferralInfo = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Acesso negado.");

    // "as any": referral_code/referral_credit_balance e agency_referrals são
    // novos, os tipos do Supabase ainda não os conhecem até a migração
    // rodar e ser regenerada (mesmo padrão já usado no projeto).
    const db = context.supabase as any;
    const { data: org } = await db
      .from("orgs").select("referral_code, referral_credit_balance").eq("id", context.orgId).maybeSingle();

    const { data: referrals } = await db
      .from("agency_referrals")
      .select("id, status, created_at, validated_at, confirmed_at, orgs!agency_referrals_referred_org_id_fkey(name)")
      .eq("referrer_org_id", context.orgId)
      .order("created_at", { ascending: false });

    return {
      referralCode: (org as any)?.referral_code ?? null,
      referralLink: (org as any)?.referral_code ? `https://www.modocriador.com.br/r/${(org as any).referral_code}` : null,
      balance: (org as any)?.referral_credit_balance ?? 0,
      referrals: (referrals ?? []).map((r: any) => ({
        id: r.id,
        status: r.status as string,
        referredAgencyName: r.orgs?.name ?? "Agência",
        createdAt: r.created_at,
        validatedAt: r.validated_at,
        confirmedAt: r.confirmed_at,
      })),
    };
  });

export const setMyReferralCode = createServerFn({ method: "POST" })
  .middleware([requireActiveProfile])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().trim().toLowerCase().min(3).max(40) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
    if (!isMaster) throw new Error("Acesso negado.");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.code)) {
      throw new Error("Use apenas letras minúsculas, números e hífen.");
    }
    const { error } = await (context.supabase as any)
      .from("orgs").update({ referral_code: data.code }).eq("id", context.orgId);
    if (error) {
      if (error.message.includes("unique") || error.message.includes("duplicate")) {
        throw new Error("Esse código já está em uso por outra agência.");
      }
      throw new Error(error.message);
    }
    return { ok: true };
  });

/** Chamada pelo cron diário (api/cron/check-agency-referrals) — não é uma
 * createServerFn porque roda com a service-role, sem sessão de usuário. */
export async function runAgencyReferralChecks(): Promise<{ validated: number; expired: number; confirmed: number; pendingReactivation: number }> {
  const { supabaseAdmin: supabaseAdminTyped } = await import("@/integrations/supabase/client.server");
  // "as any": agency_referrals/referral_credit_ledger e as colunas novas de
  // orgs ainda não existem nos tipos gerados do Supabase até a migração
  // rodar (mesmo padrão já usado no projeto pra tabelas/colunas recém-criadas).
  const supabaseAdmin = supabaseAdminTyped as any;
  const { notifyOrgMasters } = await import("./promotion-affiliate.functions");

  let validated = 0, expired = 0, confirmed = 0, pendingReactivation = 0;

  async function confirmCredit(referral: { id: string; referrer_org_id: string }) {
    const { data: referrer } = await supabaseAdmin
      .from("orgs").select("referral_credit_balance").eq("id", referral.referrer_org_id).maybeSingle();
    const newBalance = Math.min((referrer?.referral_credit_balance ?? 0) + 1, MAX_REFERRAL_CREDIT);
    await supabaseAdmin.from("orgs").update({ referral_credit_balance: newBalance }).eq("id", referral.referrer_org_id);
    await supabaseAdmin.from("referral_credit_ledger").insert({
      org_id: referral.referrer_org_id, referral_id: referral.id,
      delta: 1, reason: "referral_confirmed", balance_after: newBalance,
    });
    await supabaseAdmin.from("agency_referrals")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() }).eq("id", referral.id);
    await notifyOrgMasters(
      referral.referrer_org_id,
      `Seu crédito de indicação foi confirmado! Você já tem ${newBalance} mês(es) grátis disponível(is).`,
      "referral_credit_confirmed",
    );
    confirmed++;
  }

  // --- pending_validation: precisa de 1 cliente + 1 funcionário (dono +
  // pelo menos mais 1 perfil ativo) dentro do trial do indicado.
  const { data: pending } = await supabaseAdmin
    .from("agency_referrals").select("id, referred_org_id").eq("status", "pending_validation");
  for (const r of pending ?? []) {
    const { data: referredOrg } = await supabaseAdmin
      .from("orgs").select("trial_ends_at").eq("id", r.referred_org_id).maybeSingle();
    const { count: clientCount } = await supabaseAdmin
      .from("clients").select("id", { count: "exact", head: true })
      .eq("org_id", r.referred_org_id).eq("archived", false).neq("category", "Ex-clientes");
    const { count: profileCount } = await supabaseAdmin
      .from("profiles").select("id", { count: "exact", head: true })
      .eq("org_id", r.referred_org_id).eq("active", true);
    if ((clientCount ?? 0) >= 1 && (profileCount ?? 0) >= 2) {
      await supabaseAdmin.from("agency_referrals")
        .update({ status: "validated", validated_at: new Date().toISOString() }).eq("id", r.id);
      validated++;
    } else if (referredOrg?.trial_ends_at && new Date(referredOrg.trial_ends_at) < new Date()) {
      await supabaseAdmin.from("agency_referrals").update({ status: "expired" }).eq("id", r.id);
      expired++;
    }
  }

  // --- validated: aguarda 60 dias como pagante ativo desde a primeira
  // cobrança confirmada, depois checa se o indicador está ativo pra creditar.
  const { data: waitingConfirmation } = await supabaseAdmin
    .from("agency_referrals").select("id, referrer_org_id, referred_org_id").eq("status", "validated");
  for (const r of waitingConfirmation ?? []) {
    const { data: referredOrg } = await supabaseAdmin
      .from("orgs").select("subscription_status, first_payment_confirmed_at").eq("id", r.referred_org_id).maybeSingle();
    if (!referredOrg?.first_payment_confirmed_at || referredOrg.subscription_status !== "active") continue;
    const activeSince = new Date(referredOrg.first_payment_confirmed_at);
    const daysActive = (Date.now() - activeSince.getTime()) / 86_400_000;
    if (daysActive < REFERRED_VALIDATION_DAYS_ACTIVE) continue;

    const { data: referrerOrg } = await supabaseAdmin
      .from("orgs").select("subscription_status").eq("id", r.referrer_org_id).maybeSingle();
    if (referrerOrg?.subscription_status === "active") {
      await confirmCredit(r);
    } else {
      await supabaseAdmin.from("agency_referrals").update({ status: "pending_reactivation" }).eq("id", r.id);
      pendingReactivation++;
    }
  }

  // --- pending_reactivation: só falta o indicador voltar a ficar ativo.
  const { data: waitingReactivation } = await supabaseAdmin
    .from("agency_referrals").select("id, referrer_org_id").eq("status", "pending_reactivation");
  for (const r of waitingReactivation ?? []) {
    const { data: referrerOrg } = await supabaseAdmin
      .from("orgs").select("subscription_status").eq("id", r.referrer_org_id).maybeSingle();
    if (referrerOrg?.subscription_status === "active") await confirmCredit(r);
  }

  return { validated, expired, confirmed, pendingReactivation };
}
