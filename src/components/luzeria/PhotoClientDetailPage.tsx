import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, Images } from "lucide-react";
import { photoClientQO } from "@/lib/luzeria/queries";
import { PhotoSelectionsPanel } from "./PhotoSelectionsPanel";

export function PhotoClientDetailPage({ clientId }: { clientId: string }) {
  const { data: photoClient, isLoading } = useQuery(photoClientQO(clientId));

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Link
          to="/selecao-de-fotos"
          className="inline-flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground transition px-2 py-2"
        >
          <ChevronLeft size={14} /> Todos os clientes
        </Link>
        {photoClient && (
          <span
            className="text-xs font-bold uppercase px-2 py-1 rounded inline-flex items-center gap-1.5"
            style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 60%, transparent)" }}
          >
            <Images size={12} /> {photoClient.name}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="text-foreground/40 text-sm py-10 text-center">Carregando…</div>
      ) : !photoClient ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-10 text-center text-foreground/30 text-sm">
          Cliente de fotografia não encontrado.
        </div>
      ) : (
        <PhotoSelectionsPanel photoClientId={photoClient.id} />
      )}
    </div>
  );
}
