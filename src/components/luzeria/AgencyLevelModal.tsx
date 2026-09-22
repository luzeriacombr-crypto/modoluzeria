import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { myAgencyLevelInputsQO, useMe } from "@/lib/luzeria/queries";
import { computeAgencyPoints, getAgencyLevel } from "@/lib/luzeria/agency-level";
import { TIER_COLOR, TIER_ICON, type AgencyTierName } from "./AgencyLevelIcons";
import { Modal } from "./Modals";

/** Mesmo resumo de nível que já existe na sidebar (computador), só que num
 * modal — pra abrir clicando na logo da agência no cabeçalho, que existe
 * tanto no computador quanto no celular (a sidebar com o selo some no
 * celular, então era a única forma de ver o nível por lá). */
export function AgencyLevelModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe().data;
  const disabled = new Set(me?.disabledFeatures ?? []);
  const { data: inputs } = useQuery({ ...myAgencyLevelInputsQO(), enabled: open && !disabled.has("agency_levels") });

  if (disabled.has("agency_levels")) return null;

  const points = inputs ? computeAgencyPoints(inputs) : 0;
  const level = getAgencyLevel(points);
  const color = TIER_COLOR[level.tier as AgencyTierName] ?? "#9AA4B2";
  const Icon = TIER_ICON[level.tier as AgencyTierName];

  return (
    <Modal open={open} onClose={onClose} title="Nível da agência">
      {!inputs ? (
        <div className="text-sm text-foreground/40 py-4 text-center">Carregando…</div>
      ) : (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
              {Icon && <Icon size={22} />}
            </div>
            <div>
              <div className="text-foreground text-base font-black">Agência {level.label}</div>
              <div className="text-foreground/45 text-[12px] tabular-nums">{points} pts</div>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ background: "color-mix(in srgb, var(--foreground) 10%, transparent)" }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${level.progressPct}%`, background: color }} />
          </div>
          <p className="text-foreground/55 text-[13px] leading-relaxed mb-4">
            {level.pointsToNext != null
              ? `Faltam ${level.pointsToNext} pts pro próximo nível.`
              : "Nível máximo — sua agência é uma potência."}
            {" "}É o Programa de Níveis: quanto mais você usa o Modo Criador de verdade, mais sobe.
          </p>
          <Link to="/programa-de-niveis" onClick={onClose}
            className="inline-flex items-center gap-1.5 text-sm font-bold hover:underline" style={{ color }}>
            Ver o programa completo →
          </Link>
        </div>
      )}
    </Modal>
  );
}
