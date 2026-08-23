import { Hammer, AlertTriangle, ClipboardCheck, Rocket, CheckCheck, type LucideIcon } from "lucide-react";
import { CLIENT_STAGE_META, type ClientStage } from "@/lib/luzeria/client-stage";

const ICONS: Record<string, LucideIcon> = { Hammer, AlertTriangle, ClipboardCheck, Rocket, CheckCheck };

export function PublicProgressBar({ stageCounts, blockedCount }: {
  stageCounts: { stage: ClientStage; label: string; count: number }[];
  blockedCount: number;
}) {
  const n = stageCounts.length;
  const colWidth = 100 / n;

  return (
    <div className="mb-6">
      {blockedCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 mb-3 text-[13px] font-semibold"
          style={{ background: "rgba(255,107,107,0.12)", color: "#FF6B6B" }}
        >
          <AlertTriangle size={16} className="shrink-0" />
          {blockedCount} publicaç{blockedCount === 1 ? "ão precisa" : "ões precisam"} de atenção
        </div>
      )}

      <div className="relative">
        {/* Connector track (segments between consecutive step centers) */}
        {stageCounts.slice(1).map((s, i) => {
          const meta = CLIENT_STAGE_META[s.stage];
          const left = colWidth * i + colWidth / 2;
          return (
            <div
              key={s.stage}
              className="absolute top-[18px] h-[2px] -translate-y-1/2"
              style={{
                left: `${left}%`,
                width: `${colWidth}%`,
                background: s.count > 0 ? meta.color : "color-mix(in srgb, var(--foreground) 8%, transparent)",
              }}
            />
          );
        })}

        <div className="relative grid" style={{ gridTemplateColumns: `repeat(${n}, 1fr)` }}>
          {stageCounts.map((s) => {
            const meta = CLIENT_STAGE_META[s.stage];
            const Icon = ICONS[meta.icon];
            const active = s.count > 0;
            return (
              <div key={s.stage} className="flex flex-col items-center gap-1.5 text-center px-1">
                <div
                  className="size-9 rounded-full grid place-items-center transition-colors"
                  style={{
                    background: active ? meta.color : "#1C1C1C",
                    color: active ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 30%, transparent)",
                    border: active ? "none" : "2px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                  }}
                >
                  <Icon size={16} />
                </div>
                <div
                  className="text-[10px] leading-tight font-semibold"
                  style={{ color: active ? "color-mix(in srgb, var(--foreground) 85%, transparent)" : "color-mix(in srgb, var(--foreground) 30%, transparent)" }}
                >
                  {meta.label}
                </div>
                <div
                  className="text-[11px] font-bold"
                  style={{ color: active ? meta.color : "color-mix(in srgb, var(--foreground) 25%, transparent)" }}
                >
                  {s.count}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
