import { createFileRoute } from "@tanstack/react-router";
import { runAgencyRankRecompute } from "@/lib/luzeria/agency-rank.functions";

// Recalcula o ranking "Agência Top N" entre todas as agências, 1x por dia
// (mesmo padrão de /api/cron/retention-cleanup). Protegido por CRON_SECRET —
// é a única rotina do sistema que compara pontos entre agências diferentes,
// então nunca deve ser chamada a partir do client.
export const Route = createFileRoute("/api/cron/compute-agency-ranks")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        try {
          const result = await runAgencyRankRecompute();
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
