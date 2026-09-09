import { createFileRoute } from "@tanstack/react-router";
import { runInstagramTokenRefresh } from "@/lib/luzeria/instagram.functions";

// Chamado 1x/dia por um cron externo (GitHub Actions, ver
// .github/workflows/refresh-instagram-tokens-cron.yml). Renova o token de
// acesso do Instagram de cada cliente antes dele expirar (~60 dias,
// long-lived token da Meta) — sem isso, publicação (manual ou programada)
// começa a falhar em silêncio passado esse prazo. Protegido por
// CRON_SECRET, mesmo padrão de /api/cron/publish-instagram.
export const Route = createFileRoute("/api/cron/refresh-instagram-tokens")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await runInstagramTokenRefresh();
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
