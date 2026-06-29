export type Status =
  | "PLANEJAMENTO"
  | "COPY"
  | "REVISAO_INTERNA"
  | "REVISAO_CLIENTE"
  | "AGENDAMENTO"
  | "REVISAO_AGENDAMENTO"
  | "FINALIZADO"
  // Post-only
  | "CRIACAO"
  | "REVISAO_ARTE"
  // Reel-only
  | "EM_GRAVACAO"
  | "EM_EDICAO";

export type ContentType = "post" | "reel" | "outros";

/** Tipos de vídeo exclusivos de Reels. */
export type ReelType = "lofi" | "facil" | "basico" | "avancado";
export const REEL_TYPES: ReelType[] = ["lofi", "facil", "basico", "avancado"];
export const REEL_TYPE_LABEL: Record<ReelType, string> = {
  lofi: "Lo-fi",
  facil: "Fácil",
  basico: "Básico",
  avancado: "Avançado",
};

export interface Comment {
  id: string;
  text: string;
  authorId: string | null;
  authorName?: string | null;
  createdAt: string;
  system?: boolean;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  idx: number;
  title: string;
  status: Status;
  assigneeIds: string[];
  copy: string;
  driveLink: string;
  comments: Comment[];
  updatedAt: string;
  reelType?: ReelType | null;
  editorId?: string | null;
}

export interface MonthData {
  id: string;
  /** YYYY-MM */
  key: string;
  posts: ContentItem[];
  reels: ContentItem[];
  outros: ContentItem[];
}

export interface CustomFields {
  niche: string;
  postsPerWeek: number;
  reelsPerWeek: number;
  fixedResponsibleId: string | null;
  reviewDay: string;
  notes: string;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  favorite: boolean;
  archived: boolean;
  category: string;
  customFields: CustomFields;
  createdAt: string;
}

export type Role = "master" | "setor" | "member";

export interface Profile {
  id: string;
  email: string;
  name: string;
  color: string;
  icon: string | null;
  active: boolean;
  role: Role;
}

export interface NotificationItem {
  id: string;
  type: string;
  itemId: string | null;
  message: string;
  read: boolean;
  createdAt: string;
}

export const STATUS_META: Record<
  Status,
  { label: string; bg: string; color: string; icon: string }
> = {
  PLANEJAMENTO:        { label: "Planejamento",        bg: "#1E2A3A", color: "#7EB3FF", icon: "FileText" },
  COPY:                { label: "Copy",                bg: "#2A1E3A", color: "#B97EFF", icon: "PenLine" },
  REVISAO_INTERNA:     { label: "Revisão interna",     bg: "#2A2A1E", color: "#FFD97E", icon: "Search" },
  REVISAO_CLIENTE:     { label: "Revisão cliente",     bg: "#0D2B4A", color: "#4A9EFF", icon: "MessageSquare" },
  AGENDAMENTO:         { label: "Agendamento",         bg: "#1A2E2A", color: "#7EFFD9", icon: "CalendarCheck" },
  REVISAO_AGENDAMENTO: { label: "Revisão agendamento", bg: "#2A1E1E", color: "#FF9E7E", icon: "CalendarClock" },
  FINALIZADO:          { label: "Finalizado",          bg: "#1A3A1A", color: "#C8D44E", icon: "CheckCircle" },
  CRIACAO:             { label: "Criação de arte",     bg: "#3D2B5E", color: "#C084FC", icon: "Paintbrush" },
  REVISAO_ARTE:        { label: "Revisão de arte",     bg: "#4A2800", color: "#FF8C42", icon: "Eye" },
  EM_GRAVACAO:         { label: "Em gravação",         bg: "#1A1A3A", color: "#7E9EFF", icon: "Video" },
  EM_EDICAO:           { label: "Em edição",           bg: "#2A1A2A", color: "#FF7EE8", icon: "Scissors" },
};

/** Status comuns a Posts, Reels e Outros, na ordem do pipeline. */
export const GLOBAL_STATUS_ORDER: Status[] = [
  "PLANEJAMENTO",
  "COPY",
  "REVISAO_INTERNA",
  "REVISAO_CLIENTE",
  "AGENDAMENTO",
  "REVISAO_AGENDAMENTO",
  "FINALIZADO",
];

export const POST_EXTRA_STATUS: Status[] = ["CRIACAO", "REVISAO_ARTE"];
export const REEL_EXTRA_STATUS: Status[] = ["EM_GRAVACAO", "EM_EDICAO"];

/** Ordem usada para listagens gerais (Dashboard, MyTasks). Inclui todos. */
export const STATUS_ORDER: Status[] = [
  "PLANEJAMENTO",
  "COPY",
  "CRIACAO",
  "REVISAO_ARTE",
  "EM_GRAVACAO",
  "EM_EDICAO",
  "REVISAO_INTERNA",
  "REVISAO_CLIENTE",
  "AGENDAMENTO",
  "REVISAO_AGENDAMENTO",
  "FINALIZADO",
];

export function statusOptionsFor(type: ContentType): Status[] {
  if (type === "post") return [...GLOBAL_STATUS_ORDER, ...POST_EXTRA_STATUS];
  if (type === "reel") return [...GLOBAL_STATUS_ORDER, ...REEL_EXTRA_STATUS];
  return [...GLOBAL_STATUS_ORDER, ...POST_EXTRA_STATUS, ...REEL_EXTRA_STATUS];
}