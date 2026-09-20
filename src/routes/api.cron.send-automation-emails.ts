import { createFileRoute } from "@tanstack/react-router";

// Roda de 10 em 10 min (GitHub Actions), protegido por CRON_SECRET. Envia
// os e-mails enfileirados pela ação "Enviar e-mail" das Automações.
export const Route = createFileRoute("/api/cron/send-automation-emails")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runAutomationEmailQueue } = await import("@/lib/luzeria/automation-email.functions");
        const result = await runAutomationEmailQueue();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
