import { AlertTriangle } from "lucide-react";
import { useClientReactivate } from "@/lib/luzeria/client-reactivate-store";
import { useApi } from "@/lib/luzeria/queries";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { toast } from "sonner";
import { Modal } from "./Modals";

/** Montado global (App.tsx) — abre quando uma mutação tenta criar conteúdo
 * num cliente arquivado/"Ex-clientes" (ver queries.ts -> fail() e
 * require-active.ts -> assertClientActive). Reativar volta o cliente pra
 * "Social Media" (categoria padrão — a original de antes de virar
 * Ex-clientes não fica guardada em lugar nenhum) e conta de novo como
 * cliente ativo no plano. */
export function ClientReactivateModal() {
  const { pending, close } = useClientReactivate();
  const { updateClient } = useApi();

  if (!pending) return null;

  function reactivate() {
    if (!pending) return;
    updateClient.mutate(
      { data: { id: pending.id, patch: { archived: false, category: "Social Media" } } },
      {
        onSuccess: () => { toast.success(`"${pending.name}" reativado.`); close(); },
        onError: (e: any) => toastFriendlyError(e, "Não consegui reativar o cliente."),
      },
    );
  }

  return (
    <Modal open onClose={close} title="Cliente desativado">
      <div className="flex items-start gap-3 mb-4">
        <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(255,107,107,0.14)" }}>
          <AlertTriangle size={16} className="text-[#FF6B6B]" />
        </div>
        <p className="text-sm text-foreground/70 leading-relaxed">
          <strong className="text-foreground">{pending.name}</strong> está em Ex-clientes — por isso não dá pra criar conteúdo novo aqui.
          Quer reativar? Ele volta a contar como cliente ativo no seu plano.
        </p>
      </div>
      <div className="flex gap-2">
        <button onClick={close} className="flex-1 px-3 py-2 rounded-lg text-sm text-foreground/70 hover:bg-foreground/5">Cancelar</button>
        <button
          onClick={reactivate}
          disabled={updateClient.isPending}
          className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold bg-[rgb(var(--lz-brand-rgb))] text-black disabled:opacity-50"
        >
          {updateClient.isPending ? "Reativando…" : "Reativar cliente"}
        </button>
      </div>
    </Modal>
  );
}
