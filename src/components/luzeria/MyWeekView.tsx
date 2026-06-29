import { useQuery } from "@tanstack/react-query";
import { myWeekQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { STATUS_META, type Status } from "@/lib/luzeria/types";

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function weekRange(): { start: Date; end: Date; days: Date[] } {
  const now = new Date();
  const dow = now.getDay(); // 0..6
  const start = new Date(now); start.setDate(now.getDate() - dow); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  const days: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setDate(start.getDate() + i); return d;
  });
  return { start, end, days };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

export function MyWeekView({ userId }: { userId?: string }) {
  const { start, end, days } = weekRange();
  const { data: items = [] } = useQuery(myWeekQO(iso(start), iso(end), userId));
  const { selectClient, selectMonth, openItem } = useUI();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const byDay: Record<string, typeof items> = {};
  days.forEach((d) => { byDay[iso(d)] = []; });
  const noDate: typeof items = [];
  items.forEach((it) => {
    if (!it.dueDate) { noDate.push(it); return; }
    if (byDay[it.dueDate]) byDay[it.dueDate].push(it);
    else noDate.push(it);
  });

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {days.map((d) => {
          const key = iso(d);
          const isToday = d.getTime() === today.getTime();
          const isPast = d < today;
          const list = byDay[key];
          return (
            <div key={key} className={`rounded-xl border p-3 min-h-[120px] ${
              isToday ? "border-[#C8D44E]/50 bg-[#C8D44E]/[0.04]" : "border-white/[0.06] bg-[#1C1C1C]"
            }`}>
              <div className="flex items-baseline justify-between mb-2">
                <div className={`text-[10px] uppercase font-bold tracking-wider ${
                  isToday ? "text-[#C8D44E]" : isPast ? "text-white/30" : "text-white/50"
                }`}>{WEEKDAYS[d.getDay()]}</div>
                <div className={`text-base font-bold tabular-nums ${
                  isToday ? "text-white" : isPast ? "text-white/30" : "text-white/70"
                }`}>{String(d.getDate()).padStart(2, "0")}</div>
              </div>
              {list.length === 0 ? (
                <div className="text-[10px] text-white/20 mt-3">—</div>
              ) : list.map((t) => (
                <button key={t.id}
                  onClick={() => { selectClient(t.clientId); selectMonth(t.monthKey); setTimeout(() => openItem(t.id), 30); }}
                  className="w-full mb-1.5 text-left rounded-md p-2 bg-[#0D0D0D]/60 hover:bg-[#0D0D0D] transition-colors border border-white/[0.04]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: t.clientColor }} />
                    <span className="text-[9px] uppercase font-bold tracking-wider text-white/50 truncate">{t.clientName}</span>
                    <span className="ml-auto text-[8px] uppercase font-bold tracking-wider rounded px-1 py-px"
                      style={{ backgroundColor: STATUS_META[t.status as Status].bg, color: STATUS_META[t.status as Status].color }}>
                      {STATUS_META[t.status as Status].label.slice(0, 4)}
                    </span>
                  </div>
                  <div className="text-[11px] text-white leading-tight truncate">{t.title || `${t.type === "post" ? "Post" : t.type === "reel" ? "Reels" : "Item"} ${String(t.idx).padStart(2, "0")}`}</div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
      {noDate.length > 0 && (
        <div className="mt-6">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-2">Sem prazo definido ({noDate.length})</div>
          <div className="bg-[#1C1C1C] rounded-lg divide-y divide-white/[0.04]">
            {noDate.map((t) => (
              <button key={t.id}
                onClick={() => { selectClient(t.clientId); selectMonth(t.monthKey); setTimeout(() => openItem(t.id), 30); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.03] text-left">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: t.clientColor }} />
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">{t.clientName}</span>
                <span className="text-sm text-white truncate flex-1">{t.title}</span>
                <span className="text-[9px] uppercase font-bold tracking-wider rounded px-1.5 py-0.5"
                  style={{ backgroundColor: STATUS_META[t.status as Status].bg, color: STATUS_META[t.status as Status].color }}>
                  {STATUS_META[t.status as Status].label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}