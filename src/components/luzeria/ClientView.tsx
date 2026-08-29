import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Info, Plus, LayoutGrid, List, CheckSquare, Trash2, X, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { clientsQO, monthKeysQO, monthQO, profilesQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import type { ContentItem } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { ContentCard, ContentListRow } from "./ContentCard";
import { FeedPreview } from "./FeedPreview";
import { ClientFichaContent } from "./ClientFichaPanel";
import { formatMonth, nextMonthKey } from "@/lib/luzeria/utils";
import { useMe } from "@/lib/luzeria/queries";
import { MaisAtividadesTab } from "./MaisAtividadesTab";
import { ClientDocsTab } from "./ClientDocsTab";
import { ClientReferenceLibraryTab } from "./ClientReferenceLibraryTab";
import { CampanhasTab } from "./CampanhasTab";
import { Modal } from "./Modals";
import type { Client } from "@/lib/luzeria/types";

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

type ClientTab = "posts" | "reels" | "stories" | "finalizados" | "mais" | "feed" | "ficha";
const VALID_CLIENT_TABS: ClientTab[] = ["posts", "reels", "stories", "finalizados", "mais", "feed", "ficha"];
/** Abas que dá pra ocultar (por padrão da agência ou só pra um cliente) —
 * Ficha e Stories ficam de fora (Stories já tem seu próprio toggle de
 * sempre, "ficha" é o mínimo de navegação garantido). */
const HIDEABLE_TABS = ["posts", "reels", "finalizados", "mais", "feed"] as const;
type MaisSubTab = "atividades" | "campanhas" | "docs" | "biblioteca";

export function ClientView({ clientId, tab: tabParam, onTabChange }: {
  clientId: string; tab?: string; onTabChange: (tab: ClientTab) => void;
}) {
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === clientId);
  const isAvulso = client?.category === "Avulsos";
  const { data: profiles = [] } = useQuery(profilesQO());
  const { selectedMonthKey, selectMonth } = useUI();
  const { data: monthKeys = [] } = useQuery(monthKeysQO(clientId));
  // Avulso não tem seletor de mês na tela (não existe pra onde trocar) — é
  // sempre o único month_key que já existe pra ele, nunca o mês "atual"
  // selecionado globalmente pro resto do app. Sem isso, o conteúdo de um
  // avulso criado num mês passado simplesmente some assim que o calendário
  // vira, e adicionar conteúdo novo criaria um segundo mês fantasma.
  const effectiveMonthKey = isAvulso && monthKeys.length > 0 ? monthKeys[0] : selectedMonthKey;
  const { data: month } = useQuery(monthQO(clientId, effectiveMonthKey));
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
  const disabledFeatures = new Set(me?.disabledFeatures ?? []);
  const hiddenTabs = client?.hiddenTabs != null ? new Set(client.hiddenTabs) : disabledFeatures;
  // "posts" agora pode ser oculta, então o fallback (sem ?tab= na URL) não
  // pode mais ser fixo em "posts" — cai na primeira aba visível pra esse
  // cliente, senão a grade de conteúdo renderiza sem nenhuma aba destacada.
  const visibleTabs = VALID_CLIENT_TABS
    .filter((t) => t !== "stories" || !disabledFeatures.has("stories"))
    .filter((t) => !(HIDEABLE_TABS as readonly string[]).includes(t) || !hiddenTabs.has(t));
  const tab: ClientTab = tabParam && (visibleTabs as string[]).includes(tabParam)
    ? (tabParam as ClientTab)
    : (visibleTabs[0] ?? "posts");
  const [maisSubTab, setMaisSubTab] = useState<MaisSubTab>("atividades");
  const [customizingTabs, setCustomizingTabs] = useState(false);
  const { duplicateMonth, addContentItem, deleteItem, deleteContentItems, updateMyOrg, updateClient, reorderContentItems, moveItemToMonth } = useApi();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);
  const [movingItem, setMovingItem] = useState<ContentItem | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setLocalOrder(null); }, [tab, effectiveMonthKey, orderMode]);
  const canDragReorder = isAdmin && !selectMode && orderMode === "personalizada" && (tab === "posts" || tab === "reels");
  function applyLocalOrder(baseItems: readonly ContentItem[]): ContentItem[] {
    if (!localOrder) return [...baseItems];
    const byId = new Map(baseItems.map((i) => [i.id, i]));
    const seen = new Set<string>();
    const result: ContentItem[] = [];
    for (const id of localOrder) { const it = byId.get(id); if (it && !seen.has(id)) { result.push(it); seen.add(id); } }
    for (const it of baseItems) if (!seen.has(it.id)) result.push(it);
    return result;
  }
  function onDropReorder(targetId: string, currentItems: ContentItem[], monthId: string, type: "post" | "reel") {
    if (!dragId || dragId === targetId) { setDragId(null); setOverId(null); return; }
    const ids = currentItems.map((i) => i.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) { setDragId(null); setOverId(null); return; }
    ids.splice(from, 1);
    ids.splice(to, 0, dragId);
    setLocalOrder(ids);
    reorderContentItems.mutate({ data: { monthId, type, orderedItemIds: ids } });
    setDragId(null);
    setOverId(null);
  }
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function exitSelectMode() {
    setSelectMode(false);
    setSelectedIds(new Set());
  }
  async function bulkDelete() {
    if (selectedIds.size === 0) return;
    if (!(await requestConfirm(`Excluir ${selectedIds.size} ${selectedIds.size === 1 ? "item" : "itens"} selecionado${selectedIds.size === 1 ? "" : "s"}?`, { danger: true }))) return;
    deleteContentItems.mutate({ data: { ids: [...selectedIds] } }, { onSuccess: exitSelectMode });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { exitSelectMode(); }, [tab, effectiveMonthKey]);

  if (!client) return null;

  // Itens "Finalizado" saem da grade de trabalho (fica limpa pro time), mas
  // continuam existindo e visíveis no Preview de Feed — ver FeedPreview.tsx —
  // e reaparecem aqui, só pra consulta, na aba "Finalizados".
  const notFinalized = (items: ContentItem[]) => items.filter((i) => i.status !== "FINALIZADO");
  const onlyFinalized = (items: ContentItem[]) => items.filter((i) => i.status === "FINALIZADO");
  // Itens marcados como "interno" numa campanha continuam existindo em
  // month.posts/reels (senão o modal de detalhe se perderia ao alternar o
  // toggle), mas somem daqui — só ficam visíveis dentro da própria campanha.
  const notCampaignInternal = (items: ContentItem[]) => items.filter((i) => !i.campaignInternal);

  const TAB_CONFIG = {
    posts: { label: "Posts", type: "post" as const, items: notFinalized(notCampaignInternal(month?.posts ?? [])) },
    reels: { label: "Reels", type: "reel" as const, items: notFinalized(notCampaignInternal(month?.reels ?? [])) },
    stories: { label: "Stories", type: "story" as const, items: month?.stories ?? [] },
    finalizados: {
      label: "Finalizados",
      type: "post" as const,
      items: [...onlyFinalized(notCampaignInternal(month?.posts ?? [])), ...onlyFinalized(notCampaignInternal(month?.reels ?? []))],
    },
  } as const;

  const showDocsSubTab = isAdmin;
  const showBibliotecaSubTab = !disabledFeatures.has("reference_library");
  const tabs = visibleTabs;

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
          <h1 className="text-[24px] font-bold text-foreground leading-tight">{client.name}</h1>
          {client.customFields.niche && (
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: "var(--lz-accent-ink)" }}>{client.customFields.niche}</div>
          )}
          </div>
          <button
            onClick={() => setTab("ficha")}
            title="Ficha do cliente"
            className="ml-1 p-1.5 rounded-md text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition"
          >
            <Info size={15} />
          </button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {!isAvulso && <button onClick={() => go(-1)} disabled={idx <= 0}
            className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 transition">
            <ChevronLeft size={16} />
          </button>}
          {isAvulso ? (
            <span className="rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)", border: "1px solid rgba(var(--lz-brand-light-rgb),0.3)" }}>
              Avulso
            </span>
          ) : (
            <span className="rounded-md px-3 py-1 text-xs font-bold uppercase" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              {formatMonth(selectedMonthKey)}
            </span>
          )}
          {!isAvulso && <button onClick={() => go(1)} disabled={idx >= sortedKeys.length - 1}
            className="h-8 w-8 flex items-center justify-center rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-30 transition">
            <ChevronRight size={16} />
          </button>}
          {isAdmin && !isAvulso && (
            <button onClick={() => duplicateMonth.mutate({ data: { clientId, fromKey: selectedMonthKey } })}
              disabled={duplicateMonth.isPending}
              className="inline-flex items-center gap-1.5 ml-2 rounded-md px-3 py-1.5 text-xs font-semibold text-foreground/80 border border-foreground/10 hover:border-[rgb(var(--lz-brand-rgb))] hover:text-[var(--lz-accent-ink)] transition">
              <Copy size={13} /> Duplicar mês
            </button>
          )}
        </div>
      </div>

      {/* Tabs — horizontally scrollable on its own (touch swipe), scrollbar
       * hidden, so the rest of the page never shifts sideways on mobile
       * when there are more tabs than fit the viewport width. */}
      <div className="flex items-center gap-2 mt-8 border-b border-foreground/6">
        <div className="flex items-center gap-6 overflow-x-auto overflow-y-hidden lz-no-scrollbar flex-1 min-w-0">
          {tabs.map((t) => (
            <button key={t} onClick={() => setTab(t as any)}
              className="relative py-3 text-sm font-semibold transition-colors shrink-0 whitespace-nowrap"
              style={{ color: tab === t ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 50%, transparent)" }}>
              {t === "feed" ? "Preview de Feed" : t === "ficha" ? "Ficha do Cliente" : t === "mais" ? "Mais" : t === "finalizados" ? "Finalizados" : TAB_CONFIG[t as keyof typeof TAB_CONFIG]?.label ?? t}
              {tab === t && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }} />}
            </button>
          ))}
        </div>
        {isAdmin && (
          <button onClick={() => setCustomizingTabs(true)} title="Personalizar abas"
            className="shrink-0 p-1.5 mb-1 rounded-md text-foreground/40 hover:text-foreground hover:bg-foreground/5 transition">
            <Settings2 size={15} />
          </button>
        )}
      </div>
      {customizingTabs && (
        <CustomizeTabsModal
          client={client}
          disabledFeatures={disabledFeatures}
          onClose={() => setCustomizingTabs(false)}
          onSaveOrgDefault={(hidden) => updateMyOrg.mutate({
            data: { disabledFeatures: [...new Set([...(me?.disabledFeatures ?? []).filter((f) => !(HIDEABLE_TABS as readonly string[]).includes(f)), ...hidden])] },
          })}
          onSaveClientOverride={(hidden) => updateClient.mutate({ data: { id: client.id, patch: { hidden_tabs: hidden } } })}
          onClearClientOverride={() => updateClient.mutate({ data: { id: client.id, patch: { hidden_tabs: null } } })}
        />
      )}

      <div className="mt-2">
        {(tab in TAB_CONFIG) && (() => {
          const cfg = TAB_CONFIG[tab as keyof typeof TAB_CONFIG];
          const items = orderMode === "cronologica" ? [...cfg.items].sort(byScheduledAt(orderDirection)) : applyLocalOrder(cfg.items);
          const navList = items.map((it) => it.id);
          return (
            <>
              {selectMode ? (
                <div className="flex items-center justify-between gap-2 mb-3 rounded-lg px-3 py-2" style={{ background: "rgba(var(--lz-brand-rgb),0.1)", border: "1px solid rgba(var(--lz-brand-rgb),0.3)" }}>
                  <span className="text-xs font-semibold text-foreground">
                    {selectedIds.size === 0 ? "Selecione os itens" : `${selectedIds.size} selecionado${selectedIds.size === 1 ? "" : "s"}`}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={bulkDelete}
                      disabled={selectedIds.size === 0 || deleteContentItems.isPending}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-red-400 hover:bg-red-500/10 disabled:opacity-30 transition"
                    >
                      <Trash2 size={13} /> Excluir selecionados
                    </button>
                    <button onClick={exitSelectMode} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition">
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
              <div className="flex items-center justify-end gap-1.5 mb-3">
                {isAdmin && tab !== "finalizados" && items.length > 0 && (
                  <button
                    onClick={() => setSelectMode(true)}
                    title="Selecionar vários"
                    className="h-6 w-6 rounded-full flex items-center justify-center transition-colors text-foreground/50 hover:text-foreground hover:bg-foreground/[0.08] mr-1"
                  ><CheckSquare size={13} /></button>
                )}
                <div className="inline-flex items-center gap-0.5 rounded-full bg-foreground/[0.05] p-0.5 mr-2">
                  <button
                    onClick={() => changeViewMode("grade")}
                    title="Grade"
                    className="h-6 w-6 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: viewMode === "grade" ? "rgb(var(--lz-brand-rgb))" : "transparent",
                      color: viewMode === "grade" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
                    }}
                  ><LayoutGrid size={12} /></button>
                  <button
                    onClick={() => changeViewMode("lista")}
                    title="Lista"
                    className="h-6 w-6 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      backgroundColor: viewMode === "lista" ? "rgb(var(--lz-brand-rgb))" : "transparent",
                      color: viewMode === "lista" ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
                    }}
                  ><List size={12} /></button>
                </div>
                <span className="text-[10px] uppercase font-semibold text-foreground/30 tracking-wider mr-1">
                  Ordem
                  {canDragReorder && <span className="normal-case tracking-normal ml-1.5 text-foreground/25">— arraste pra reordenar</span>}
                </span>
                {(["personalizada", "cronologica"] as const).map((m) => {
                  const active = orderMode === m;
                  return (
                    <button
                      key={m}
                      onClick={() => changeOrderMode(m)}
                      className="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors"
                      style={{
                        backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
                        color: active ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 50%, transparent)",
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
                    className="ml-1 bg-transparent border border-foreground/10 rounded-full px-2.5 py-1 text-[10px] font-semibold text-foreground/50 outline-none cursor-pointer hover:text-foreground/70 hover:border-foreground/20 transition-colors"
                  >
                    <option value="desc" className="bg-card text-foreground">Recentes primeiro</option>
                    <option value="asc" className="bg-card text-foreground">Antigas primeiro</option>
                  </select>
                )}
              </div>
              )}
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
                      onMove={!isAvulso ? () => setMovingItem(item) : undefined}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelected(item.id)}
                      draggable={canDragReorder}
                      isDragging={dragId === item.id}
                      isOver={overId === item.id}
                      onDragStart={() => setDragId(item.id)}
                      onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== item.id) setOverId(item.id); }}
                      onDragLeave={() => { if (overId === item.id) setOverId(null); }}
                      onDrop={() => onDropReorder(item.id, items, month!.id, cfg.type as "post" | "reel")}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                    />
                  ))}
                  {!selectMode && isAdmin && tab !== "finalizados" && (
                    <button
                      onClick={() => addContentItem.mutate({
                        data: { clientId, key: effectiveMonthKey, type: cfg.type },
                      })}
                      className="flex flex-col items-center justify-center gap-2 min-h-[200px] rounded-xl border border-dashed border-foreground/15 text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] hover:-translate-y-1 hover:shadow-xl transition-all duration-300"
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
                      onMove={!isAvulso ? () => setMovingItem(item) : undefined}
                      selectMode={selectMode}
                      selected={selectedIds.has(item.id)}
                      onToggleSelect={() => toggleSelected(item.id)}
                      draggable={canDragReorder}
                      isDragging={dragId === item.id}
                      isOver={overId === item.id}
                      onDragStart={() => setDragId(item.id)}
                      onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== item.id) setOverId(item.id); }}
                      onDragLeave={() => { if (overId === item.id) setOverId(null); }}
                      onDrop={() => onDropReorder(item.id, items, month!.id, cfg.type as "post" | "reel")}
                      onDragEnd={() => { setDragId(null); setOverId(null); }}
                    />
                  ))}
                  {!selectMode && isAdmin && tab !== "finalizados" && (
                    <button
                      onClick={() => addContentItem.mutate({
                        data: { clientId, key: effectiveMonthKey, type: cfg.type },
                      })}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-foreground/15 text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] transition-colors"
                    >
                      <Plus size={14} />
                      <span className="text-xs font-semibold">Adicionar {cfg.label}</span>
                    </button>
                  )}
                </div>
              )}
              {cfg.items.length === 0 && (!isAdmin || tab === "finalizados") && (
                <div className="px-4 py-10 text-center text-sm text-foreground/40">Sem itens nesta aba.</div>
              )}
            </>
          );
        })()}
        {tab === "mais" && (
          <div className="mt-2">
            <div className="flex items-center gap-2 mb-5">
              <MaisSubTabPill active={maisSubTab === "atividades"} onClick={() => setMaisSubTab("atividades")}>Atividades</MaisSubTabPill>
              <MaisSubTabPill active={maisSubTab === "campanhas"} onClick={() => setMaisSubTab("campanhas")}>Campanhas</MaisSubTabPill>
              {showDocsSubTab && (
                <MaisSubTabPill active={maisSubTab === "docs"} onClick={() => setMaisSubTab("docs")}>Roteiros &amp; Planejamento</MaisSubTabPill>
              )}
              {showBibliotecaSubTab && (
                <MaisSubTabPill active={maisSubTab === "biblioteca"} onClick={() => setMaisSubTab("biblioteca")}>Biblioteca</MaisSubTabPill>
              )}
            </div>
            {maisSubTab === "atividades" && month && (
              <MaisAtividadesTab
                clientId={clientId}
                monthKey={effectiveMonthKey}
                gravacoes={month.gravacoes ?? []}
                roteiros={month.roteiros ?? []}
                sistemas={month.sistemas ?? []}
                outros={month.outros ?? []}
                profiles={profiles}
                isAdmin={isAdmin}
              />
            )}
            {maisSubTab === "campanhas" && (
              <CampanhasTab clientId={client.id} monthKey={effectiveMonthKey} isAdmin={isAdmin} />
            )}
            {maisSubTab === "docs" && showDocsSubTab && <ClientDocsTab clientId={client.id} />}
            {maisSubTab === "biblioteca" && showBibliotecaSubTab && <ClientReferenceLibraryTab clientId={client.id} />}
          </div>
        )}
        {tab === "ficha" && (
          <div className="mt-2 -mx-4 sm:-mx-6 md:mx-0 md:rounded-lg md:overflow-hidden md:border md:border-foreground/6">
            <ClientFichaContent clientId={client.id} />
          </div>
        )}
        {tab === "feed" && month && <FeedPreview month={month} client={client} />}
      </div>
      {movingItem && (
        <MoveItemModal
          item={movingItem}
          clientId={clientId}
          currentKey={effectiveMonthKey}
          onClose={() => setMovingItem(null)}
          onMove={(targetKey) => {
            moveItemToMonth.mutate({ data: { itemId: movingItem.id, targetKey } });
            setMovingItem(null);
          }}
        />
      )}
    </div>
  );
}

function MoveItemModal({ item, clientId, currentKey, onClose, onMove }: {
  item: ContentItem; clientId: string; currentKey: string; onClose: () => void; onMove: (targetKey: string) => void;
}) {
  const { data: monthKeys = [] } = useQuery(monthKeysQO(clientId));
  const [customKey, setCustomKey] = useState("");
  const upcoming: string[] = [];
  let k = currentKey;
  for (let i = 0; i < 6; i++) { k = nextMonthKey(k); upcoming.push(k); }
  const options = [...new Set([...monthKeys.filter((mk) => mk !== currentKey), ...upcoming])].sort();

  return (
    <Modal open onClose={onClose} title={`Mover "${item.title || "item sem título"}"`}>
      <p className="text-xs text-foreground/50 mb-3">Escolha pra qual mês mover este {item.type === "reel" ? "reel" : "post"}. Está em {formatMonth(currentKey)}.</p>
      <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
        {options.map((key) => (
          <button
            key={key}
            onClick={() => onMove(key)}
            className="text-left px-3 py-2 rounded-md text-sm font-medium text-foreground hover:bg-foreground/[0.06] transition-colors"
          >
            {formatMonth(key)}
            {!monthKeys.includes(key) && <span className="ml-2 text-[10px] uppercase font-bold text-foreground/30">Novo mês</span>}
          </button>
        ))}
      </div>
      <div className="mt-3 pt-3 border-t border-foreground/6 flex items-center gap-2">
        <input
          type="month"
          value={customKey}
          onChange={(e) => setCustomKey(e.target.value)}
          className="flex-1 bg-transparent border border-foreground/10 rounded-md px-2.5 py-1.5 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] transition-colors"
        />
        <button
          onClick={() => customKey && onMove(customKey)}
          disabled={!customKey}
          className="rounded-md px-3 py-1.5 text-xs font-bold uppercase disabled:opacity-30 transition"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Mover
        </button>
      </div>
    </Modal>
  );
}

function MaisSubTabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
      style={{
        backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
        color: active ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
      }}>
      {children}
    </button>
  );
}

const HIDEABLE_TAB_LABEL: Record<(typeof HIDEABLE_TABS)[number], string> = {
  posts: "Posts", reels: "Reels", finalizados: "Finalizados", mais: "Mais", feed: "Preview de Feed",
};

function CustomizeTabsModal({ client, disabledFeatures, onClose, onSaveOrgDefault, onSaveClientOverride, onClearClientOverride }: {
  client: Client;
  disabledFeatures: Set<string>;
  onClose: () => void;
  onSaveOrgDefault: (hidden: string[]) => void;
  onSaveClientOverride: (hidden: string[]) => void;
  onClearClientOverride: () => void;
}) {
  const hasOverride = client.hiddenTabs != null;
  const [hidden, setHidden] = useState<Set<string>>(new Set(client.hiddenTabs ?? disabledFeatures));

  function toggle(t: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  }

  return (
    <Modal open onClose={onClose} title="Personalizar abas">
      <p className="text-xs text-foreground/50 mb-4">Escolha quais abas ficam visíveis. Salve como padrão pra todos os clientes, ou só pra {client.name}.</p>
      <div className="space-y-2 mb-5">
        {HIDEABLE_TABS.map((t) => (
          <label key={t} className="flex items-center gap-2.5 text-sm text-foreground/80">
            <input type="checkbox" checked={!hidden.has(t)} onChange={() => toggle(t)} />
            {HIDEABLE_TAB_LABEL[t]}
          </label>
        ))}
      </div>
      {hasOverride && (
        <button
          onClick={() => { onClearClientOverride(); onClose(); }}
          className="text-[11px] text-foreground/40 hover:text-foreground mb-4 underline"
        >
          Remover exceção — voltar a usar o padrão da agência pra {client.name}
        </button>
      )}
      <div className="flex items-center justify-end gap-2">
        <button onClick={onClose} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
        <button
          onClick={() => { onSaveClientOverride([...hidden]); onClose(); }}
          className="px-3 py-2 rounded-md text-xs font-bold border border-foreground/15 text-foreground/80 hover:border-[rgb(var(--lz-brand-rgb))] hover:text-[var(--lz-accent-ink)] transition"
        >
          Salvar só pra {client.name}
        </button>
        <button
          onClick={() => { onSaveOrgDefault([...hidden]); onClose(); }}
          className="px-4 py-2 rounded-md text-xs font-bold transition-opacity hover:opacity-90"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Salvar como padrão da agência
        </button>
      </div>
    </Modal>
  );
}