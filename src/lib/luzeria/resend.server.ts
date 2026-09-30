// Server-only Resend API client. Never imported at module scope from a
// .functions.ts or route file — always reached via dynamic import from
// inside a handler, so RESEND_API_KEY never ends up in the client bundle.

export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  /** Versão em texto puro. E-mail só com HTML pesa contra nos filtros de
   * spam — sempre que possível, mande as duas (renderEmail já devolve). */
  text?: string;
  from?: string;
  /** Cabeçalhos extras (ex.: List-Unsubscribe nos e-mails de reativação). */
  headers?: Record<string, string>;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: params.from ?? "Modo Criador <contato@modocriador.com.br>",
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.text ? { text: params.text } : {}),
      ...(params.headers ? { headers: params.headers } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `Resend retornou ${res.status}`);
  }
  return body as { id: string };
}

/** Últimos e-mails enviados pelo Resend, com o último evento de cada um
 * (delivered, bounced, complained...) — pro painel de entrega da aba
 * "E-mails". Pagina até `max` e-mails. */
export async function listRecentEmails(max = 300): Promise<{ id: string; to: string[]; subject: string; created_at: string; last_event: string | null }[]> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY não configurada.");
  const out: any[] = [];
  let after: string | null = null;
  while (out.length < max) {
    const url = new URL("https://api.resend.com/emails");
    url.searchParams.set("limit", "100");
    if (after) url.searchParams.set("after", after);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message ?? `Resend retornou ${res.status}`);
    const page: any[] = json?.data ?? [];
    out.push(...page);
    if (!json?.has_more || page.length === 0) break;
    after = page[page.length - 1].id;
  }
  return out.slice(0, max);
}
