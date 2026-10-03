import { createFileRoute } from "@tanstack/react-router";

// Acervo por cliente do Nativo (IA). Toda a lógica, o login e a regra de quem paga vivem em
// nativo-acervo.server.ts. Chamada pelo site do Nativo (nativo.modocriador.com.br) com o token da sessão.
export const Route = createFileRoute("/api/nativo-acervo")({
  server: {
    handlers: {
      GET: async ({ request }) => (await import("@/lib/luzeria/nativo-acervo.server")).handleAcervo(request),
      POST: async ({ request }) => (await import("@/lib/luzeria/nativo-acervo.server")).handleAcervo(request),
      OPTIONS: async ({ request }) => (await import("@/lib/luzeria/nativo-acervo.server")).handleAcervo(request),
    },
  },
});
