// Nudge de ativação — roda 1x/dia via cron (api.cron.activation-nudges),
// avisa por e-mail quem ainda não completou os 3 passos básicos (cadastrar
// cliente, conectar Drive, conectar Instagram). Manda todo dia enquanto
// faltar pelo menos um e a agência ainda estiver dentro do trial — pra
// naturalmente e não virar spam depois que a pessoa vira paga ou desiste.
// orgs.activation_nudge_sent_at guarda o último envio (não é mais um
// "enviado uma vez" — vira "enviado hoje").
import type { ActivationChecklistItem } from "./activation-nudge-email.server";

export async function runActivationNudges(): Promise<{ sent: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { LUZERIA_ORG_ID } = await import("./api.functions");

  const now = new Date();
  const sentTodayCutoff = new Date(now.getTime() - 20 * 3_600_000).toISOString(); // mín. ~20h desde o último envio

  const { data: candidates, error } = await (supabaseAdmin as any)
    .from("orgs")
    .select("id, name, is_reseller, reseller_org_id, trial_ends_at, activation_nudge_sent_at")
    .gte("trial_ends_at", now.toISOString())
    .neq("id", LUZERIA_ORG_ID);
  if (error) throw new Error(error.message);

  const eligible = (candidates ?? []).filter((o: any) =>
    !o.is_reseller && !o.reseller_org_id &&
    (!o.activation_nudge_sent_at || o.activation_nudge_sent_at < sentTodayCutoff),
  );
  if (eligible.length === 0) return { sent: 0, errors: 0 };

  const orgIds = eligible.map((o: any) => o.id);

  const { data: clientRows } = await supabaseAdmin
    .from("clients").select("id, org_id").eq("archived", false).neq("category", "Ex-clientes").in("org_id", orgIds);
  const clientsByOrg = new Map<string, string[]>();
  (clientRows ?? []).forEach((c: any) => {
    const list = clientsByOrg.get(c.org_id) ?? [];
    list.push(c.id);
    clientsByOrg.set(c.org_id, list);
  });

  const { data: driveRows } = await supabaseAdmin
    .from("org_google_credentials").select("org_id").in("org_id", orgIds);
  const orgsWithDrive = new Set((driveRows ?? []).map((r: any) => r.org_id as string));

  const allClientIds = (clientRows ?? []).map((c: any) => c.id);
  const igByClientId = new Set<string>();
  if (allClientIds.length) {
    const { data: igRows } = await supabaseAdmin
      .from("client_instagram_credentials").select("client_id").in("client_id", allClientIds);
    (igRows ?? []).forEach((r: any) => igByClientId.add(r.client_id));
  }

  // Só quem tem pelo menos um item ainda faltando entra na lista final.
  const toNudge: { org: any; missing: ActivationChecklistItem[] }[] = [];
  for (const org of eligible) {
    const clientIds = clientsByOrg.get(org.id) ?? [];
    const missing: ActivationChecklistItem[] = [];
    if (clientIds.length === 0) missing.push("client");
    if (!orgsWithDrive.has(org.id)) missing.push("drive");
    if (!clientIds.some((id) => igByClientId.has(id))) missing.push("instagram");
    if (missing.length > 0) toNudge.push({ org, missing });
  }
  if (toNudge.length === 0) return { sent: 0, errors: 0 };

  const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
  const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("id, org_id, name, email, created_at")
    .in("org_id", toNudge.map((t) => t.org.id));
  const ownerByOrg = new Map<string, { name: string; email: string }>();
  (profiles ?? [])
    .filter((p: any) => masterIds.has(p.id))
    .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
    .forEach((p: any) => {
      if (!ownerByOrg.has(p.org_id)) ownerByOrg.set(p.org_id, { name: p.name, email: p.email });
    });

  const { sendEmail } = await import("./resend.server");
  const { buildActivationNudgeEmailHtml } = await import("./activation-nudge-email.server");

  let sent = 0;
  let errors = 0;
  for (const { org, missing } of toNudge) {
    const owner = ownerByOrg.get(org.id);
    if (!owner?.email) continue;
    try {
      await sendEmail({
        to: owner.email,
        subject: `${owner.name.split(" ")[0]}, falta pouco pra aproveitar tudo no Modo Criador`,
        html: buildActivationNudgeEmailHtml({ name: owner.name, missing }),
      });
      await (supabaseAdmin as any).from("orgs").update({ activation_nudge_sent_at: now.toISOString() }).eq("id", org.id);
      sent++;
    } catch (e) {
      console.error(`Falha ao enviar nudge de ativação pra org ${org.id}:`, e);
      errors++;
    }
  }
  return { sent, errors };
}
