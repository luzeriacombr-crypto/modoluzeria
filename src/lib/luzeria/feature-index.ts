import type { OptionalFeatureKey } from "./types";

export type FeatureEntry = {
  id: string;
  label: string;
  description: string;
  keywords: string[];
  /** Termos "guarda-chuva" (ex: "financeiro" pra Plano e Cobrança) — pesam
   * tanto quanto o próprio nome na hora de ordenar os resultados, mesmo
   * aparecendo também como keyword comum em outras entradas relacionadas. */
  strongKeywords?: string[];
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
    keywords: ["tarefas", "demandas", "kanban", "semana", "metas", "inicio", "home", "trabalho", "fazer", "pendente", "prazo", "atrasado", "minhas coisas", "o que fazer"],
    to: "/minhas-tarefas",
  },
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Métricas do mês, ranking da equipe e saúde da operação.",
    keywords: ["dashboard", "metricas", "ranking", "produtividade", "entregas", "grafico", "numeros", "desempenho", "resultado", "quanto entregamos", "meta do mes", "painel"],
    to: "/admin",
    roles: ["master", "setor"],
  },
  {
    id: "calendario",
    label: "Calendário",
    description: "Visão mensal em grade com todas as publicações da agência.",
    keywords: ["calendario", "agenda", "grade", "mes", "publicacoes", "cronograma", "datas", "quando publica", "programacao"],
    to: "/calendario",
    hideIfDisabled: "calendar",
  },
  {
    id: "biblioteca",
    label: "Biblioteca de Referências",
    description: "Links de vídeos e posts guardados como referência, geral ou por cliente.",
    keywords: ["biblioteca", "referencia", "referencias", "links", "inspiracao", "roteiro", "salvar link", "ideias", "exemplos", "moodboard"],
    to: "/biblioteca",
    hideIfDisabled: "reference_library",
  },
  {
    id: "visao-geral",
    label: "Visão Geral",
    description: "Todos os clientes lado a lado — etapa da jornada, última gravação e análise.",
    keywords: ["visao geral", "clientes", "jornada", "gravacao", "atrasado", "panorama", "todos os clientes", "situacao", "acompanhamento"],
    to: "/configuracoes",
    toSearch: { tab: "cliente" },
    roles: ["master", "setor"],
  },
  {
    id: "instagram",
    label: "Instagram",
    description: "Conecte a conta e publique posts, reels e stories direto pelo app.",
    keywords: ["instagram", "publicar", "postar", "agendar post", "reels", "insta", "ig", "conectar conta", "publicacao automatica", "feed"],
    to: "/instagram",
    roles: ["master", "setor"],
    hideIfDisabled: "instagram",
  },
  {
    id: "rotina",
    label: "Rotina",
    description: "Tarefas de limpeza e organização recorrentes, marcadas dia a dia.",
    keywords: ["rotina", "limpeza", "organizacao", "recorrente", "escala", "tarefa do dia", "faxina", "semanal"],
    to: "/rotina",
    hideIfDisabled: "rotina",
  },
  {
    id: "ajuda",
    label: "Ajuda",
    description: "Tutoriais, perguntas frequentes e reportar um problema.",
    keywords: ["ajuda", "suporte", "tutorial", "faq", "bug", "problema", "erro", "duvida", "como faz", "reportar", "nao funciona", "tour", "aprender"],
    to: "/ajuda",
  },
  {
    id: "perfil",
    label: "Meu Perfil",
    description: "Sua foto, cor do avatar, verificação em duas etapas, refazer o tour.",
    keywords: ["perfil", "avatar", "foto", "senha", "verificacao em duas etapas", "tour", "tela inicial", "trocar senha", "minha conta", "2fa", "seguranca", "notificacoes"],
    to: "/perfil",
  },
  {
    id: "cfg-equipe",
    label: "Equipe (Configurações)",
    description: "Aprovar membros novos e definir a meta de posts/reels/stories de cada um.",
    keywords: ["equipe", "membros", "aprovar", "meta", "colaborador", "time", "pessoas", "adicionar pessoa", "convidar", "novo membro", "cargo", "funcao", "permissao", "acesso", "demitir", "remover pessoa", "salario", "remuneracao"],
    strongKeywords: ["equipe"],
    to: "/configuracoes",
    toSearch: { tab: "team" },
    roles: ["master", "setor"],
  },
  {
    id: "cfg-relatorio",
    label: "Relatório",
    description: "Exportação de relatório de produtividade em Excel.",
    keywords: ["relatorio", "excel", "exportar", "produtividade", "planilha", "baixar dados", "quem entregou", "desempenho da equipe", "xls"],
    to: "/configuracoes",
    toSearch: { tab: "report" },
    roles: ["master", "setor"],
  },
  {
    id: "cfg-automacoes",
    label: "Automações",
    description: "Conexão com o Google Drive e lembretes automáticos.",
    keywords: ["automacoes", "drive", "google drive", "lembretes", "backup", "conectar drive", "automatico", "integracao", "pasta"],
    to: "/configuracoes",
    toSearch: { tab: "automations" },
    roles: ["master"],
  },
  {
    id: "cfg-jornada",
    label: "Jornada do Cliente",
    description: "As etapas que avisam o cliente por WhatsApp em cada fase do trabalho.",
    keywords: ["jornada", "etapas", "funil do cliente", "onboarding", "fases", "estagio"],
    to: "/configuracoes",
    toSearch: { tab: "journey" },
    roles: ["master"],
  },
  {
    id: "cfg-cobranca",
    label: "Plano e Cobrança",
    description: "Seu plano atual, uso, CNPJ/CPF e upgrade de plano.",
    keywords: ["plano", "cobranca", "assinatura", "pagamento", "fatura", "mensalidade", "cartao", "boleto", "pagar", "assinar", "quanto custa", "preco", "valor", "upgrade", "cancelar plano", "nota fiscal", "vencimento", "trocar cartao"],
    strongKeywords: ["financeiro"],
    to: "/configuracoes",
    toSearch: { tab: "cobranca" },
    roles: ["master"],
  },
  {
    id: "cfg-margem",
    label: "Margem por Cliente",
    description: "Quanto cada cliente rende, descontando custo de hora e horas estimadas.",
    keywords: ["margem", "lucro", "custo", "rentabilidade", "quanto rende", "lucratividade", "custo hora", "vale a pena"],
    to: "/configuracoes",
    toSearch: { tab: "margem" },
    roles: ["master"],
  },
  {
    id: "cfg-afiliados",
    label: "Afiliados",
    description: "Programa de indicação — indique o Modo Criador e ganhe comissão.",
    keywords: ["afiliados", "indicacao", "comissao", "indicar", "ganhar indicando", "parceria"],
    to: "/configuracoes",
    toSearch: { tab: "afiliados" },
    roles: ["master"],
  },
  {
    id: "cfg-revenda",
    label: "Revenda White Label",
    description: "Revenda instâncias do Modo Criador com a marca da sua agência.",
    keywords: ["revenda", "revender", "white label", "vender o sistema", "atacado"],
    to: "/configuracoes",
    toSearch: { tab: "revenda" },
    roles: ["master"],
  },
  {
    id: "cfg-atualizacoes",
    label: "Atualizações",
    description: "O que mudou de novo no Modo Criador.",
    keywords: ["atualizacoes", "novidades", "changelog", "o que mudou", "novo", "versao"],
    to: "/configuracoes",
    toSearch: { tab: "updates" },
    roles: ["master"],
  },
  {
    id: "cfg-geral",
    label: "Marca da Agência",
    description: "Logo, cores, degradê do dashboard, cantos arredondados e menu personalizado.",
    keywords: ["marca", "logo", "cor", "cores", "personalizar", "personalizacao", "degrade", "gradiente", "borda", "arredondado", "menu", "renomear menu", "branding", "identidade visual", "trocar logo", "tema", "aparencia", "recursos opcionais", "desativar funcao"],
    to: "/configuracoes",
    toSearch: { tab: "general" },
    roles: ["master"],
  },
  {
    id: "vendas",
    label: "Vendas",
    description: "Funil de leads em blocos: novos, responder agora, follow-up, fechado e perdido.",
    keywords: ["vendas", "lead", "leads", "funil", "crm", "oportunidade", "prospeccao", "orcamento", "follow-up", "followup", "cliente novo", "negociacao", "fechar venda", "proposta"],
    strongKeywords: ["vendas", "crm"],
    to: "/vendas",
    hideIfDisabled: "sales_pipeline",
  },
  {
    id: "lixeira",
    label: "Lixeira",
    description: "Posts e reels excluídos nos últimos 7 dias — dá pra restaurar ou apagar de vez.",
    keywords: ["lixeira", "excluido", "apagado", "restaurar", "recuperar", "desfazer exclusao", "lixo", "apaguei sem querer", "voltar post", "deletado"],
    strongKeywords: ["lixeira", "restaurar"],
    to: "/lixeira",
    roles: ["master", "setor"],
  },
  {
    id: "cfg-pagamentos",
    label: "Pagamentos",
    description: "Quem já pagou no mês, vencimentos e mensagem de cobrança pelo WhatsApp.",
    keywords: ["pagamento", "pagamentos", "cobrar", "cobranca do cliente", "vencimento", "mensalidade", "recebimento", "quem pagou", "receber", "inadimplente", "cobrar cliente", "quem deve"],
    to: "/configuracoes",
    toSearch: { tab: "pagamentos" },
    roles: ["master", "setor"],
  },
];
