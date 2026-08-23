import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { itemTimelineQO, profilesQO } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { ChevronDown, ChevronRight, History } from "lucide-react";

const KIND_DOT: Record<string, string> = {
  created: "#7EB3FF",
  status: "var(--lz-accent-ink)",
  due: "#FF8C42",
  rated: "#FFD66E",
  rework: "#FF4444",
  comment: "color-mix(in srgb, var(--foreground) 40%, transparent)",
  system: "color-mix(in srgb, var(--foreground) 30%, transparent)",
  file: "#4A9EFF",
};

export function ItemTimeline({ itemId }: { itemId: string }) {
  const [open, setOpen] = useState(false);
  const { data: timeline = [] } = useQuery({ ...itemTimelineQO(itemId), enabled: open });
  const { data: profiles = [] } = useQuery(profilesQO());
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  return (
    <div className="rounded-lg border border-foreground/6 bg-background/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left">
        <div className="flex items-center gap-2 text-[11px] uppercase font-bold tracking-wider text-foreground/60">
          <History size={12} /> Histórico
          {timeline.length > 0 && (
            <span className="text-[10px] text-foreground/40 normal-case font-normal">({timeline.length})</span>
          )}
        </div>
        {open ? <ChevronDown size={14} className="text-foreground/40" /> : <ChevronRight size={14} className="text-foreground/40" />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-72 overflow-y-auto">
          {timeline.length === 0 ? (
            <div className="text-[11px] text-foreground/30 py-2">Sem registros ainda.</div>
          ) : timeline.map((e) => {
            const actor = e.actorId ? byId.get(e.actorId) : null;
            return (
              <div key={e.id} className="flex items-start gap-2 text-[11px]">
                <div className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: KIND_DOT[e.kind] }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 text-foreground/85">
                    {actor && <Avatar profile={actor} size={14} />}
                    <span className="font-medium">{actor?.name ?? "Sistema"}</span>
                    <span className="text-foreground/40">{e.text}</span>
                  </div>
                  <div className="text-[10px] text-foreground/30 mt-0.5">
                    {new Date(e.at).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}