import { useQuery } from "@tanstack/react-query";
import { myTasksQO, myTodayQO, productivityQO, profilesQO, useMe, useApi } from "@/lib/luzeria/queries";
import { STATUS_META, STATUS_ORDER, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { useState } from "react";
import { ChevronDown, ChevronUp, Camera, Sparkles, List, CalendarDays, Clock, Check, X, Circle } from "lucide-react";
import { formatMonth, shortMonth, deadlineInfo } from "@/lib/luzeria/utils";
import { CLEANING_TASKS } from "./CleaningView";
import { GoalsWidget } from "./GoalsWidget";
import { MyWeekView } from "./MyWeekView";

export function MyTasks() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { setStoryDone, setCleaningDone } = useApi();
  const [viewAs, setViewAs] = useState<string>("");
  const targetId = isAdmin && viewAs ? viewAs : me?.id;
  const { data: tasks = [] } = useQuery({
    ...myTasksQO(targetId),
    enabled: !!targetId,
  });
  const { selectClient, selectMonth, openItem } = useUI();
  const monthKey = useUI((s) => s.selectedMonthKey);
  const { data: prod } = useQuery(productivityQO(monthKey, targetId));

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // JS Sunday=0..Saturday=6 → our weekday Monday=0..Saturday=5 (Sunday => -1 skip)
  const dow = now.getDay();
  const weekdayIdx = dow === 0 ? -1 : dow - 1;
  const { data: today } = useQuery({
    ...myTodayQO(todayStr, weekdayIdx, targetId),
    enabled: !!targetId,
  });

  const grouped: Record<Status, typeof tasks> = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, [] as typeof tasks])
  ) as Record<Status, typeof tasks>;
  tasks.forEach((t) => {
    const s = t.status as Status;
    if (grouped[s]) grouped[s].push(t);
  });
  // Sort each group by due date asc; nulls last.
  (Object.keys(grouped) as Status[]).forEach((s) => {
    grouped[s] = [...grouped[s]].sort((a: any, b: any) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  });

  const targetProfile = profiles.find((p) => p.id === targetId);
  const [view, setView] = useState<"list" | "week">("list");

  return (
    <div className="p-10 max-w-5xl mx-auto" data-tour="my-tasks">
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-[32px] font-bold text-white leading-none tracking-tight">Coisas para fazer</h1>
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

      {targetId && <div data-tour="goals"><GoalsWidget monthKey={monthKey} userId={targetId} /></div>}

      <div className="inline-flex bg-[#1C1C1C] border border-white/[0.06] rounded-lg p-1 mb-6" data-tour="my-week">
        {[
          { id: "list" as const, label: "Lista", Icon: List },
          { id: "week" as const, label: "Minha Semana", Icon: CalendarDays },
        ].map((v) => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
              view === v.id ? "bg-[#C8D44E] text-black" : "text-white/60 hover:text-white"}`}>
            <v.Icon size={12} /> {v.label}
          </button>
        ))}
      </div>

      {(today?.stories || (today?.cleaningTaskIdx?.length ?? 0) > 0) && (
        <div className="space-y-3 mb-8">
          {today?.stories && (
            (() => {
              const ss = today?.storyStatus ?? "pending";
              const isMe = !isAdmin || !viewAs || viewAs === me?.id;
              return (
                <div className="rounded-lg p-4 flex items-center gap-3"
                  style={{
                    backgroundColor: ss === "done" ? "rgba(200,212,78,0.08)" : ss === "missed" ? "rgba(255,68,68,0.08)" : "rgba(200,212,78,0.1)",
                    borderLeft: `3px solid ${ss === "missed" ? "#FF4444" : "#C8D44E"}`,
                  }}>
                  <div className="h-9 w-9 rounded-md flex items-center justify-center"
                    style={{ backgroundColor: ss === "missed" ? "rgba(255,68,68,0.2)" : "rgba(200,212,78,0.2)", color: ss === "missed" ? "#FF4444" : "#C8D44E" }}>
                    <Camera size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-white">
                      {ss === "done" ? "Stories de hoje — feito ✓" : ss === "missed" ? "Stories de hoje — não feito" : "Hoje é seu dia de Stories"}
                    </div>
                    <div className="text-[11px] text-white/60">Publique os stories da Luzeria.</div>
                  </div>
                  {isMe && ss !== "missed" && (
                    <button
                      onClick={() => setStoryDone.mutate({ data: { day: todayStr, done: ss !== "done" } })}
                      className="text-[11px] font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 shrink-0"
                      style={{
                        backgroundColor: ss === "done" ? "rgba(255,255,255,0.06)" : "#C8D44E",
                        color: ss === "done" ? "rgba(255,255,255,0.7)" : "#0D0D0D",
                      }}
                    >
                      {ss === "done" ? <><X size={12} /> Desfazer</> : <><Check size={12} /> Marcar feito</>}
                    </button>
                  )}
                </div>
              );
            })()
          )}
          {(today?.cleaningTaskIdx?.length ?? 0) > 0 && (
            <div className="rounded-lg p-4 flex items-start gap-3"
              style={{ backgroundColor: "rgba(200,212,78,0.1)", borderLeft: "3px solid #C8D44E" }}>
              <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(200,212,78,0.2)", color: "#C8D44E" }}>
                <Sparkles size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-white">Tarefas de limpeza hoje</div>
                <ul className="mt-2 space-y-1.5">
                  {today!.cleaningTaskIdx.map((ti) => {
                    const st = (today?.cleaningStatuses ?? []).find((s) => s.taskIdx === ti)?.status ?? "pending";
                    const isMe = !isAdmin || !viewAs || viewAs === me?.id;
                    const done = st === "done";
                    const missed = st === "missed";
                    return (
                      <li key={ti} className="flex items-center gap-2">
                        <button
                          onClick={() => isMe && !missed && setCleaningDone.mutate({ data: { taskIdx: ti, weekday: weekdayIdx, occurrenceDate: todayStr, done: !done } })}
                          disabled={!isMe || missed}
                          className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: done ? "#C8D44E" : missed ? "#FF4444" : "transparent",
                            border: done || missed ? "none" : "1.5px solid rgba(255,255,255,0.3)",
                            color: missed ? "#FFFFFF" : "#0D0D0D",
                            cursor: isMe && !missed ? "pointer" : "default",
                          }}
                        >
                          {done ? <Check size={12} strokeWidth={3} /> : missed ? <X size={12} strokeWidth={3} /> : <Circle size={6} className="opacity-0" />}
                        </button>
                        <span className="text-[12px]" style={{ color: done ? "rgba(255,255,255,0.5)" : missed ? "#FF8888" : "rgba(255,255,255,0.85)", textDecoration: done ? "line-through" : "none" }}>
                          {CLEANING_TASKS[ti]}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "week" ? (
        <MyWeekView userId={isAdmin && viewAs ? viewAs : undefined} />
      ) : tasks.length === 0 ? (
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
                      {t.clientCategory === "Avulsos" && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                          style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
                          Avulso
                        </span>
                      )}
                      <span className="text-[11px] text-white/50 uppercase font-semibold">
                        {t.type === "post" ? "Post" : t.type === "reel" ? "Reels" : "Item"} {String(t.idx).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-white truncate flex-1">{t.title}</span>
                      <DeadlinePill dueDate={(t as any).dueDate} status={t.status} />
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

function DeadlinePill({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const info = deadlineInfo(dueDate, status);
  if (info.level === "done") return null;
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
      style={{ backgroundColor: info.bg, color: info.color }}
      title={dueDate ? `Prazo: ${dueDate}` : "Sem prazo definido"}
    >
      <Clock size={10} /> {info.label}
    </span>
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
        <h3 className="text-lg font-bold text-white">Como estou indo?</h3>
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