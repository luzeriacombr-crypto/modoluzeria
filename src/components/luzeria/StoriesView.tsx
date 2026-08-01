import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Camera, Check, X } from "lucide-react";
import { profilesQO, storiesQO, useApi, useMe } from "@/lib/luzeria/queries";
import { formatMonth } from "@/lib/luzeria/utils";
import { AssigneePicker, colorForLabel } from "./AssigneePicker";
import { ClientPicker } from "./ClientPicker";
import { Avatar } from "./Avatar";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type DayEntry = {
  userId: string | null; label: string | null; status: "pending" | "done" | "missed";
  clientId: string | null; clientName: string | null; clientColor: string | null;
};

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
  const [assigneePicker, setAssigneePicker] = useState<{ rect: DOMRect; day: string } | null>(null);
  const [clientPicker, setClientPicker] = useState<{ rect: DOMRect; day: string } | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, DayEntry>();
    rows.forEach((r) => m.set(r.day, {
      userId: r.userId, label: r.label, status: r.status,
      clientId: r.clientId, clientName: r.clientName, clientColor: r.clientColor,
    }));
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

  function personInfo(entry?: DayEntry) {
    if (!entry) return null;
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
          <p className="text-sm text-white/50 mt-2">Cliente e responsável pelos stories do dia.</p>
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
          const person = personInfo(entry);
          const hasClient = !!entry?.clientId;
          const isToday = c.key === today;
          const isMine = !!entry?.userId && entry.userId === me?.id;
          const status = entry?.status ?? "pending";
          const canToggle = !!entry?.userId && (isMine || isAdmin);
          return (
            <div
              key={c.key}
              className="aspect-square rounded-md p-1.5 flex flex-col gap-1 relative"
              style={{
                backgroundColor: (person || hasClient) ? "rgba(255,255,255,0.04)" : "rgba(28,28,28,0.6)",
                border: isMine ? "2px solid rgb(var(--lz-brand-rgb))" : isToday ? "1px solid rgba(var(--lz-brand-light-rgb),0.4)" : "1px solid transparent",
              }}
            >
              <span className="text-xs font-bold shrink-0" style={{ color: isToday ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.6)" }}>
                {String(c.day).padStart(2, "0")}
              </span>

              {/* Client (independent of responsible person) */}
              <button
                type="button"
                disabled={!isAdmin}
                onClick={(e) => isAdmin && setClientPicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), day: c.key })}
                className="flex-1 min-h-0 rounded px-1 flex items-center text-left transition-colors"
                style={{
                  backgroundColor: hasClient ? `${entry!.clientColor}22` : "transparent",
                  cursor: isAdmin ? "pointer" : "default",
                }}
                title={hasClient ? `Cliente: ${entry!.clientName}` : isAdmin ? "Definir cliente" : undefined}
              >
                {hasClient ? (
                  <span className="flex items-center gap-1 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: entry!.clientColor ?? "#888" }} />
                    <span className="text-[9px] font-semibold truncate" style={{ color: entry!.clientColor ?? "#fff" }}>{entry!.clientName}</span>
                  </span>
                ) : isAdmin ? (
                  <span className="text-[9px] text-white/20">+ cliente</span>
                ) : null}
              </button>

              {/* Responsible person */}
              <button
                type="button"
                disabled={!isAdmin}
                onClick={(e) => isAdmin && setAssigneePicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), day: c.key })}
                className="flex-1 min-h-0 rounded px-1 flex items-center justify-between gap-1 transition-colors"
                style={{ cursor: isAdmin ? "pointer" : "default" }}
              >
                {person ? (
                  <span className="flex items-center gap-1 min-w-0">
                    {person.profile && <Avatar profile={person.profile} size={14} />}
                    <span className="text-[9px] font-semibold truncate" style={{ color: person.color === "#FFFFFF" ? "#FFFFFF" : person.color }}>{person.name}</span>
                  </span>
                ) : isAdmin ? (
                  <span className="text-[9px] text-white/20">+ responsável</span>
                ) : <span />}
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
                    className="h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor:
                        status === "done" ? "rgb(var(--lz-brand-rgb))"
                        : status === "missed" ? "#FF4444"
                        : "rgba(255,255,255,0.15)",
                      color: status === "missed" ? "#FFFFFF" : "#0D0D0D",
                      cursor: canToggle ? "pointer" : "default",
                      border: status === "pending" ? "1px solid rgba(255,255,255,0.25)" : "none",
                    }}
                  >
                    {status === "done" ? <Check size={9} strokeWidth={3} />
                      : status === "missed" ? <X size={9} strokeWidth={3} />
                      : null}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {assigneePicker && createPortal(
        <AssigneePicker
          anchorRect={assigneePicker.rect}
          onClose={() => setAssigneePicker(null)}
          onPick={(p) => {
            const current = byDay.get(assigneePicker.day);
            upsertStoryDay.mutate({ data: { day: assigneePicker.day, userId: p.userId, label: p.label, clientId: current?.clientId ?? null } });
          }}
        />,
        document.body,
      )}
      {clientPicker && createPortal(
        <ClientPicker
          anchorRect={clientPicker.rect}
          onClose={() => setClientPicker(null)}
          onPick={(clientId) => {
            const current = byDay.get(clientPicker.day);
            upsertStoryDay.mutate({ data: { day: clientPicker.day, userId: current?.userId ?? null, label: current?.label ?? null, clientId } });
          }}
        />,
        document.body,
      )}
    </div>
  );
}
