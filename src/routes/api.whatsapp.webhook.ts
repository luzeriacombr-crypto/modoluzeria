import { createFileRoute } from "@tanstack/react-router";

// Webhook da API oficial do WhatsApp (configurado no painel da Meta, em
// WhatsApp → Configuração). GET = verificação inicial da Meta (confere o
// WHATSAPP_VERIFY_TOKEN); POST = eventos, assinados com o segredo do app
// (X-Hub-Signature-256) — sem assinatura válida, nada é processado.
export const Route = createFileRoute("/api/whatsapp/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = process.env.WHATSAPP_VERIFY_TOKEN;
        if (
          token &&
          url.searchParams.get("hub.mode") === "subscribe" &&
          url.searchParams.get("hub.verify_token") === token
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const secret = process.env.WHATSAPP_APP_SECRET;
        const raw = await request.text();
        if (!secret) return new Response("Not configured", { status: 503 });

        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const received = request.headers.get("x-hub-signature-256") ?? "";
        const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
        const a = Buffer.from(received);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        try {
          const { handleWhatsappWebhook } = await import("@/lib/luzeria/whatsapp-webhook.server");
          await handleWhatsappWebhook(JSON.parse(raw));
        } catch (e) {
          // Sempre 200 depois de validar a assinatura: se devolver erro, a
          // Meta fica reenviando o mesmo evento por horas.
          console.error("[whatsapp-webhook] erro ao processar:", e);
        }
        return new Response("OK", { status: 200 });
      },
    },
  },
});
