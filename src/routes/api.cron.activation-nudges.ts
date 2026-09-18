import { createFileRoute } from "@tanstack/react-router";

// Confere uma vez por dia quem se cadastrou há 3+ dias e ainda não
// importou nenhum cliente, e manda o e-mail de nudge (uma única vez por
// org). Mesmo padrão de /api/cron/retention-cleanup. Protegido por
// CRON_SECRET.
export const Route = createFileRoute("/api/cron/activation-nudges")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runActivationNudges } = await import("@/lib/luzeria/activation.functions");
        const result = await runActivationNudges();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
