import { createFileRoute } from "@tanstack/react-router";

// Manifesto do app instalado, com nome/cor/ícone da organização.
export const Route = createFileRoute("/api/manifest/$orgId")({
  server: {
    handlers: {
      GET: async ({ params }) => (await import("@/lib/luzeria/org-pwa.server")).serveManifest(params.orgId),
    },
  },
});
