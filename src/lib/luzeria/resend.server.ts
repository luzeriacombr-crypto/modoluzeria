// Server-only Resend API client. Never imported at module scope from a
// .functions.ts or route file — always reached via dynamic import from
// inside a handler, so RESEND_API_KEY never ends up in the client bundle.

export async function sendEmail(params: { to: string; subject: string; html: string; from?: string }) {
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
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.message ?? `Resend retornou ${res.status}`);
  }
  return body as { id: string };
}
