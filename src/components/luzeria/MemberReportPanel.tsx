import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { memberReportDetailQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { REEL_TYPE_LABEL, type ReelType } from "@/lib/luzeria/types";
import { roleLabel } from "./Sidebar";

const WEEKDAY = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function MemberReportPanel({
  member, from, to, onClose,
}: {
  member: { userId: string; name: string; role: string; total: number; color: string; icon: string | null };
  from: string;
  to: string;
  onClose: () => void;
}) {
  const { data } = useQuery(memberReportDetailQO(member.userId, from, to));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  const maxBar = Math.max(1, ...(data?.monthly ?? []).map((m) => m.count));

  const profile = { id: member.userId, name: member.name, color: member.color, icon: member.icon, active: true, email: "", role: "member" as const };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
      <div ref={ref}
        className="fixed z-50 bg-[#0D0D0D] border-l border-white/10 lz-slide-in overflow-y-auto
          inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t
          md:rounded-none md:border-t-0 md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[480px] md:max-h-none">
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.08] flex items-start gap-3">
          <Avatar profile={profile as any} size={48} />
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-bold text-white truncate">{member.name}</div>
            <div className="text-[11px] uppercase font-bold tracking-wider text-white/50">
              {roleLabel(member.role as any)} · <span className="text-[#C8D44E]">{member.total} entregas</span>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5"><X size={16} /></button>
        </div>

        {/* Bar chart */}
        <div className="px-6 py-5 border-b border-white/[0.08]">
          <div className="text-[10px] uppercase font-bold tracking-wider mb-3 text-[#C8D44E]">Últimos 6 meses</div>
          <div className="flex items-end gap-2 h-32">
            {(data?.monthly ?? []).map((m) => {
              const top = Math.max(...(data?.monthly ?? []).map((x) => x.count));
              const isMax = m.count === top && m.count > 0;
              const h = (m.count / maxBar) * 100;
              return (
                <div key={m.key} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex-1 w-full flex items-end">
                    <div className="w-full rounded-t-sm transition-all"
                      style={{ height: `${h}%`, backgroundColor: isMax ? "#C8D44E" : "rgba(200,212,78,0.25)" }} />
                  </div>
                  <div className="text-[9px] text-white/50">{m.key.slice(5)}/{m.key.slice(2, 4)}</div>
                  <div className="text-[10px] font-bold text-white">{m.count}</div>
                </div>
              );
            })}
          </div>
        </div>

        <ListBlock title="Posts finalizados" items={data?.posts ?? []} renderRight={(x) => null} />
        <ListBlock title="Reels finalizados" items={data?.reels ?? []} renderRight={(x: any) =>
          x.reelType ? <span className="text-[10px] text-white/50">{REEL_TYPE_LABEL[x.reelType as ReelType]}</span> : null
        } />
        <ListBlock title="Reels editados" items={data?.editedReels ?? []} renderRight={(x: any) =>
          x.reelType ? <span className="text-[10px] text-white/50">{REEL_TYPE_LABEL[x.reelType as ReelType]}</span> : null
        } />
        <ListBlock title="Outros" items={data?.outros ?? []} renderRight={() => null} />

        <div className="px-6 py-5 border-b border-white/[0.08]">
          <div className="text-[10px] uppercase font-bold tracking-wider mb-3 text-[#C8D44E]">Stories</div>
          {(data?.stories ?? []).length === 0 ? (
            <p className="text-xs text-white/40">Nenhum.</p>
          ) : (data?.stories ?? []).map((s) => (
            <div key={s.day} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-white/80">Stories · {new Date(s.day + "T12:00:00Z").toLocaleDateString("pt-BR")}</span>
              <span className="text-white/40 text-[10px]">{new Date(s.finalizedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </div>

        <div className="px-6 py-5">
          <div className="text-[10px] uppercase font-bold tracking-wider mb-3 text-[#C8D44E]">Limpeza</div>
          {(data?.cleaning ?? []).length === 0 ? (
            <p className="text-xs text-white/40">Nenhuma.</p>
          ) : (data?.cleaning ?? []).map((c, i) => (
            <div key={i} className="flex items-center justify-between py-1.5 text-xs">
              <span className="text-white/80">{WEEKDAY[c.weekday] ?? "—"} · tarefa {c.taskIdx + 1}</span>
              <span className="text-white/40 text-[10px]">{new Date(c.finalizedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ListBlock({ title, items, renderRight }: {
  title: string;
  items: any[];
  renderRight: (item: any) => React.ReactNode;
}) {
  return (
    <div className="px-6 py-5 border-b border-white/[0.08]">
      <div className="text-[10px] uppercase font-bold tracking-wider mb-3 flex items-center justify-between">
        <span className="text-[#C8D44E]">{title}</span>
        <span className="text-white/40">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-white/40">Nenhum.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((it) => (
            <div key={it.itemId} className="flex items-center gap-2 text-xs">
              {it.clientColor && (
                <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: it.clientColor }} />
              )}
              <span className="text-white/50 truncate w-24">{it.clientName ?? "—"}</span>
              <span className="text-white/80 flex-1 truncate">{it.title}</span>
              {renderRight(it)}
              {it.lateDays > 0 && (
                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: "rgba(255,107,107,0.18)", color: "#FF6B6B" }}>
                  Atraso {it.lateDays}d
                </span>
              )}
              <span className="text-white/40 text-[10px] shrink-0">{new Date(it.finalizedAt).toLocaleDateString("pt-BR")}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}