// Sistema de nível/gamificação da agência — módulo puro (sem Supabase),
// importável tanto no server quanto no client. Regras definidas com o
// Junior: escala de jogo competitivo (Bronze a Lendária), pontuação só a
// partir de dados que já existem no banco hoje, sem depender de nenhuma
// coluna/migração ainda não confirmada como aplicada em produção.

export type AgencyLevelInput = {
  activeClients: number;
  /** Teto de clientes do plano atual (Solo=10, Pro=20, Agência=30, Enterprise=50). */
  planMaxClients: number;
  finalizedCount: number;
  isPayingCustomer: boolean;
  driveConnected: boolean;
  instagramConnectedCount: number;
  teamSize: number;
  /** Teto de colaboradores do plano atual (Solo=2, Pro=10, Agência=20, Enterprise=50). */
  planMaxCollaborators: number;
};

/** Clientes, equipe e Instagram pontuam por PERCENTUAL do que o plano da
 * agência permite, não número absoluto — pedido direto do Junior: uma
 * agência Solo (teto de 10 clientes) precisa conseguir chegar em Lendária
 * lotando o próprio plano, do mesmo jeito que uma Agência (teto de 30)
 * lotando o dela. Com número absoluto, Solo nunca alcançava o teto de
 * pontos só por ter um plano menor — o que não tem nada a ver com o
 * quanto ela realmente usa o produto.
 *
 * Conteúdo entregue continua sendo contagem absoluta (com teto de 2500) —
 * ele não favorece agência grande do mesmo jeito: uma Solo consistente ao
 * longo dos anos acumula tanto post/reel quanto uma agência maior num
 * período mais curto, então não precisa ser relativo ao plano. */
export function computeAgencyPoints(i: AgencyLevelInput): number {
  const clientFill = i.planMaxClients > 0 ? Math.min(1, i.activeClients / i.planMaxClients) : 0;
  const clientPts = clientFill * 300;
  const teamFill = i.planMaxCollaborators > 0 ? Math.min(1, i.teamSize / i.planMaxCollaborators) : 0;
  const teamPts = teamFill * 300;
  const igFill = i.activeClients > 0 ? Math.min(1, i.instagramConnectedCount / i.activeClients) : 0;
  const igPts = igFill * 300;
  const deliveryPts = Math.min(i.finalizedCount, 2500);
  const payingPts = i.isPayingCustomer ? 150 : 0;
  const drivePts = i.driveConnected ? 25 : 0;
  return Math.round(clientPts + teamPts + igPts + deliveryPts + payingPts + drivePts);
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
