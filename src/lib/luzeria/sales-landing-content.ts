/** Conteúdo editável da página de vendas (Configurações → Site).
 * Módulo puro (sem React nem servidor) — usado pela página pública, pelo
 * editor e pelas server functions. Tudo aqui tem um valor padrão: o que o
 * Junior não editou continua igual, e campo novo nunca quebra conteúdo salvo. */

export type LandingFeat = { icon: string; title: string; desc: string; chip: string };
export type LandingTab = {
  id: string;
  label: string;
  feats: LandingFeat[];
  /** Imagem que substitui a padrão da aba (URL do upload). */
  image: string | null;
  /** Segunda imagem (só a aba Gestão usa). */
  image2: string | null;
};
export type LandingRow = { icon: string; before: string; title: string; desc: string };
export type LandingStep = { bold: string; rest: string };

export type LandingContent = {
  hero: {
    badge: string; pill: string;
    title: string; titleAccent: string; subtitle: string;
    /** Tamanho máximo do título em px no computador (no celular reduz sozinho). */
    titleSize: number;
    ctaLabel: string; ctaSecondaryLabel: string;
    trust: string[];
    chipTitle: string; chipSub: string;
    chip2Title: string; chip2Sub: string;
    image: string | null;
  };
  numbers: { clientsLabel: string; deliveriesLabel: string; trialValue: string; trialLabel: string };
  beforeAfter: { eyebrow: string; heading: string; rows: LandingRow[] };
  features: { eyebrow: string; heading: string; subheading: string; tabs: LandingTab[] };
  ai: { eyebrow: string; heading: string; steps: LandingStep[]; ctaLabel: string; note: string };
  aiConnector: { eyebrow: string; heading: string; steps: LandingStep[]; ctaLabel: string; note: string };
  /** Ordem e visibilidade das seções (o hero fica sempre no topo). */
  sections: { order: string[]; hidden: string[] };
};

export const LANDING_SECTIONS: { id: string; label: string }[] = [
  { id: "numbers", label: "Faixa de números" },
  { id: "beforeAfter", label: "Antes e depois" },
  { id: "features", label: "Funções por área" },
  { id: "ai", label: "Planejamento com IA" },
  { id: "aiConnector", label: "Conector de IA (destaque)" },
  { id: "demo", label: "Demonstração interativa (dashboard)" },
];

const tab = (id: string, label: string, feats: LandingFeat[]): LandingTab => ({ id, label, feats, image: null, image2: null });

export const DEFAULT_LANDING: LandingContent = {
  hero: {
    badge: "Novo",
    pill: "Planejamento mensal com IA",
    title: "Pare de perder cliente por falta de organização.",
    titleAccent: "Entregue mais, com menos correria.",
    titleSize: 52,
    subtitle: "Calendário, aprovação do cliente, publicação no Instagram, equipe e IA num lugar só — sem planilha, sem arquivo perdido no WhatsApp.",
    ctaLabel: "Testar 30 dias grátis",
    ctaSecondaryLabel: "Ver o que tem dentro",
    trust: ["Sem cartão", "Cancele quando quiser", "Suporte em português"],
    chipTitle: "Post aprovado", chipSub: "Cliente aprovou em um clique",
    chip2Title: "Planejamento pronto", chip2Sub: "A IA montou a prévia de outubro",
    image: null,
  },
  numbers: {
    clientsLabel: "clientes organizados na plataforma",
    deliveriesLabel: "posts, reels e stories entregues",
    trialValue: "30 dias",
    trialLabel: "de teste grátis, sem cartão",
  },
  beforeAfter: {
    eyebrow: "O antes e o depois",
    heading: "Se você se reconheceu em algum desses, é pra você.",
    rows: [
      { icon: "link", before: "Cliente some por dias sem aprovar o post", title: "Link de aprovação bonito", desc: "Ele vê o post como vai ficar no Instagram e aprova em um toque, sem login." },
      { icon: "drive", before: "Arquivo perdido no meio do WhatsApp", title: "Tudo no Google Drive da agência", desc: "Cada arquivo salvo e organizado por cliente e por mês, automaticamente." },
      { icon: "clock", before: "Ninguém sabe quem faz o quê nem o prazo", title: "Responsável e prazo em cada entrega", desc: "Com aviso no celular pra equipe não deixar nada escapar." },
      { icon: "send", before: "Postar é lembrar, abrir o Instagram e subir na mão", title: "Publica sozinho depois da aprovação", desc: "Pela API oficial da Meta — sem abrir o Instagram nem outro app de agendamento." },
      { icon: "sparkles", before: "Planejar o mês de cada cliente leva dias", title: "A IA monta a prévia do mês", desc: "Usando o histórico, a marca e os concorrentes de cada cliente." },
      { icon: "palette", before: "O app parece de outro sistema, não da sua agência", title: "Sua marca em tudo que o cliente vê", desc: "Logo e cores da sua agência — o cliente nunca vê \"Modo Criador\" na tela, só a sua marca." },
    ],
  },
  features: {
    eyebrow: "Tudo que tem dentro",
    heading: "Do planejamento à cobrança, num lugar só.",
    subheading: "Cada parte da rotina da agência tem o seu espaço — e conversa com as outras.",
    tabs: [
      tab("producao", "Produção", [
        { icon: "layout", title: "Board por cliente e por mês", desc: "Posts, reels e stories num quadro visual, com status, responsável, prazo e checklist em cada card.", chip: "" },
        { icon: "calendar", title: "Calendário geral", desc: "Tudo que vai ao ar em qualquer dia, de qualquer cliente, com a miniatura do post ao passar o mouse.", chip: "" },
        { icon: "zap", title: "Automações", desc: "Regras do tipo \"quando acontecer X, faça Y\": cobrar aprovação parada, avisar prazo, criar tarefa. Com modelos prontos.", chip: "16 gatilhos · 9 ações" },
        { icon: "calendarclock", title: "Google Agenda", desc: "Cada pessoa da equipe conecta a própria Google Agenda e cria compromissos direto do Modo Criador, sem trocar de aba.", chip: "Novo" },
      ]),
      tab("aprovacao", "Aprovação", [
        { icon: "link", title: "Link de aprovação sem login", desc: "O cliente vê o post do jeito que vai ficar no Instagram e aprova ou pede ajuste pelo celular, sem criar conta.", chip: "" },
        { icon: "file", title: "Roteiros e planejamento aprovados", desc: "Manda o roteiro ou o planejamento do mês pro cliente, ele responde por item e você vê tudo organizado.", chip: "" },
        { icon: "image", title: "Seleção e entrega de fotos", desc: "Galeria a partir do Drive, com marca d'água na escolha e download em alta ou tamanho pra redes na entrega.", chip: "" },
        { icon: "route", title: "Jornada do Cliente", desc: "Cada etapa do trabalho já sai com a mensagem pronta pro WhatsApp — o cliente sempre sabe onde está, sem você parar tudo pra escrever.", chip: "Novo" },
      ]),
      tab("publicacao", "Publicação", [
        { icon: "send", title: "Instagram e Facebook", desc: "Publica posts, carrosséis, reels e stories direto do Modo Criador, com autorização oficial da Meta.", chip: "App Review aprovado" },
        { icon: "clock", title: "Programa e esquece", desc: "Agendou, aprovou, saiu. Se algo falhar, você é avisado na hora com o motivo.", chip: "" },
        { icon: "userplus", title: "Cliente conecta o próprio Instagram", desc: "Manda um link e ele mesmo autoriza — você nunca vê nem guarda a senha dele. Mais seguro pra você e pra ele.", chip: "Zero senha" },
      ]),
      tab("financeiro", "Financeiro & Vendas", [
        { icon: "wallet", title: "Financeiro", desc: "Contas a pagar e a receber de cada cliente, vencimento e status num lugar só — sem depender de planilha.", chip: "Novo" },
        { icon: "trending-up", title: "Margem por Cliente", desc: "Descubra quanto cada cliente realmente rende, descontando o tempo que sua equipe gasta com ele — não só o que ele paga.", chip: "" },
        { icon: "signature", title: "Contrato com assinatura eletrônica", desc: "Manda o contrato por link, o cliente digita nome e CPF e assina com o dedo na tela — sem imprimir nada.", chip: "" },
        { icon: "handshake", title: "Vendas (CRM)", desc: "Um funil simples pra não perder nenhum lead — e quando fecha, o sistema já cria o cliente novo sozinho.", chip: "Novo" },
      ]),
      tab("gestao", "Gestão", [
        { icon: "chart", title: "Dashboard e relatórios", desc: "Entregas, gargalos e ranking de produtividade da equipe, com retrabalho e prazos cumpridos.", chip: "" },
        { icon: "trophy", title: "Programa de Níveis", desc: "Da Bronze à Lendária: sua agência sobe de nível usando o sistema e desbloqueia novidades.", chip: "" },
        { icon: "listchecks", title: "Rotina", desc: "Escala tarefas de limpeza recorrentes e quem posta o Stories do perfil da agência — com ranking no relatório pra premiar quem mais fez.", chip: "Novo" },
        { icon: "message", title: "Fórum entre Agências", desc: "Troque ideia direto com outras agências que usam o Modo Criador, dentro do próprio app.", chip: "Novo" },
      ]),
      tab("ia", "Inteligência artificial", [
        { icon: "sparkles", title: "Planejamento do próximo mês", desc: "A IA lê o histórico, a marca e os concorrentes do cliente e monta as sugestões com texto e legenda prontos.", chip: "Novo" },
        { icon: "upload", title: "Importação de clientes", desc: "Manda uma planilha, PDF ou até um print e ela organiza todos os seus clientes pra você revisar.", chip: "" },
        { icon: "message", title: "Chat de suporte", desc: "Tira dúvida na hora com o assistente do Modo Criador — e passa pro nosso time quando precisar.", chip: "" },
        { icon: "bot", title: "Conecte o Claude ou o ChatGPT", desc: "Sua IA de todo dia consulta os dados reais da agência — clientes, demandas, calendário — direto de dentro do Claude ou do ChatGPT.", chip: "Novo" },
      ]),
    ],
  },
  ai: {
    eyebrow: "Novo · Planejamento com IA",
    heading: "Um mês de conteúdo planejado antes de você abrir a agenda.",
    steps: [
      { bold: "Ela lê o que sua agência já sabe:", rest: "histórico de posts, roteiros, arquivos de marca e concorrentes." },
      { bold: "Você cola o contexto da reunião", rest: "com o cliente, se tiver — isso pesa mais que qualquer histórico." },
      { bold: "Sai uma prévia completa:", rest: "de 4 a 12 sugestões com roteiro e legenda prontos, no tom do cliente." },
      { bold: "Você revisa e decide.", rest: "Nada é salvo sozinho — aprova direto pros roteiros do mês." },
    ],
    ctaLabel: "Quero testar",
    note: "No teste grátis ou no plano Solo, dá pra usar em até 2 clientes. No plano Pro ou superior, não tem limite.",
  },
  aiConnector: {
    eyebrow: "Novo · Assistente de IA",
    heading: "A sua IA de todo dia já sabe tudo sobre a sua agência.",
    steps: [
      { bold: "Gere sua chave em Configurações → Integrações.", rest: "Leva menos de um minuto, sem nada técnico." },
      { bold: "Conecte como um conector no Claude ou no ChatGPT.", rest: "Cola a chave uma vez e pronto." },
      { bold: "Pergunte qualquer coisa sobre a operação.", rest: "\"O que falta essa semana?\", \"quantos clientes ativos?\" — resposta na hora, com dados reais." },
      { bold: "Sem abrir o Modo Criador.", rest: "Você já usa essa IA no dia a dia — agora ela também enxerga sua agência." },
    ],
    ctaLabel: "Quero testar",
    note: "Liberado a partir do plano Pro ou do nível Prata II do Programa de Níveis.",
  },
  sections: { order: LANDING_SECTIONS.map((s) => s.id), hidden: [] },
};

/** Mescla o que foi salvo por cima do padrão. Objetos mesclam campo a campo;
 * arrays (listas de cards, passos…) são substituídos inteiros. */
function mergeDeep(base: any, saved: any): any {
  if (Array.isArray(base)) return Array.isArray(saved) ? saved : base;
  if (base && typeof base === "object") {
    const out: any = { ...base };
    if (saved && typeof saved === "object" && !Array.isArray(saved)) {
      for (const k of Object.keys(base)) if (k in saved) out[k] = mergeDeep(base[k], saved[k]);
    }
    return out;
  }
  return saved === undefined || saved === null ? base : typeof saved === typeof base ? saved : base;
}

export function mergeLanding(saved: unknown): LandingContent {
  const merged = mergeDeep(DEFAULT_LANDING, saved) as LandingContent;
  // Imagens são "string | null" — o mergeDeep acima trata null como "sem valor".
  const s: any = saved ?? {};
  if (typeof s?.hero?.image === "string") merged.hero.image = s.hero.image;
  if (Array.isArray(s?.features?.tabs)) {
    merged.features.tabs = s.features.tabs.map((t: any, i: number) => {
      const d = DEFAULT_LANDING.features.tabs.find((x) => x.id === t?.id) ?? DEFAULT_LANDING.features.tabs[i] ?? DEFAULT_LANDING.features.tabs[0];
      return {
        id: String(t?.id ?? d.id), label: String(t?.label ?? d.label),
        feats: Array.isArray(t?.feats) ? t.feats.map((f: any) => ({ icon: String(f?.icon ?? "sparkles"), title: String(f?.title ?? ""), desc: String(f?.desc ?? ""), chip: String(f?.chip ?? "") })) : d.feats,
        image: typeof t?.image === "string" ? t.image : null,
        image2: typeof t?.image2 === "string" ? t.image2 : null,
      };
    });
  }
  // Seção nova (que o salvo não conhece) entra no fim, na ordem padrão.
  const known = new Set(LANDING_SECTIONS.map((x) => x.id));
  const order = (merged.sections.order ?? []).filter((id) => known.has(id));
  merged.sections = {
    order: [...order, ...LANDING_SECTIONS.map((x) => x.id).filter((id) => !order.includes(id))],
    hidden: (merged.sections.hidden ?? []).filter((id) => known.has(id)),
  };
  return merged;
}
