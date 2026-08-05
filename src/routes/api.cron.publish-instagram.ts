import { createFileRoute } from "@tanstack/react-router";
import { runScheduledInstagramPublishes } from "@/lib/luzeria/instagram.functions";

// Chamado por um cron externo (GitHub Actions, a cada poucos minutos — o
// cron nativo da Vercel no plano Hobby só roda 1x por dia, cedo demais pra
// "programar publicação" com hora certa). Protegido por CRON_SECRET: só
// quem tem o segredo (o próprio workflow do GitHub) consegue chamar.
export const Route = createFileRoute("/api/cron/publish-instagram")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const results = await runScheduledInstagramPublishes();
        return new Response(JSON.stringify({ ok: true, results }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
