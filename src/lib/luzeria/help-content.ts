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
      { q: "Como funcionam as Automações?", a: "Em Configurações → Automações, o Admin Master cria regras do tipo \"quando acontecer X, então fazer Y\". Elas rodam sozinhas, mesmo sem ninguém com a tela aberta. Gatilhos: item criado, status mudou, prazo (antes/vencido), item parado, cliente aprovou o feed ou pediu ajuste, arquivo anexado, falha na publicação do Instagram, roteiro aprovado ou com ajuste, seleção de fotos finalizada, contrato assinado, cliente sem entrega e cobrança a vencer/atrasada. Ações: mudar status, atribuir, notificar, deixar WhatsApp pronto, programar no Instagram, criar tarefa, comentar no item, mover pro próximo mês e enviar e-mail. Dá pra limitar a regra a um cliente ou tipo de conteúdo, pausar, testar a mensagem e ver quantas vezes ela já disparou. Se está começando, use um dos Modelos prontos na própria página." },
      { q: "Não sei por onde começar nas Automações — tem algum exemplo pronto?", a: "Tem. Em Configurações → Automações, logo abaixo das suas regras, fica a lista de Modelos prontos (cobrar aprovação parada, avisar quando o cliente pedir ajuste, lembrete de prazo, falha no Instagram, mensalidade atrasada, cliente sem entrega, entre outros). É só clicar em Adicionar — depois você pode editar, limitar a um cliente ou pausar." },
      { q: "Adicionei um colaborador, mas ele não tem acesso de Admin — o que eu esqueci?", a: "Adicionar o colaborador e definir a função dele são duas etapas separadas. Depois de adicionar, clique no card da pessoa em Configurações → Equipe e escolha a Função certa: Membro, Adm Setor ou Adm Master." },
      { q: "Dá pra restringir o acesso à aba financeira só pros sócios?", a: "Sim, pela Função de cada pessoa. \"Membro\" só vê e mexe no que for atribuído a ele, \"Adm Setor\" pode ter permissões extras configuradas por cargo, e \"Adm Master\" tem acesso total, inclusive ao financeiro. Escolha a função certa pra cada colaborador em Configurações → Equipe." },
    ],
  },
  {
    category: "Clientes e arquivos",
    items: [
      { q: "Como mando a arte pro cliente aprovar pelo WhatsApp? O Modo Criador envia sozinho no grupo?", a: "O Modo Criador não envia a mensagem sozinho: ele gera o link, e você manda no WhatsApp. Passo a passo: 1) deixe o post/reel com a arte anexada e o status em \"Revisão cliente\" (a partir dessa etapa ele aparece no preview do cliente); 2) abra o cliente, vá na aba \"Preview de Feed\" e clique em \"Compartilhar preview\"; 3) clique em \"Copiar\" e cole o link no WhatsApp do cliente ou do grupo; 4) o cliente abre sem login, vê como o feed vai ficar e pode aprovar ou deixar comentário; 5) você é avisado quando ele aprovar ou pedir ajuste, e a aba mostra \"Feed aprovado pelo cliente\". O link é fixo por cliente (sempre mostra o mês ativo; \"Gerar novo link\" cancela o anterior). Pra agilizar, dá pra criar uma Automação em Configurações → Automações (por exemplo, quando o status virar \"Revisão cliente\", deixar a mensagem de WhatsApp pronta pra você só clicar em enviar)." },
      { q: "Como meu cliente aprova um post sem ter conta?", a: "Cada cliente tem um link público (aba \"Preview de Feed\" dentro do cliente). Manda esse link — o cliente aprova ou comenta direto, sem login." },
      { q: "Como funciona o backup no Google Drive?", a: "Conecte sua conta do Drive em Configurações → Drive. Os arquivos enviados nos posts/reels são organizados automaticamente lá, por cliente e mês." },
      { q: "Dá pra importar vários clientes de uma vez, sem cadastrar um por um?", a: "Sim. Assim que você tem menos de 2 clientes cadastrados aparece um banner \"Traga seus clientes de onde já estão\" — clique nele (ou no item correspondente do checklist \"Primeiros passos\") e escolha entre mandar uma planilha/CSV/PDF, prints de tela da sua organização atual, ou conectar direto com Trello, ClickUp ou Notion. A IA lê e monta uma lista pra você revisar e confirmar antes de importar de verdade." },
      { q: "Deu erro de permissão ao conectar o Google Drive, o que eu faço?", a: "O mais comum é estar conectando com uma conta do Google diferente da dona da pasta (por exemplo, uma conta pessoal quando a pasta é de uma conta Workspace da agência) — refaça a conexão escolhendo a conta certa. Confira também se o link da pasta raiz foi copiado com permissão de compartilhamento, não só de visualização restrita." },
      { q: "Preciso criar a pasta de cada cliente manualmente no Google Drive?", a: "Não. No passo 3 (\"Vincular clientes\") do assistente de conexão do Drive, em Configurações → Drive, o Modo Criador já sugere a pasta certa pra cada cliente comparando os nomes — você só confirma, e o que não tiver pasta ainda é criado automaticamente." },
      { q: "Como registro um cliente que pausou o contrato, mas não cancelou de vez?", a: "Use a categoria \"Avulso\" pra esse caso. \"Arquivado\" é só pra quem realmente encerrou com a agência." },
    ],
  },
  {
    category: "Instagram e outras redes",
    items: [
      { q: "Preciso pedir login e senha do Instagram do meu cliente?", a: "Não necessariamente. Na Ficha do Cliente, seção Instagram, tem um botão \"Gerar link\" — ele cria um link com a marca da sua agência pro próprio cliente conectar o Instagram dele, sem passar a senha pra você. Se preferir, ainda dá pra conectar direto fazendo login com a conta do cliente." },
      { q: "Dá pra editar a bio ou a foto de perfil do Instagram do cliente pelo Modo Criador?", a: "Não — essa é uma limitação da própria API da Meta, não dá pra fazer isso por nenhum app de terceiros. Precisa ser direto no aplicativo do Instagram." },
      { q: "Além do Instagram, dá pra publicar em outra rede social?", a: "Por enquanto só no Instagram (posts, carrosséis, reels e stories). Facebook, TikTok e LinkedIn ainda não estão liberados pra todas as agências." },
      { q: "Consigo excluir um post, reel ou story que já foi publicado pelo Modo Criador?", a: "Pelo Modo Criador ainda não: a Meta não permite que o app apague publicações do Instagram com o tipo de conexão que usamos. O caminho é abrir o item, ir na seção \"No Instagram\" e clicar em \"Ver no Instagram\"; o post abre lá e você exclui direto no app (três pontinhos → Excluir)." },
      { q: "Os relatórios de alcance, curtidas e outras métricas do Instagram do meu cliente aparecem no Modo Criador?", a: "Ainda não pra contas de cliente — essa permissão específica de insights depende de uma aprovação separada da Meta, que ainda está em análise. Assim que for liberada, passa a funcionar pra todas as agências automaticamente." },
    ],
  },
  {
    category: "Conta e assinatura",
    items: [
      { q: "Preciso cadastrar cartão de crédito pra testar o Modo Criador?", a: "Não. Os 30 dias de teste grátis não pedem cartão nem PIX. No último dia do teste avisamos você pra decidir se quer continuar." },
    ],
  },
  {
    category: "Suporte",
    items: [
      { q: "Como reporto um problema ou peço uma sugestão?", a: "Use o ícone de interrogação (?) ao lado do sino de notificações, em qualquer tela. Você também pode acompanhar o que já reportou na aba \"Minhas solicitações\" aqui em cima." },
      { q: "O Modo Criador é seguro? Meus dados e os dos meus clientes ficam protegidos?", a: "Sim, o Modo Criador é muito seguro. Não é à toa que conseguimos aprovação oficial do Google pra integração com Drive e Agenda, e também autorização como desenvolvedor Meta, com acesso à API oficial do Instagram e do Facebook dentro do próprio app. Pra passar por essas revisões, o site precisa cumprir critérios rígidos de segurança e ter uma política de privacidade clara, alinhada à LGPD. Seus dados e os dos seus clientes ficam sempre isolados dos de outras agências." },
    ],
  },
];

export const TUTORIALS: HelpTutorial[] = [
  {
    title: "Importar vários clientes de uma vez",
    steps: [
      "Enquanto você tiver menos de 2 clientes cadastrados, aparece um banner \"Traga seus clientes de onde já estão\" no topo — ou acesse pelo item correspondente no checklist \"Primeiros passos\".",
      "Escolha a origem: Arquivo (planilha, CSV ou PDF), Prints de tela da sua organização atual, ou conectar direto com Trello, ClickUp ou Notion.",
      "Se for arquivo ou print, arraste ou selecione os arquivos e clique em \"Ler arquivos\" — a IA identifica os clientes automaticamente.",
      "Revise a lista antes de confirmar: dá pra editar nome, nicho e frequência de cada cliente, ou desmarcar quem não quer importar.",
      "Confirme — os clientes selecionados são criados de uma vez.",
    ],
  },
  {
    title: "Conectar o Google Drive",
    steps: [
      "Vá em Configurações → Drive. É um assistente de 3 passos: Conectar conta, Pasta raiz, Vincular clientes.",
      "Passo 1: clique em conectar e faça login com a conta Google da agência.",
      "Passo 2: escolha a pasta que vai guardar as pastas de todos os clientes — navega clicando, ou cola o link/ID se já souber.",
      "Passo 3: confira as sugestões de pasta pra cada cliente (a gente já compara o nome) e confirme — o que não tiver pasta, é criado automaticamente.",
      "Pronto — os arquivos enviados nos posts passam a ser organizados lá automaticamente.",
    ],
  },
  {
    title: "Resolver erro de permissão ao conectar o Google Drive",
    steps: [
      "O erro mais comum acontece quando a conta Google usada pra conectar é diferente da dona da pasta (por exemplo, uma conta pessoal quando a pasta é de uma conta Workspace da agência).",
      "Refaça a conexão em Configurações → Drive, e na tela de login do Google escolha a conta certa (se aparecer mais de uma opção salva no navegador).",
      "Confira também se o link da pasta raiz foi copiado com permissão de compartilhamento (\"qualquer pessoa com o link\"), não de visualização restrita só pra quem já tem acesso.",
      "Se continuar dando erro, desconecte em Configurações → Drive e conecte de novo do zero.",
    ],
  },
  {
    title: "Conectar o Instagram de um cliente sem pedir a senha dele",
    steps: [
      "Abra a Ficha do Cliente e ache a seção \"Instagram\".",
      "Clique em \"Gerar link\" — isso cria um link com a marca da sua agência.",
      "Copie o link (ou mande direto pelo WhatsApp) pro próprio cliente conectar o Instagram dele — sem precisar te passar login e senha.",
      "Assim que o cliente conectar do lado dele, a Ficha do Cliente já mostra \"Conectado\" e libera publicar/programar direto pelos posts e reels.",
      "Se preferir, ainda dá pra conectar direto fazendo login com a conta do Instagram do cliente (Business ou Criador de Conteúdo) — não precisa de Página do Facebook vinculada.",
    ],
  },
  {
    title: "Definir a função de um colaborador (Membro, Adm Setor ou Adm Master)",
    steps: [
      "Adicionar o colaborador na equipe e definir a função dele são duas etapas separadas — é fácil esquecer a segunda.",
      "Vá em Configurações → Equipe e clique no card da pessoa.",
      "No campo \"Função\", escolha: Membro (só vê e mexe no que for atribuído a ele), Adm Setor (pode ter permissões extras configuradas por cargo) ou Adm Master (acesso total à agência, inclusive financeiro).",
      "A mudança é salva na hora — não precisa nenhum outro passo.",
    ],
  },
  {
    title: "Gerar uma prévia de planejamento com IA (novidade, a partir do nível Prata)",
    steps: [
      "Essa função é exclusiva de agências que já chegaram no nível Prata do Programa de Níveis — veja em /programa-de-niveis como está o seu nível e o que falta pra subir.",
      "Abra a Ficha de um cliente e vá na aba \"Roteiros & Planejamento\".",
      "Clique no card \"Gerar prévia de planejamento com IA\", no topo da aba.",
      "Se teve reunião com o cliente recentemente, cola as anotações ou a transcrição inteira no campo de contexto extra — isso conta mais do que qualquer histórico antigo, mas é opcional.",
      "Clique em gerar e aguarde — a IA lê o histórico de posts/reels do cliente, o último roteiro ou planejamento escrito, os arquivos de marca no Drive, a base de conhecimento da agência e, se houver concorrentes cadastrados na Ficha do Cliente, pesquisa o que eles andam postando.",
      "Revise cada sugestão: cada uma vem com o \"Texto de produção (Briefing)\" pronto pro editor gravar/produzir e a \"Legenda a publicar\" separada — edite o que quiser antes de continuar.",
      "Avalie o resultado com as estrelas (isso ajuda a Luzeria a melhorar a IA) e escolha: \"Salvar como Planejamento\" (vira um documento normal, visível pro cliente) ou \"Aprovar e enviar pros Roteiros\" (escolhe um mês e já cria os roteiros de verdade no quadro).",
      "Quanto mais preenchida a Ficha do Cliente (nicho, briefing, roteiros recentes, concorrentes) e a Base de Conhecimento da agência (Configurações → Base de conhecimento), melhor fica o resultado.",
    ],
  },
  {
    title: "Criar uma automação (com modelo pronto ou do zero)",
    steps: [
      "Vá em Configurações → Automações (só o Admin Master cria e edita).",
      "Mais rápido: role até \"Modelos prontos\", escolha um (ex: \"Avisar falha na publicação do Instagram\") e clique em Adicionar — a regra já nasce com o texto pronto.",
      "Do zero: clique em \"Nova automação\", escolha o gatilho (o que acontece), depois a ação (o que o sistema faz). Os gatilhos são agrupados em Conteúdo, Prazos e paradas, Cliente e Cobrança.",
      "Use \"Só quando for\" pra limitar a regra a um cliente específico ou a um tipo de conteúdo (Posts, Reels ou Stories).",
      "Nas mensagens, {cliente} e {titulo} são trocados pelo nome do cliente e o título do item — e {erro} no gatilho de falha do Instagram.",
      "Na lista de automações, o frasco (🧪) manda a mensagem pra você como notificação, sem executar nada de verdade; o botão de pausa desliga a regra sem apagar; e cada linha mostra quantas vezes já disparou e quando foi a última.",
      "Gatilhos de tempo (prazo, item parado, cliente sem entrega, cobrança) são conferidos uma vez por dia, de manhã. Os demais rodam na hora.",
    ],
  },
  {
    title: "Instalar o Modo Criador como app no celular",
    steps: [
      "No iPhone (Safari): toque no botão de compartilhar na barra do navegador, role até \"Adicionar à Tela de Início\", confira o nome e toque em Adicionar.",
      "No Android (Chrome): toque no menu de três pontinhos no canto superior direito, depois em \"Instalar aplicativo\" ou \"Adicionar à tela inicial\".",
      "Pronto — o ícone da sua agência aparece na tela inicial, abrindo igual um app de verdade.",
      "Isso só funciona nesse aparelho e navegador específico — repita em cada celular que a equipe da agência usar.",
      "Depois de instalado, ative as notificações no sininho dentro do app pra saber na hora de comentário novo, prazo próximo ou aprovação de cliente.",
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
  { label: "Programa de Níveis (Bronze a Lendária)", path: "/programa-de-niveis" },
  { label: "Novidade — Prévia de planejamento com IA", path: "/planejamento-com-ia" },
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
