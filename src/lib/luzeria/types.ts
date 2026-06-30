export type Status =
  | "PLANEJAMENTO"
  | "COPY"
  | "REVISAO_INTERNA"
  | "REVISAO_CLIENTE"
  | "AGENDAMENTO"
  | "REVISAO_AGENDAMENTO"
  | "PRONTO_PARA_PUBLICAR"
  | "TRAVADO"
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
  caption: string;
  comments: Comment[];
  updatedAt: string;
  reelType?: ReelType | null;
  editorId?: string | null;
  /** Optional internal deadline (YYYY-MM-DD). */
  dueDate?: string | null;
  /** Set automatically when item leaves PLANEJAMENTO for the first time. */
  startedAt?: string | null;
  /** Set automatically when item reaches PRONTO_PARA_PUBLICAR. */
  finishedAt?: string | null;
  /** Filled when status = TRAVADO. */
  blockedReason?: string | null;
  /** Checklist embarcada (subtarefas). */
  checklist?: ChecklistItem[];
  /** Quantas vezes o item voltou (de PRONTO_PARA_PUBLICAR ou REVISAO_*). */
  reworkCount?: number;
  /** Nota de qualidade dada quando virou PRONTO_PARA_PUBLICAR (1–5). */
  qualityRating?: number | null;
  /** Posição na aba "Preview de Feed" (independente de `idx`). */
  feedOrder?: number | null;
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
  /** Free-form description for the client profile/ficha. */
  description?: string | null;
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
  /** Public/signed URL of the uploaded avatar image, or null. */
  avatarUrl?: string | null;
  /** Path inside the `avatars` bucket (raw value stored in DB). */
  avatarPath?: string | null;
  onboardedAt?: string | null;
  tourCompletedAt?: string | null;
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
  PRONTO_PARA_PUBLICAR: { label: "Pronto para publicar", bg: "#1A3A1A", color: "#C8D44E", icon: "CheckCircle" },
  TRAVADO:             { label: "Travado",             bg: "#3A1A1A", color: "#FF6B6B", icon: "Ban" },
  CRIACAO:             { label: "Criação de arte",     bg: "#3D2B5E", color: "#C084FC", icon: "Paintbrush" },
  REVISAO_ARTE:        { label: "Revisão de arte",     bg: "#4A2800", color: "#FF8C42", icon: "Eye" },
  EM_GRAVACAO:         { label: "Em gravação",         bg: "#1A1A3A", color: "#7E9EFF", icon: "Video" },
  EM_EDICAO:           { label: "Em edição",         bg: "#2A1A2A", color: "#FF7EE8", icon: "Scissors" },
};

/** Status comuns a Posts, Reels e Outros, na ordem do pipeline. */
export const GLOBAL_STATUS_ORDER: Status[] = [
  "PLANEJAMENTO",
  "COPY",
  "REVISAO_INTERNA",
  "REVISAO_CLIENTE",
  "AGENDAMENTO",
  "REVISAO_AGENDAMENTO",
  "TRAVADO",
  "PRONTO_PARA_PUBLICAR",
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
  "TRAVADO",
  "PRONTO_PARA_PUBLICAR",
];

export function statusOptionsFor(type: ContentType): Status[] {
  const base: Status[] = [
    "PLANEJAMENTO",
    "COPY",
    "REVISAO_INTERNA",
    "REVISAO_CLIENTE",
    "AGENDAMENTO",
    "REVISAO_AGENDAMENTO",
  ];
  const tail: Status[] = ["TRAVADO", "PRONTO_PARA_PUBLICAR"];
  if (type === "post") {
    return [
      "PLANEJAMENTO",
      "COPY",
      ...POST_EXTRA_STATUS,
      ...base.filter((s) => s !== "PLANEJAMENTO" && s !== "COPY"),
      ...tail,
    ];
  }
  if (type === "reel") {
    return [
      "PLANEJAMENTO",
      "COPY",
      ...REEL_EXTRA_STATUS,
      ...base.filter((s) => s !== "PLANEJAMENTO" && s !== "COPY"),
      ...tail,
    ];
  }
  return [
    "PLANEJAMENTO",
    "COPY",
    ...POST_EXTRA_STATUS,
    ...REEL_EXTRA_STATUS,
    ...base.filter((s) => s !== "PLANEJAMENTO" && s !== "COPY"),
    ...tail,
  ];
}

/* ============== CLIENT PROFILE (Ficha) ============== */

export interface ClientLink {
  id: string;
  clientId: string;
  label: string;
  url: string;
  sortOrder: number;
}

export interface ClientContact {
  id: string;
  clientId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  sortOrder: number;
}

export interface ClientSecret {
  id: string;
  clientId: string;
  label: string;
  value: string;
  notes: string | null;
}

export interface ClientFicha {
  description: string;
  links: ClientLink[];
  contacts: ClientContact[];
  /** Only filled for admins (master/setor). */
  secrets: ClientSecret[];
  /** Aggregated metrics computed across all months. */
  metrics: {
    totalItems: number;
    finalized: number;
    blocked: number;
    avgLeadTimeHours: number | null;
    lastDeliveryAt: string | null;
  };
}

/* ============== ROADMAP — FASES 2/3/4 ============== */

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface MemberGoal {
  userId: string;
  monthKey: string;
  postsGoal: number;
  reelsGoal: number;
  storiesGoal: number;
}

export interface MemberGoalProgress extends MemberGoal {
  postsDone: number;
  reelsDone: number;
  storiesDone: number;
}

export interface ClientOnboarding {
  id: string;
  clientId: string;
  checklist: ChecklistItem[];
  completedAt: string | null;
}

export type RecurringCadence = "weekly" | "monthly";

export interface RecurringTemplate {
  id: string;
  clientId: string;
  type: ContentType;
  title: string;
  cadence: RecurringCadence;
  dayOfWeek: number | null;   // 0 (Dom) – 6 (Sáb)
  dayOfMonth: number | null;  // 1 – 31
  defaultAssignees: string[];
  active: boolean;
  lastGeneratedAt: string | null;
}

export interface ActivityEntry {
  id: string;
  actorId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  meta: Record<string, any>;
  at: string;
}

/** Tempo médio gasto em cada status. */
export interface StatusDurationStat {
  status: Status;
  avgHours: number;
  count: number;
}

/** App-wide settings (master-controlled). */
export interface AppSettings {
  requireRatingOnFinalize: boolean;
}

/** Item agrupado por dia da semana para o kanban "Minha Semana". */
export interface WeekItem {
  id: string;
  type: ContentType;
  idx: number;
  title: string;
  status: Status;
  clientId: string;
  clientName: string;
  clientColor: string;
  monthKey: string;
  dueDate: string | null;
}

export interface WorkloadSummary {
  userId: string;
  openCount: number;
  oldest: { id: string; title: string; clientName: string; daysOpen: number }[];
}

export interface TimelineEntry {
  id: string;
  at: string;
  actorId: string | null;
  kind: "created" | "status" | "due" | "rated" | "rework" | "comment" | "system";
  text: string;
  meta?: Record<string, any>;
}