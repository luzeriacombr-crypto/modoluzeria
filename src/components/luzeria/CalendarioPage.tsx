import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, X, Inbox, CalendarDays, Image as ImageIcon } from "lucide-react";
import { calendarItemsQO, itemFilesQO, driveThumbnailQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { CONTENT_TYPE_LABEL, STATUS_META, type Status } from "@/lib/luzeria/types";
import { formatMonth } from "@/lib/luzeria/utils";

type CalendarItem = {
  id: string; title: string; type: string; status: string; scheduledAt: string | null;
  monthKey: string; clientId: string; clientName: string; clientColor: string; coverUrl: string | null;
};

const WEEKDAYS = ["segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado", "domingo"];
const MAX_VISIBLE = 3;

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Local YYYY-MM-DD, matching how a Brazilian user reads a scheduled datetime. */
function localDateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey() {
  return localDateKey(new Date().toISOString());
}

/** Grid range: Monday on/before the 1st through Sunday on/after the last day,
 * so the month grid always has full weeks (matches the ClickUp look). */
function gridRange(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const last = new Date(y, m, 0);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = Monday
  const lastWeekday = (last.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - firstWeekday);
  const end = new Date(last);
  end.setDate(last.getDate() + (6 - lastWeekday));
  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function CalendarioPage() {
  const { selectedMonthKey, selectMonth, openItem, flash } = useUI();
  const navigate = useNavigate();
  const monthKey = selectedMonthKey || currentMonthKey();
  const [dayOpen, setDayOpen] = useState<string | null>(null);
  const [hover, setHover] = useState<{ item: CalendarItem; top: number; left: number; placeAbove: boolean } | null>(null);

  function showHover(item: CalendarItem, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const POPUP_W = 220;
    const POPUP_H = 260;
    const placeAbove = rect.top - POPUP_H - 8 >= 8;
    const top = placeAbove ? rect.top - POPUP_H - 8 : rect.bottom + 8;
    const left = Math.min(Math.max(rect.left, 8), window.innerWidth - POPUP_W - 8);
    setHover({ item, top, left, placeAbove });
  }

  const days = useMemo(() => gridRange(monthKey), [monthKey]);
  const from = useMemo(() => new Date(days[0].getFullYear(), days[0].getMonth(), days[0].getDate()).toISOString(), [days]);
  const to = useMemo(() => {
    const last = days[days.length - 1];
    return new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1).toISOString();
  }, [days]);

  const { data: items = [], isLoading } = useQuery(calendarItemsQO(from, to));

  const byDay = useMemo(() => {
    const map = new Map<string, typeof items>();
    items.forEach((it) => {
      const key = localDateKey(it.scheduledAt!);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    });
    for (const list of map.values()) {
      list.sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    }
    return map;
  }, [items]);

  function goToItem(clientId: string, itemMonthKey: string, itemId: string) {
    navigate({ to: "/cliente/$clientId", params: { clientId } });
    selectMonth(itemMonthKey);
    setTimeout(() => { openItem(itemId); flash(itemId); }, 50);
    setTimeout(() => flash(null), 2050);
  }

  const today = todayKey();
  const dayList = dayOpen ? (byDay.get(dayOpen) ?? []) : [];

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <CalendarDays size={20} className="text-[rgb(var(--lz-brand-rgb))]" />
          <h1 className="text-[28px] font-bold text-white tracking-tight">Calendário</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => selectMonth(currentMonthKey())}
            className="px-3 py-1.5 rounded-md text-xs font-semibold text-white/70 hover:text-white hover:bg-white/5 border border-white/10 transition">
            Hoje
          </button>
          <div className="inline-flex items-center gap-1 rounded-full bg-[#161616] p-1 border border-white/10">
            <button onClick={() => selectMonth(shiftMonth(monthKey, -1))}
              className="h-8 w-8 rounded-full hover:bg-white/10 text-white/70 flex items-center justify-center transition">
              <ChevronLeft size={15} />
            </button>
            <div className="px-4 text-white text-sm font-semibold min-w-[140px] text-center capitalize">
              {formatMonth(monthKey)}
            </div>
            <button onClick={() => selectMonth(shiftMonth(monthKey, +1))}
              className="h-8 w-8 rounded-full hover:bg-white/10 text-white/70 flex items-center justify-center transition">
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-white/40 -mt-4 mb-5">
        Todos os posts com data de publicação definida, de todos os clientes — independente do status.
      </p>

      {/* Grid */}
      <div className="rounded-xl border border-white/[0.07] overflow-hidden bg-[#161616]">
        <div className="grid grid-cols-7 border-b border-white/[0.07]">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-bold text-white/40 text-center md:text-left">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const inMonth = `${d.getMonth() + 1}`.padStart(2, "0") === monthKey.split("-")[1];
            const isToday = key === today;
            const dayItems = byDay.get(key) ?? [];
            const visible = dayItems.slice(0, MAX_VISIBLE);
            const overflow = dayItems.length - visible.length;
            return (
              <div key={key}
                className={`min-h-[110px] border-b border-r border-white/[0.05] p-1.5 ${i % 7 === 6 ? "border-r-0" : ""} ${!inMonth ? "opacity-40" : ""}`}>
                <div className="flex items-center justify-end px-1 mb-1">
                  <span className={`text-[11px] font-semibold tabular-nums ${isToday ? "h-5 w-5 rounded-full bg-[rgb(var(--lz-brand-rgb))] text-[#0D0D0D] flex items-center justify-center" : "text-white/50"}`}>
                    {d.getDate()}
                  </span>
                </div>
                <div className="space-y-1">
                  {visible.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => goToItem(it.clientId, it.monthKey, it.id)}
                      onMouseEnter={(e) => showHover(it, e.currentTarget)}
                      onMouseLeave={() => setHover(null)}
                      className="w-full text-left px-1.5 py-1 rounded text-[10.5px] leading-tight truncate transition hover:opacity-80"
                      style={{
                        backgroundColor: `${STATUS_META[it.status as Status]?.color ?? "#5BA88A"}22`,
                        color: STATUS_META[it.status as Status]?.color ?? "#5BA88A",
                      }}
                    >
                      <span className="font-bold">{it.clientName}</span> | {it.title}
                    </button>
                  ))}
                  {overflow > 0 && (
                    <button
                      onClick={() => setDayOpen(key)}
                      className="w-full text-left px-1.5 py-0.5 text-[10.5px] font-semibold text-white/50 hover:text-white transition"
                    >
                      + mais {overflow}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isLoading && (
        <p className="text-xs text-white/30 text-center mt-4">Carregando…</p>
      )}

      {/* Day overflow panel */}
      {dayOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" onClick={() => setDayOpen(null)} />
          <div className="fixed z-50 bg-[#0D0D0D] border-white/10 flex flex-col
            inset-x-0 bottom-0 max-h-[80vh] rounded-t-2xl border-t
            md:rounded-none md:border-t-0 md:border-l md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[420px] md:max-h-none">
            <div className="px-6 pt-5 pb-4 border-b border-white/[0.08] flex items-start justify-between">
              <div>
                <div className="text-white font-bold text-[17px]">
                  {new Date(dayOpen + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
                <div className="mt-1 text-[12px] text-white/60">
                  <span className="text-white font-semibold">{dayList.length}</span> post{dayList.length === 1 ? "" : "s"}
                </div>
              </div>
              <button onClick={() => setDayOpen(null)} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
              {dayList.length === 0 && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <Inbox size={28} className="text-white/20 mb-3" />
                  <p className="text-white/40 text-xs">Nenhum post neste dia</p>
                </div>
              )}
              <ul className="space-y-1.5">
                {dayList.map((it) => (
                  <li key={it.id}>
                    <button
                      onClick={() => { setDayOpen(null); goToItem(it.clientId, it.monthKey, it.id); }}
                      onMouseEnter={(e) => showHover(it, e.currentTarget)}
                      onMouseLeave={() => setHover(null)}
                      className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                            style={{ backgroundColor: `${it.clientColor}22`, color: it.clientColor }}>
                            {it.clientName}
                          </span>
                          <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                            style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                            {CONTENT_TYPE_LABEL[it.type as keyof typeof CONTENT_TYPE_LABEL] ?? it.type}
                          </span>
                        </div>
                        <div className="text-white text-sm truncate">{it.title}</div>
                        <div className="text-[10px] text-white/40 mt-0.5">
                          {new Date(it.scheduledAt!).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}

      {/* Hover preview popup */}
      {hover && (
        <div
          className="fixed z-[60] w-[220px] rounded-xl border border-white/15 bg-[#1C1C1C] shadow-2xl overflow-hidden pointer-events-none"
          style={{ top: hover.top, left: hover.left }}
        >
          <div className="relative w-full aspect-square bg-[#111]">
            <HoverThumb itemId={hover.item.id} coverUrl={hover.item.coverUrl} />
          </div>
          <div className="p-2.5">
            <span className="inline-block text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mb-1.5"
              style={{ backgroundColor: `${hover.item.clientColor}22`, color: hover.item.clientColor }}>
              {hover.item.clientName}
            </span>
            <div className="text-white text-xs font-medium leading-snug line-clamp-3">{hover.item.title}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function HoverThumb({ itemId, coverUrl }: { itemId: string; coverUrl: string | null }) {
  const filesQ = useQuery({ ...itemFilesQO(itemId), enabled: !coverUrl });
  const fileId = filesQ.data?.[0]?.driveFileId ?? null;
  const thumbQ = useQuery(driveThumbnailQO(fileId, !!fileId && !coverUrl));
  const url = coverUrl ?? thumbQ.data?.dataUrl ?? null;

  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <ImageIcon size={28} style={{ color: "rgba(255,255,255,0.2)" }} />
      </div>
    );
  }
  return <img src={url} alt="" className="absolute inset-0 w-full h-full object-cover" />;
}
