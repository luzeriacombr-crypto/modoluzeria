// Nudge de ativação — roda 1x/dia via cron (api.cron.activation-nudges),
// avisa por e-mail quem se cadastrou há 3+ dias e ainda não importou
// nenhum cliente de verdade. Dispara uma única vez por org
// (orgs.activation_nudge_sent_at trava o reenvio) — nunca reprocessa quem
// já foi avisado, mesmo que ainda esteja zerado no dia seguinte.
export async function runActivationNudges(): Promise<{ sent: number; errors: number }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { LUZERIA_ORG_ID } = await import("./api.functions");

  const cutoff = new Date(Date.now() - 3 * 86_400_000).toISOString();
  const { data: candidates, error } = await (supabaseAdmin as any)
    .from("orgs")
    .select("id, name, is_reseller, reseller_org_id")
    .lte("created_at", cutoff)
    .is("activation_nudge_sent_at", null)
    .neq("id", LUZERIA_ORG_ID);
  if (error) throw new Error(error.message);

  const eligible = (candidates ?? []).filter((o: any) => !o.is_reseller && !o.reseller_org_id);
  if (eligible.length === 0) return { sent: 0, errors: 0 };

  const orgIds = eligible.map((o: any) => o.id);
  const { data: clientRows } = await supabaseAdmin
    .from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes").in("org_id", orgIds);
  const clientsByOrg = new Map<string, number>();
  (clientRows ?? []).forEach((c: any) => clientsByOrg.set(c.org_id, (clientsByOrg.get(c.org_id) ?? 0) + 1));

  const cold = eligible.filter((o: any) => (clientsByOrg.get(o.id) ?? 0) === 0);
  if (cold.length === 0) return { sent: 0, errors: 0 };

  const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
  const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
  const { data: profiles } = await supabaseAdmin
    .from("profiles").select("id, org_id, name, email, created_at")
    .in("org_id", cold.map((o: any) => o.id));
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
  for (const org of cold) {
    const owner = ownerByOrg.get(org.id);
    if (!owner?.email) continue;
    try {
      await sendEmail({
        to: owner.email,
        subject: `${owner.name.split(" ")[0]}, seus clientes ainda não estão no Modo Criador`,
        html: buildActivationNudgeEmailHtml({ name: owner.name }),
      });
      await (supabaseAdmin as any).from("orgs").update({ activation_nudge_sent_at: new Date().toISOString() }).eq("id", org.id);
      sent++;
    } catch (e) {
      console.error(`Falha ao enviar nudge de ativação pra org ${org.id}:`, e);
      errors++;
    }
  }
  return { sent, errors };
}
