import { createFileRoute } from "@tanstack/react-router";
import { runPendingPushNotifications } from "@/lib/luzeria/push-dispatch.functions";

// Chamado por um cron externo (GitHub Actions, a cada poucos minutos —
// mesmo padrão do /api/cron/publish-instagram) pra despachar como push todas
// as notificações pendentes (notifications.push_sent_at IS NULL). Protegido
// por CRON_SECRET.
export const Route = createFileRoute("/api/cron/send-push-notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const result = await runPendingPushNotifications();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
