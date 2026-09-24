import type { OptionalFeatureKey } from "./types";

/** Conteúdo da página "Conheça o Modo Criador" (/funcionalidades) — pedido
 * do Junior pra dar mais visibilidade a recursos fortes que muita gente não
 * descobre sozinha (Vendas e Financeiro, por exemplo, ficaram de fora do
 * tour por serem "secundários" — ver AppTour.tsx — mas impressionam muito
 * em demonstração). Separado do FEATURE_INDEX (que alimenta só a busca
 * global, com descrição de uma linha) porque aqui o texto é bem mais rico:
 * destaque com negrito e um passo a passo curto, não só "onde fica isso".
 *
 * `to`/`toSearch`/`roles`/`hideIfDisabled` no mesmo formato de
 * feature-index.ts, pro botão "Ir lá" e a filtragem por cargo/recurso
 * desativado funcionarem igual. `highlight` aceita **negrito** (markdown
 * bem simples, só isso — ver renderBold em FeatureShowcasePage.tsx). */

export type ShowcaseCategory = "financeiro" | "cliente" | "ia" | "organizacao";

export const SHOWCASE_CATEGORY_LABEL: Record<ShowcaseCategory, string> = {
  financeiro: "Financeiro e Vendas",
  cliente: "Aprovação e Cliente",
  ia: "Inteligência Artificial",
  organizacao: "Organização do dia a dia",
};

export type ShowcaseEntry = {
  id: string;
  category: ShowcaseCategory;
  icon: "wallet" | "trending-up" | "handshake" | "link" | "route" | "sparkles" | "calendar" | "layout-dashboard" | "bookmark" | "zap" | "instagram" | "folder-tree" | "calendar-clock" | "message-circle" | "bot" | "list-checks";
  label: string;
  highlight: string;
  steps: string[];
  to: string;
  toSearch?: Record<string, string>;
  ctaLabel?: string;
  roles?: ("master" | "setor")[];
  hideIfDisabled?: OptionalFeatureKey;
};

export const FEATURE_SHOWCASE: ShowcaseEntry[] = [
  {
    id: "financeiro",
    category: "financeiro",
    icon: "wallet",
    label: "Financeiro",
    highlight: "Lance **entradas e saídas** e organize a cobrança de cada cliente num só lugar, sem depender de planilha.",
    steps: [
      "Veja quem já pagou, quem tá pendente e o vencimento de cada cliente.",
      "Marque um pagamento como recebido com um clique.",
      "Gere uma mensagem de cobrança pronta pro WhatsApp, já com o valor e seu Pix.",
      "Lance despesas fixas ou variáveis e acompanhe o saldo previsto do mês.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "pagamentos" },
    roles: ["master", "setor"],
  },
  {
    id: "margem",
    category: "financeiro",
    icon: "trending-up",
    label: "Margem por Cliente",
    highlight: "Descubra **quanto cada cliente realmente rende**, descontando o tempo que sua equipe gasta com ele.",
    steps: [
      "O sistema já sabe quanto custa a hora de cada colaborador.",
      "Cruza isso com o tempo que cada cliente consome pra calcular a margem de verdade.",
      "Use isso na hora de negociar reajuste, desconto ou um brinde — sem chutar.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "margem" },
    roles: ["master"],
  },
  {
    id: "vendas",
    category: "financeiro",
    icon: "handshake",
    label: "Vendas (CRM)",
    highlight: "Um funil simples pra **não perder nenhum lead** — do primeiro contato até virar cliente de verdade.",
    steps: [
      "Arraste o card entre as etapas: Novos → Responder agora → Follow-up → Fechado/Perdido.",
      "Agende um follow-up com data — nada mais fica esquecido.",
      "Ao marcar como \"Ganho\", o sistema já cria o cliente novo pra você, pronto pra começar.",
    ],
    to: "/vendas",
    hideIfDisabled: "sales_pipeline",
  },
  {
    id: "aprovacao-link",
    category: "cliente",
    icon: "link",
    label: "Aprovação por Link",
    highlight: "Manda **um link só** com o feed do mês inteiro — o cliente aprova ou pede ajuste sem precisar de conta nem senha.",
    steps: [
      "Abra o cliente → aba Documentos → Compartilhar.",
      "Ele vê o feed como vai ficar no Instagram e aprova post por post, ou tudo de uma vez.",
      "Também pode baixar os arquivos em alta qualidade direto por lá, sem te pedir no WhatsApp.",
    ],
    to: "/minhas-tarefas",
    ctaLabel: "Abrir o app",
  },
  {
    id: "jornada",
    category: "cliente",
    icon: "route",
    label: "Jornada do Cliente",
    highlight: "Mantenha o cliente informado **automaticamente** em cada etapa do trabalho, sem parar tudo pra escrever mensagem.",
    steps: [
      "Configure as etapas (gravação, revisão, aprovação...) com o texto de cada uma.",
      "Ao mudar a etapa do cliente, a mensagem já sai pronta — só copiar e mandar no WhatsApp.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "journey" },
    roles: ["master"],
  },
  {
    id: "planejamento-ia",
    category: "ia",
    icon: "sparkles",
    label: "Planejamento com IA",
    highlight: "A IA monta a **prévia do mês inteiro** de um cliente com base no histórico, na marca e nos concorrentes dele.",
    steps: [
      "Abra o cliente → \"+\" → Roteiro/Planejamento → Gerar prévia com IA.",
      "Revise, ajuste o que quiser e aprove — os roteiros já saem prontos.",
      "Manda o link pro cliente aprovar os roteiros antes de gravar.",
    ],
    to: "/minhas-tarefas",
    ctaLabel: "Abrir o app",
  },
  {
    id: "calendario",
    category: "organizacao",
    icon: "calendar",
    label: "Calendário",
    highlight: "Veja **tudo que vai ao ar**, de todos os clientes, numa grade mensal só.",
    steps: [
      "Passe o mouse num dia pra ver a miniatura do post.",
      "Clique pra abrir o conteúdo direto dali.",
    ],
    to: "/calendario",
    hideIfDisabled: "calendar",
  },
  {
    id: "dashboard",
    category: "organizacao",
    icon: "layout-dashboard",
    label: "Dashboard",
    highlight: "Métricas do mês, **ranking da equipe** e a saúde geral da operação, tudo numa tela.",
    steps: [
      "Veja quanto já foi entregue x o que falta.",
      "Acompanhe retrabalho e o tempo médio do planejamento até a entrega.",
      "Confira quem está no topo da produtividade do mês.",
    ],
    to: "/admin",
    roles: ["master", "setor"],
  },
  {
    id: "biblioteca",
    category: "organizacao",
    icon: "bookmark",
    label: "Biblioteca de Referências",
    highlight: "Organize toda referência que você vê na internet — **YouTube, Pinterest, Instagram**, qualquer link — de forma rápida e fácil.",
    steps: [
      "Cole o link e salve como referência geral ou de um cliente específico.",
      "Use na hora de montar o roteiro ou o planejamento.",
    ],
    to: "/biblioteca",
    hideIfDisabled: "reference_library",
  },
  {
    id: "instagram-auto-publish",
    category: "organizacao",
    icon: "instagram",
    label: "Publicação Automática no Instagram",
    highlight: "Quando o cliente aprova um post com **data e horário já definidos**, o Modo Criador publica sozinho no Instagram, direto pela API oficial da Meta.",
    steps: [
      "Conecte o Instagram do cliente em Configurações → Integrações (ou direto na ficha dele).",
      "Defina a data e o horário do post — ao ser aprovado pelo cliente, a publicação já é agendada sem você precisar fazer nada.",
      "Acompanhe o que foi publicado e os insights de cada post na aba Instagram.",
      "Em breve: os mesmos insights também pro Facebook e o TikTok.",
    ],
    to: "/instagram",
    hideIfDisabled: "instagram",
    roles: ["master", "setor"],
  },
  {
    id: "google-drive",
    category: "organizacao",
    icon: "folder-tree",
    label: "Google Drive",
    highlight: "Conecte o **Google Drive** e o Modo Criador organiza sozinho uma pasta por cliente, já com a estrutura de mês e tipo de conteúdo.",
    steps: [
      "Conecte sua conta Google em Configurações → Integrações.",
      "Escolha a pasta raiz — o sistema cria a estrutura de clientes e meses automaticamente.",
      "Os arquivos ficam organizados no Drive sem precisar subir nada manualmente.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "integrations" },
    hideIfDisabled: "drive",
    roles: ["master"],
  },
  {
    id: "google-agenda",
    category: "organizacao",
    icon: "calendar-clock",
    label: "Google Agenda",
    highlight: "Conecte sua **Google Agenda** pessoal e crie compromissos direto do Modo Criador, sem trocar de aba.",
    steps: [
      "Cada pessoa conecta a própria Google Agenda no Perfil.",
      "Crie um compromisso com título, data e horário — ele já aparece na sua Google Agenda de verdade.",
      "Os compromissos de hoje aparecem direto em Minhas Demandas.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "integrations" },
    hideIfDisabled: "google_calendar",
  },
  {
    id: "rotina",
    category: "organizacao",
    icon: "list-checks",
    label: "Rotina",
    highlight: "Escala tarefas de **limpeza e organização** recorrentes, e a escala de quem posta o Stories do perfil da agência.",
    steps: [
      "Cadastre as tarefas recorrentes e quem fica responsável por cada dia.",
      "Cada pessoa marca como feito no seu próprio dia.",
      "No Relatório, a aba Rotina mostra quem fez e quem não fez cada dia, com um ranking de stories — dá pra usar até pra premiar quem mais fez no mês.",
    ],
    to: "/rotina",
    hideIfDisabled: "rotina",
  },
  {
    id: "forum",
    category: "organizacao",
    icon: "message-circle",
    label: "Fórum entre Agências",
    highlight: "Troque ideia direto com **outras agências** que usam o Modo Criador, dentro do próprio app.",
    steps: [
      "Abra Ajuda → Fórum.",
      "Poste uma dúvida, uma dica ou um caso — só masters participam.",
      "Curta e comente nos posts de outras agências.",
    ],
    to: "/ajuda",
    hideIfDisabled: "forum",
    roles: ["master"],
  },
  {
    id: "assistente-ia",
    category: "ia",
    icon: "bot",
    label: "Conecte o Claude ou o ChatGPT",
    highlight: "Deixe uma IA **consultar seus dados de verdade** — clientes, demandas, calendário — direto de dentro do Claude ou do ChatGPT.",
    steps: [
      "Vá em Configurações → Integrações → Assistente de IA e gere sua chave.",
      "Conecte como um conector MCP no Claude ou no ChatGPT.",
      "Pergunte coisas como \"o que falta entregar essa semana?\" e a IA já responde com os dados reais da sua agência.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "integrations" },
    roles: ["master"],
  },
  {
    id: "automacoes",
    category: "organizacao",
    icon: "zap",
    label: "Automações",
    highlight: "Regras do tipo \"quando acontecer X, faça Y\" — pra sua equipe **não esquecer nada**.",
    steps: [
      "Ex: quando o cliente aprovar, cria uma tarefa de agendar.",
      "Ex: avisa quando um prazo está perto de vencer.",
      "Já vem com modelos prontos — é só ativar.",
    ],
    to: "/configuracoes",
    toSearch: { tab: "automations" },
    roles: ["master"],
  },
];
