// Versão "me guie" de alguns tutoriais da Central de Ajuda (help-content.ts)
// — passos reais com destaque na tela, em vez de só texto pra ler antes.
// Pedido do Junior em 01/10/2026. Só vale a pena pra tutorial que seja uma
// tela só (ou um fluxo linear curto), sem depender de geração por IA, texto
// colado de fora, ou dado que já precisa existir antes (ver análise prévia
// — vários tutoriais ficaram de fora por causa disso).
//
// A chave de cada entrada precisa bater EXATAMENTE com o `title` do
// tutorial correspondente em help-content.ts — é assim que o botão "Me
// guie" aparece (ou não) em cada card da aba Tutoriais.
export type GuidedStep = {
  text: string;
  /** Seletor `data-tour="..."` do elemento a destacar — sem isso, mostra um cartão centralizado (sem apontar pra nada). */
  target?: string;
  /** Rota pra navegar antes desse passo aparecer. */
  to?: string;
  search?: Record<string, string>;
  /** Abre a Ficha do Cliente (modal global, não é uma rota) pro cliente escolhido — ver ClientFichaPanel.tsx/ui-store.ts. */
  openClientFicha?: boolean;
};

export type GuidedTutorial = {
  /** Quando true, antes do primeiro passo pergunta "em qual cliente?" (ver GuidedTutorialRunner). */
  needsClient?: boolean;
  steps: GuidedStep[] | ((clientId: string) => GuidedStep[]);
};

export const GUIDED_TUTORIALS: Record<string, GuidedTutorial> = {
  "Conectar o Google Drive": {
    steps: [
      {
        to: "/configuracoes", search: { tab: "integrations" },
        target: '[data-tour="drive-wizard"]',
        text: "Esse é o assistente de conexão do Google Drive — são 3 passos: Conectar conta, Pasta raiz e Vincular clientes. Siga as instruções que aparecem aqui, um passo de cada vez.",
      },
    ],
  },
  "Definir a função de um colaborador (Membro, Adm Setor ou Adm Master)": {
    steps: [
      {
        to: "/configuracoes", search: { tab: "team" },
        target: '[data-tour="team-active-list"]',
        text: "Essa é a lista de colaboradores ativos. Clique no card de alguém pra abrir os detalhes dele.",
      },
      {
        target: '[data-tour="member-role-select"]',
        text: "Aqui você escolhe a Função: Membro, Adm Setor ou Adm Master. Salva sozinho assim que você escolher — não precisa clicar em mais nada.",
      },
    ],
  },
  "Configurar a Base de Conhecimento pra treinar a IA": {
    steps: [
      {
        to: "/configuracoes", search: { tab: "knowledge" },
        target: '[data-tour="knowledge-add-text"]',
        text: "Escreva (ou cole) um texto aqui — um guia de tom de voz, um padrão de legenda, ou um roteiro que deu certo e você quer que a IA use de referência.",
      },
      {
        target: '[data-tour="knowledge-save"]',
        text: "Depois é só clicar em \"Salvar nota\". Isso já entra na próxima prévia de planejamento com IA de qualquer cliente da agência.",
      },
    ],
  },
  "Personalizar a logo e as cores da agência": {
    steps: [
      {
        to: "/configuracoes", search: { tab: "general" },
        target: '[data-tour="org-branding"]',
        text: "Aqui você troca a logo (uma versão pro modo escuro, outra pro claro), o nome/slogan da agência e as cores — principal, clara, da barra lateral e de destaque nos gráficos.",
      },
    ],
  },
  "Conectar o Instagram de um cliente sem pedir a senha dele": {
    needsClient: true,
    steps: (clientId: string) => [
      {
        openClientFicha: true,
        target: '[data-tour="client-instagram-section"]',
        text: "Essa é a seção do Instagram na Ficha desse cliente. Role até ela se não aparecer de cara.",
      },
      {
        openClientFicha: true,
        target: '[data-tour="client-instagram-section"]',
        text: "Clique em \"Gerar link\" — ele cria um link com a marca da sua agência. Depois clique em \"Copiar\" e manda pro próprio cliente pelo WhatsApp, pra ele conectar o Instagram dele sem te passar a senha.",
      },
    ],
  },
};
