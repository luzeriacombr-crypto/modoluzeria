import { useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMe } from "./queries";
import { useUI } from "./ui-store";

/** Aba do cliente onde um item mora (pedido do Junior, 02/10: clicar numa
 * demanda tem que cair no lugar exato, não na primeira aba do cliente). */
export function clientTabForItem(type: string | null | undefined, opts?: { finalizadosSeparateTab?: boolean; status?: string | null }): string {
  const t = type ?? "";
  if ((t === "post" || t === "reel") && opts?.finalizadosSeparateTab && opts.status === "FINALIZADO") return "finalizados";
  if (t === "post") return "posts";
  if (t === "reel") return "reels";
  if (t === "story") return "stories";
  return "mais";
}

export type GoToItemTarget = {
  itemId: string;
  clientId: string;
  monthKey?: string | null;
  type?: string | null;
  status?: string | null;
  /** Também abre o painel de detalhes do item (comportamento antigo das telas que já abriam). */
  openPanel?: boolean;
};

/** Leva até o item: cliente → aba certa → mês certo → rola até o card e
 * pisca. Compartilhado por Minhas Demandas, notificações, calendário,
 * atividade do Instagram e painel de desempenho. */
export function useGoToItem() {
  const navigate = useNavigate();
  const { selectMonth, openItem, flash } = useUI();
  const finalizadosSeparateTab = useMe().data?.finalizadosSeparateTab ?? false;
  return useCallback((t: GoToItemTarget) => {
    const tab = clientTabForItem(t.type, { finalizadosSeparateTab, status: t.status });
    navigate({ to: "/cliente/$clientId", params: { clientId: t.clientId }, search: { tab } });
    if (t.monthKey) selectMonth(t.monthKey);
    if (t.openPanel) setTimeout(() => openItem(t.itemId), 50);
    // Espera o cliente/aba montarem, rola até o card e só então pisca.
    [350, 900].forEach((ms) => setTimeout(() => document.getElementById(`item-${t.itemId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), ms));
    setTimeout(() => flash(t.itemId), 650);
    setTimeout(() => flash(null), 2300);
  }, [navigate, selectMonth, openItem, flash, finalizadosSeparateTab]);
}
