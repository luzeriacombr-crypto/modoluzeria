import { createFileRoute } from "@tanstack/react-router";

// Ícone da organização (o favicon que ela enviou), servido no domínio do app
// pro manifesto não depender de link assinado que expira.
export const Route = createFileRoute("/api/org-icon/$orgId")({
  server: {
    handlers: {
      GET: async ({ params }) => (await import("@/lib/luzeria/org-pwa.server")).serveOrgIcon(params.orgId),
    },
  },
});
