// Três réguas rodando 1x/dia via cron (api.cron.activation-nudges):
//
// 1. runClientActivationNudges — nos dias 2 e 4 desde o cadastro, se a
//    agência ainda não tiver nenhum cliente, avisa (notificação in-app +
//    e-mail). Só sobre "cliente" — não é mais o checklist diário genérico
//    de cliente/Drive/Instagram que existia antes (client_nudge_day2_sent_at/
//    client_nudge_day4_sent_at, cada marco dispara só uma vez).
//
// 2. runInactivityDeactivation — avisa 5 e 2 dias antes do fim do teste
//    (trial_ends_at, que já reflete qualquer extensão manual dada via
//    "Dar mais 30 dias de teste") se ainda faltar cliente cadastrado E/OU
//    Google Drive conectado — Instagram não entra aqui, nem toda agência
//    usa. Se o teste terminar sem isso, desativa (profiles.active = false
//    pra todo mundo da org — mesmo mecanismo que já barra cadastro
//    pendente de aprovação, reversível, nunca apaga dado).
//
// 3. runPaymentGraceEnforcement — a régua de cobrança (mockup aprovado em
//    claude.ai/artifact/6zLgdSd2nA9qstYDeBZKiD). Cobre o caso oposto: a
//    agência COMPLETOU o onboarding (tem cliente + Drive, passou pela régua
//    acima), mas o teste terminou sem nenhuma assinatura real, ou uma
//    fatura venceu. Dá 7 dias de tolerância (orgs.payment_grace_started_at)
//    — durante esse tempo o app mostra o popup/faixinha de cobrança
//    (frontend, via getOrgPlanStatus) — e só desativa depois de esgotado.
import type { ActivationChecklistItem } from "./activation-nudge-email.server";

export async function runClientActivationNudges(): Promise<{ sent: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  const now = new Date();
  const daysSince = (iso: string) => (now.getTime() - new Date(iso).getTime()) / 86_400_000;

  const { data: orgs, error } = await (supabaseAdmin as any)
    .from("orgs")
    .select("id, name, is_reseller, reseller_org_id, created_at, client_nudge_day2_sent_at, client_nudge_day4_sent_at")
    .neq("id", LUZERIA_ORG_ID);
  if (error) throw new Error(error.message);

  const organic = (orgs ?? []).filter((o: any) => !o.is_reseller && !o.reseller_org_id);
  if (organic.length === 0) return { sent: 0, errors: 0 };

  const orgIds = organic.map((o: any) => o.id);
  const { data: clientRows } = await supabaseAdmin
    .from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes").in("org_id", orgIds);
  const orgsWithClient = new Set((clientRows ?? []).map((c: any) => c.org_id as string));

  const toNudge: { org: any; milestone: "day2" | "day4" }[] = [];
  for (const org of organic) {
    if (orgsWithClient.has(org.id)) continue;
    const days = daysSince(org.created_at);
    if (!org.client_nudge_day2_sent_at && days >= 2) toNudge.push({ org, milestone: "day2" });
    else if (!org.client_nudge_day4_sent_at && days >= 4) toNudge.push({ org, milestone: "day4" });
  }
  if (toNudge.length === 0) return { sent: 0, errors: 0 };

  const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
  const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("id, org_id, name, email, created_at")
    .in("org_id", toNudge.map((t) => t.org.id));
  const ownerByOrg = new Map<string, { id: string; name: string; email: string }>();
  (profiles ?? [])
    .filter((p: any) => masterIds.has(p.id))
    .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
    .forEach((p: any) => {
      if (!ownerByOrg.has(p.org_id)) ownerByOrg.set(p.org_id, { id: p.id, name: p.name, email: p.email });
    });

  const { sendEmail } = await import("./resend.server");
  const { buildActivationNudgeEmailHtml } = await import("./activation-nudge-email.server");

  let sent = 0;
  let errors = 0;
  for (const { org, milestone } of toNudge) {
    const owner = ownerByOrg.get(org.id);
    if (!owner) continue;
    try {
      await (supabaseAdmin as any).from("notifications").insert({
        user_id: owner.id,
        type: "activation_no_client",
        message: "Você ainda não cadastrou nenhum cliente no Modo Criador. Bora começar?",
      });
      if (owner.email) {
        await sendEmail({
          to: owner.email,
          subject: `${owner.name.split(" ")[0]}, já cadastrou algum cliente?`,
          html: buildActivationNudgeEmailHtml({ name: owner.name, missing: ["client"] }),
        });
      }
      const column = milestone === "day2" ? "client_nudge_day2_sent_at" : "client_nudge_day4_sent_at";
      await (supabaseAdmin as any).from("orgs").update({ [column]: now.toISOString() }).eq("id", org.id);
      sent++;
    } catch (e) {
      console.error(`Falha ao enviar nudge de cliente (${milestone}) pra org ${org.id}:`, e);
      errors++;
    }
  }
  return { sent, errors };
}

export async function runInactivityDeactivation(): Promise<{ warned5d: number; warned2d: number; deactivated: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  const now = new Date();

  const { data: orgs, error } = await (supabaseAdmin as any)
    .from("orgs")
    .select("id, name, is_reseller, reseller_org_id, subscription_status, trial_ends_at, deactivated_for_inactivity, inactivity_warning_5d_sent_at, inactivity_warning_2d_sent_at")
    .eq("subscription_status", "trialing")
    .eq("deactivated_for_inactivity", false)
    .not("trial_ends_at", "is", null)
    .neq("id", LUZERIA_ORG_ID);
  if (error) throw new Error(error.message);

  const eligible = (orgs ?? []).filter((o: any) => !o.is_reseller && !o.reseller_org_id);
  if (eligible.length === 0) return { warned5d: 0, warned2d: 0, deactivated: 0, errors: 0 };

  const orgIds = eligible.map((o: any) => o.id);
  const { data: clientRows } = await supabaseAdmin
    .from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes").in("org_id", orgIds);
  const orgsWithClient = new Set((clientRows ?? []).map((c: any) => c.org_id as string));
  const { data: driveRows } = await supabaseAdmin.from("org_google_credentials").select("org_id").in("org_id", orgIds);
  const orgsWithDrive = new Set((driveRows ?? []).map((r: any) => r.org_id as string));

  const missingFor = (orgId: string): ActivationChecklistItem[] => {
    const missing: ActivationChecklistItem[] = [];
    if (!orgsWithClient.has(orgId)) missing.push("client");
    if (!orgsWithDrive.has(orgId)) missing.push("drive");
    return missing;
  };

  const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
  const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("id, org_id, name, email, created_at").in("org_id", orgIds);
  const ownerByOrg = new Map<string, { name: string; email: string }>();
  (profiles ?? [])
    .filter((p: any) => masterIds.has(p.id))
    .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
    .forEach((p: any) => {
      if (!ownerByOrg.has(p.org_id)) ownerByOrg.set(p.org_id, { name: p.name, email: p.email });
    });

  const { sendEmail } = await import("./resend.server");
  const { buildInactivityEmailHtml } = await import("./inactivity-email.server");

  let warned5d = 0, warned2d = 0, deactivated = 0, errors = 0;
  for (const org of eligible) {
    const missing = missingFor(org.id);
    if (missing.length === 0) continue; // já cumpriu os requisitos, nada a fazer
    const owner = ownerByOrg.get(org.id);
    const daysLeft = (new Date(org.trial_ends_at).getTime() - now.getTime()) / 86_400_000;
    try {
      if (daysLeft <= 0) {
        await supabaseAdmin.from("profiles").update({ active: false }).eq("org_id", org.id);
        await (supabaseAdmin as any).from("orgs")
          .update({ deactivated_for_inactivity: true, deactivated_at: now.toISOString() }).eq("id", org.id);
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: `${owner.name.split(" ")[0]}, sua conta no Modo Criador foi pausada`,
            html: buildInactivityEmailHtml({ name: owner.name, missing, daysLeft: null }),
          });
        }
        deactivated++;
      } else if (daysLeft <= 2 && !org.inactivity_warning_2d_sent_at) {
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: `${owner.name.split(" ")[0]}, seu teste no Modo Criador termina em 2 dias`,
            html: buildInactivityEmailHtml({ name: owner.name, missing, daysLeft: 2 }),
          });
        }
        await (supabaseAdmin as any).from("orgs").update({ inactivity_warning_2d_sent_at: now.toISOString() }).eq("id", org.id);
        warned2d++;
      } else if (daysLeft <= 5 && !org.inactivity_warning_5d_sent_at) {
        if (owner?.email) {
          await sendEmail({
            to: owner.email,
            subject: `${owner.name.split(" ")[0]}, seu teste no Modo Criador termina em 5 dias`,
            html: buildInactivityEmailHtml({ name: owner.name, missing, daysLeft: 5 }),
          });
        }
        await (supabaseAdmin as any).from("orgs").update({ inactivity_warning_5d_sent_at: now.toISOString() }).eq("id", org.id);
        warned5d++;
      }
    } catch (e) {
      console.error(`Falha na régua de inatividade da org ${org.id}:`, e);
      errors++;
    }
  }
  return { warned5d, warned2d, deactivated, errors };
}

export async function runPaymentGraceEnforcement(): Promise<{ started: number; deactivated: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  const now = new Date();
  const db = supabaseAdmin as any;
  let errors = 0;

  // 1) Teste acabou sem nenhuma assinatura Asaas real e a tolerância ainda
  // não começou a contar — inicia agora, ancorada em trial_ends_at (não em
  // "agora") pra um cron atrasado não roubar dias que a pessoa já ganhou.
  const { data: candidates } = await db
    .from("orgs")
    .select("id, is_reseller, reseller_org_id, asaas_subscription_id, trial_ends_at")
    .eq("subscription_status", "trialing")
    .is("payment_grace_started_at", null)
    .not("trial_ends_at", "is", null)
    .lte("trial_ends_at", now.toISOString())
    .neq("id", LUZERIA_ORG_ID);

  let started = 0;
  for (const org of candidates ?? []) {
    if (org.is_reseller || org.reseller_org_id || org.asaas_subscription_id) continue;
    try {
      await db.from("orgs").update({ payment_grace_started_at: org.trial_ends_at }).eq("id", org.id);
      started++;
    } catch (e) {
      console.error(`Falha ao iniciar tolerância de pagamento da org ${org.id}:`, e);
      errors++;
    }
  }

  // 2) Tolerância de 7 dias esgotada (fim de teste sem assinar, ou fatura
  // vencida — os dois casos usam a mesma coluna) e a conta ainda não foi
  // pausada por isso — pausa agora. Some sozinha do lado direito assim que
  // subscription_status volta a "active" (asaas-webhook.server.ts zera
  // payment_grace_started_at e reativa os perfis), então não precisa
  // reverter nada aqui.
  const { data: graceOrgs } = await db
    .from("orgs")
    .select("id, payment_grace_started_at")
    .not("payment_grace_started_at", "is", null)
    .is("deactivation_reason", null)
    .neq("id", LUZERIA_ORG_ID);

  let deactivated = 0;
  for (const org of graceOrgs ?? []) {
    const daysSince = (now.getTime() - new Date(org.payment_grace_started_at).getTime()) / 86_400_000;
    if (daysSince < 7) continue;
    try {
      await supabaseAdmin.from("profiles").update({ active: false }).eq("org_id", org.id);
      await db.from("orgs").update({ deactivation_reason: "payment", deactivated_at: now.toISOString() }).eq("id", org.id);
      deactivated++;
    } catch (e) {
      console.error(`Falha ao pausar org ${org.id} por pagamento pendente:`, e);
      errors++;
    }
  }

  return { started, deactivated, errors };
}
