import { useQuery } from "@tanstack/react-query";
import { myTasksQO, productivityQO, profilesQO, useMe } from "@/lib/luzeria/queries";
import { STATUS_META, STATUS_ORDER, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { formatMonth, shortMonth } from "@/lib/luzeria/utils";

export function MyTasks() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const [viewAs, setViewAs] = useState<string>("");
  const targetId = isAdmin && viewAs ? viewAs : me?.id;
  const { data: tasks = [] } = useQuery({
    ...myTasksQO(targetId),
    enabled: !!targetId,
  });
  const { selectClient, selectMonth, openItem } = useUI();
  const monthKey = useUI((s) => s.selectedMonthKey);
  const { data: prod } = useQuery(productivityQO(monthKey, targetId));

  const grouped: Record<Status, typeof tasks> = {
    START: [], CRIACAO: [], REVISAO_ARTE: [], REVISAO_CLIENTE: [], FINALIZADO: [],
  };
  tasks.forEach((t) => grouped[t.status as Status].push(t));

  const targetProfile = profiles.find((p) => p.id === targetId);

  return (
    <div className="p-10 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-bold text-white leading-none tracking-tight">Minhas Demandas</h1>
          <p className="text-sm text-white/50 mt-2">
            {tasks.length} {tasks.length === 1 ? "tarefa atribuída" : "tarefas atribuídas"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/40">Ver como:</span>
            <select value={viewAs} onChange={(e) => setViewAs(e.target.value)}
              className="bg-[#1C1C1C] border border-white/10 text-sm text-white rounded-md px-3 py-1.5 outline-none focus:border-[#C8D44E]">
              <option value="">{me?.name} (eu)</option>
              {profiles.filter((p) => p.id !== me?.id).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {targetProfile && targetId !== me?.id && <Avatar profile={targetProfile} size={28} />}
          </div>
        )}
      </div>

      {tasks.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-16 text-center">
          <p className="text-white/50 text-sm">Sem tarefas no momento.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_ORDER.map((s) => {
            if (!grouped[s].length) return null;
            const m = STATUS_META[s]; const I = STATUS_ICONS[s];
            return (
              <div key={s}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="rounded p-1" style={{ backgroundColor: m.bg, color: m.color }}><I size={11} /></span>
                  <h2 className="text-[11px] uppercase font-bold tracking-wider text-white/60">{m.label}</h2>
                  <span className="text-[11px] text-white/40">· {grouped[s].length}</span>
                </div>
                <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
                  {grouped[s].map((t) => (
                    <button key={t.id}
                      onClick={() => { selectClient(t.clientId); selectMonth(t.monthKey); setTimeout(() => openItem(t.id), 30); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left border-b border-white/[0.05] last:border-b-0">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: t.clientColor + "33", color: t.clientColor.toUpperCase() === "#FFFFFF" ? "#FFFFFF" : t.clientColor }}>
                        {t.clientName}
                      </span>
                      <span className="text-[11px] text-white/50 uppercase font-semibold">
                        {t.type === "post" ? "Post" : "Reels"} {String(t.idx).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-white truncate flex-1">{t.title}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {prod && <ProductivityBlock prod={prod} monthKey={monthKey} />}
    </div>
  );
}

function ProductivityBlock({ prod, monthKey }: { prod: { weeks: number[]; items: string[][]; total: number; history: { key: string; count: number }[] }; monthKey: string }) {
  const [showHist, setShowHist] = useState(false);
  const max = Math.max(...prod.weeks, 1);
  const avg = (prod.weeks.reduce((a, b) => a + b, 0) / 4).toFixed(1);
  const bestIdx = prod.weeks.indexOf(Math.max(...prod.weeks));
  const histMax = Math.max(...prod.history.map((h) => h.count), 1);
  const histBest = prod.history.reduce((a, b) => (b.count > a.count ? b : a), prod.history[0] ?? { key: "", count: 0 });

  return (
    <div className="mt-10 rounded-lg p-6" style={{ background: "#1C1C1C", border: "1px solid rgba(200,212,78,0.15)" }}>
      <div className="flex items-end justify-between mb-1">
        <h3 className="text-lg font-bold text-white">Produtividade</h3>
        <span className="text-xs text-white/40">{formatMonth(monthKey)}</span>
      </div>
      <p className="text-xs text-white/50 mb-6">
        <span className="text-[#C8D44E] font-bold">{prod.total}</span> tarefa{prod.total === 1 ? "" : "s"} finalizada{prod.total === 1 ? "" : "s"} em {formatMonth(monthKey)}
      </p>

      <div className="flex items-end gap-4 h-44 px-2">
        {prod.weeks.map((v, i) => {
          const h = (v / max) * 100;
          const isBest = i === bestIdx && v > 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group relative">
              <div className="text-[11px] font-bold text-white">{v}</div>
              <div className="w-full rounded-t-md lz-grow-bar relative"
                style={{
                  height: `${Math.max(h, 4)}%`,
                  background: isBest
                    ? "linear-gradient(180deg, #C8D44E 0%, #8FA832 100%)"
                    : "rgba(200,212,78,0.25)",
                }}>
                {prod.items[i].length > 0 && (
                  <div className="hidden group-hover:block absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-48 z-10 bg-[#0D0D0D] border border-white/10 rounded-md p-2 text-[10px] text-white/80">
                    <div className="font-semibold text-[#C8D44E] mb-1">Semana {i + 1}</div>
                    {prod.items[i].slice(0, 5).map((t, j) => <div key={j} className="truncate">• {t}</div>)}
                    {prod.items[i].length > 5 && <div className="text-white/40">+{prod.items[i].length - 5}</div>}
                  </div>
                )}
              </div>
              <div className="text-[10px] text-white/40 uppercase font-semibold">S{i + 1}</div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-5 text-xs">
        <span className="text-[#C8D44E] font-semibold">
          {prod.weeks[bestIdx] > 0 ? `Melhor: Semana ${bestIdx + 1} com ${prod.weeks[bestIdx]} tarefa${prod.weeks[bestIdx] === 1 ? "" : "s"}` : "Sem tarefas finalizadas ainda"}
        </span>
        <span className="text-white/50">Média: {avg}/semana</span>
      </div>

      <button onClick={() => setShowHist((x) => !x)}
        className="mt-5 inline-flex items-center gap-1 text-[11px] text-white/50 hover:text-white">
        {showHist ? <ChevronUp size={12} /> : <ChevronDown size={12} />} Histórico 6 meses
      </button>
      {showHist && (
        <div className="mt-3 flex items-end gap-2 h-20">
          {prod.history.map((h) => {
            const isBest = h.key === histBest.key && h.count > 0;
            return (
              <div key={h.key} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] font-bold" style={{ color: isBest ? "#C8D44E" : "rgba(255,255,255,0.5)" }}>{h.count}</div>
                <div className="w-full rounded-t" style={{
                  height: `${(h.count / histMax) * 60 + 4}px`,
                  background: isBest ? "#C8D44E" : "rgba(200,212,78,0.25)",
                }} />
                <div className="text-[9px] text-white/40">{shortMonth(h.key)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}