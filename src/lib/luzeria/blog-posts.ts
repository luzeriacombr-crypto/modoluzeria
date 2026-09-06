/** Conteúdo do blog do Modo Criador — hardcoded, igual todo o resto do
 * conteúdo do site (SalesPage, ResellerLandingPage, FeatureLandingPage):
 * sem CMS, sem tabela no banco, só um array em TS. Pensado pra reforçar
 * o SEO de cauda longa (ver as 5 páginas de funcionalidade) com a história
 * real por trás de cada uma — a Luzeria era uma agência que sentia essas
 * dores antes de virarem funcionalidades do produto. */

export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  date: string;
  readingMinutes: number;
  relatedFeatureHref?: string;
  relatedFeatureLabel?: string;
  body: BlogBlock[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "de-onde-veio-o-modo-criador",
    title: "De onde veio o Modo Criador",
    description:
      "O Modo Criador não nasceu como produto — nasceu como o painel interno que a Luzeria Estúdio construiu pra dar conta da própria bagunça.",
    date: "2026-09-06",
    readingMinutes: 4,
    body: [
      {
        type: "p",
        text: "Antes de ser um produto que qualquer agência pode assinar, o Modo Criador era só o jeito que a Luzeria Estúdio achou pra parar de se afogar na própria operação. A gente gerencia conteúdo de vários clientes ao mesmo tempo — calendário, aprovação, arquivo, publicação — e por muito tempo isso viveu espalhado entre planilha, pasta de Drive e conversa de WhatsApp.",
      },
      {
        type: "p",
        text: "Funcionava, no sentido de que os posts saíam. Mas cada cliente novo era mais uma planilha, mais um grupo de WhatsApp, mais uma chance de alguma coisa se perder no meio do caminho. Post aprovado que sumia na rolagem da conversa. Foto de ensaio que ninguém lembrava em qual pasta tinha ficado. Publicação feita na mão, cliente por cliente, todo santo dia.",
      },
      { type: "h2", text: "O ponto de virada" },
      {
        type: "p",
        text: "Em algum momento ficou claro que o problema não era falta de organização nossa — era falta de uma ferramenta feita pra esse tipo de operação. As que existiam por aí eram genéricas demais, ou caras demais pra o tamanho da nossa agência, ou não resolviam a parte que mais doía: o cliente aprovando conteúdo sem precisar criar conta, sem baixar app, sem virar mais um login que ele ia esquecer a senha.",
      },
      {
        type: "quote",
        text: "A gente não construiu o Modo Criador pra vender. Construiu pra usar. Virou produto depois, quando percebemos que toda agência do tamanho da nossa vivia exatamente a mesma bagunça.",
      },
      {
        type: "p",
        text: "Cada funcionalidade que existe hoje tem uma dor real por trás — não foi brainstorm de reunião, foi coisa que aconteceu com a gente e que a gente resolveu pra nós mesmos antes de oferecer pros outros. Esse blog é sobre isso: as dores específicas, uma por uma, e o que fizemos a respeito.",
      },
    ],
  },
  {
    slug: "como-paramos-de-perder-arquivo-de-cliente",
    title: "Como paramos de perder arquivo de cliente",
    description:
      "Computador que trava, pasta que some, pen drive que ninguém acha — a história de por que o backup automático no Google Drive virou funcionalidade.",
    date: "2026-09-06",
    readingMinutes: 3,
    relatedFeatureHref: "/backup-automatico-drive",
    relatedFeatureLabel: "Backup Automático no Drive",
    body: [
      {
        type: "p",
        text: "Teve uma época na Luzeria em que cada pessoa da equipe guardava os arquivos de cliente do jeito que achava melhor. Uma no Drive pessoal. Outra numa pasta local do computador. Outra mandava tudo direto pro WhatsApp do cliente e confiava na sorte.",
      },
      {
        type: "p",
        text: "Funcionou até não funcionar mais. Teve arquivo que sumiu quando um notebook precisou ser formatado. Teve pasta que ninguém sabia mais onde tinha ficado, meses depois, quando o cliente pediu de volta um material antigo. E teve a sensação constante de que a gente estava sempre a um imprevisto de distância de perder trabalho de verdade.",
      },
      { type: "h2", text: "A regra que criamos pra nós mesmos" },
      {
        type: "p",
        text: "A solução não podia depender de disciplina individual — disciplina falha, principalmente quando a operação cresce e mais gente entra no time. Tinha que ser automática: o arquivo aprovado ou publicado ia sozinho pra pasta certa, sem ninguém precisar lembrar de fazer isso.",
      },
      {
        type: "list",
        items: [
          "Uma pasta por cliente, organizada por mês",
          "Tudo no Google Drive da própria agência — não um armazenamento terceiro que some se a gente trocar de ferramenta",
          "Sem passo manual: acontece no momento em que o conteúdo é aprovado",
        ],
      },
      {
        type: "p",
        text: "Foi assim que o backup automático virou parte do Modo Criador — não como um extra bonito, mas como resposta direta a um problema que já tinha custado arquivo de verdade da gente.",
      },
    ],
  },
  {
    slug: "fim-da-aprovacao-perdida-no-whatsapp",
    title: "O fim da aprovação perdida no meio do WhatsApp",
    description:
      "Post aprovado que sumia na rolagem da conversa, cliente que esquecia se já tinha dito 'sim' — por que a aprovação por link sem login existe.",
    date: "2026-09-06",
    readingMinutes: 3,
    relatedFeatureHref: "/aprovacao-de-conteudo-por-link",
    relatedFeatureLabel: "Aprovação de Conteúdo por Link",
    body: [
      {
        type: "p",
        text: "Por muito tempo, aprovação de post na Luzeria era isso: mandar a imagem no grupo do WhatsApp do cliente e esperar um 'ok' ou um coraçãozinho de reação. Funcionava enquanto o volume era pequeno. Deixou de funcionar quando cada cliente virou uma conversa cheia de imagem, áudio, e o post aprovado há duas semanas ficou perdido lá em cima, impossível de achar sem rolar a tela por dez minutos.",
      },
      {
        type: "p",
        text: "Pior: às vezes o cliente aprovava de boca, numa ligação, e ninguém documentava. Na hora de publicar, vinha a dúvida — foi esse mesmo que ele aprovou? Teve alteração que ele pediu e a gente esqueceu de aplicar?",
      },
      { type: "h2", text: "O que a gente precisava de verdade" },
      {
        type: "p",
        text: "Não precisávamos de mais um app pro cliente instalar — isso só ia trocar um tipo de fricção por outro. Precisávamos de um jeito de aprovação que fosse tão simples quanto mandar mensagem no WhatsApp, mas que deixasse rastro: aprovou, ficou registrado; pediu ajuste, o comentário ficou anexado ao post certo, não solto numa conversa.",
      },
      {
        type: "quote",
        text: "A resposta foi um link. Só isso. O cliente abre, vê o post, aprova ou comenta — sem senha, sem cadastro, sem app novo pra lembrar de abrir.",
      },
      {
        type: "p",
        text: "Hoje isso é a aprovação por link do Modo Criador, e resolveu de vez o problema que mais nos tirava tempo: não o trabalho de produzir o conteúdo, mas o de descobrir se ele já tinha sido aprovado ou não.",
      },
    ],
  },
  {
    slug: "por-que-a-selecao-de-fotos-parou-de-ser-um-problema",
    title: "Por que a seleção de fotos parou de ser um problema",
    description:
      "Pastas cruas de Google Drive, fotos de prévia usadas sem autorização, cliente perdido sem saber quais escolher — a origem da Seleção de Fotos.",
    date: "2026-09-06",
    readingMinutes: 3,
    relatedFeatureHref: "/selecao-de-fotos-para-fotografos",
    relatedFeatureLabel: "Seleção de Fotos pra Fotógrafos",
    body: [
      {
        type: "p",
        text: "Esse problema não era da parte de social media da Luzeria — era de fotógrafos parceiros e clientes que trabalham com ensaio e evento. O fluxo de sempre era mandar a pasta inteira do Google Drive, crua, com todas as fotos, e torcer pra o cliente conseguir escolher as favoritas sem se perder.",
      },
      {
        type: "p",
        text: "Duas coisas davam errado direto. Primeira: sem controle nenhum sobre quem tinha acesso, era comum foto de prévia (ainda sem tratamento, sem ser a entrega final) circular antes da hora, às vezes usada em rede social pelo próprio cliente sem querer prejudicar ninguém, mas prejudicando o trabalho do fotógrafo. Segunda: quando mais de uma pessoa precisava escolher junto — noivo e noiva, por exemplo — não tinha jeito de saber quem tinha escolhido o quê.",
      },
      { type: "h2", text: "Proteção sem complicar o fluxo" },
      {
        type: "p",
        text: "A solução não podia pedir pro fotógrafo trocar de onde guarda as fotos — o Google Drive já é o fluxo de trabalho de praticamente todo mundo nesse mercado. Tinha que entrar por cima do que já existe, não substituir.",
      },
      {
        type: "list",
        items: [
          "O fotógrafo só cola o link da pasta que já usa no Drive",
          "Cada foto que o cliente vê já sai com marca d'água aplicada nos próprios pixels — não some com um print",
          "Mais de uma pessoa pode responder ao mesmo link, cada uma com seu nome",
        ],
      },
      {
        type: "p",
        text: "Isso virou a Seleção de Fotos do Modo Criador — pensada pra fotógrafo que vive de entregar ensaio grande e não pode se dar ao luxo de perder controle sobre o próprio material antes da entrega final.",
      },
    ],
  },
  {
    slug: "publicar-no-instagram-na-mao-quase-nos-esgotou",
    title: "Publicar no Instagram na mão, cliente por cliente, quase nos esgotou",
    description:
      "Abrir o Instagram de cada cliente, todo santo dia, pra publicar o que já tinha sido aprovado — por que a publicação automática existe.",
    date: "2026-09-06",
    readingMinutes: 3,
    relatedFeatureHref: "/publicacao-automatica-instagram",
    relatedFeatureLabel: "Publicação Automática no Instagram",
    body: [
      {
        type: "p",
        text: "Aprovar o conteúdo era só metade do trabalho. A outra metade era publicar — e por muito tempo isso significou abrir o Instagram de cada cliente, um por um, baixar a imagem aprovada, colar a legenda, conferir se não tinha esquecido nenhuma hashtag, e postar. Todo santo dia, pra cada cliente ativo.",
      },
      {
        type: "p",
        text: "Multiplica isso pelo número de clientes que uma agência de verdade tem, e o que sobra é uma pessoa da equipe gastando a manhã inteira só de tarefa repetitiva — tempo que não ia pra estratégia, não ia pra atender melhor o cliente, não ia pra nada que realmente movesse a agulha.",
      },
      { type: "h2", text: "Automatizar sem perder controle" },
      {
        type: "p",
        text: "A parte delicada não era técnica, era de confiança: publicar automaticamente na conta do cliente é coisa séria, não dá pra ser um script por fora que quebra sem aviso ou que a Meta pode bloquear a qualquer momento. Por isso a integração do Modo Criador com o Instagram é oficial, com App Review aprovado pela própria Meta — não é gambiarra.",
      },
      {
        type: "quote",
        text: "Hoje o post aprovado é agendado uma vez e publica sozinho, no feed ou nos reels, no horário certo. A pessoa que antes gastava a manhã publicando na mão, agora gasta esse tempo com outra coisa.",
      },
      {
        type: "p",
        text: "Foi uma das mudanças mais simples de explicar e mais sentidas no dia a dia — o tipo de dor que só quem já publicou manualmente pra dez clientes diferentes entende de verdade.",
      },
    ],
  },
];

export function getBlogPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}
