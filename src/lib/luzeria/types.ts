export type Status =
  | "START"
  | "CRIACAO"
  | "REVISAO_ARTE"
  | "REVISAO_CLIENTE"
  | "FINALIZADO";

export type ContentType = "post" | "reel";

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
}

export interface MonthData {
  id: string;
  /** YYYY-MM */
  key: string;
  posts: ContentItem[];
  reels: ContentItem[];
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
  START: {
    label: "Start",
    bg: "rgba(255,255,255,0.1)",
    color: "#FFFFFF",
    icon: "Play",
  },
  CRIACAO: {
    label: "Criação da arte",
    bg: "#3D2B5E",
    color: "#C9B6FF",
    icon: "Paintbrush",
  },
  REVISAO_ARTE: {
    label: "Revisão da arte",
    bg: "#4A2800",
    color: "#FF8C42",
    icon: "Eye",
  },
  REVISAO_CLIENTE: {
    label: "Revisão cliente",
    bg: "#0D2B4A",
    color: "#4A9EFF",
    icon: "MessageSquare",
  },
  FINALIZADO: {
    label: "Finalizado",
    bg: "#1A3A1A",
    color: "#C8D44E",
    icon: "CheckCircle",
  },
};

export const STATUS_ORDER: Status[] = [
  "START",
  "CRIACAO",
  "REVISAO_ARTE",
  "REVISAO_CLIENTE",
  "FINALIZADO",
];