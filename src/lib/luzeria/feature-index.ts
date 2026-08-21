import type { OptionalFeatureKey } from "./types";

export type FeatureEntry = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  to: string;
  toSearch?: Record<string, string>;
  /** Omit = visible to everyone with access to the app (member included). */
  roles?: ("master" | "setor")[];
  hideIfDisabled?: OptionalFeatureKey;
};

/** Índice do que existe no Modo Criador, pra alimentar a busca global (⌘/🔍
 * no cabeçalho e na barra inferior do celular) — não busca dados (posts,
 * clientes), busca "onde é que fica isso" entre telas e configurações. */
export const FEATURE_INDEX: FeatureEntry[] = [
  {
    id: "minhas-demandas",
    label: "Minhas Demandas",
    description: "Suas tarefas do mês, metas e visão semanal em kanban.",
    keywords: ["tarefas", "demandas", "kanban", "semana", "metas", "início", "home"],
    to: "/minhas-tarefas",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Métricas do mês, ranking da equipe e saúde da operação.",
    keywords: ["dashboard", "métricas", "ranking", "produtividade", "entregas", "gráfico"],
    to: "/admin",
    roles: ["master", "setor"],
  },
  {
    id: "calendario",
    label: "Calendário",
    description: "Visão mensal em grade com todas as publicações da agência.",
    keywords: ["calendário", "agenda", "grade", "mês", "publicações"],
    to: "/calendario",
    hideIfDisabled: "calendar",
  },
  {
    id: "biblioteca",
    label: "Biblioteca de Referências",
    description: "Links de vídeos e posts guardados como referência, geral ou por cliente.",
    keywords: ["biblioteca", "referência", "referencias", "links", "inspiração", "roteiro"],
    to: "/biblioteca",
    hideIfDisabled: "reference_library",
  },
  {
    id: "visao-geral",
    label: "Visão Geral",
    description: "Todos os clientes lado a lado — etapa da jornada, última gravação e análise.",
    keywords: ["visão geral", "clientes", "jornada", "gravação", "atrasado"],
    to: "/visao-geral",
    roles: ["master", "setor"],
    hideIfDisabled: "client_overview",
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Conecte a conta e publique posts, reels e stories direto pelo app.",
    keywords: ["instagram", "publicar", "postar", "agendar post", "reels"],
    to: "/instagram",
    roles: ["master", "setor"],
    hideIfDisabled: "instagram",
  },
  {
    id: "rotina",
    label: "Rotina",
    description: "Tarefas de limpeza e organização recorrentes, marcadas dia a dia.",
    keywords: ["rotina", "limpeza", "organização", "recorrente"],
    to: "/rotina",
    hideIfDisabled: "rotina",
  },
  {
    id: "ajuda",
    label: "Ajuda",
    description: "Tutoriais, perguntas frequentes e reportar um problema.",
    keywords: ["ajuda", "suporte", "tutorial", "faq", "bug", "problema", "erro"],
    to: "/ajuda",
  },
  {
    id: "perfil",
    label: "Meu Perfil",
    description: "Sua foto, cor do avatar, verificação em duas etapas, refazer o tour.",
    keywords: ["perfil", "avatar", "foto", "senha", "verificação em duas etapas", "tour", "tela inicial"],
    to: "/perfil",
  },
  {
    id: "cfg-equipe",
    label: "Equipe (Configurações)",
    description: "Aprovar membros novos e definir a meta de posts/reels/stories de cada um.",
    keywords: ["equipe", "membros", "aprovar", "meta", "colaborador"],
    to: "/configuracoes",
    toSearch: { tab: "team" },
    roles: ["master", "setor"],
  },
  {
    id: "cfg-relatorio",
    label: "Relatório",
    description: "Exportação de relatório de produtividade em Excel.",
    keywords: ["relatório", "excel", "exportar", "produtividade"],
    to: "/configuracoes",
    toSearch: { tab: "report" },
    roles: ["master", "setor"],
  },
  {
    id: "cfg-automacoes",
    label: "Automações",
    description: "Conexão com o Google Drive e lembretes automáticos.",
    keywords: ["automações", "drive", "google drive", "lembretes", "backup"],
    to: "/configuracoes",
    toSearch: { tab: "automations" },
    roles: ["master"],
  },
  {
    id: "cfg-jornada",
    label: "Jornada do Cliente",
    description: "As etapas que avisam o cliente por WhatsApp em cada fase do trabalho.",
    keywords: ["jornada", "etapas", "whatsapp", "avisar cliente"],
    to: "/configuracoes",
    toSearch: { tab: "journey" },
    roles: ["master"],
  },
  {
    id: "cfg-cobranca",
    label: "Plano e Cobrança",
    description: "Seu plano atual, uso, CNPJ/CPF e upgrade de plano.",
    keywords: ["plano", "cobrança", "assinatura", "cnpj", "cpf", "upgrade", "pagamento"],
    to: "/configuracoes",
    toSearch: { tab: "cobranca" },
    roles: ["master"],
  },
  {
    id: "cfg-margem",
    label: "Margem por Cliente",
    description: "Quanto cada cliente rende, descontando custo de hora e horas estimadas.",
    keywords: ["margem", "lucro", "rentabilidade", "custo", "hora"],
    to: "/configuracoes",
    toSearch: { tab: "margem" },
    roles: ["master"],
  },
  {
    id: "cfg-afiliados",
    label: "Afiliados",
    description: "Programa de indicação — indique o Modo Criador e ganhe comissão.",
    keywords: ["afiliados", "indicação", "comissão", "indicar"],
    to: "/configuracoes",
    toSearch: { tab: "afiliados" },
    roles: ["master"],
  },
  {
    id: "cfg-revenda",
    label: "Revenda White Label",
    description: "Revenda instâncias do Modo Criador com a marca da sua agência.",
    keywords: ["revenda", "white label", "parceiro", "instância", "atacado"],
    to: "/configuracoes",
    toSearch: { tab: "revenda" },
    roles: ["master"],
  },
  {
    id: "cfg-atualizacoes",
    label: "Atualizações",
    description: "O que mudou de novo no Modo Criador.",
    keywords: ["atualizações", "novidades", "changelog", "o que mudou"],
    to: "/configuracoes",
    toSearch: { tab: "updates" },
    roles: ["master"],
  },
  {
    id: "cfg-geral",
    label: "Marca da Agência",
    description: "Logo, cores, degradê do dashboard, cantos arredondados e menu personalizado.",
    keywords: ["marca", "logo", "cor", "cores", "personalizar", "personalização", "degradê", "gradiente", "borda", "arredondado", "menu", "renomear menu", "branding"],
    to: "/configuracoes",
    toSearch: { tab: "general" },
    roles: ["master"],
  },
];
