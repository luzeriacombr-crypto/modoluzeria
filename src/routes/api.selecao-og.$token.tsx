import { createFileRoute } from "@tanstack/react-router";
import { getPublicPhotoSelectionCoverImage } from "@/lib/luzeria/photo-selection.functions";

/** Imagem de capa pra pré-visualização de link (WhatsApp, etc.) da
 * Seleção de Fotos — precisa ser uma URL crua, buscável por GET sem
 * autenticação (é assim que o crawler do WhatsApp funciona), diferente de
 * getPublicPhotoThumbnails (POST, JSON, protegida). Já sai com a marca
 * d'água da agência, igual toda outra foto que passa por essa seleção. */
export const Route = createFileRoute("/api/selecao-og/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const buf = await getPublicPhotoSelectionCoverImage({ data: { token: params.token } });
        if (!buf) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(new Uint8Array(buf), {
          headers: {
            "content-type": "image/jpeg",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
