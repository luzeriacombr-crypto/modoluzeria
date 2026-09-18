import { createFileRoute } from "@tanstack/react-router";

// Confere uma vez por dia quem ainda está dentro do trial e não completou
// os 3 passos básicos (cliente cadastrado, Drive conectado, Instagram
// conectado) — manda o e-mail de nudge listando só o que falta, uma vez
// por dia por org, até completar tudo ou o trial acabar. Mesmo padrão de
// /api/cron/retention-cleanup. Protegido por CRON_SECRET.
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
