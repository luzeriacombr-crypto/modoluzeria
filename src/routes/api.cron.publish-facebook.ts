import { createFileRoute } from "@tanstack/react-router";
import { runScheduledFacebookPublishes } from "@/lib/luzeria/facebook.functions";

// Mesmo padrão de api.cron.publish-instagram.ts — cron externo (GitHub
// Actions, a cada poucos minutos), protegido por CRON_SECRET.
export const Route = createFileRoute("/api/cron/publish-facebook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await runScheduledFacebookPublishes();
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
