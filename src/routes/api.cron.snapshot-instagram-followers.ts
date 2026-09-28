import { createFileRoute } from "@tanstack/react-router";
import { runInstagramFollowerSnapshots } from "@/lib/luzeria/instagram.functions";

// Chamado 1x/dia (pg_cron, ver migration instagram_follower_snapshots_cron)
// pra guardar o número de seguidores de cada cliente conectado — a Meta só
// devolve uma janela recente de histórico, então esse retrato diário é o
// que permite comparar "quantos seguidores há X tempo vs. hoje" mais pra
// frente. Protegido por CRON_SECRET, mesmo padrão dos outros cron.
export const Route = createFileRoute("/api/cron/snapshot-instagram-followers")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await runInstagramFollowerSnapshots();
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
