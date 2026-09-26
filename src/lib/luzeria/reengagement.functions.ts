// Aba "Mensagens" em Planos e Cobrança (platform-admin only) — segmenta
// agências inativas e dispara e-mail de reativação em lote, ou gera links
// wa.me prontos pra mandar um por um. Mesmo padrão de acesso a dados de
// listOrgsBilling (api.functions.ts): usa supabaseAdmin pra ver todas as
// agências, sempre gated por LUZERIA_ORG_ID (não `is_master`, que também
// seria true pro master de qualquer agência comum).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

// page_views só existe a partir dessa data (migração 20260919235200) — uma
// agência criada antes disso nunca teria registro de navegação nenhum,
// então ela some do filtro "nunca acessou nenhuma página" (não dá pra
// confirmar isso pra quem é de antes desse marco).
const PAGE_VIEWS_TRACKING_START = "2026-09-19T00:00:00Z";

function assertPlatformAdmin(context: any) {
  if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
}

export type InactiveOrgRow = {
  orgId: string;
  orgName: string;
  ownerName: string | null;
  ownerEmail: string | null;
  whatsapp: string | null;
  clientCount: number;
  lastActiveAt: string | null;
  lastMessageSentAt: string | null;
};

export const listInactiveOrgsForReengagement = createServerFn({ method: "GET" })
  .inputValidator((d: { noClients?: boolean; minDaysInactive?: number; neverVisitedPages?: boolean }) =>
    z.object({
      noClients: z.boolean().optional(),
      minDaysInactive: z.number().int().min(1).max(365).optional(),
      neverVisitedPages: z.boolean().optional(),
    }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }): Promise<InactiveOrgRow[]> => {
    assertPlatformAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orgs, error } = await supabaseAdmin
      .from("orgs")
      .select("id, name, whatsapp, created_at")
      .neq("id", LUZERIA_ORG_ID);
    if (error) throw new Error(error.message);

    const { data: clientRows } = await supabaseAdmin
      .from("clients").select("org_id").eq("archived", false).neq("category", "Ex-clientes");
    const clientsByOrg = new Map<string, number>();
    (clientRows ?? []).forEach((c: any) => clientsByOrg.set(c.org_id, (clientsByOrg.get(c.org_id) ?? 0) + 1));

    const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
    const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, org_id, name, email, created_at, last_active_at");
    const ownerByOrg = new Map<string, { name: string; email: string }>();
    (profiles ?? [])
      .filter((p: any) => masterIds.has(p.id))
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((p: any) => { if (!ownerByOrg.has(p.org_id)) ownerByOrg.set(p.org_id, { name: p.name, email: p.email }); });
    const lastActiveByOrg = new Map<string, string | null>();
    (profiles ?? []).forEach((p: any) => {
      if (!p.last_active_at) return;
      const current = lastActiveByOrg.get(p.org_id);
      if (!current || p.last_active_at > current) lastActiveByOrg.set(p.org_id, p.last_active_at);
    });

    // Só marca "nunca visitou" pra quem já podia ter deixado rastro —
    // criada antes do início do rastreamento não conta.
    const { data: pageViewOrgIds } = await supabaseAdmin.from("page_views").select("org_id");
    const orgsWithPageViews = new Set((pageViewOrgIds ?? []).map((r: any) => r.org_id as string));

    const { data: lastMessageRows } = await supabaseAdmin
      .from("agency_reengagement_messages")
      .select("org_id, sent_at")
      .order("sent_at", { ascending: false });
    const lastMessageByOrg = new Map<string, string>();
    (lastMessageRows ?? []).forEach((r: any) => {
      if (!lastMessageByOrg.has(r.org_id)) lastMessageByOrg.set(r.org_id, r.sent_at);
    });

    const now = Date.now();
    const cutoffMs = data.minDaysInactive ? now - data.minDaysInactive * 86_400_000 : null;

    return (orgs ?? [])
      .filter((o: any) => {
        if (data.noClients && (clientsByOrg.get(o.id) ?? 0) > 0) return false;
        if (cutoffMs != null) {
          const lastActive = lastActiveByOrg.get(o.id);
          if (lastActive && new Date(lastActive).getTime() > cutoffMs) return false;
        }
        if (data.neverVisitedPages) {
          if (o.created_at < PAGE_VIEWS_TRACKING_START) return false; // sem como saber, fica de fora
          if (orgsWithPageViews.has(o.id)) return false;
        }
        return true;
      })
      .map((o: any) => ({
        orgId: o.id,
        orgName: o.name,
        ownerName: ownerByOrg.get(o.id)?.name ?? null,
        ownerEmail: ownerByOrg.get(o.id)?.email ?? null,
        whatsapp: o.whatsapp,
        clientCount: clientsByOrg.get(o.id) ?? 0,
        lastActiveAt: lastActiveByOrg.get(o.id) ?? null,
        lastMessageSentAt: lastMessageByOrg.get(o.id) ?? null,
      }))
      .sort((a, b) => (a.lastActiveAt ?? "").localeCompare(b.lastActiveAt ?? ""));
  });

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildReengagementEmailHtml(body: string) {
  const text = esc(body).replace(/\n/g, "<br>");
  return `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#F2F2ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border-radius:16px;">
<tr><td style="padding:28px 32px;font-size:14px;line-height:1.6;color:#16171B;">${text}</td></tr>
</table></td></tr></table></body></html>`;
}

export const sendReengagementEmails = createServerFn({ method: "POST" })
  .inputValidator((d: { orgIds: string[]; subject: string; body: string }) =>
    z.object({
      orgIds: z.array(z.string().uuid()).min(1).max(500),
      subject: z.string().trim().min(1).max(200),
      body: z.string().trim().min(1).max(5000),
    }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail } = await import("./resend.server");

    const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
    const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, org_id, name, email, created_at")
      .in("org_id", data.orgIds);
    const ownerByOrg = new Map<string, { name: string; email: string }>();
    (profiles ?? [])
      .filter((p: any) => masterIds.has(p.id))
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((p: any) => { if (!ownerByOrg.has(p.org_id)) ownerByOrg.set(p.org_id, { name: p.name, email: p.email }); });

    const results: { orgId: string; ok: boolean; error?: string }[] = [];
    for (const orgId of data.orgIds) {
      const owner = ownerByOrg.get(orgId);
      if (!owner?.email) { results.push({ orgId, ok: false, error: "Sem e-mail de responsável." }); continue; }
      try {
        const firstName = owner.name?.trim().split(" ")[0] ?? "";
        const personalized = data.body.replaceAll("{nome}", firstName ? ` ${firstName}` : "");
        await sendEmail({ to: owner.email, subject: data.subject, html: buildReengagementEmailHtml(personalized) });
        await supabaseAdmin.from("agency_reengagement_messages").insert({
          org_id: orgId, channel: "email", subject: data.subject, body: personalized, sent_by: context.userId,
        });
        results.push({ orgId, ok: true });
      } catch (e: any) {
        results.push({ orgId, ok: false, error: e?.message ?? String(e) });
      }
    }
    return { sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok) };
  });

export const getReengagementWhatsappLinks = createServerFn({ method: "POST" })
  .inputValidator((d: { orgIds: string[]; message: string }) =>
    z.object({
      orgIds: z.array(z.string().uuid()).min(1).max(500),
      message: z.string().trim().min(1).max(2000),
    }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    assertPlatformAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: orgs } = await supabaseAdmin.from("orgs").select("id, name, whatsapp").in("id", data.orgIds);
    const { data: masterRoles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "master");
    const masterIds = new Set((masterRoles ?? []).map((r: any) => r.user_id));
    const { data: profiles } = await supabaseAdmin
      .from("profiles").select("id, org_id, name, created_at")
      .in("org_id", data.orgIds);
    const ownerNameByOrg = new Map<string, string>();
    (profiles ?? [])
      .filter((p: any) => masterIds.has(p.id))
      .sort((a: any, b: any) => a.created_at.localeCompare(b.created_at))
      .forEach((p: any) => { if (!ownerNameByOrg.has(p.org_id)) ownerNameByOrg.set(p.org_id, p.name); });

    const rows: { orgId: string; orgName: string; whatsapp: string | null; link: string | null }[] = [];
    const logRows: { org_id: string; channel: "whatsapp"; body: string; sent_by: string }[] = [];
    for (const org of orgs ?? []) {
      const rawDigits = (org.whatsapp ?? "").replace(/\D/g, "");
      if (!rawDigits) { rows.push({ orgId: org.id, orgName: org.name, whatsapp: null, link: null }); continue; }
      const digits = rawDigits.length <= 11 ? `55${rawDigits}` : rawDigits;
      const firstName = ownerNameByOrg.get(org.id)?.trim().split(" ")[0] ?? "";
      const personalized = data.message.replaceAll("{nome}", firstName ? ` ${firstName}` : "");
      rows.push({ orgId: org.id, orgName: org.name, whatsapp: org.whatsapp, link: `https://wa.me/${digits}?text=${encodeURIComponent(personalized)}` });
      logRows.push({ org_id: org.id, channel: "whatsapp", body: personalized, sent_by: context.userId });
    }
    if (logRows.length > 0) await supabaseAdmin.from("agency_reengagement_messages").insert(logRows);
    return rows;
  });
