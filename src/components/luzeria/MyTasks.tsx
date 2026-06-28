import { useQuery } from "@tanstack/react-query";
import { myTasksQO, profilesQO, useMe } from "@/lib/luzeria/queries";
import { STATUS_META, STATUS_ORDER, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { useState } from "react";

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
    </div>
  );
}