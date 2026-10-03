import { createFileRoute } from "@tanstack/react-router";

// Roda 1x/dia (GitHub Actions), protegido por CRON_SECRET. Quatro réguas:
// 1) nudge de cliente nos dias 2/4 desde o cadastro; 2) avisos de
// inatividade (5/2 dias antes do fim do teste) + desativação quando o
// teste acaba sem cliente + Drive; 3) régua de cobrança (tolerância de 7
// dias e depois pausa quando o teste acaba sem assinatura, ou uma fatura
// vence); 4) notificação única de tutoriais pra agência nova/pouco ativa.
// Ver activation.functions.ts.
export const Route = createFileRoute("/api/cron/activation-nudges")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const auth = request.headers.get("authorization");
        if (!secret || auth !== `Bearer ${secret}`) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { runClientActivationNudges, runInactivityDeactivation, runPaymentGraceEnforcement, runTutorialNudge } = await import("@/lib/luzeria/activation.functions");
        const [nudges, inactivity, paymentGrace, tutorialNudge] = await Promise.all([
          runClientActivationNudges(),
          runInactivityDeactivation(),
          runPaymentGraceEnforcement(),
          runTutorialNudge(),
        ]);
        // WhatsApp de ativação (48h): isolado — uma falha aqui não derruba o resto da régua.
        const whatsapp = await import("@/lib/luzeria/whatsapp-activation.server")
          .then((m) => m.runWhatsappActivationNudges())
          .catch((e) => ({ error: String(e?.message ?? e) }));
        return new Response(JSON.stringify({ ok: true, nudges, inactivity, paymentGrace, tutorialNudge, whatsapp }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
