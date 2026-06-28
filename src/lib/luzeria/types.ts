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
  author: string;
  createdAt: number;
  system?: boolean;
}

export interface ContentItem {
  id: string;
  type: ContentType;
  index: number;
  title: string;
  status: Status;
  assignee: string | null;
  copy: string;
  driveLink: string;
  comments: Comment[];
  updatedAt: number;
}

export interface MonthData {
  /** YYYY-MM */
  key: string;
  posts: ContentItem[];
  reels: ContentItem[];
}

export interface CustomFields {
  niche: string;
  postsPerWeek: number;
  reelsPerWeek: number;
  fixedResponsible: string;
  reviewDay: string;
  notes: string;
}

export interface Client {
  id: string;
  name: string;
  color: string;
  icon: string; // emoji
  favorite: boolean;
  archived: boolean;
  customFields: CustomFields;
  months: Record<string, MonthData>;
  createdAt: number;
}

export const TEAM = ["Jordania", "Lucas", "Marina", "Pedro", "Ana"];

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