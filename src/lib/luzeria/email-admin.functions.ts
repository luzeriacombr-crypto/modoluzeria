// Aba "E-mails" (Configurações, só a plataforma): ver como cada e-mail
// automático chega pras agências, editar os textos, mandar um teste pra si
// mesmo e acompanhar a entrega (Resend). Mesmo controle de acesso de
// reengagement.functions.ts — org da Luzeria — e, aqui, só master.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireActiveProfile } from "./require-active";
import { LUZERIA_ORG_ID } from "./api.functions";

async function assertPlatformMaster(context: any) {
  if (context.orgId !== LUZERIA_ORG_ID) throw new Error("Forbidden");
  const { data: isMaster } = await context.supabase.rpc("is_master", { _user_id: context.userId });
  if (!isMaster) throw new Error("Forbidden");
}

const KEYS = ["welcome", "team_invite", "activation_nudge", "trial_ending", "account_paused", "invoice", "password_reset", "footer"] as const;

const fieldsSchema = z.object({
  subject: z.string().max(200),
  heading: z.string().max(300),
  body: z.string().max(4000),
  highlight: z.string().max(2000),
  buttonLabel: z.string().max(120),
});

export type EmailTemplateAdminRow = {
  key: (typeof KEYS)[number];
  label: string;
  when: string;
  variables: Record<string, string>;
  automaticPart: string | null;
  hiddenFields: string[];
  defaults: z.infer<typeof fieldsSchema>;
  current: z.infer<typeof fieldsSchema>;
  edited: boolean;
  updatedAt: string | null;
};

export const listEmailTemplates = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<EmailTemplateAdminRow[]> => {
    await assertPlatformMaster(context);
    const { EMAIL_TEMPLATES, EMAIL_TEMPLATE_KEYS, loadEmailOverrides, resolveFields } = await import("./email-templates.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const overrides = await loadEmailOverrides();
    const { data: rows } = await (supabaseAdmin as any).from("email_templates").select("key, updated_at");
    const updatedAt = new Map(((rows ?? []) as any[]).map((r) => [r.key, r.updated_at as string]));
    return EMAIL_TEMPLATE_KEYS.map((key) => {
      const def = EMAIL_TEMPLATES[key];
      return {
        key,
        label: def.label,
        when: def.when,
        variables: def.variables,
        automaticPart: def.automaticPart ?? null,
        hiddenFields: (def.hiddenFields ?? []) as string[],
        defaults: def.defaults,
        current: resolveFields(key, overrides),
        edited: updatedAt.has(key),
        updatedAt: updatedAt.get(key) ?? null,
      };
    });
  });

/** Monta o e-mail com dados de exemplo e os textos passados (inclusive os
 * ainda não salvos), pra prévia ao vivo e pro "enviar teste". O rodapé é
 * mostrado dentro do e-mail de boas-vindas. */
async function renderSample(key: (typeof KEYS)[number], fields: z.infer<typeof fieldsSchema>) {
  const { EMAIL_TEMPLATES, loadEmailOverrides, renderEmail, checklistParts, APP_URL, WHATSAPP_URL } = await import("./email-templates.server");
  const overrides = { ...(await loadEmailOverrides()), [key]: fields };
  const target = key === "footer" ? "welcome" : key;
  const vars = EMAIL_TEMPLATES[target].variables;
  const checklist = target === "trial_ending" ? checklistParts(["client", "drive"])
    : target === "activation_nudge" ? checklistParts(["client"]) : null;
  const extraInvoice = target === "invoice"
    ? `<p style="font-size:13px; margin:0; text-align:center;"><a href="#" style="color:#6B7A2E; font-weight:700;">Baixar o boleto em PDF</a></p>`
    : undefined;
  return renderEmail(target, {
    vars,
    buttonUrl: target === "account_paused" ? WHATSAPP_URL : APP_URL,
    overrides,
    extraHtml: checklist?.html ?? extraInvoice,
    extraText: checklist?.text,
  });
}

export const previewEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; fields: z.infer<typeof fieldsSchema> }) =>
    z.object({ key: z.enum(KEYS), fields: fieldsSchema }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformMaster(context);
    const r = await renderSample(data.key, data.fields);
    return { subject: r.subject, html: r.html };
  });

export const saveEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; fields: z.infer<typeof fieldsSchema> }) =>
    z.object({ key: z.enum(KEYS), fields: fieldsSchema }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const f = data.fields;
    const { error } = await (supabaseAdmin as any).from("email_templates").upsert({
      key: data.key,
      subject: f.subject, heading: f.heading, body: f.body, highlight: f.highlight, button_label: f.buttonLabel,
      updated_by: context.userId, updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string }) => z.object({ key: z.enum(KEYS) }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("email_templates").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manda o e-mail (com os textos da tela, salvos ou não) pro próprio login
 * de quem clicou — pra ver como chega de verdade na caixa de entrada. */
export const sendTestEmailTemplate = createServerFn({ method: "POST" })
  .inputValidator((d: { key: string; fields: z.infer<typeof fieldsSchema> }) =>
    z.object({ key: z.enum(KEYS), fields: fieldsSchema }).parse(d))
  .middleware([requireActiveProfile])
  .handler(async ({ data, context }) => {
    await assertPlatformMaster(context);
    const { data: myEmail } = await context.supabase.rpc("get_my_email");
    if (!myEmail) throw new Error("Não consegui identificar seu e-mail de login.");
    const r = await renderSample(data.key, data.fields);
    const { sendEmail } = await import("./resend.server");
    await sendEmail({ to: myEmail as string, subject: `[Teste] ${r.subject}`, html: r.html, text: r.text });
    return { ok: true, email: myEmail as string };
  });

export type EmailDeliveryStats = {
  days: number;
  total: number;
  delivered: number;
  bounced: number;
  complained: number;
  pending: number;
  other: number;
  problems: { to: string; subject: string; createdAt: string; event: string }[];
  error: string | null;
};

/** Números de entrega dos últimos 30 dias, direto do Resend. Nenhum serviço
 * sabe se o e-mail caiu na pasta de spam; o que dá pra medir é entregue,
 * voltou (endereço inválido/caixa cheia) e marcado como spam pela pessoa. */
export const getEmailDeliveryStats = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<EmailDeliveryStats> => {
    await assertPlatformMaster(context);
    const days = 30;
    const empty: EmailDeliveryStats = { days, total: 0, delivered: 0, bounced: 0, complained: 0, pending: 0, other: 0, problems: [], error: null };
    try {
      const { listRecentEmails } = await import("./resend.server");
      const since = Date.now() - days * 86_400_000;
      const emails = (await listRecentEmails(500)).filter((e) => new Date(e.created_at).getTime() >= since);
      const stats = { ...empty, total: emails.length };
      for (const e of emails) {
        const ev = e.last_event ?? "";
        if (ev === "delivered" || ev === "opened" || ev === "clicked") stats.delivered++;
        else if (ev === "bounced") stats.bounced++;
        else if (ev === "complained") stats.complained++;
        else if (ev === "sent" || ev === "queued" || ev === "scheduled" || ev === "delivery_delayed") stats.pending++;
        else stats.other++;
        if (ev === "bounced" || ev === "complained" || ev === "delivery_delayed" || ev === "failed") {
          stats.problems.push({ to: (e.to ?? []).join(", "), subject: e.subject, createdAt: e.created_at, event: ev });
        }
      }
      stats.problems = stats.problems.slice(0, 50);
      return stats;
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      return {
        ...empty,
        error: /restricted|permission|unauthorized|401|403/i.test(msg)
          ? "A chave do Resend configurada na Vercel só tem permissão de envio. Pra ver os números aqui, crie uma chave com \"Full access\" no Resend e troque a RESEND_API_KEY na Vercel."
          : `Não consegui ler os dados do Resend: ${msg}`,
      };
    }
  });

export type EmailDnsCheck = { id: string; label: string; status: "ok" | "warn" | "bad"; detail: string };

/** Confere, ao vivo, os registros de DNS que decidem se o e-mail cai no
 * spam — pelo DNS público do Google, então reflete o que qualquer provedor
 * de e-mail enxerga. */
export const checkEmailDns = createServerFn({ method: "GET" })
  .middleware([requireActiveProfile])
  .handler(async ({ context }): Promise<EmailDnsCheck[]> => {
    await assertPlatformMaster(context);
    const lookup = async (name: string, type: string): Promise<string[] | null> => {
      try {
        const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`);
        const json: any = await res.json();
        return ((json?.Answer ?? []) as any[]).map((a) => String(a.data).replace(/^"|"$/g, "").replace(/" "/g, ""));
      } catch { return null; }
    };
    const [dkim, spf, dmarc, mx] = await Promise.all([
      lookup("resend._domainkey.modocriador.com.br", "TXT"),
      lookup("send.modocriador.com.br", "TXT"),
      lookup("_dmarc.modocriador.com.br", "TXT"),
      lookup("modocriador.com.br", "MX"),
    ]);
    const failed = "Não consegui consultar agora. Tente recarregar.";
    const dmarcRec = dmarc?.find((t) => t.startsWith("v=DMARC1")) ?? null;
    const dmarcPolicy = dmarcRec?.match(/p=(\w+)/)?.[1] ?? null;
    return [
      {
        id: "dkim", label: "Assinatura DKIM",
        status: dkim === null ? "warn" : dkim.some((t) => t.includes("p=")) ? "ok" : "bad",
        detail: dkim === null ? failed : dkim.some((t) => t.includes("p=")) ? "Os e-mails saem assinados: os provedores sabem que vieram mesmo do Modo Criador." : "Sem assinatura: é o que mais manda e-mail pro spam. Refaça a verificação do domínio no Resend.",
      },
      {
        id: "spf", label: "SPF",
        status: spf === null ? "warn" : spf.some((t) => t.startsWith("v=spf1")) ? "ok" : "bad",
        detail: spf === null ? failed : spf.some((t) => t.startsWith("v=spf1")) ? "O servidor que envia (Resend) está autorizado a mandar em nome do domínio." : "Servidor de envio não autorizado. Refaça a verificação do domínio no Resend.",
      },
      {
        id: "dmarc", label: "DMARC",
        status: dmarc === null ? "warn" : !dmarcRec ? "bad" : dmarcPolicy === "none" ? "warn" : "ok",
        detail: dmarc === null ? failed
          : !dmarcRec ? "Sem política DMARC. Gmail e Yahoo exigem uma."
          : dmarcPolicy === "none" ? "Existe, mas no modo mais fraco (p=none): só observa. Mudar pra p=quarantine aumenta a confiança dos provedores."
          : `Política ativa (p=${dmarcPolicy}).`,
      },
      {
        id: "mx", label: "Caixa pra receber respostas",
        status: mx === null ? "warn" : mx.length > 0 ? "ok" : "bad",
        detail: mx === null ? failed
          : mx.length > 0 ? "contato@modocriador.com.br recebe e-mails: quem responder chega até você."
          : "contato@modocriador.com.br não recebe nada. Quem responde um e-mail do Modo Criador recebe erro, e endereço que não recebe perde confiança nos filtros.",
      },
    ];
  });
