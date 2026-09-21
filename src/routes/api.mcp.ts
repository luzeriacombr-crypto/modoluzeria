import { createFileRoute } from "@tanstack/react-router";

// Servidor MCP do Modo Criador (Streamable HTTP, sem sessão). Toda a lógica,
// autenticação por chave e ferramentas vivem em mcp.server.ts.
export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      POST: async ({ request }) => (await import("@/lib/luzeria/mcp.server")).handleMcpHttp(request),
      GET: async ({ request }) => (await import("@/lib/luzeria/mcp.server")).handleMcpHttp(request),
      OPTIONS: async ({ request }) => (await import("@/lib/luzeria/mcp.server")).handleMcpHttp(request),
    },
  },
});
