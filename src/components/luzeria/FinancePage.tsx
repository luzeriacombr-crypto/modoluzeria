import { lazy, Suspense } from "react";
import { FolderTabs } from "./FolderTabs";
import { Loader2 } from "lucide-react";
import { useMe } from "@/lib/luzeria/queries";
import { hasPermission } from "@/lib/luzeria/types";
import { isHouse } from "@/lib/luzeria/house";
import { ClientPaymentsPanel } from "./ClientPaymentsPanel";
import { MonthResultPanel } from "./MonthResultPanel";
import { ClientMarginPanel } from "./ClientMarginPanel";

const OrcamentosPanel = lazy(() => import("./OrcamentosPanel").then((m) => ({ default: m.OrcamentosPanel })));

export type FinanceTab = "entradas" | "resultado" | "margem" | "orcamentos";
export const FINANCE_TABS: FinanceTab[] = ["entradas", "resultado", "margem", "orcamentos"];

const TABS: { id: FinanceTab; label: string; description: string }[] = [
  { id: "entradas", label: "Entradas e saídas", description: "Fluxo de caixa do mês, contas bancárias e cobrança dos clientes." },
  { id: "resultado", label: "Resultado do mês", description: "Receitas, despesas por categoria e o resultado, comparando com o mês anterior." },
  { id: "margem", label: "Margem por cliente", description: "Quanto cada cliente rende, descontando o custo estimado da equipe." },
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
  const house = isHouse(me);
  // Margem usa o custo-hora da equipe — o servidor só libera pra master/setor,
  // e o toggle "margin" (Configurações → Geral) esconde. Na House vira "Custo
  // por marca": só o custo da equipe em cada marca e o total da house.
  const showMargem = me.role !== "member" && !(me.disabledFeatures ?? []).includes("margin");
  const tabs = TABS
    .filter((t) => t.id !== "margem" || showMargem)
    .map((t) => t.id === "margem" && house
      ? { ...t, label: "Custo por marca", description: "Quanto a equipe custa em cada marca e a fatia de cada uma no total da house." }
      : t);
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

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
          <FolderTabs activeId={current.id} onChange={(id) => onTabChange(id as any)} items={tabs.map((t) => ({ id: t.id, label: t.label }))} />
          {current.id === "entradas" ? <ClientPaymentsPanel /> :
           current.id === "resultado" ? <MonthResultPanel /> :
           current.id === "margem" ? <ClientMarginPanel /> : (
            <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="animate-spin text-foreground/30" size={22} /></div>}>
              <OrcamentosPanel />
            </Suspense>
          )}
        </>
      )}
    </div>
  );
}
