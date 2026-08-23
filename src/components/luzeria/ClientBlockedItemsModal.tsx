import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, X } from "lucide-react";
import { clientBlockedItemsQO } from "@/lib/luzeria/queries";
import { CONTENT_TYPE_LABEL } from "@/lib/luzeria/types";

export function ClientBlockedItemsModal({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const { data: items = [], isLoading } = useQuery(clientBlockedItemsQO(clientId));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[80vh] flex flex-col bg-card border border-foreground/10 rounded-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between px-6 py-4 border-b border-foreground/8 shrink-0">
          <div>
            <h3 className="text-base font-semibold text-foreground">Conteúdos travados</h3>
            <p className="text-[11px] text-foreground/40 mt-0.5">Todos os meses, com o motivo do bloqueio</p>
          </div>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground shrink-0"><X size={16} /></button>
        </div>

        <div className="overflow-y-auto">
          {isLoading ? (
            <p className="text-foreground/40 text-sm px-6 py-8 text-center">Carregando…</p>
          ) : items.length === 0 ? (
            <p className="text-foreground/40 text-sm px-6 py-8 text-center">Nenhum conteúdo travado. 🎉</p>
          ) : items.map((item) => (
            <div key={item.id} className="px-6 py-3 border-b border-foreground/5 last:border-b-0">
              <div className="flex items-start gap-2">
                <AlertOctagon size={14} style={{ color: "#FF6B6B" }} className="shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm truncate">{item.title}</span>
                    <span className="text-[10px] text-foreground/40 shrink-0">{CONTENT_TYPE_LABEL[item.type as keyof typeof CONTENT_TYPE_LABEL] ?? item.type}</span>
                  </div>
                  <p className="text-[11px] text-foreground/50 mt-1">
                    {item.blockedReason?.trim() ? item.blockedReason : "Sem motivo informado"}
                  </p>
                  <p className="text-[10px] text-foreground/30 mt-1">
                    {item.monthKey} · atualizado em {new Date(item.updatedAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
