import { createFileRoute } from "@tanstack/react-router";

// Descadastro dos e-mails de reativação — ver email-unsubscribe.server.ts.
export const Route = createFileRoute("/api/descadastrar/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => (await import("@/lib/luzeria/email-unsubscribe.server")).handleUnsubscribe(params.token, request),
      POST: async ({ params, request }) => (await import("@/lib/luzeria/email-unsubscribe.server")).handleUnsubscribe(params.token, request),
    },
  },
});
