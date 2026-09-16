import { createFileRoute } from "@tanstack/react-router";

// Confere o programa de indicação entre agências uma vez por dia (mesmo
// padrão de /api/cron/retention-cleanup): valida indicações dentro do
// trial (1 cliente + 1 funcionário), confirma crédito depois de 60 dias
// como pagante ativo, e reconfere indicações presas aguardando o indicador
// reativar a assinatura. Protegido por CRON_SECRET.
export const Route = createFileRoute("/api/cron/check-agency-referrals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runAgencyReferralChecks } = await import("@/lib/luzeria/referrals.functions");
        const result = await runAgencyReferralChecks();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
