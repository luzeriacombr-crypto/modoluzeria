import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Info, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { clientsQO, monthKeysQO, monthQO, profilesQO, useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { ContentRow } from "./ContentRow";
import { FeedPreview } from "./FeedPreview";
import { ClientFichaContent } from "./ClientFichaPanel";
import { formatMonth } from "@/lib/luzeria/utils";
import { useMe } from "@/lib/luzeria/queries";
import { MaisAtividadesTab } from "./MaisAtividadesTab";

export function ClientView({ clientId }: { clientId: string }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === clientId);
  const { data: profiles = [] } = useQuery(profilesQO());
  const { selectedMonthKey, selectMonth } = useUI();
  const { data: month } = useQuery(monthQO(clientId, selectedMonthKey));
  const { data: monthKeys = [] } = useQuery(monthKeysQO(clientId));
  const [tab, setTab] = useState<"posts" | "reels" | "mais" | "feed" | "ficha">("posts");
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { duplicateMonth, addContentItem, deleteItem } = useApi();

  if (!client) return null;
  const isAvulso = client.category === "Avulsos";

  const TAB_CONFIG = {
    posts: { label: "Posts", type: "post" as const, items: month?.posts ?? [] },
    reels: { label: "Reels", type: "reel" as const, items: month?.reels ?? [] },
  } as const;

  const tabs = isAvulso
    ? (["posts", "reels", "mais", "feed"] as const)
    : (["posts", "reels", "mais", "feed", "ficha"] as const);

  const sortedKeys = [...new Set([...monthKeys, selectedMonthKey])].sort();
  const idx = sortedKeys.indexOf(selectedMonthKey);

  function go(delta: number) {
    const nextIdx = idx + delta;
    if (nextIdx >= 0 && nextIdx < sortedKeys.length) selectMonth(sortedKeys[nextIdx]);
  }

  return (
    <div className="px-10 py-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Avatar name={client.name} color={client.color} size={40} avatarUrl={client.photoUrl} />
        <div className="flex items-center gap-2">
          <div>
          <h1 className="text-[24px] font-bold text-white leading-tight">{client.name}</h1>
          {client.customFields.niche && (
            <div className="text-[13px] font-semibold mt-0.5" style={{ color: "#C8D44E" }}>{client.customFields.niche}</div>
          )}
          </div>
          <button
            onClick={() => setTab(isAvulso ? "feed" : "ficha")}
            title="Ficha do cliente"
            className="ml-1 p-1.5 rounded-md text-white/50 hover:text-[#C8D44E] hover:bg-white/5 transition"
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
            <span className="rounded-md px-3 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E", border: "1px solid rgba(200,212,78,0.3)" }}>
              Avulso
            </span>
          ) : (
            <span className="rounded-md px-3 py-1 text-xs font-bold uppercase" style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
              {formatMonth(selectedMonthKey)}
            </span>
          )}
          {!isAvulso && <button onClick={() => go(1)} disabled={idx >= sortedKeys.length - 1}
            className="h-8 w-8 flex items-center justify-center rounded-md text-white/60 hover:text-white hover:bg-white/5 disabled:opacity-30 transition">
            <ChevronRight size={16} />
          </button>}
          {isAdmin && !isAvulso && (
            <button onClick={() => duplicateMonth.mutate({ data: { clientId, fromKey: selectedMonthKey } })}
              className="inline-flex items-center gap-1.5 ml-2 rounded-md px-3 py-1.5 text-xs font-semibold text-white/80 border border-white/10 hover:border-[#C8D44E] hover:text-[#C8D44E] transition">
              <Copy size={13} /> Duplicar mês
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-6 mt-8 border-b border-white/[0.06]">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t as any)}
            className="relative py-3 text-sm font-semibold transition-colors"
            style={{ color: tab === t ? "#FFFFFF" : "rgba(255,255,255,0.5)" }}>
            {t === "feed" ? "Preview de Feed" : t === "ficha" ? "Ficha do Cliente" : t === "mais" ? "Mais atividades" : TAB_CONFIG[t as keyof typeof TAB_CONFIG]?.label ?? t}
            {tab === t && <span className="absolute left-0 right-0 bottom-[-1px] h-[2px]" style={{ backgroundColor: "#C8D44E" }} />}
          </button>
        ))}
      </div>

      <div className="mt-2">
        {(tab in TAB_CONFIG) && (() => {
          const cfg = TAB_CONFIG[tab as keyof typeof TAB_CONFIG];
          return (
            <>
              {cfg.items.map((item, i) => (
                <div key={item.id} className="group/row relative pr-12">
                  <ContentRow item={item} profiles={profiles} idx={i + 1} />
                  {isAdmin && (
                    <button
                      onClick={() => { if (confirm(`Excluir "${item.title}"?`)) deleteItem.mutate({ data: { id: item.id } }); }}
                      title="Excluir item"
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover/row:opacity-100 p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-red-500/10 transition">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
              {isAdmin && (
                <button
                  onClick={() => addContentItem.mutate({
                    data: { clientId, key: selectedMonthKey, type: cfg.type },
                  })}
                  className="mt-4 ml-4 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold border border-dashed border-white/15 text-white/60 hover:text-[#C8D44E] hover:border-[#C8D44E] transition">
                  <Plus size={13} /> Adicionar {cfg.label}
                </button>
              )}
              {cfg.items.length === 0 && !isAdmin && (
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
        {tab === "ficha" && (
          <div className="mt-2 -mx-10 md:mx-0 md:rounded-lg md:overflow-hidden md:border md:border-white/[0.06]">
            <ClientFichaContent clientId={client.id} />
          </div>
        )}
        {tab === "feed" && month && <FeedPreview month={month} client={client} />}
      </div>
    </div>
  );
}