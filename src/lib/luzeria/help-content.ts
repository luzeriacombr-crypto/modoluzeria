// Fonte única do conteúdo de ajuda do Modo Criador — usado pela Central de
// Ajuda (AjudaPage.tsx) e como base de conhecimento do Chat do Modo Criador
// (support-chat.functions.ts). Editar aqui atualiza os dois lugares.

export type HelpFaqGroup = { category: string; items: { q: string; a: string }[] };
export type HelpTutorial = { title: string; steps: string[]; images?: { src: string; alt: string }[]; videoUrl?: string };

export const FAQ: HelpFaqGroup[] = [
  {
    category: "Conteúdo (Posts, Reels e Rotina)",
    items: [
      { q: "Como funcionam os cards de Posts e Reels?", a: "Cada post ou reel aparece como um card com capa, status, responsável e prazo. Clique no card pra abrir os detalhes completos (copy, checklist, comentários, arquivos)." },
      { q: "O que é o campo Estático/Carrossel?", a: "É o formato do post. No resumo em cards só aparece o formato já escolhido — pra mudar, abra o post clicando nele e use a seção \"Formato\"." },
      { q: "Como funciona a Rotina?", a: "É a lista de tarefas de organização/limpeza da agência, com um calendário por dia. O Admin Master pode editar a lista de tarefas direto na tela." },
    ],
  },
  {
    category: "Equipe e automações",
    items: [
      { q: "Como envio uma foto de perfil pra um colega que ainda não tem?", a: "Em Configurações → Equipe, clique no card do colaborador — abre um modal onde o Admin Master pode enviar ou trocar a foto dele." },
      { q: "Esqueci minha senha, e agora?", a: "Peça pro Admin Master da sua agência: Configurações → Equipe → clique no seu card → \"Resetar senha\". Você recebe um link por e-mail." },
      { q: "Como funcionam as Automações?", a: "Em Configurações → Automações, o Admin Master pode criar regras do tipo \"quando o status virar X, então alterar status para Y (ou atribuir para alguém)\". Elas rodam sozinhas, mesmo sem ninguém com a tela aberta." },
    ],
  },
  {
    category: "Clientes e arquivos",
    items: [
      { q: "Como meu cliente aprova um post sem ter conta?", a: "Cada cliente tem um link público (aba \"Preview de Feed\" dentro do cliente). Manda esse link — o cliente aprova ou comenta direto, sem login." },
      { q: "Como funciona o backup no Google Drive?", a: "Conecte sua conta do Drive em Configurações → Drive. Os arquivos enviados nos posts/reels são organizados automaticamente lá, por cliente e mês." },
    ],
  },
  {
    category: "Suporte",
    items: [
      { q: "Como reporto um problema ou peço uma sugestão?", a: "Use o ícone de interrogação (?) ao lado do sino de notificações, em qualquer tela. Você também pode acompanhar o que já reportou na aba \"Minhas solicitações\" aqui em cima." },
    ],
  },
];

export const TUTORIALS: HelpTutorial[] = [
  {
    title: "Criar um novo post ou reel",
    steps: [
      "Abra o cliente e escolha a aba Posts ou Reels.",
      "Clique no card tracejado \"Adicionar Post/Reel\" no fim da lista.",
      "Clique no título do card pra dar um nome a ele.",
      "Defina status, responsável e prazo direto pelo card.",
    ],
  },
  {
    title: "Marcar um post como Estático ou Carrossel",
    steps: [
      "Clique no card do post pra abrir os detalhes.",
      "Na seção \"Formato\", escolha Estático ou Carrossel.",
      "Isso só pode ser mudado dentro do post — no resumo em cards ele só aparece pra leitura.",
    ],
  },
  {
    title: "Conectar o Google Drive",
    steps: [
      "Vá em Configurações → Integrações → Google Drive. É um assistente de 3 passos.",
      "Passo 1: clique em conectar e faça login com a conta Google da agência.",
      "Passo 2: escolha a pasta que vai guardar as pastas de todos os clientes — navega clicando, ou cola o link/ID se já souber.",
      "Passo 3: confira as sugestões de pasta pra cada cliente (a gente já compara o nome) e confirme — o que não tiver pasta, é criado do zero.",
      "Pronto — os arquivos enviados nos posts passam a ser organizados lá automaticamente.",
    ],
  },
  {
    title: "Conectar o Instagram de um cliente",
    steps: [
      "Abra a Ficha do Cliente e ache a seção \"Instagram\".",
      "Clique em \"Conectar Instagram\" — a tela de login que abre é a do próprio Instagram, não a do Modo Criador.",
      "Faça login com a conta do Instagram do cliente (Business ou Criador de Conteúdo) — não a sua conta de administrador.",
      "Não precisa de Página do Facebook vinculada — só a conta do Instagram já resolve.",
      "Depois de conectado, aparece \"✓ Conectado — @usuario\" e já dá pra publicar/programar direto pelos posts e reels desse cliente.",
    ],
  },
  {
    title: "Criar uma automação",
    steps: [
      "Vá em Configurações → Automações (só Admin Master).",
      "Clique em \"Nova automação\".",
      "Escolha o status de gatilho e a ação (alterar status ou atribuir membro).",
      "Salve — a regra passa a rodar sozinha a partir daí.",
    ],
  },
  {
    title: "Adicionar foto de um colaborador",
    steps: [
      "Vá em Configurações → Equipe (só Admin Master).",
      "Clique no card da pessoa.",
      "Clique em \"Enviar foto\" e escolha a imagem.",
    ],
  },
];

/** Rotas reais do app que o Chat do Modo Criador pode linkar — a IA só pode
 * usar caminhos desta lista (nunca inventar uma URL), pra nunca mandar a
 * pessoa pra um link quebrado. */
export const INTERNAL_LINKS: { label: string; path: string }[] = [
  { label: "Minhas demandas", path: "/minhas-tarefas" },
  { label: "Dashboard", path: "/admin" },
  { label: "Calendário", path: "/calendario" },
  { label: "Biblioteca", path: "/biblioteca" },
  { label: "Instagram (Insights)", path: "/instagram" },
  { label: "Rotina", path: "/rotina" },
  { label: "Vendas", path: "/vendas" },
  { label: "Seleção de Fotos", path: "/selecao-de-fotos" },
  { label: "Central de Ajuda — Tutoriais", path: "/ajuda?tab=tutoriais" },
  { label: "Configurações — Equipe", path: "/configuracoes?tab=team" },
  { label: "Configurações — Integrações (Google Drive/Instagram)", path: "/configuracoes?tab=integrations" },
  { label: "Configurações — Automações", path: "/configuracoes?tab=automations" },
  { label: "Configurações — Base de conhecimento", path: "/configuracoes?tab=knowledge" },
  { label: "Configurações — Plano e Cobrança", path: "/configuracoes?tab=cobranca" },
  { label: "Configurações — Geral", path: "/configuracoes?tab=general" },
];

/** Achata FAQ + Tutoriais num bloco de texto simples pro prompt da IA do chat de suporte. */
export function buildHelpKnowledgeText(): string {
  const faqText = FAQ.map((group) =>
    `## ${group.category}\n` + group.items.map((i) => `P: ${i.q}\nR: ${i.a}`).join("\n\n")
  ).join("\n\n");
  const tutorialsText = TUTORIALS.map((t) =>
    `## ${t.title}\n` + t.steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
  ).join("\n\n");
  const linksText = INTERNAL_LINKS.map((l) => `${l.label} => ${l.path}`).join("\n");
  return `PERGUNTAS FREQUENTES:\n\n${faqText}\n\nTUTORIAIS PASSO A PASSO:\n\n${tutorialsText}\n\nLINKS REAIS DO APP (use só estes, nunca invente um caminho):\n\n${linksText}`;
}
