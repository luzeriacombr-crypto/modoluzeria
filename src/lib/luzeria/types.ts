export type Status =
  | "PLANEJAMENTO"
  | "COPY"
  | "REVISAO_INTERNA"
  | "REVISAO_CLIENTE"
  | "AGENDAMENTO"
  | "REVISAO_AGENDAMENTO"
  | "PRONTO_PARA_PUBLICAR"
  | "FINALIZADO"
  | "TRAVADO"
  // Post-only
  | "CRIACAO"
  | "REVISAO_ARTE"
  // Reel-only
  | "EM_GRAVACAO"
  | "EM_EDICAO"
  // Activity-only (gravacao/roteiro/sistema/outros) — simple two-state pipeline,
  // these aren't "published" so the post/reel funnel doesn't apply.
  | "PENDENTE"
  | "CONCLUIDO";

/** Content types that are activity logs, not publishable content. */
export const ACTIVITY_TYPES: ContentType[] = ["gravacao", "roteiro", "sistema", "outros"];
export function isActivityType(type: ContentType): boolean {
  return ACTIVITY_TYPES.includes(type);
}

/** Date field label per activity type — what the date on the item actually means.
 * Mirrors ACTIVITY_CONFIG in MaisAtividadesTab.tsx, kept in sync manually. */
export const ACTIVITY_DATE_LABEL: Record<string, string> = {
  gravacao: "Data para gravação",
  roteiro: "Data de entrega",
  sistema: "Data de entrega",
  outros: "Data de entrega",
};

/** Label da quantidade por tipo de atividade — null quando o tipo não usa
 * esse campo (Sistema, por natureza, não tem uma "contagem" fixa). Mirrors
 * ACTIVITY_CONFIG in MaisAtividadesTab.tsx, kept in sync manually. */
export const ACTIVITY_QUANTITY_LABEL: Record<string, string | null> = {
  gravacao: "Vídeos gravados",
  roteiro: "Roteiros",
  sistema: null,
  outros: "Quantidade",
};

/** True for any status that means "done" for its content type — the final
 * publish/finalize states for posts/reels/avulsos, and the equivalent
 * "Concluído" state for activities (gravação/roteiro/sistema/outros). Use
 * this everywhere "is this item done" is checked instead of comparing
 * against PRONTO_PARA_PUBLICAR/FINALIZADO directly, so activities don't
 * fall through as perpetually pending. */
export function isDoneStatus(status: Status): boolean {
  return status === "PRONTO_PARA_PUBLICAR" || status === "FINALIZADO" || status === "CONCLUIDO";
}

export type ContentType = "post" | "reel" | "story" | "outros" | "gravacao" | "roteiro" | "sistema";

/** Label de exibição para cada tipo de conteúdo. */
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  post: "Post",
  reel: "Reel",
  story: "Story",
  outros: "Outro",
  gravacao: "Gravação",
  roteiro: "Roteiro",
  sistema: "Sistema",
};

/** Emoji/ícone textual rápido por tipo. */
export const CONTENT_TYPE_ICON: Record<ContentType, string> = {
  post: "🖼️",
  reel: "🎬",
  story: "📸",
  outros: "📦",
  gravacao: "🎥",
  roteiro: "📝",
  sistema: "🗂️",
};

/** Tipos de vídeo exclusivos de Reels. */
export type ReelType = "lofi" | "facil" | "basico" | "avancado";
export const REEL_TYPES: ReelType[] = ["lofi", "facil", "basico", "avancado"];
export const REEL_TYPE_LABEL: Record<ReelType, string> = {
  lofi: "Lo-fi",
  facil: "Fácil",
  basico: "Básico",
  avancado: "Avançado",
};

/** Formato exclusivo de Posts. */
export type PostFormat = "estatico" | "carrossel";
export const POST_FORMATS: PostFormat[] = ["estatico", "carrossel"];
export const POST_FORMAT_LABEL: Record<PostFormat, string> = {
  estatico: "Estático",
  carrossel: "Carrossel",
};

export interface Comment {
  id: string;
  text: string;
  authorId: string | null;
  authorName?: string | null;
  createdAt: string;
  editedAt?: string | null;
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
  postFormat?: PostFormat | null;
  editorId?: string | null;
  /** Optional internal deadline (YYYY-MM-DD). Never shown to clients. */
  dueDate?: string | null;
  /** Real scheduled publish date+time (ISO timestamp). Shown to clients in the preview. */
  scheduledAt?: string | null;
  /** When true, the scheduled-publish cron auto-publishes this post to Instagram once scheduledAt arrives. */
  igAutoPublish?: boolean;
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
  /** Caminho da capa customizada no bucket `reel-covers` (storage). */
  coverPath?: string | null;
  /** URL assinada da capa para uso direto em <img>. */
  coverUrl?: string | null;
  /** Origem: frame capturado do vídeo ou imagem enviada. */
  coverSource?: "frame" | "upload" | null;
  /** Local da gravação (ex.: estúdio, externo). Só usado em type="gravacao". */
  location?: string | null;
  /** Contagem livre (vídeos gravados / roteiros / itens), conforme
   * ACTIVITY_QUANTITY_LABEL — null quando o tipo não usa quantidade. */
  activityQuantity?: number | null;
}

export interface MonthData {
  id: string;
  /** YYYY-MM */
  key: string;
  /** How "Preview de Feed" (and the public client link) orders items. */
  feedOrderMode: "personalizada" | "cronologica";
  /** Only meaningful when feedOrderMode is "cronologica". */
  feedOrderDirection: "asc" | "desc";
  posts: ContentItem[];
  reels: ContentItem[];
  stories: ContentItem[];
  outros: ContentItem[];
  gravacoes: ContentItem[];
  roteiros: ContentItem[];
  sistemas: ContentItem[];
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
  /** Signed URL for the client's avatar photo (stored in avatars bucket under clients/ prefix). */
  photoUrl?: string | null;
  /** Raw storage path in the avatars bucket. */
  photoPath?: string | null;
  /** Whether Stories assigned for this client show up in the assignee's
   * "Minhas Demandas" — off by default so high-frequency Stories work
   * doesn't clutter the task list unless the agency opts in per client. */
  notifyStoriesInTasks?: boolean;
  /** Valor mensal do contrato — master-only, usado pelo painel de margem/lucratividade. */
  contractValue?: number | null;
  /** Dia do mês (1-31) em que o pagamento desse cliente vence — master-only,
   * usado pra "Pagamentos próximos" em Minhas Demandas e na aba Financeiro. */
  paymentDueDay?: number | null;
  /** Exceção por cliente às abas customizáveis (reels/finalizados/mais/feed)
   * — null = usa o padrão da agência (me.disabledFeatures); um array
   * substitui o padrão só pra esse cliente. */
  hiddenTabs?: string[] | null;
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
  /** Admin opted this member out of the "Top Membros" ranking (e.g. an
   * automation-only account that shouldn't compete in the internal bonus). */
  excludeFromRanking?: boolean;
  /** Public/signed URL of the uploaded avatar image, or null. */
  avatarUrl?: string | null;
  /** Path inside the `avatars` bucket (raw value stored in DB). */
  avatarPath?: string | null;
  onboardedAt?: string | null;
  tourCompletedAt?: string | null;
  /** True only for masters of the Luzeria org itself (the platform owner). */
  isPlatformAdmin?: boolean;
  /** True when this org was approved by Luzeria to resell white-label
   * instances of Modo Criador to its own clients. */
  isReseller?: boolean;
  orgId?: string | null;
  orgName?: string | null;
  orgTagline?: string | null;
  orgLogoUrl?: string | null;
  orgColorPrimary?: string | null;
  orgColorPrimaryLight?: string | null;
  orgColorSidebar?: string | null;
  /** Imagem própria da agência usada no og:image do link público de preview
   * de feed, ou null pra usar a imagem padrão do Modo Criador. */
  orgFeedPreviewImageUrl?: string | null;
  orgFeedPreviewImagePath?: string | null;
  /** Ícone próprio da agência (favicon da aba + apple-touch-icon), ou null
   * pra usar o ícone padrão do Modo Criador. */
  orgFaviconUrl?: string | null;
  orgFaviconPath?: string | null;
  /** Optional features this org's team turned off in Configurações > Geral
   * — keys from OPTIONAL_FEATURE_KEYS. Hides the corresponding UI without
   * touching any underlying data. */
  disabledFeatures?: string[];
  /** Capabilities this org's Master granted the "setor" role beyond its
   * fixed baseline — keys from SETOR_PERMISSION_KEYS. Present for every
   * profile (not just setor ones) so a Master viewing the Equipe tab can
   * render the current toggle state. */
  setorPermissions?: string[];
  /** Cargos (Editor, Videomaker, Financeiro...) atribuídos a esse perfil —
   * uma pessoa pode ter vários ao mesmo tempo. `cargoPermissions` já vem
   * como a união das permissões de todos eles (calculada no servidor),
   * pra checar com hasPermission() sem precisar cruzar as duas listas. */
  cargoNames?: string[];
  cargoPermissions?: string[];
  /** Ids dos cargos atribuídos — usado só na lista de equipe (Settings),
   * pra saber quais checkboxes marcar no seletor de múltipla escolha. */
  cargoIds?: string[];
  /** Quando true, esse perfil só enxerga (em qualquer lugar do app — e
   * também no banco, via RLS) os clientes listados em `clientAccessIds`.
   * Default false = vê todos os clientes da org, igual sempre foi. */
  clientAccessRestricted?: boolean;
  /** Ids dos clientes liberados pra esse perfil quando `clientAccessRestricted`
   * é true. Ignorado quando false. */
  clientAccessIds?: string[];
  /** Org-wide toggle: when true, a member who's an assignee on an item can
   * set its editor and pick its video format (reel_type/post_format),
   * not just admins. Present for every profile, same reasoning as above. */
  membersCanSetEditorFormat?: boolean;
  /** Org-wide custom labels for fixed sidebar nav items, keyed by item id
   * (e.g. "dashboard", "cobranca") — falls back to the built-in label when
   * an id has no entry here. */
  navLabels?: Record<string, string>;
  /** Org-wide custom ordering for fixed sidebar nav items, keyed by section
   * ("main", "financeiro", "equipe") — each value is an ordered list of item
   * ids; any visible item missing from the list renders after the ordered
   * ones, in its built-in position. */
  navOrder?: Record<string, string[]>;
  /** Org-wide corner radius (px) applied to cards/buttons/inputs app-wide. */
  borderRadius?: number;
  /** Org-wide saved position/size of the movable Dashboard cards, keyed by
   * widget id — grid units, not pixels. Empty/missing id falls back to the
   * widget's built-in default slot. */
  dashboardLayout?: Record<string, { x: number; y: number; w: number; h: number }>;
  /** Org-wide override for the two colors in the Dashboard hero gradient.
   * null = auto (derived from the brand's light/sidebar colors). */
  heroGradientFrom?: string | null;
  heroGradientTo?: string | null;
  /** Personal (not org-wide) — which screen this member lands on right
   * after login. null = today's default (Minhas Demandas). */
  defaultLanding?: { view: string; clientId?: string } | null;
}

/** Escala semanal usada pro custo-hora por colaborador (Equipe > remuneração).
 * 0 = não trabalha nesse dia, 1 = meio período (4h), 2 = período integral (8h) —
 * varia por dia pra dar conta de casos como "sábado só de manhã". */
export type WorkSchedule = Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", 0 | 1 | 2>;
export const WEEK_DAYS: (keyof WorkSchedule)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const WEEK_DAY_LABEL: Record<keyof WorkSchedule, string> = {
  mon: "Seg", tue: "Ter", wed: "Qua", thu: "Qui", fri: "Sex", sat: "Sáb", sun: "Dom",
};
export function defaultWorkSchedule(): WorkSchedule {
  return { mon: 2, tue: 2, wed: 2, thu: 2, fri: 2, sat: 0, sun: 0 };
}
/** Mesma fórmula usada no banco (admin_list_member_hourly_cost) — só pra
 * mostrar uma prévia ao vivo enquanto o master edita, antes de salvar. */
export function computeMonthlyHourlyCost(monthlySalary: number | null, schedule: WorkSchedule | null): number | null {
  if (!monthlySalary || monthlySalary <= 0 || !schedule) return null;
  const periodsPerWeek = WEEK_DAYS.reduce((sum, d) => sum + (schedule[d] ?? 0), 0);
  const hoursPerMonth = periodsPerWeek * 4 * (52 / 12);
  return hoursPerMonth > 0 ? monthlySalary / hoursPerMonth : null;
}

export const SETOR_PERMISSION_KEYS = [
  "approve_finalize", "instagram_publish", "team_reports", "settings_journey",
] as const;
export type SetorPermissionKey = (typeof SETOR_PERMISSION_KEYS)[number];
export const SETOR_PERMISSION_LABEL: Record<SetorPermissionKey, { label: string; description: string }> = {
  approve_finalize: {
    label: "Aprovar posts e reels",
    description: "Marcar um conteúdo como \"Pronto para publicar\".",
  },
  instagram_publish: {
    label: "Publicar no Instagram",
    description: "Publicar ou programar posts diretamente no Instagram do cliente.",
  },
  team_reports: {
    label: "Ver relatório completo da equipe",
    description: "Acessar a aba Relatório em Configurações, com o desempenho de todos os colaboradores.",
  },
  settings_journey: {
    label: "Configurar Jornada do cliente",
    description: "Acessar a aba Jornada do cliente em Configurações.",
  },
};

/** True for Master always; for setor, only when the org granted `key`. */
export function hasSetorPermission(me: Pick<Profile, "role" | "setorPermissions"> | null | undefined, key: SetorPermissionKey): boolean {
  if (!me) return false;
  if (me.role === "master") return true;
  return me.role === "setor" && (me.setorPermissions ?? []).includes(key);
}

/** Catálogo mais amplo de permissões, generalizando SETOR_PERMISSION_KEYS
 * pra qualquer cargo (não só o papel fixo "setor") — v1 curado com as
 * chaves mais pedidas, não uma pra cada checagem interna do app (dá pra
 * crescer esse catálogo depois sem migração, já que cargos.permissions é
 * só um array de texto). */
export const PERMISSION_KEYS = [
  ...SETOR_PERMISSION_KEYS,
  "view_financeiro", "manage_team", "sales_pipeline", "manage_automations", "view_client_overview",
] as const;
export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export const PERMISSION_LABEL: Record<PermissionKey, { label: string; description: string }> = {
  ...SETOR_PERMISSION_LABEL,
  view_financeiro: {
    label: "Ver Financeiro",
    description: "Acessar Plano e Cobrança e Margem por Cliente em Configurações.",
  },
  manage_team: {
    label: "Gerenciar equipe",
    description: "Aprovar membros novos e editar a aba Equipe em Configurações.",
  },
  sales_pipeline: {
    label: "Vendas",
    description: "Ver e gerenciar o quadro de vendas (leads).",
  },
  manage_automations: {
    label: "Gerenciar automações",
    description: "Acessar a aba Automações em Configurações (Google Drive, lembretes).",
  },
  view_client_overview: {
    label: "Ver Visão Geral",
    description: "Acessar a Visão Geral operacional de todos os clientes.",
  },
};

/** True for Master always; pra todo mundo, também true se o papel "setor"
 * tem essa chave liberada por setorPermissions (compat com o mecanismo
 * antigo, ainda em uso pras 4 chaves originais) OU se algum cargo
 * atribuído à pessoa inclui essa permissão (união, já resolvida no
 * servidor em cargoPermissions). */
export function hasPermission(
  me: Pick<Profile, "role" | "setorPermissions" | "cargoPermissions"> | null | undefined,
  key: PermissionKey,
): boolean {
  if (!me) return false;
  if (me.role === "master") return true;
  if (me.role === "setor" && (SETOR_PERMISSION_KEYS as readonly string[]).includes(key) && (me.setorPermissions ?? []).includes(key)) return true;
  return (me.cargoPermissions ?? []).includes(key);
}

export const OPTIONAL_FEATURE_KEYS = [
  "formats", "whatsapp_reminders", "rotina", "calendar", "stories", "instagram", "drive", "daily_verse", "video_call", "google_calendar", "client_overview", "forum", "reference_library", "sales_pipeline",
  "reels", "finalizados", "mais", "feed",
] as const;
export type OptionalFeatureKey = (typeof OPTIONAL_FEATURE_KEYS)[number];
export const OPTIONAL_FEATURE_LABEL: Record<OptionalFeatureKey, { label: string; description: string }> = {
  formats: {
    label: "Formatos de post",
    description: "Seletor de formato (Lofi, Básico, Fácil, Avançado) dentro de cada post/reel.",
  },
  whatsapp_reminders: {
    label: "Avisar clientes no WhatsApp",
    description: "Seção em Minhas Demandas com clientes prontos pra receber aviso semanal.",
  },
  rotina: {
    label: "Rotina",
    description: "Item de menu e página de tarefas de limpeza recorrentes.",
  },
  calendar: {
    label: "Calendário",
    description: "Item de menu e visão mensal em grade de todas as publicações.",
  },
  stories: {
    label: "Stories",
    description: "Aba de Stories dentro de cada cliente.",
  },
  instagram: {
    label: "Instagram",
    description: "Item de menu com publicações agendadas/publicadas pelo app.",
  },
  drive: {
    label: "Google Drive",
    description: "Integração de arquivos com o Drive, dentro de Automações.",
  },
  daily_verse: {
    label: "Versículo do dia",
    description: "Frase e referência bíblica no topo de Minhas Demandas.",
  },
  video_call: {
    label: "Vídeo chamada",
    description: "Botão na barra lateral pra fazer uma vídeo chamada com câmera entre membros, com compartilhamento de tela opcional (esse último só no computador).",
  },
  google_calendar: {
    label: "Google Agenda",
    description: "Cada membro pode conectar sua própria Google Agenda no Perfil e ver os compromissos de hoje em Minhas Demandas.",
  },
  client_overview: {
    label: "Visão Geral",
    description: "Item de menu com uma tabela de todos os clientes ativos mostrando etapa atual da jornada, última gravação, próxima gravação prevista e última análise do mês anterior, além do painel de margem por cliente.",
  },
  forum: {
    label: "Fórum entre agências",
    description: "Aba dentro de Ajuda com um fórum entre agências do Modo Criador — só masters participam, moderação é do platform admin.",
  },
  reference_library: {
    label: "Biblioteca de Referências",
    description: "Item de menu com um banco de links/vídeos de referência salvos por cliente ou de forma geral, pra reaproveitar em roteiros futuros.",
  },
  sales_pipeline: {
    label: "Vendas",
    description: "Item de menu com um quadro kanban de leads/oportunidades, com conversão direta em cliente ao fechar uma venda.",
  },
  reels: {
    label: "Aba Reels (na página do cliente)",
    description: "Aba \"Reels\" dentro de cada cliente. Pode ser ocultada por cliente em Personalizar abas.",
  },
  finalizados: {
    label: "Aba Finalizados (na página do cliente)",
    description: "Aba \"Finalizados\" dentro de cada cliente. Pode ser ocultada por cliente em Personalizar abas.",
  },
  mais: {
    label: "Aba Mais (na página do cliente)",
    description: "Aba \"Mais\" (atividades, roteiros & planejamento, biblioteca) dentro de cada cliente. Pode ser ocultada por cliente em Personalizar abas.",
  },
  feed: {
    label: "Aba Preview de Feed (na página do cliente)",
    description: "Aba \"Preview de Feed\" dentro de cada cliente. Pode ser ocultada por cliente em Personalizar abas.",
  },
};

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
  PRONTO_PARA_PUBLICAR: { label: "Pronto para publicar", bg: "#1A3A1A", color: "rgb(var(--lz-brand-rgb))", icon: "CheckCircle" },
  FINALIZADO:          { label: "Finalizado/Publicado", bg: "#20242A", color: "#9AA4B2", icon: "Archive" },
  TRAVADO:             { label: "Travado",             bg: "#3A1A1A", color: "#FF6B6B", icon: "Ban" },
  CRIACAO:             { label: "Criação de arte",     bg: "#3D2B5E", color: "#C084FC", icon: "Paintbrush" },
  REVISAO_ARTE:        { label: "Revisão de arte",     bg: "#4A2800", color: "#FF8C42", icon: "Eye" },
  EM_GRAVACAO:         { label: "Em gravação",         bg: "#1A1A3A", color: "#7E9EFF", icon: "Video" },
  EM_EDICAO:           { label: "Em edição",         bg: "#2A1A2A", color: "#FF7EE8", icon: "Scissors" },
  PENDENTE:            { label: "Pendente",             bg: "#2A2A1E", color: "#FFD97E", icon: "Clock" },
  CONCLUIDO:           { label: "Concluído",            bg: "#1A3A1A", color: "rgb(var(--lz-brand-rgb))", icon: "CheckCircle" },
};

/** Rótulo exibido para um status — clientes Avulsos veem "Entregue" no lugar
 * de "Pronto para publicar" (o valor no banco continua PRONTO_PARA_PUBLICAR). */
export function statusLabel(status: Status, isAvulso?: boolean): string {
  if (isAvulso && status === "PRONTO_PARA_PUBLICAR") return "Entregue";
  return STATUS_META[status].label;
}

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

/** Visual grouping for the status-change dropdown — purely presentational
 * (doesn't affect the pipeline/order itself), so a long list of statuses
 * reads as "3 phases" instead of one flat wall of options. */
export const STATUS_GROUPS: { label: string; statuses: Status[] }[] = [
  { label: "Produção", statuses: ["PLANEJAMENTO", "COPY", "CRIACAO", "REVISAO_ARTE", "EM_GRAVACAO", "EM_EDICAO", "REVISAO_INTERNA", "PENDENTE"] },
  { label: "Aprovação", statuses: ["REVISAO_CLIENTE", "AGENDAMENTO", "REVISAO_AGENDAMENTO", "TRAVADO"] },
  { label: "Publicação", statuses: ["PRONTO_PARA_PUBLICAR", "FINALIZADO", "CONCLUIDO"] },
];

export function statusOptionsFor(type: ContentType): Status[] {
  // Atividades (gravação/roteiro/sistema/outros) não são publicadas — não fazem
  // sentido no funil de post/reel. Só registram se aconteceu ou não.
  if (isActivityType(type)) {
    return ["PENDENTE", "CONCLUIDO"];
  }

  // Stories não aparecem no Preview de Feed — não teria mais nenhum lugar
  // pra ver de novo depois de "Finalizado", então só post/reel ganham essa
  // etapa extra.
  const tail: Status[] = type === "post" || type === "reel"
    ? ["TRAVADO", "PRONTO_PARA_PUBLICAR", "FINALIZADO"]
    : ["TRAVADO", "PRONTO_PARA_PUBLICAR"];

  const base: Status[] = [
    "PLANEJAMENTO",
    "COPY",
    "REVISAO_INTERNA",
    "REVISAO_CLIENTE",
    "AGENDAMENTO",
    "REVISAO_AGENDAMENTO",
  ];
  if (type === "post" || type === "story") {
    return [
      "PLANEJAMENTO",
      "COPY",
      ...POST_EXTRA_STATUS,
      ...base.filter((s) => s !== "PLANEJAMENTO" && s !== "COPY"),
      ...tail,
    ];
  }
  return [
    "PLANEJAMENTO",
    "COPY",
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
  gravacaoGoal: number;
  outrosGoal: number;
}

export interface MemberGoalProgress extends MemberGoal {
  postsDone: number;
  reelsDone: number;
  storiesDone: number;
  gravacaoDone: number;
  outrosDone: number;
  rotinaDone: number;
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
  kind: "created" | "status" | "due" | "rated" | "rework" | "comment" | "system" | "file";
  text: string;
  meta?: Record<string, any>;
}

export interface PromotionCode {
  id: string;
  orgId: string;
  name: string;
  code: string;
  slug: string;
  discountPercent: number;
  description?: string;
  active: boolean;
  validFrom?: string;
  validUntil?: string;
  maxUses?: number;
  usedCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateProgram {
  id: string;
  orgId: string;
  userId: string;
  referralCode: string;
  commissionPercent: number;
  commissionValidMonths: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateReferral {
  id: string;
  affiliateId: string;
  referredUserId: string;
  referredOrgId?: string;
  subscriptionId?: string;
  commissionEarned: number;
  commissionPaid: boolean;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}