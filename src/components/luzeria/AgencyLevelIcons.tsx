// Ícones e cores dos 6 patamares do Programa de Níveis — usados tanto no
// painel admin (AgenciesBillingPanel) quanto na página pública
// (programa-de-niveis.tsx). Mantido separado de agency-level.ts (que é
// lógica pura, sem JSX) pra esse arquivo poder ficar só com o visual.
import type { SVGProps } from "react";
import type { AGENCY_TIER_NAMES } from "@/lib/luzeria/agency-level";

export type AgencyTierName = (typeof AGENCY_TIER_NAMES)[number];

export const TIER_COLOR: Record<AgencyTierName, string> = {
  "Bronze": "#B87A4B",
  "Prata": "#C7CDD6",
  "Ouro": "#E8C34A",
  "Platina": "#7EE0D1",
  "Diamante": "#6FC3FF",
  "Lendária": "#D7FF3F",
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

/** Bronze/Prata/Ouro — medalha (contorno). */
function MedalIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <circle cx="12" cy="8" r="6" />
      <path d="M8.7 13.3 7 22l5-3 5 3-1.7-8.7" />
    </svg>
  );
}

/** Platina/Diamante — gema (contorno). */
function GemIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 3h12l4 6-10 12L2 9Z" />
      <path d="M11 3 8 9l4 12 4-12-3-6" />
      <path d="M2 9h20" />
    </svg>
  );
}

/** Lendária — escudo preenchido com a chama vazada (recorte), aprovado
 * pelo Junior depois de algumas rodadas de ajuste num protótipo. */
function ShieldFlameIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M12 1 3 5v6.1c0 6.6 3.9 11.6 9 13.4 5.1-1.8 9-6.8 9-13.4V5l-9-4Z M12 5.8c1.8 2.6 2.9 4.5 2.9 6.3a2.9 2.9 0 1 1-5.8 0c0-1.1.35-2.1 1-2.9-.1.8.1 1.55.8 2-.35-1.7-.1-3.5 1.1-5.4Z"
      />
    </svg>
  );
}

export const TIER_ICON: Record<AgencyTierName, (props: IconProps) => React.JSX.Element> = {
  "Bronze": MedalIcon,
  "Prata": MedalIcon,
  "Ouro": MedalIcon,
  "Platina": GemIcon,
  "Diamante": GemIcon,
  "Lendária": ShieldFlameIcon,
};
