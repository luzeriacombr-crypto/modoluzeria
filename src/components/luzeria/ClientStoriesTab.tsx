import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Check, X, Plus } from "lucide-react";
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

type DayEntry = {
  id: string;
  userId: string | null; label: string | null; status: "pending" | "done" | "missed";
};

/** Stories schedule scoped to one client — internal agency control only,
 * not part of the client-facing Preview de Feed. */
export function ClientStoriesTab({ clientId }: { clientId: string }) {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const [cursor, setCursor] = useState(() => {
    const d = new Date(); d.setDate(1); return d;
  });
  const key = monthKey(cursor);
  const { data: rows = [] } = useQuery(storiesQO(clientId, key));
  const { data: profiles = [] } = useQuery(profilesQO());
  const { upsertStoryDay, setStoryDone, deleteStoryEntry } = useApi();
  const [assigneePicker, setAssigneePicker] = useState<{ rect: DOMRect; day: string; entryId: string | null } | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, DayEntry[]>();
    rows.forEach((r) => {
      const list = m.get(r.day) ?? [];
      list.push({ id: r.id, userId: r.userId, label: r.label, status: r.status });
      m.set(r.day, list);
    });
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

  function personInfo(entry: DayEntry) {
    if (entry.userId) {
      const p = profiles.find((x) => x.id === entry.userId);
      if (p) return { name: p.name, color: p.color, profile: p };
    }
    if (entry.label) return { name: entry.label, color: colorForLabel(entry.label), profile: null };
    return null;
  }

  return (
    <div>
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <p className="text-sm text-white/50">Escala de Stories deste cliente. Uso interno da agência.</p>
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
          if (!c) return <div key={`e-${i}`} className="min-h-[64px]" />;
          const entries = byDay.get(c.key) ?? [];
          const isToday = c.key === today;
          return (
            <div
              key={c.key}
              className="min-h-[64px] rounded-md p-1.5 flex flex-col gap-1"
              style={{
                backgroundColor: entries.length ? "rgba(255,255,255,0.04)" : "rgba(28,28,28,0.6)",
                border: isToday ? "1px solid rgba(var(--lz-brand-light-rgb),0.4)" : "1px solid transparent",
              }}
            >
              <span className="text-xs font-bold shrink-0" style={{ color: isToday ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.6)" }}>
                {String(c.day).padStart(2, "0")}
              </span>

              {entries.map((entry) => {
                const person = personInfo(entry);
                const isMine = entry.userId === me?.id;
                const canToggle = !!entry.userId && (isMine || isAdmin);
                return (
                  <div
                    key={entry.id}
                    className="rounded p-1 flex flex-col gap-0.5 group relative"
                    style={{ border: isMine ? "1.5px solid rgb(var(--lz-brand-rgb))" : "1px solid rgba(255,255,255,0.05)" }}
                  >
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={(e) => isAdmin && setAssigneePicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), day: c.key, entryId: entry.id })}
                      className="rounded px-1 flex items-center justify-between gap-1 transition-colors"
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
                      {entry.userId && (
                        <span
                          role={canToggle ? "button" : undefined}
                          title={entry.status === "done" ? "Feito — clique para desfazer" : entry.status === "missed" ? "Não feito" : isToday ? "Pendente — clique para marcar feito" : "Pendente"}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!canToggle) return;
                            if (entry.status === "missed" && !isAdmin) return;
                            setStoryDone.mutate({ data: { id: entry.id, done: entry.status !== "done" } });
                          }}
                          className="h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor:
                              entry.status === "done" ? "rgb(var(--lz-brand-rgb))"
                              : entry.status === "missed" ? "#FF4444"
                              : "rgba(255,255,255,0.15)",
                            color: entry.status === "missed" ? "#FFFFFF" : "#0D0D0D",
                            cursor: canToggle ? "pointer" : "default",
                            border: entry.status === "pending" ? "1px solid rgba(255,255,255,0.25)" : "none",
                          }}
                        >
                          {entry.status === "done" ? <Check size={9} strokeWidth={3} />
                            : entry.status === "missed" ? <X size={9} strokeWidth={3} />
                            : null}
                        </span>
                      )}
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => deleteStoryEntry.mutate({ data: { id: entry.id } })}
                        title="Remover esta entrada"
                        className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-[#1C1C1C] border border-white/10 items-center justify-center hover:border-red-400 hover:text-red-400 text-white/40 hidden group-hover:flex"
                      ><X size={8} /></button>
                    )}
                  </div>
                );
              })}

              {isAdmin && (
                <button
                  type="button"
                  onClick={(e) => setAssigneePicker({ rect: (e.currentTarget as HTMLElement).getBoundingClientRect(), day: c.key, entryId: null })}
                  className="text-[9px] text-white/20 hover:text-white/50 flex items-center gap-0.5 px-1"
                ><Plus size={9} /> nova entrada</button>
              )}
            </div>
          );
        })}
      </div>

      {assigneePicker && createPortal(
        <AssigneePicker
          anchorRect={assigneePicker.rect}
          onClose={() => setAssigneePicker(null)}
          onPick={(p) => {
            if (assigneePicker.entryId) {
              upsertStoryDay.mutate({ data: { id: assigneePicker.entryId, day: assigneePicker.day, userId: p.userId, label: p.label, clientId } });
            } else {
              upsertStoryDay.mutate({ data: { day: assigneePicker.day, userId: p.userId, label: p.label, clientId } });
            }
          }}
        />,
        document.body,
      )}
    </div>
  );
}
