import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useMe } from "@/lib/luzeria/queries";
import { hasPermission } from "@/lib/luzeria/types";
import { ClientPaymentsPanel } from "./ClientPaymentsPanel";
import { MonthResultPanel } from "./MonthResultPanel";

const OrcamentosPanel = lazy(() => import("./OrcamentosPanel").then((m) => ({ default: m.OrcamentosPanel })));

export type FinanceTab = "entradas" | "resultado" | "orcamentos";
export const FINANCE_TABS: FinanceTab[] = ["entradas", "resultado", "orcamentos"];

const TABS: { id: FinanceTab; label: string; description: string }[] = [
  { id: "entradas", label: "Entradas e saídas", description: "Fluxo de caixa do mês, contas bancárias e cobrança dos clientes." },
  { id: "resultado", label: "Resultado do mês", description: "Receitas, despesas por categoria e o resultado, comparando com o mês anterior." },
  { id: "orcamentos", label: "Orçamentos", description: "Catálogo de produtos e propostas em PDF pros clientes." },
];

/** Página própria do Financeiro da agência (Etapa 3, 30/09) — antes morava
 * em Configurações → Financeiro. "Meu plano" e "Indique e ganhe" (assinatura
 * do Modo Criador) continuam em Configurações. Acesso: master ou cargo com
 * "view_financeiro", o mesmo que o servidor e o RLS já exigem. */
export function FinancePage({ tab, onTabChange }: { tab: FinanceTab; onTabChange: (t: FinanceTab) => void }) {
  const me = useMe().data;
  if (!me) return null;
  const canFinanceiro = me.role === "master" || hasPermission(me, "view_financeiro");
  const current = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-6xl mx-auto">
      <div className="mb-6 lz-no-print">
        <h1 className="text-[32px] font-bold text-foreground tracking-tight">Financeiro</h1>
        <p className="text-sm text-foreground/50 mt-2">{canFinanceiro ? current.description : "Acesso restrito."}</p>
      </div>

      {!canFinanceiro ? (
        <div className="text-center py-16 text-sm text-foreground/45 bg-card border border-foreground/7 rounded-xl">
          Você não tem acesso ao Financeiro. Peça pro master da agência liberar o cargo Financeiro pra você.
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 border-b border-foreground/10 mb-6 overflow-x-auto overflow-y-hidden lz-no-print">
            {TABS.map((t) => {
              const active = t.id === current.id;
              return (
                <button key={t.id} onClick={() => onTabChange(t.id)}
                  className="shrink-0 whitespace-nowrap px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors -mb-px border-b-2"
                  style={{
                    color: active ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
                    borderColor: active ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  }}>
                  {t.label}
                </button>
              );
            })}
          </div>
          {current.id === "entradas" ? <ClientPaymentsPanel /> :
           current.id === "resultado" ? <MonthResultPanel /> : (
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-foreground/30" size={22} /></div>}>
              <OrcamentosPanel />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
