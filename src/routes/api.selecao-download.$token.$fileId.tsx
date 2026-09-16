import { createFileRoute } from "@tanstack/react-router";
import { getPublicPhotoDownloadBytes } from "@/lib/luzeria/photo-selection.functions";

/** Download de verdade (não pré-visualização) de uma foto do modo Entrega
 * — precisa ser bytes crus com Content-Disposition, igual
 * api.selecao-og.$token.tsx, porque uma resposta JSON/base64 de
 * createServerFn não é confiável pra fotos em tamanho original (passam
 * fácil dos ~4,5MB que aguentaria bem). */
export const Route = createFileRoute("/api/selecao-download/$token/$fileId")({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        const url = new URL(request.url);
        const size = url.searchParams.get("size") === "original" ? "original" : "social";
        const result = await getPublicPhotoDownloadBytes({
          data: { token: params.token, fileId: params.fileId, size },
        });
        if (!result) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(new Uint8Array(result.buffer), {
          headers: {
            "content-type": result.mimeType,
            "content-disposition": `attachment; filename="${encodeURIComponent(result.fileName)}"`,
            "cache-control": "private, no-store",
          },
        });
      },
    },
  },
});
