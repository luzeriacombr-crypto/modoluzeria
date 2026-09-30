import { createFileRoute } from "@tanstack/react-router";
import { runHouseDailyStats } from "@/lib/luzeria/house-owner.functions";

// Retrato diário das Houses (stories e posts do dia no Instagram), 23h50 de
// Brasília — o Instagram só devolve stories das últimas 24h, então sem isso
// o painel do dono não teria como contar os stories do mês. Protegido por
// CRON_SECRET, mesmo padrão de /api/cron/compute-agency-ranks.
export const Route = createFileRoute("/api/cron/house-daily-stats")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runHouseDailyStats();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            headers: { "content-type": "application/json" },
          });
        } catch (err: any) {
          return new Response(JSON.stringify({ ok: false, error: err?.message ?? String(err) }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
