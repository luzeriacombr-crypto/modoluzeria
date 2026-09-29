import { useState } from "react";
import { X, Users } from "lucide-react";
import { useMe } from "@/lib/luzeria/queries";
import { SmartImportStep } from "./SmartImportStep";

/**
 * Antes só dava pra importar clientes (Trello/ClickUp/Notion/arquivo) uma
 * vez, no primeiro acesso ou enquanto a agência tivesse menos de 2 clientes
 * — quem tentou e a importação trouxe só parte (ex: paginação do Trello,
 * token sem acesso a tudo) ficava sem como tentar de novo. Aqui reaproveita
 * o mesmo wizard (SmartImportStep) como uma ação permanente; importClients
 * já ignora nomes que já existem, então rodar de novo não duplica quem já
 * entrou certo da vez passada.
 */
export function ImportClientsSection() {
  const me = useMe().data;
  const isMaster = me?.role === "master";
  const [open, setOpen] = useState(false);

  if (!isMaster) return null;

  return (
    <div>
      <h2 className="text-xs uppercase font-bold text-foreground/50 tracking-wider mb-1.5 flex items-center gap-1.5">
        <Users size={12} /> Importar clientes
      </h2>
      <p className="text-[11px] text-foreground/40 mb-3 leading-relaxed">
        Traga clientes de um arquivo, print de tela, ou direto do Trello/ClickUp/Notion. Pode rodar quantas vezes
        precisar — quem já foi importado não entra duplicado.
      </p>
      <div className="bg-card rounded-lg px-5 py-4 flex items-center justify-between gap-3">
        <p className="text-xs text-foreground/50">Útil se a primeira importação não trouxe todo mundo.</p>
        <button onClick={() => setOpen(true)} className="lz-btn-primary text-xs px-4 py-2 rounded-md shrink-0 whitespace-nowrap">
          Importar clientes
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-card rounded-2xl p-7 max-h-[85vh] overflow-y-auto"
            style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-foreground text-lg font-bold">Importar clientes</h2>
              <button onClick={() => setOpen(false)} className="text-foreground/40 hover:text-foreground transition"><X size={18} /></button>
            </div>
            <SmartImportStep onDone={() => setOpen(false)} onSkip={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
