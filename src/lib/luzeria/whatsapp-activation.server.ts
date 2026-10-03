// Mensagens de ativação no WhatsApp ~48h depois do cadastro (sem clientes /
// poucos clientes / nunca chamou a equipe). Roda no mesmo disparo diário das
// 9h do e-mail de ativação (api.cron.activation-nudges.ts) e só faz algo se a
// chave "whatsapp_activation_enabled" estiver ligada.
//
// Regras: só agência em teste, não revendida, cadastrada entre 2 e 14 dias
// atrás (pra ligar a chave não disparar em quem já é antigo — esses o Junior
// manda à mão pelo painel); uma mensagem por vez, na ordem sem clientes >
// poucos clientes > equipe; cada campanha no máximo uma vez por agência; 3
// dias de intervalo entre mensagens; respeita SAIR e as pausas dos botões.
import {
  ACTIVATION_CAMPAIGNS, activationAutoEnabled, activationButtonPayloads, getPhoneHealth, listApprovedTemplates,
  pausedOrgIds, phoneKey, sendTemplate, toWaDigits, whatsappConfigured, isOptedOut,
  type ActivationKey,
} from "./whatsapp.server";

const MIN_DAYS = 2;
const MAX_DAYS = 14;
const SPACING_DAYS = 3;
const ORDER: ActivationKey[] = ["noClients", "fewClients", "noTeam"];

export async function runWhatsappActivationNudges() {
  if (!whatsappConfigured()) return { skipped: "whatsapp não configurado" };
  if (!(await activationAutoEnabled())) return { skipped: "chave desligada" };
  const health = await getPhoneHealth().catch(() => null);
  if (health?.quality === "RED") return { skipped: "nota de qualidade vermelha" };

  const approved = new Set((await listApprovedTemplates()).map((t) => t.name));
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { LUZERIA_ORG_ID } = await import("./api.functions");
  const db = supabaseAdmin as any;

  const now = Date.now();
  const { data: orgs } = await db.from("orgs")
    .select("id, name, whatsapp, created_at, subscription_status, is_reseller, reseller_org_id")
    .neq("id", LUZERIA_ORG_ID)
    .eq("subscription_status", "trialing")
    .gte("created_at", new Date(now - MAX_DAYS * 86_400_000).toISOString())
    .lte("created_at", new Date(now - MIN_DAYS * 86_400_000).toISOString());
  const eligible = (orgs ?? []).filter((o: any) => !o.is_reseller && !o.reseller_org_id && toWaDigits(o.whatsapp));
  if (eligible.length === 0) return { sent: 0, eligible: 0 };
  const ids = eligible.map((o: any) => o.id as string);

  const [{ data: clientRows }, { data: profiles }, { data: roles }, { data: sentRows }, { data: optOuts }] = await Promise.all([
    db.from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes").in("org_id", ids),
    db.from("profiles").select("id, org_id, name, active, created_at").in("org_id", ids),
    db.from("user_roles").select("user_id").eq("role", "master"),
    db.from("whatsapp_messages").select("org_id, template_name, created_at")
      .in("kind", ["campaign", "activation_auto"]).neq("status", "failed").in("org_id", ids),
    db.from("whatsapp_opt_outs").select("phone_key"),
  ]);
  const clients = new Map<string, number>();
  (clientRows ?? []).forEach((c: any) => clients.set(c.org_id, (clients.get(c.org_id) ?? 0) + 1));
  const team = new Map<string, number>();
  (profiles ?? []).forEach((p: any) => { if (p.active) team.set(p.org_id, (team.get(p.org_id) ?? 0) + 1); });
  const masters = new Set((roles ?? []).map((r: any) => r.user_id));
  const ownerName = new Map<string, string>();
  (profiles ?? []).filter((p: any) => masters.has(p.id))
    .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
    .forEach((p: any) => { if (!ownerName.has(p.org_id)) ownerName.set(p.org_id, p.name); });
  const optedOut = new Set((optOuts ?? []).map((r: any) => r.phone_key));
  const pauses = new Map<ActivationKey, Set<string>>();
  for (const key of ORDER) pauses.set(key, await pausedOrgIds(key, ids));

  let sent = 0;
  const failed: { org: string; reason: string }[] = [];
  for (const org of eligible) {
    if (optedOut.has(phoneKey(org.whatsapp)) || (await isOptedOut(org.whatsapp))) continue;
    const history = (sentRows ?? []).filter((r: any) => r.org_id === org.id);
    if (history.some((r: any) => now - new Date(r.created_at).getTime() < SPACING_DAYS * 86_400_000)) continue;

    const nClients = clients.get(org.id) ?? 0;
    const applies: Record<ActivationKey, boolean> = {
      noClients: nClients === 0,
      fewClients: nClients >= 1 && nClients <= 2,
      noTeam: (team.get(org.id) ?? 1) === 1,
    };
    const key = ORDER.find((k) =>
      applies[k] && approved.has(ACTIVATION_CAMPAIGNS[k].template) && !pauses.get(k)!.has(org.id)
      && !history.some((r: any) => r.template_name === ACTIVATION_CAMPAIGNS[k].template));
    if (!key) continue;

    const firstName = ownerName.get(org.id)?.trim().split(" ")[0] || "tudo bem";
    const params = key === "fewClients" ? [firstName, `${nClients} cliente${nClients === 1 ? "" : "s"}`] : [firstName];
    const r = await sendTemplate(org.whatsapp, ACTIVATION_CAMPAIGNS[key].template, params, {
      kind: "activation_auto", orgId: org.id, buttonPayloads: activationButtonPayloads(key, org.id),
    });
    if (r.ok) {
      sent++;
      await db.from("agency_reengagement_messages").insert({
        org_id: org.id, channel: "whatsapp", subject: `Ativação automática: ${ACTIVATION_CAMPAIGNS[key].template}`,
        body: `Mensagem de ${ACTIVATION_CAMPAIGNS[key].label} (automática, ~48h após o cadastro)`,
      });
    } else failed.push({ org: org.name, reason: r.error });
  }
  return { sent, eligible: eligible.length, failed };
}
