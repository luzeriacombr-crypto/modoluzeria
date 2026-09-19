// Sistema de nível/gamificação da agência — módulo puro (sem Supabase),
// importável tanto no server quanto no client. Regras definidas com o
// Junior: escala de jogo competitivo (Bronze a Lendária), pontuação só a
// partir de dados que já existem no banco hoje, sem depender de nenhuma
// coluna/migração ainda não confirmada como aplicada em produção.

export type AgencyLevelInput = {
  activeClients: number;
  finalizedCount: number;
  isPayingCustomer: boolean;
  driveConnected: boolean;
  instagramConnectedCount: number;
  teamSize: number;
};

/** Conteúdo entregue tem teto de propósito — sem isso, uma agência antiga
 * com histórico gigante de posts chegaria em Lendária sozinha, só no
 * volume, sem nunca ter conectado Instagram, crescido a equipe ou tido
 * mais de 1 cliente. O teto (2500 pts) fica sempre abaixo do primeiro
 * degrau de Lendária (3250) — só combinando com os outros critérios dá
 * pra chegar lá (ajustado a pedido do Junior, que testou isso na prática). */
export function computeAgencyPoints(i: AgencyLevelInput): number {
  const clientPts = Math.min(i.activeClients, 20) * 15;
  const deliveryPts = Math.min(i.finalizedCount, 2500);
  const payingPts = i.isPayingCustomer ? 150 : 0;
  const drivePts = i.driveConnected ? 25 : 0;
  const igPts = Math.min(i.instagramConnectedCount, 20) * 15;
  const teamPts = Math.min(i.teamSize, 15) * 20;
  return clientPts + deliveryPts + payingPts + drivePts + igPts + teamPts;
}

export const AGENCY_TIER_NAMES = ["Bronze", "Prata", "Ouro", "Platina", "Diamante", "Lendária"] as const;
const SUB_LEVELS = ["I", "II", "III"] as const;

/** Índice 0 = Bronze I (0 pts). Cada patamar cresce mais que o anterior de
 * propósito — sobe rápido no começo (motivação imediata), exige uso
 * sustentado pra chegar no topo. */
const THRESHOLDS = [
  0, 40, 90, // Bronze I/II/III
  150, 230, 330, // Prata
  450, 600, 780, // Ouro
  1000, 1260, 1560, // Platina
  1900, 2300, 2750, // Diamante
  3250, 3800, 4400, // Lendária
];

export type AgencyLevel = {
  tier: string;
  subLevel: string;
  label: string;
  points: number;
  index: number;
  nextThreshold: number | null;
  pointsToNext: number | null;
  progressPct: number;
};

export function getAgencyLevel(points: number): AgencyLevel {
  let idx = 0;
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= THRESHOLDS[i]) { idx = i; break; }
  }
  const tier = AGENCY_TIER_NAMES[Math.floor(idx / 3)];
  const subLevel = SUB_LEVELS[idx % 3];
  const prevThreshold = THRESHOLDS[idx];
  const nextThreshold = idx + 1 < THRESHOLDS.length ? THRESHOLDS[idx + 1] : null;
  const progressPct = nextThreshold
    ? Math.round(((points - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;
  return {
    tier, subLevel, label: `${tier} ${subLevel}`, points, index: idx,
    nextThreshold, pointsToNext: nextThreshold != null ? nextThreshold - points : null,
    progressPct,
  };
}
