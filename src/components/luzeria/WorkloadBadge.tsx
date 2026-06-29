import { useQuery } from "@tanstack/react-query";
import { workloadQO } from "@/lib/luzeria/queries";
import { AlertTriangle, Inbox } from "lucide-react";

export function WorkloadBadge({ userId, compact }: { userId: string; compact?: boolean }) {
  const { data } = useQuery(workloadQO(userId));
  if (!data) return null;
  const heavy = data.openCount > 8;
  const color = heavy ? "#FF8C42" : data.openCount === 0 ? "rgba(255,255,255,0.4)" : "#C8D44E";
  return (
    <div className="relative group inline-flex items-center gap-1 text-[10px] font-semibold tabular-nums"
      style={{ color }}>
      {heavy ? <AlertTriangle size={11} /> : <Inbox size={11} />}
      {data.openCount} {compact ? "" : (data.openCount === 1 ? "em aberto" : "em aberto")}
      {data.oldest.length > 0 && (
        <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 z-50 bg-[#0D0D0D] border border-white/10 rounded-md p-2.5 text-left">
          <div className="text-[10px] uppercase font-bold tracking-wider text-white/40 mb-1.5">Mais antigos em aberto</div>
          {data.oldest.map((o) => (
            <div key={o.id} className="text-[11px] text-white/80 truncate">
              <span className="text-white/40">{o.daysOpen}d</span> · {o.clientName} <span className="text-white/50">— {o.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}