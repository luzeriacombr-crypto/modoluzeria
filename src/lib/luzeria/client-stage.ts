import type { Status } from "./types";

/** Etapas do pipeline como o cliente final enxerga, sem jargão interno. */
export type ClientStage = "producing" | "blocked" | "client_review" | "scheduled" | "published";

/** Ordem do pipeline pra barra de progresso — "blocked" é exceção, não um degrau. */
export const CLIENT_STAGE_ORDER: ClientStage[] = ["producing", "client_review", "scheduled", "published"];

export const CLIENT_STAGE_META: Record<ClientStage, { label: string; icon: string; color: string }> = {
  producing: { label: "Em produção", icon: "Hammer", color: "#8B93A6" },
  blocked: { label: "Precisa de atenção", icon: "AlertTriangle", color: "#FF6B6B" },
  client_review: { label: "Aguardando sua aprovação", icon: "ClipboardCheck", color: "#F5A623" },
  scheduled: { label: "Aprovado, aguardando publicação", icon: "Rocket", color: "#8B7CFF" },
  published: { label: "Publicado", icon: "CheckCheck", color: "rgb(var(--lz-brand-rgb))" },
};

export const CLIENT_STAGE_BLOCKED_FALLBACK = "Aguardando um ajuste interno antes de continuar.";

export function mapStatusToClientStage(status: Status): ClientStage {
  switch (status) {
    case "TRAVADO":
      return "blocked";
    case "REVISAO_CLIENTE":
      return "client_review";
    case "AGENDAMENTO":
    case "REVISAO_AGENDAMENTO":
    case "PRONTO_PARA_PUBLICAR":
      return "scheduled";
    case "FINALIZADO":
      return "published";
    default:
      return "producing";
  }
}
