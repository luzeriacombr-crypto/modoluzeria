/** Descadastro dos e-mails de reativação (aba Mensagens). O link vai em
 * cada e-mail e no cabeçalho List-Unsubscribe (Gmail e Yahoo exigem isso
 * em e-mail de marketing). Assinado com HMAC e amarrado à agência, sem
 * validade — um link de descadastro precisa funcionar pra sempre. Só barra
 * os e-mails de reativação; avisos de conta, teste e fatura continuam. */
import { createHmac, timingSafeEqual } from "node:crypto";

const SITE = "https://www.modocriador.com.br";

function secret(): string {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Segredo do servidor ausente.");
  return s;
}
// Prefixo separa esse uso do mesmo segredo em outros tokens (ig-media).
const sign = (orgId: string) => createHmac("sha256", secret()).update(`descadastro:${orgId}`).digest("base64url");

export function makeUnsubscribeUrl(orgId: string): string {
  return `${SITE}/api/descadastrar/${orgId}.${sign(orgId)}`;
}

function verify(token: string): string | null {
  const [orgId, sig] = token.split(".");
  if (!orgId || !sig || !/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(orgId));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return orgId;
}

function page(title: string, text: string, form?: string) {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;padding:48px 16px;background:#F2F2ED;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:440px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;">
<div style="font-size:12px;font-weight:800;letter-spacing:.06em;color:#8A8F7A;">MODO CRIADOR</div>
<h1 style="font-size:22px;color:#16171B;margin:12px 0 0;">${title}</h1>
<p style="font-size:14px;line-height:1.6;color:#3C3F33;">${text}</p>${form ?? ""}
</div></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}

/** GET só mostra o botão de confirmar — robôs de segurança de e-mail abrem
 * os links sozinhos, e isso não pode descadastrar ninguém. POST (o botão,
 * ou o "cancelar inscrição" nativo do Gmail via List-Unsubscribe-Post)
 * descadastra de fato. */
export async function handleUnsubscribe(token: string, request: Request): Promise<Response> {
  const orgId = verify(token);
  if (!orgId) return page("Link inválido", "Esse link de descadastro não é válido. Se quiser parar de receber nossos e-mails, responda qualquer um deles pedindo.");
  if (request.method !== "POST") {
    return page(
      "Parar de receber estes e-mails?",
      "Você deixa de receber os e-mails de novidades e convites pra voltar ao Modo Criador. Avisos importantes da sua conta (teste, fatura, senha) continuam chegando.",
      `<form method="post"><button type="submit" style="margin-top:8px;background:#C8D44E;color:#16171B;font-weight:800;font-size:14px;border:0;border-radius:8px;padding:12px 24px;cursor:pointer;">Sim, não quero mais receber</button></form>`,
    );
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await (supabaseAdmin as any).from("orgs")
    .update({ marketing_emails_opt_out_at: new Date().toISOString() })
    .eq("id", orgId).is("marketing_emails_opt_out_at", null);
  if (error) {
    console.error("[descadastro] falha ao gravar:", error.message);
    return page("Algo deu errado", "Não consegui concluir agora. Tente de novo em alguns minutos.");
  }
  return page("Pronto!", "Você não vai mais receber esses e-mails do Modo Criador.");
}
