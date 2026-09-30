// House — agência interna de uma empresa (orgs.account_type = 'house').
// Mesmo código do Modo Criador: este arquivo concentra o que muda por tipo
// de conta (módulos escondidos + terminologia), pra nenhum componente ter
// que saber a regra de cor. Pode ser importado tanto no navegador quanto no
// servidor — nada aqui toca banco.
import type { Profile } from "./types";

export type AccountType = "agency" | "house";

export function isHouse(me: Pick<Profile, "accountType"> | null | undefined): boolean {
  return me?.accountType === "house";
}

/** Módulos que nunca aparecem numa house, independente do que estiver em
 * orgs.disabled_features — somados a disabledFeatures pelo getMe, então
 * todo `disabled.has("x")` que já existe no app funciona sem mudança.
 * Algumas chaves (client_finance, journey, approval_link, avulsos,
 * referrals, client_overview) só existem pra house: não são toggles de
 * Configurações → Geral, e em agência nunca estão ligadas. */
export const HOUSE_HIDDEN_FEATURES = [
  "sales_pipeline",   // Vendas / CRM da agência
  "forum",            // Fórum entre agências
  "photo_selection",  // Seleção de fotos
  "contract",         // Gerar contrato pra assinatura
  "agency_levels",    // Programa de Níveis / ranking de agências
  "whatsapp_reminders", // Avisar clientes no WhatsApp
  "client_finance",   // Valor de contrato/vencimento, pagamentos por cliente
  "margin",           // Margem por cliente
  "journey",          // Jornada do cliente
  "approval_link",    // Aprovação por link (feed e roteiros)
  "avulsos",          // Pasta de clientes avulsos
  "referrals",        // Indique e ganhe
  "client_overview",  // Visão geral de clientes
  "client_import",    // Importar clientes (Trello/ClickUp/IA)
] as const;

export function withHouseHiddenFeatures(disabled: string[], accountType: AccountType): string[] {
  if (accountType !== "house") return disabled;
  return [...new Set([...disabled, ...HOUSE_HIDDEN_FEATURES])];
}

const TERMS = {
  cliente: { agency: "cliente", house: "marca" },
  Cliente: { agency: "Cliente", house: "Marca" },
  clientes: { agency: "clientes", house: "marcas" },
  Clientes: { agency: "Clientes", house: "Marcas" },
  agencia: { agency: "agência", house: "house" },
  Agencia: { agency: "Agência", house: "House" },
  aprovacaoCliente: { agency: "Aprovação do cliente", house: "Aprovação do gestor" },
  // Artigos concordando com o termo ("o cliente" / "a marca").
  oCliente: { agency: "o cliente", house: "a marca" },
  doCliente: { agency: "do cliente", house: "da marca" },
  daAgencia: { agency: "da agência", house: "da house" },
  novoCliente: { agency: "Novo cliente", house: "Nova marca" },
} as const;

export type TermKey = keyof typeof TERMS;

/** Termo certo pro tipo de conta de quem está vendo. Sem `me` (carregando),
 * cai no termo de agência — o mesmo texto que o app sempre mostrou. */
export function term(me: Pick<Profile, "accountType"> | null | undefined, key: TermKey): string {
  return TERMS[key][isHouse(me) ? "house" : "agency"];
}

/** Rótulo do status REVISAO_CLIENTE numa house recém-criada/convertida
 * (gravado em content_statuses, então o master ainda pode renomear). */
export const HOUSE_APPROVAL_STATUS_LABEL = "Aprovação do gestor";

/** Metas padrão de uma house nova — o dono ajusta no onboarding. */
export const HOUSE_DEFAULT_GOALS = {
  storiesPerWorkday: 3,
  feedPostsPerWeek: 3,
  planningDeadlineDay: 25,
};

/** Quanto a house paga por mês: plano + marcas além da principal. */
export function houseMonthlyCents(planPriceCents: number, extraBrandCents: number, activeBrands: number): number {
  return planPriceCents + Math.max(0, activeBrands - 1) * extraBrandCents;
}

export const HOUSE_EXTRA_BRAND_CENTS_DEFAULT = 7990;
