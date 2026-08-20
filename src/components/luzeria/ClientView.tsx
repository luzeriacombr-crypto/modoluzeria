import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Info, Plus, LayoutGrid, List } from "lucide-react";
import { useState } from "react";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { clientsQO, monthKeysQO, monthQO, profilesQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { ContentItem } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { ContentCard, ContentListRow } from "./ContentCard";
import { FeedPreview } from "./FeedPreview";
import { ClientFichaContent } from "./ClientFichaPanel";
import { formatMonth } from "@/lib/luzeria/utils";
import { useMe } from "@/lib/luzeria/queries";
import { MaisAtividadesTab } from "./MaisAtividadesTab";
import { ClientDocsTab } from "./ClientDocsTab";
import { ClientReferenceLibraryTab } from "./ClientReferenceLibraryTab";

type OrderMode = "personalizada" | "cronologica";
type OrderDirection = "asc" | "desc";
type ViewMode = "grade" | "lista";
const ORDER_MODE_KEY = "lz-content-order-mode";
const ORDER_DIRECTION_KEY = "lz-content-order-direction";
const VIEW_MODE_KEY = "lz-content-view-mode";

function byScheduledAt(direction: OrderDirection) {
  return (a: ContentItem, b: ContentItem) => {
    const at = a.scheduledAt ? new Date(a.scheduledAt).getTime() : null;
    const bt = b.scheduledAt ? new Date(b.scheduledAt).getTime() : null;
    if (at === null && bt === null) return a.idx - b.idx;
    if (at === null) return 1;
    if (bt === null) return -1;
    return direction === "asc" ? at - bt : bt - at;
  };
}

type ClientTab = "posts" | "reels" | "stories" | "finalizados" | "mais" | "docs" | "biblioteca" | "feed" | "ficha";
const VALID_CLIENT_TABS: ClientTab[] = ["posts", "reels", "stories", "finalizados", "mais", "docs", "biblioteca", "feed", "ficha"];

export function ClientView({ clientId, tab: tabParam, onTabChange }: {
  clientId: string; tab?: string; onTabChange: (tab: ClientTab) => void;
}) {
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === clientId);
  const { data: profiles = [] } = useQuery(profilesQO());
  const { selectedMonthKey, selectMonth } = useUI();
  const { data: month } = useQuery(monthQO(clientId, selectedMonthKey));
  const { data: monthKeys = [] } = useQuery(monthKeysQO(clientId));
  const tab: ClientTab = (VALID_CLIENT_TABS as string[]).includes(tabParam ?? "") ? (tabParam as ClientTab) : "posts";
  const setTab = onTabChange;
  const [orderMode, setOrderMode] = useState<OrderMode>(
    () => (typeof window !== "undefined" && (localStorage.getItem(ORDER_MODE_KEY) as OrderMode)) || "personalizada",
  );
  function changeOrderMode(mode: OrderMode) {
    setOrderMode(mode);
    localStorage.setItem(ORDER_MODE_KEY, mode);
  }
  const [orderDirection, setOrderDirection] = useState<OrderDirection>(
    () => (typeof window !== "undefined" && (localStorage.getItem(ORDER_DIRECTION_KEY) as OrderDirection)) || "asc",
  );
  function changeOrderDirection(direction: OrderDirection) {
    setOrderDirection(direction);
    localStorage.setItem(ORDER_DIRECTION_KEY, direction);
  }
  const [viewMode, setViewMode] = useState<ViewMode>(
    () => (typeof window !== "undefined" && (localStorage.getItem(VIEW_MODE_KEY) as ViewMode)) || "grade",
  );
  function changeViewMode(mode: ViewMode) {
    setViewMode(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { duplicateMonth, addContentItem, deleteItem } = useApi();

  if (!client) return null;
  const isAvulso = client.category === "Avulsos";

  // Itens "Finalizado" saem da grade de trabalho (fica limpa pro time), mas
  // continuam existindo e visíveis no Preview de Feed — ver FeedPreview.tsx —
  // e reaparecem aqui, só pra consulta, na aba "Finalizados".
  const notFinalized = (items: ContentItem[]) => items.filter((i) => i.status !== "FINALIZADO");
  const onlyFinalized = (items: ContentItem[]) => items.filter((i) => i.status === "FINALIZADO");

  const TAB_CONFIG = {
    posts: { label: "Posts", type: "post" as const, items: notFinalized(month?.posts ?? []) },
    reels: { label: "Reels", type: "reel" as const, items: notFinalized(month?.reels ?? []) },
    stories: { label: "Stories", type: "story" as const, items: month?.stories ?? [] },
    finalizados: {
      label: "Finalizados",
      type: "post" as const,
      items: [...onlyFinalized(month?.posts ?? []), ...onlyFinalized(month?.reels ?? [])],
    },
  } as const;

  const disabledFeatures = new Set(me?.disabledFeatures ?? []);
  const tabs = (["posts", "reels", "stories", "finalizados", "mais", "docs", "biblioteca", "feed", "ficha"] as const)
    .filter((t) => t !== "stories" || !disabledFeatures.has("stories"))
    .filter((t) => t !== "docs" || isAdmin)
    .filter((t) => t !== "biblioteca" || !disabledFeatures.has("reference_library"));

  const sortedKeys = [...new Set([...monthKeys, selectedMonthKey])].sort();
  const idx = sortedKeys.indexOf(selectedMonthKey);

  function go(delta: number) {
    const nextIdx = idx + delta;
    if (nextIdx >= 0 && nextIdx < sortedKeys.length) selectMonth(sortedKeys[nextIdx]);
  }

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Avatar name={client.name} color={client.color} size={40} avatarUrl={client.photoUrl} />
        <div className="flex items-center gap-2">
          <div>
          <h1 className="text-[24px] font-bold text-white leading-tight">{client.name}</h1>
          {client.customFields.niche && (
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: "rgb(var(--lz-brand-rgb))" }}>{client.customFields.niche}</div>
          )}
          </div>
          <button
            onClick={() => setTab("ficha")}
            title="Ficha do cliente"
            className="ml-1 p-1.5 rounded-md text-white/50 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 transition"
          >
            <Info size={15} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isAvulso && <button onClick={() => go(-1)} disabled={idx <= 0}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition">
            <ChevronLeft size={16} />
          </button>}
          {isAvulso ? (
            <span className="rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))", border: "1px solid rgba(var(--lz-brand-light-rgb),0.3)" }}>
              Avulso
            </span>
          ) : (
            <span className="rounded-md px-3 py-1 text-xs font-bold uppercase" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              {formatMonth(selectedMonthKey)}
            </span>
          )}
          {!isAvulso && <button onClick={() => go(1)} disabled={idx >= sortedKeys.length - 1}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition">
            <ChevronRight size={16} />
          </button>}
          {isAdmin && !isAvulso && (
            <button onClick={() => duplicateMonth.mutate({ data: { clientId, fromKey: selectedMonthKey } })}
              className="inline-flex items-center gap-1.5 ml-2 rounded-md px-3 py-1.5 text-xs font-semibold text-white/80 border border-white/10 hover:border-[rgb(var(--lz-brand-rgb))] hover:text-[rgb(var(--lz-brand-rgb))] transition">
              <Copy size={13} /> Duplicar mês
            </button>
          )}
        </div>
      </div>

      {/* Tabs — horizontally scrollable on its own (touch swipe), scrollbar
       * hidden, so the rest of the page never shifts sideways on mobile
       * when there are more tabs than fit the viewport width. */}
      <div className="flex items-center gap-6 mt-8 border-b border-white/[0.06] overflow-x-auto overflow-y-hidden lz-no-scrollbar">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t as any)}
            className="relative py-3 text-sm font-semibold transition-colors shrink-0 whitespace-nowrap"
            style={{ color: tab === t ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}>
            {t === "feed" ? "Preview de Feed" : t === "ficha" ? "Ficha do Cliente" : t === "mais" ? "Mais atividades" : t === "docs" ? "Roteiros & Planejamento" : t === "biblioteca" ? "Biblioteca" : t === "finalizados" ? "Finalizados" : TAB_CONFIG[t as keyof typeof TAB_CONFIG]?.label ?? t}
            {tab === t && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {(tab in TAB_CONFIG) && (() => {
          const cfg = TAB_CONFIG[tab as keyof typeof TAB_CONFIG];
          const items = orderMode === "cronologica" ? [...cfg.items].sort(byScheduledAt(orderDirection)) : cfg.items;
          const navList = items.map((it) => it.id);
          return (
            <>
              <div className="flex items-center justify-end gap-1.5 mb-3">
                <div className="inline-flex items-center gap-0.5 rounded-full bg-white/[0.05] p-0.5 mr-2">
                  <button
                    onClick={() => changeViewMode("grade")}
                    title="Grade"
                    className="h-6 w-6 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: viewMode === "grade" ? "rgb(var(--lz-brand-rgb))" : "transparent",
                      color: viewMode === "grade" ? "#0D0D0D" : "rgba(255,255,255,0.5)",
                    }}
                  ><LayoutGrid size={12} /></button>
                  <button
                    onClick={() => changeViewMode("lista")}
                    title="Lista"
                    className="h-6 w-6 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: viewMode === "lista" ? "rgb(var(--lz-brand-rgb))" : "transparent",
                      color: viewMode === "lista" ? "#0D0D0D" : "rgba(255,255,255,0.5)",
                    }}
                  ><List size={12} /></button>
                </div>
                <span className="text-[10px] uppercase font-semibold text-white/30 tracking-wider mr-1">Ordem</span>
                {(["personalizada", "cronologica"] as const).map((m) => {
                  const active = orderMode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => changeOrderMode(m)}
                      className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors"
                      style={{
                        backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.06)",
                        color: active ? "#0D0D0D" : "rgba(255,255,255,0.5)",
                      }}
                    >
                      {m === "personalizada" ? "Personalizada" : "Cronológica"}
                    </button>
                  );
                })}
                {orderMode === "cronologica" && (
                  <select
                    value={orderDirection}
                    onChange={(e) => changeOrderDirection(e.target.value as OrderDirection)}
                    className="ml-1 bg-transparent border border-white/10 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white/50 outline-none cursor-pointer hover:text-white/70 hover:border-white/20 transition-colors"
                  >
                    <option value="desc" className="bg-[#1C1C1C] text-white">Recentes primeiro</option>
                    <option value="asc" className="bg-[#1C1C1C] text-white">Antigas primeiro</option>
                  </select>
                )}
              </div>
              {viewMode === "grade" ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lz-stagger-cards">
                  {items.map((item, i) => (
                    <ContentCard
                      key={item.id}
                      item={item}
                      profiles={profiles}
                      idx={i + 1}
                      isAvulso={isAvulso}
                      isAdmin={isAdmin}
                      navList={navList}
                      onDelete={async () => { if (await requestConfirm(`Excluir "${item.title}"?`, { danger: true })) deleteItem.mutate({ data: { id: item.id } }); }}
                    />
                  ))}
                  {isAdmin && tab !== "finalizados" && (
                    <button
                      onClick={() => addContentItem.mutate({
                        data: { clientId, key: selectedMonthKey, type: cfg.type },
                      })}
                      className="flex flex-col items-center justify-center gap-2 min-h-[200px] rounded-xl border border-dashed border-white/15 text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:border-[rgb(var(--lz-brand-rgb))] hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
                      style={{ transitionTimingFunction: "var(--ease-premium)" }}>
                      <Plus size={20} />
                      <span className="text-xs font-semibold">Adicionar {cfg.label}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1.5 lz-stagger">
                  {items.map((item, i) => (
                    <ContentListRow
                      key={item.id}
                      item={item}
                      profiles={profiles}
                      idx={i + 1}
                      isAvulso={isAvulso}
                      isAdmin={isAdmin}
                      navList={navList}
                      onDelete={async () => { if (await requestConfirm(`Excluir "${item.title}"?`, { danger: true })) deleteItem.mutate({ data: { id: item.id } }); }}
                    />
                  ))}
                  {isAdmin && tab !== "finalizados" && (
                    <button
                      onClick={() => addContentItem.mutate({
                        data: { clientId, key: selectedMonthKey, type: cfg.type },
                      })}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-white/15 text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:border-[rgb(var(--lz-brand-rgb))] transition-colors"
                    >
                      <Plus size={14} />
                      <span className="text-xs font-semibold">Adicionar {cfg.label}</span>
                    </button>
                  )}
                </div>
              )}
              {cfg.items.length === 0 && (!isAdmin || tab === "finalizados") && (
                <div className="px-4 py-10 text-center text-sm text-white/40">Sem itens nesta aba.</div>
              )}
            </>
          );
        })()}
        {tab === "mais" && month && (
          <MaisAtividadesTab
            clientId={clientId}
            monthKey={selectedMonthKey}
            gravacoes={month.gravacoes ?? []}
            roteiros={month.roteiros ?? []}
            sistemas={month.sistemas ?? []}
            outros={month.outros ?? []}
            profiles={profiles}
            isAdmin={isAdmin}
          />
        )}
        {tab === "docs" && isAdmin && (
          <div className="mt-2">
            <ClientDocsTab clientId={client.id} />
          </div>
        )}
        {tab === "biblioteca" && (
          <div className="mt-2">
            <ClientReferenceLibraryTab clientId={client.id} />
          </div>
        )}
        {tab === "ficha" && (
          <div className="mt-2 -mx-4 sm:-mx-6 md:mx-0 md:rounded-lg md:overflow-hidden md:border md:border-white/[0.06]">
            <ClientFichaContent clientId={client.id} />
          </div>
        )}
        {tab === "feed" && month && <FeedPreview month={month} client={client} />}
      </div>
    </div>
  );
}