// Popup de "subiu de nível" no Programa de Níveis — dispara pro primeiro
// perfil ativo que abrir o app depois de um aumento real de pontos (não é
// sincronizado entre dispositivos/pessoas, é aceitável quem chegar primeiro
// "ganhar" a comemoração). Detecção é 100% client-side: compara o nível
// computado agora com orgs.last_seen_level_index (gravado por
// acknowledgeAgencyLevel, api.functions.ts) — nunca comemora numa primeira
// checagem (lastSeen null), só em aumentos reais depois disso.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { myAgencyLevelInputsQO, useMe } from "@/lib/luzeria/queries";
import { acknowledgeAgencyLevel } from "@/lib/luzeria/api.functions";
import { computeAgencyPoints, getAgencyLevel, type AgencyLevel } from "@/lib/luzeria/agency-level";
import { TIER_COLOR, TIER_ICON, type AgencyTierName } from "./AgencyLevelIcons";

const CONFETTI_COLORS = ["rgb(var(--lz-brand-rgb))", "#6FA8DC", "#FF6B6B", "#B892FF", "#D7FF3F"];
const CONFETTI_COUNT = 28;

export function LevelUpCelebration() {
  const me = useMe().data;
  const disabled = new Set(me?.disabledFeatures ?? []);
  const { data: inputs } = useQuery({ ...myAgencyLevelInputsQO(), enabled: !!me && !disabled.has("agency_levels") });
  const acknowledge = useServerFn(acknowledgeAgencyLevel);
  const [celebrate, setCelebrate] = useState<AgencyLevel | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (!inputs || checkedRef.current) return;
    checkedRef.current = true;
    const level = getAgencyLevel(computeAgencyPoints(inputs));
    const lastSeen = (inputs as any).lastSeenLevelIndex as number | null;
    if (lastSeen == null) {
      acknowledge({ data: { index: level.index } }).catch(() => {});
    } else if (level.index > lastSeen) {
      setCelebrate(level);
      acknowledge({ data: { index: level.index } }).catch(() => {});
    }
  }, [inputs]);

  if (!celebrate) return null;
  const color = TIER_COLOR[celebrate.tier as AgencyTierName];
  const Icon = TIER_ICON[celebrate.tier as AgencyTierName];

  return createPortal(
    <div className="lz-overlay z-[200] flex items-center justify-center p-4" onClick={() => setCelebrate(null)}>
      <div
        className="relative bg-card rounded-3xl w-full max-w-sm border border-foreground/10 shadow-2xl lz-modal-in overflow-hidden text-center px-7 py-9"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
            <span
              key={i}
              style={{
                position: "absolute", top: -12, left: `${(i / CONFETTI_COUNT) * 100 + Math.random() * 4}%`,
                width: 6, height: 9, borderRadius: 1,
                backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
                animation: `lz-tour-confetti ${1.3 + Math.random() * 0.6}s ease-in ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
        </div>
        <button onClick={() => setCelebrate(null)} className="lz-icon-btn h-7 w-7 absolute top-3 right-3">
          <X size={15} />
        </button>
        <div
          className="w-20 h-20 rounded-[22px] flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color, boxShadow: `0 0 0 10px color-mix(in srgb, ${color} 10%, transparent)` }}
        >
          <Icon size={42} />
        </div>
        <div className="text-[11px] font-black uppercase tracking-widest text-foreground/40 mb-2">Parabéns! 🎉</div>
        <h2 className="text-2xl font-black text-foreground mb-1.5">
          Sua agência agora é <span style={{ color }}>{celebrate.label}</span>
        </h2>
        <p className="text-foreground/50 text-[13.5px] leading-relaxed mb-6">
          Continue assim! Cada cliente organizado e cada post entregue conta pro próximo nível.
        </p>
        <Link
          to="/programa-de-niveis"
          onClick={() => setCelebrate(null)}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-[13px] font-black transition hover:opacity-90"
          style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          Ver meu progresso
        </Link>
      </div>
    </div>,
    document.body,
  );
}
