import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Camera, Check, X } from "lucide-react";
import { profilesQO, storiesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { formatMonth } from "@/lib/luzeria/utils";
import { AssigneePicker, colorForLabel } from "./AssigneePicker";
import { Avatar } from "./Avatar";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function StoriesView() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const key = monthKey(cursor);
  const { data: rows = [] } = useQuery(storiesQO(key));
  const { data: profiles = [] } = useQuery(profilesQO());
  const { upsertStoryDay, setStoryDone } = useApi();
  const [picker, setPicker] = useState<{ rect: DOMRect; day: string } | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, { userId: string | null; label: string | null; status: "pending" | "done" | "missed" }>();
    rows.forEach((r) => m.set(r.day, { userId: r.userId, label: r.label, status: r.status }));
    return m;
  }, [rows]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const today = todayKey();

  const cells: ({ day: number; key: string } | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const k = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ day: d, key: k });
  }

  function shift(delta: number) {
    const d = new Date(cursor); d.setMonth(d.getMonth() + delta); setCursor(d);
  }

  function nameAndColor(entry: { userId: string | null; label: string | null }) {
    if (entry.userId) {
      const p = profiles.find((x) => x.id === entry.userId);
      if (p) return { name: p.name, color: p.color, profile: p };
    }
    if (entry.label) return { name: entry.label, color: colorForLabel(entry.label), profile: null };
    return null;
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
            <Camera size={13} /> <span>Escala</span>
          </div>
          <h1 className="text-[32px] font-bold text-white leading-none tracking-tight">Stories</h1>
          <p className="text-sm text-white/50 mt-2">Responsáveis pelos stories da Luzeria.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => shift(-1)} className="p-2 rounded-md bg-[#1C1C1C] hover:bg-white/5 text-white/70">
            <ChevronLeft size={16} />
          </button>
          <div className="text-sm text-white font-semibold px-3">{formatMonth(key)}</div>
          <button onClick={() => shift(1)} className="p-2 rounded-md bg-[#1C1C1C] hover:bg-white/5 text-white/70">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2 mb-2">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className="text-[10px] uppercase font-bold tracking-wider text-white/40 text-center">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-2">
        {cells.map((c, i) => {
          if (!c) return <div key={`e-${i}`} className="aspect-square" />;
          const entry = byDay.get(c.key);
          const info = entry ? nameAndColor(entry) : null;
          const isToday = c.key === today;
          const isMine = !!entry?.userId && entry.userId === me?.id;
          const isPast = c.key < today;
          const status = entry?.status ?? "pending";
          const canToggle = !!entry?.userId && (isMine || isAdmin);
          const bg = info ? info.color + (info.color === "#FFFFFF" ? "33" : "33") : "rgba(255,255,255,0.04)";
          return (
            <button
              key={c.key}
              disabled={!isAdmin}
              onClick={(e) => {
                if (!isAdmin) return;
                setPicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), day: c.key });
              }}
              className="aspect-square rounded-md p-2 flex flex-col justify-between text-left transition-all relative"
              style={{
                backgroundColor: info ? bg : "rgba(28,28,28,0.6)",
                border: isMine ? "2px solid #C8D44E" : isToday ? "1px solid rgba(200,212,78,0.4)" : "1px solid transparent",
                cursor: isAdmin ? "pointer" : "default",
                opacity: isAdmin ? 1 : 0.95,
              }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: isToday ? "#C8D44E" : "rgba(255,255,255,0.6)" }}>
                  {String(c.day).padStart(2, "0")}
                </span>
                {info?.profile && <Avatar profile={info.profile} size={18} />}
              </div>
              {info && (
                <div className="flex items-end justify-between gap-1">
                  <div className="text-[10px] font-semibold truncate" style={{ color: info.color === "#FFFFFF" ? "#FFFFFF" : info.color }}>
                    {info.name}
                  </div>
                  {entry?.userId && (
                    <span
                      role={canToggle ? "button" : undefined}
                      title={status === "done" ? "Feito — clique para desfazer" : status === "missed" ? "Não feito" : isToday ? "Pendente — clique para marcar feito" : "Pendente"}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!canToggle) return;
                        if (status === "missed" && !isAdmin) return;
                        setStoryDone.mutate({ data: { day: c.key, done: status !== "done" } });
                      }}
                      className="h-4 w-4 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor:
                          status === "done" ? "#C8D44E"
                          : status === "missed" ? "#FF4444"
                          : "rgba(255,255,255,0.15)",
                        color: status === "missed" ? "#FFFFFF" : "#0D0D0D",
                        cursor: canToggle ? "pointer" : "default",
                        border: status === "pending" ? "1px solid rgba(255,255,255,0.25)" : "none",
                      }}
                    >
                      {status === "done" ? <Check size={10} strokeWidth={3} />
                        : status === "missed" ? <X size={10} strokeWidth={3} />
                        : null}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {picker && createPortal(
        <AssigneePicker
          anchorRect={picker.rect}
          onClose={() => setPicker(null)}
          onPick={(p) => upsertStoryDay.mutate({ data: { day: picker.day, userId: p.userId, label: p.label } })}
        />,
        document.body,
      )}
    </div>
  );
}