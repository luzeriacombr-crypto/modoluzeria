// Envia os e-mails que a ação "Enviar e-mail" das Automações enfileirou em
// automation_email_queue (o banco só enfileira — não tem como chamar o
// Resend de dentro do Postgres). Chamada de 10 em 10 min por
// /api/cron/send-automation-emails. Até 3 tentativas por e-mail.
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildHtml(body: string, fromName: string | null) {
  const text = esc(body).replace(/\n/g, "<br>");
  const footer = fromName ? `<p style="font-size:11px;color:#8A8D80;margin:24px 0 0 0;">Enviado por ${esc(fromName)} pelo Modo Criador.</p>` : "";
  return `<!doctype html><html><body style="margin:0;padding:24px 16px;background:#F2F2ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#FFFFFF;border-radius:16px;">
<tr><td style="padding:28px 32px;font-size:14px;line-height:1.6;color:#16171B;">${text}${footer}</td></tr>
</table></td></tr></table></body></html>`;
}

export async function runAutomationEmailQueue() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { sendEmail } = await import("./resend.server");
  const { data: rows, error } = await (supabaseAdmin as any)
    .from("automation_email_queue")
    .select("id, to_email, from_name, subject, body, attempts")
    .is("sent_at", null).lt("attempts", 3)
    .order("created_at").limit(50);
  if (error) throw new Error(error.message);

  let sent = 0, failed = 0;
  for (const r of (rows ?? []) as any[]) {
    try {
      const name = (r.from_name ?? "").replace(/[<>",\r\n]/g, "").trim();
      await sendEmail({
        to: r.to_email,
        subject: r.subject,
        html: buildHtml(r.body, name || null),
        from: name ? `${name} via Modo Criador <contato@modocriador.com.br>` : undefined,
      });
      await (supabaseAdmin as any).from("automation_email_queue").update({ sent_at: new Date().toISOString(), error: null }).eq("id", r.id);
      sent++;
    } catch (e: any) {
      await (supabaseAdmin as any).from("automation_email_queue")
        .update({ attempts: r.attempts + 1, error: String(e?.message ?? e).slice(0, 300) }).eq("id", r.id);
      failed++;
    }
  }
  return { pending: (rows ?? []).length, sent, failed };
}
