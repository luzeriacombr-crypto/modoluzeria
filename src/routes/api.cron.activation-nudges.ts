import { createFileRoute } from "@tanstack/react-router";

// Roda 1x/dia (GitHub Actions), protegido por CRON_SECRET. Duas réguas:
// 1) nudge de cliente nos dias 2/4 desde o cadastro; 2) avisos de
// inatividade (5/2 dias antes do fim do teste) + desativação quando o
// teste acaba sem cliente + Drive. Ver activation.functions.ts.
export const Route = createFileRoute("/api/cron/activation-nudges")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runClientActivationNudges, runInactivityDeactivation } = await import("@/lib/luzeria/activation.functions");
        const [nudges, inactivity] = await Promise.all([
          runClientActivationNudges(),
          runInactivityDeactivation(),
        ]);
        return new Response(JSON.stringify({ ok: true, nudges, inactivity }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
