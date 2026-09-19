import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, X } from "lucide-react";
import { clientsQO } from "@/lib/luzeria/queries";
import { SmartImportStep } from "./SmartImportStep";

const DISMISS_KEY = "modocriador:smart-import-banner-dismissed";

/** Nudge pra quem ainda tem menos de 2 clientes ativos — some sozinho
 * assim que a agência passar disso, e some (por essa sessão) se a pessoa
 * dispensar. Diferente do wizard já embutido no primeiro acesso
 * (WelcomeOnboarding): esse cobre quem pulou aquele passo, ou voltou
 * depois de um tempo sem completar o cadastro. */
export function SmartImportBanner({ isAdmin }: { isAdmin: boolean }) {
  // Sem valor padrão `[]` de propósito — enquanto a query ainda não
  // carregou, `clients` fica `undefined`, e o banner não decide nada até
  // ter a contagem real. Com `= []`, uma agência com 50 clientes via o
  // aviso "Traga seus clientes" piscar na tela por um instante a cada
  // carregamento, porque 0 (o array vazio) sempre bate no "< 2".
  const { data: clients } = useQuery({ ...clientsQO(), enabled: isAdmin });
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });
  const [open, setOpen] = useState(false);

  if (!clients) return null;
  const activeCount = clients.filter((c: any) => !c.archived && c.category !== "Ex-clientes").length;
  const shouldShow = isAdmin && !dismissed && activeCount < 2;
  if (!shouldShow) return null;

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch {}
    setDismissed(true);
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm text-white" style={{ background: "rgba(200,212,78,0.14)", borderBottom: "1px solid rgba(200,212,78,0.3)" }}>
        <Sparkles size={16} className="shrink-0" style={{ color: "#C8D44E" }} />
        <button onClick={() => setOpen(true)} className="flex-1 min-w-0 text-left hover:underline">
          <b className="font-semibold">Traga seus clientes de onde já estão</b> — manda uma planilha, print ou PDF e a IA organiza pra você revisar.
        </button>
        <button onClick={dismiss} title="Dispensar" className="shrink-0 opacity-80 hover:opacity-100"><X size={14} /></button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-card rounded-2xl p-7 max-h-[85vh] overflow-y-auto"
            style={{ border: "1px solid rgba(var(--lz-brand-light-rgb),0.18)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-foreground text-lg font-bold">Traga seus clientes</h2>
              <button onClick={() => setOpen(false)} className="text-foreground/40 hover:text-foreground transition"><X size={18} /></button>
            </div>
            <SmartImportStep onDone={() => setOpen(false)} onSkip={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}
