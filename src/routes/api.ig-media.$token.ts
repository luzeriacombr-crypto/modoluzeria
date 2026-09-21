import { createFileRoute } from "@tanstack/react-router";

// Vídeo temporário pra Meta buscar (video_url) — repassa o arquivo do Drive
// em streaming. Ver ig-media-proxy.server.ts.
export const Route = createFileRoute("/api/ig-media/$token")({
  server: {
    handlers: {
      GET: async ({ params, request }) => (await import("@/lib/luzeria/ig-media-proxy.server")).serveIgMedia(params.token, request),
      HEAD: async ({ params, request }) => (await import("@/lib/luzeria/ig-media-proxy.server")).serveIgMedia(params.token, request),
    },
  },
});
