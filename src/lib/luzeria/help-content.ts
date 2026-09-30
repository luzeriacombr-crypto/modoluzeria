// Fonte única do conteúdo de ajuda do Modo Criador — usado pela Central de
// Ajuda (AjudaPage.tsx) e como base de conhecimento do Chat do Modo Criador
// (support-chat.functions.ts). Editar aqui atualiza os dois lugares.

export type HelpFaqGroup = { category: string; items: { q: string; a: string }[] };
export type HelpTutorial = { title: string; category: string; steps: string[]; images?: { src: string; alt: string }[]; videoUrl?: string };

/** Ordem de exibição das categorias na Central de Ajuda. */
export const TUTORIAL_CATEGORIES = ["Primeiros passos", "Conteúdo e aprovação", "Inteligência Artificial", "Equipe e automações", "Personalização e organização"] as const;

export const FAQ: HelpFaqGroup[] = [
  {
    category: "Equipe e automações",
    items: [
      { q: "Como envio uma foto de perfil pra um colega que ainda não tem?", a: "Em Configurações → Equipe, clique no card do colaborador — abre um modal onde o Admin Master pode enviar ou trocar a foto dele." },
      { q: "Esqueci minha senha, e agora?", a: "Peça pro Admin Master da sua agência: Configurações → Equipe → clique no seu card → \"Resetar senha\". Você recebe um link por e-mail." },
      { q: "O e-mail de boas-vindas pra um colaborador novo não chegou, o que eu faço?", a: "Primeiro peça pra ele conferir a caixa de spam/lixo eletrônico. Se não estiver lá, vá em Configurações → Equipe, clique no card da pessoa e depois em \"Reenviar e-mail de boas-vindas\"." },
      { q: "Como funcionam as Automações?", a: "Em Configurações → Automações, o Admin Master cria regras do tipo \"quando acontecer X, então fazer Y\", que rodam sozinhas. Veja o passo a passo completo (com os Modelos prontos) no tutorial \"Criar uma automação\", aqui na aba Tutoriais." },
      { q: "Dá pra restringir o acesso à aba financeira só pros sócios?", a: "Sim, pela Função de cada pessoa. \"Membro\" só vê e mexe no que for atribuído a ele, \"Adm Setor\" pode ter permissões extras configuradas por cargo, e \"Adm Master\" tem acesso total, inclusive ao financeiro. Escolha a função certa pra cada colaborador em Configurações → Equipe." },
    ],
  },
  {
    category: "Clientes e arquivos",
    items: [
      { q: "Como meu cliente aprova um post sem ter conta?", a: "Cada cliente tem um link público (aba \"Preview de Feed\" dentro do cliente) — manda esse link e ele aprova ou comenta direto, sem login. Veja o passo a passo completo (incluindo como mandar pelo WhatsApp) no tutorial \"Como o cliente aprova o conteúdo\", aqui na aba Tutoriais." },
      { q: "Como funciona o backup no Google Drive?", a: "Conecte sua conta do Drive em Configurações → Drive. Os arquivos enviados nos posts/reels são organizados automaticamente lá, por cliente e mês." },
      { q: "Dá pra importar vários clientes de uma vez, sem cadastrar um por um?", a: "Sim — de planilha/CSV/PDF, prints de tela, ou conectando direto com Trello, ClickUp ou Notion. Veja o passo a passo no tutorial \"Importar vários clientes de uma vez\"." },
      { q: "Importei clientes do Trello/ClickUp/Notion, mas não vieram todos — por quê?", a: "A IA lê a estrutura do seu board pra separar um cliente por lista/coluna, e isso às vezes não bate 100% com boards organizados de um jeito diferente. Confira se cada cliente está numa lista/coluna própria e tente importar de novo; se continuar faltando gente, manda uma mensagem pelo ícone de interrogação (?) que a gente ajuda a resolver." },
      { q: "Deu erro de permissão ao conectar o Google Drive, o que eu faço?", a: "O mais comum é estar conectando com uma conta do Google diferente da dona da pasta. Veja o passo a passo completo no tutorial \"Resolver erro de permissão ao conectar o Google Drive\"." },
    ],
  },
  {
    category: "Instagram e outras redes",
    items: [
      { q: "Preciso pedir login e senha do Instagram do meu cliente?", a: "Não necessariamente. Na Ficha do Cliente, seção Instagram, tem um botão \"Gerar link\" — ele cria um link com a marca da sua agência pro próprio cliente conectar o Instagram dele, sem passar a senha pra você. Se preferir, ainda dá pra conectar direto fazendo login com a conta do cliente." },
      { q: "Não consigo programar ou publicar no Instagram — o botão não aparece ou dá erro. O que eu confiro?", a: "Duas coisas resolvem quase sempre: (1) o cliente precisa ter o Instagram conectado na Ficha do Cliente; (2) o conteúdo precisa estar com status \"Pronto para publicar\" e com a \"Data de publicação\" preenchida, pra liberar o botão \"Programar publicação\". Veja o passo a passo completo no tutorial \"Programar ou publicar direto no Instagram\"." },
      { q: "Além do Instagram, dá pra publicar em outra rede social?", a: "Por enquanto só no Instagram (posts, carrosséis, reels e stories). Facebook, TikTok e LinkedIn ainda não estão liberados pra todas as agências." },
      { q: "Consigo excluir um post, reel ou story que já foi publicado pelo Modo Criador?", a: "Pelo Modo Criador ainda não: a Meta não permite que o app apague publicações do Instagram com o tipo de conexão que usamos. O caminho é abrir o item, ir na seção \"No Instagram\" e clicar em \"Ver no Instagram\"; o post abre lá e você exclui direto no app (três pontinhos → Excluir)." },
      { q: "Os relatórios de alcance, curtidas e outras métricas do Instagram do meu cliente aparecem no Modo Criador?", a: "Sim, em \"Instagram\" no menu lateral — veja o tutorial \"Ver publicações programadas, publicadas e os Insights de um cliente\". Uma parte mais completa de insights ainda depende de uma aprovação separada da Meta, em análise." },
    ],
  },
  {
    category: "Personalização e organização",
    items: [
      { q: "Como coloco a logo e as cores da minha agência no Modo Criador?", a: "Em Configurações → Geral, seção \"Marca da agência\". Veja o passo a passo completo no tutorial \"Personalizar a logo e as cores da agência\"." },
      { q: "Dá pra organizar tarefas ou projetos que não são post, reel ou story (ex: identidade visual, um evento)?", a: "Dá, com limitações: pra algo pontual, use \"Registrar nova atividade\" dentro do cliente. Pra um projeto com várias etapas, crie uma \"Campanha\" nesse cliente. Hoje isso é organizado por cliente e mês, sem um quadro kanban arrastável nem visão geral da agência — veja o tutorial \"Organizar tarefas e projetos além de posts, reels e stories\" pra entender o que dá pra fazer hoje." },
    ],
  },
  {
    category: "Conta e assinatura",
    items: [
      { q: "Preciso cadastrar cartão de crédito pra testar o Modo Criador?", a: "Não. Os 30 dias de teste grátis (45 se você entrou por indicação) não pedem cartão nem PIX. No último dia do teste avisamos você pra decidir se quer continuar." },
      { q: "Clicar em \"Assinar\" vai me cobrar na hora?", a: "Não. Clicar em \"Assinar\" pede uma confirmação antes, mostrando a data real de vencimento — se você ainda está no teste grátis, essa data só cai no fim do seu teste, nunca hoje. Nada é cobrado automaticamente: só é gerada uma fatura (boleto/PIX/cartão) que você mesmo escolhe pagar quando quiser continuar." },
      { q: "Posso excluir minha conta?", a: "Sim, quem é Admin Master pode fazer isso sozinho em Configurações → Plano e Cobrança, na seção \"Excluir conta\" (no fim da página) — precisa digitar o nome da agência pra confirmar, e não dá pra desfazer. Se você só está no teste grátis, nem precisa excluir: ele acaba sozinho e não há cobrança." },
    ],
  },
  {
    category: "Suporte",
    items: [
      { q: "Como reporto um problema ou peço uma sugestão?", a: "Use o ícone de interrogação (?) ao lado do sino de notificações, em qualquer tela. Você também pode acompanhar o que já reportou na aba \"Minhas solicitações\" aqui em cima." },
      { q: "O Modo Criador é seguro? Meus dados e os dos meus clientes ficam protegidos?", a: "Sim, o Modo Criador é muito seguro. Não é à toa que conseguimos autorização como desenvolvedor Meta, com acesso à API oficial do Instagram e do Facebook dentro do próprio app. A conexão com o Google Drive e a Agenda usa o login oficial do Google, então o Modo Criador nunca vê a sua senha, e você pode desconectar quando quiser. Pra passar pela revisão da Meta, o site precisa cumprir critérios rígidos de segurança e ter uma política de privacidade clara, alinhada à LGPD. Seus dados e os dos seus clientes ficam sempre isolados dos de outras agências." },
      { q: "Se o site sair do ar, o que acontece com meus dados? Vocês têm backup?", a: "Fica tranquilo, seus dados não vão sumir. Usamos sistemas avançados e seguros pra rodar o Modo Criador, com backup duplo — seus dados ficam guardados em mais de uma plataforma ao mesmo tempo, com backup diário e automático de tudo. Uma instabilidade pontual é só isso: o site volta e seus clientes, conteúdos e arquivos continuam exatamente onde estavam, intactos." },
    ],
  },
];

export const TUTORIALS: HelpTutorial[] = [
  {
    title: "Importar vários clientes de uma vez",
    category: "Primeiros passos",
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
    category: "Primeiros passos",
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
    category: "Primeiros passos",
    steps: [
      "O erro mais comum acontece quando a conta Google usada pra conectar é diferente da dona da pasta (por exemplo, uma conta pessoal quando a pasta é de uma conta Workspace da agência).",
      "Refaça a conexão em Configurações → Drive, e na tela de login do Google escolha a conta certa (se aparecer mais de uma opção salva no navegador).",
      "Confira também se o link da pasta raiz foi copiado com permissão de compartilhamento (\"qualquer pessoa com o link\"), não de visualização restrita só pra quem já tem acesso.",
      "Se continuar dando erro, desconecte em Configurações → Drive e conecte de novo do zero.",
    ],
  },
  {
    title: "Conectar o Instagram de um cliente sem pedir a senha dele",
    category: "Primeiros passos",
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
    category: "Equipe e automações",
    steps: [
      "Adicionar o colaborador na equipe e definir a função dele são duas etapas separadas — é fácil esquecer a segunda.",
      "Vá em Configurações → Equipe e clique no card da pessoa.",
      "No campo \"Função\", escolha: Membro (só vê e mexe no que for atribuído a ele), Adm Setor (pode ter permissões extras configuradas por cargo) ou Adm Master (acesso total à agência, inclusive financeiro).",
      "A mudança é salva na hora — não precisa nenhum outro passo.",
    ],
  },
  {
    title: "Criar um conteúdo pro cliente (briefing, materiais e responsáveis)",
    category: "Conteúdo e aprovação",
    steps: [
      "Abra o cliente e clique em \"Adicionar Posts\" (ou Reels/Stories) — o item já nasce na hora e abre pra você preencher.",
      "Dê um título clicando em \"Clique para inserir um título\".",
      "Na seção \"Briefing\", escreva o que o editor precisa saber pra produzir essa arte.",
      "Em \"Imagens de referência\", clique em \"Fazer upload para briefing\" pra anexar exemplos visuais do que você quer.",
      "Em \"Materiais brutos\", clique em \"Fazer upload de material bruto\" pra subir as fotos/vídeos originais que o editor vai usar — tudo isso já fica organizado no Google Drive do cliente, se estiver conectado.",
      "Escreva a \"Legenda\" já pensando no que vai ser publicado, se já souber.",
      "Em \"Responsáveis\", clique no \"+\" e marque quem fica encarregado desse conteúdo — dá pra marcar mais de uma pessoa.",
      "Em \"Editor\", escolha quem vai produzir (ou já produziu) a arte.",
      "Mude o \"Status\" conforme o conteúdo avança: Planejamento → Criação de arte → Revisão interna → Revisão cliente. Assim que o status vira \"Revisão cliente\", o item já aparece no Preview de Feed do cliente pra ele aprovar.",
      "Quer que a atribuição de responsável aconteça sozinha quando o status mudar? Crie uma automação em Configurações → Automações, com o gatilho \"Quando o status virar\" → \"Criação de arte\" e a ação \"Atribuir para\" a pessoa certa.",
    ],
  },
  {
    title: "Como o cliente aprova o conteúdo (WhatsApp e Preview de Feed)",
    category: "Conteúdo e aprovação",
    steps: [
      "Deixe o post/reel com a arte anexada e o status em \"Revisão cliente\" — só a partir dessa etapa ele aparece no preview do cliente.",
      "Abra o cliente e vá na aba \"Preview de Feed\".",
      "Clique em \"Compartilhar preview\" e depois em \"Copiar\".",
      "Cole o link no WhatsApp do cliente (ou do grupo) — ele abre sem precisar de login.",
      "O cliente vê como o feed vai ficar e pode aprovar ou deixar um comentário direto ali.",
      "Você é avisado quando ele aprovar ou pedir ajuste — a aba passa a mostrar \"Feed aprovado pelo cliente\".",
      "O link é fixo por cliente (sempre mostra o mês ativo) — clique em \"Gerar novo link\" só se quiser cancelar o anterior.",
      "Quer que a mensagem de WhatsApp já fique pronta sozinha? Crie uma automação em Configurações → Automações, com o gatilho \"Quando o status virar\" → \"Revisão cliente\" e a ação \"Deixar mensagem de WhatsApp pronta\".",
    ],
  },
  {
    title: "Programar ou publicar direto no Instagram",
    category: "Conteúdo e aprovação",
    steps: [
      "O conteúdo precisa estar com status \"Pronto para publicar\" e o cliente com o Instagram conectado (Ficha do Cliente).",
      "Dentro do item, role até \"Data de publicação\" e defina a data e o horário reais — é isso que aparece pro cliente no preview.",
      "Quer publicar na hora? Clique em \"Publicar no Instagram agora\".",
      "Quer deixar programado pra sair sozinho? Clique em \"Programar publicação\" (só libera depois que a data/horário estiverem preenchidos).",
      "Mudou de ideia? Clique em \"Cancelar programação\" a qualquer momento antes da publicação sair.",
      "O mesmo fluxo vale pro Facebook, assim que a publicação nessa rede for liberada pra sua agência.",
    ],
  },
  {
    title: "Configurar a Base de Conhecimento pra treinar a IA",
    category: "Inteligência Artificial",
    steps: [
      "Vá em Configurações → Base de conhecimento.",
      "Clique em \"Adicionar texto\", dê um título opcional e cole o conteúdo — pode ser um guia de tom de voz, padrões de legenda ou um roteiro que deu certo e você quer que a IA use de referência.",
      "Prefira colar o texto direto ou anexar PDF/Markdown: são os formatos que a IA realmente lê. Arquivo .doc/.docx fica guardado ali, mas ainda não é lido pela IA.",
      "Clique em \"Salvar nota\".",
      "Isso entra automaticamente na \"Prévia de planejamento com IA\" de qualquer cliente da agência — quanto mais exemplos reais, melhor o resultado.",
    ],
  },
  {
    title: "Preencher a Ficha do Cliente pra IA ter mais contexto",
    category: "Inteligência Artificial",
    steps: [
      "Abra o cliente, vá na aba \"Ficha do Cliente\" e role até o final da aba \"Geral\".",
      "Em \"Concorrentes\", liste um perfil por linha (ex: @perfil_concorrente ou nome da empresa) — a IA pesquisa o que eles andam postando na hora de gerar um planejamento.",
      "Em \"Briefing / sistema de conteúdo\", cole o briefing ou manual de como criar conteúdo pra esse cliente específico.",
      "Em \"Roteiros recentes\", cole os últimos roteiros já escritos pra ele — ajuda a IA a aprender o padrão e o tom já usado.",
      "Clique em \"Salvar configuração\".",
    ],
  },
  {
    title: "Colar um roteiro feito fora do Modo Criador e formatar com IA",
    category: "Inteligência Artificial",
    steps: [
      "Abra o cliente, vá em \"Mais\" e depois na aba \"Roteiros & Planejamento\".",
      "Clique em \"Formatar com IA\".",
      "Cole o material bruto do cliente no campo que aparece — pode ser transcrição, rascunho ou notas soltas, em qualquer formato.",
      "Clique em \"Gerar com IA\" — a Luzeria organiza tudo pra você, de graça.",
      "Revise o texto formatado, ajuste o que quiser, e clique em \"Salvar\".",
      "Pronto — o cliente já vê tudo organizado no link de preview dele.",
      "Prefere formatar numa IA própria que você já assina (ChatGPT, Claude)? Clique em \"Copiar modelo\" pra copiar um prompt pronto, cole na sua IA, e depois cole o resultado de volta aqui.",
    ],
  },
  {
    title: "Exportar roteiros em PDF pra imprimir",
    category: "Conteúdo e aprovação",
    steps: [
      "Na aba \"Roteiros & Planejamento\" do cliente, ache o roteiro salvo e clique no ícone \"Exportar em PDF\".",
      "Escolha o que entra: \"Todos os roteiros\", \"Somente Reels\", \"Somente aprovados\" ou \"Selecionar quais\" (aparece uma lista pra marcar um por um).",
      "Deixe \"Exibir legendas\" marcado se quiser que a legenda de cada post/reel também saia no PDF — desmarque se não quiser.",
      "Clique em \"Baixar PDF\". Ele já sai com a logo da sua agência, pronto pra imprimir e levar no dia da gravação.",
    ],
  },
  {
    title: "Ver publicações programadas, publicadas e os Insights de um cliente",
    category: "Conteúdo e aprovação",
    steps: [
      "Clique em \"Instagram\" no menu lateral (só admins veem esse item).",
      "Na aba \"Atividade\", escolha o cliente no filtro (ou deixe em \"Todos os clientes\").",
      "\"Programados\" mostra o que ainda vai sair; \"Publicados pelo Modo Criador\" mostra tudo que já foi ao ar por aqui.",
      "Com um cliente selecionado, os Insights dele (seguidores, alcance, visitas ao perfil) aparecem na mesma tela.",
      "Pra mandar os Insights pro cliente sem ele precisar de login, clique no ícone \"Compartilhar com o cliente (link sem login)\" e depois em \"Copiar link\".",
      "Pra baixar em PDF, clique no ícone \"Baixar em PDF\", escolha a aparência (Claro/Escuro) e clique em \"Baixar PDF\".",
    ],
  },
  {
    title: "Gerar uma prévia de planejamento com IA (novidade)",
    category: "Inteligência Artificial",
    steps: [
      "Regra de acesso: sem assinatura registrada (teste grátis) ou no plano Solo, dá pra usar em até 2 clientes. No plano Pro ou superior, sem limite. Isso é por plano/pagamento, não por nível do Programa de Níveis.",
      "Na primeira vez que usar num cliente novo, se a agência estiver no limite (teste grátis ou Solo), aparece uma confirmação avisando que vai gastar uma das vagas. Clientes que já usaram antes continuam gerando de graça, sem confirmar de novo.",
      "Se a agência tinha Pro e caiu pro Solo (ou perdeu a assinatura) com mais clientes ativados do que o novo limite permite, a geração para até desativar em algum cliente ou fazer upgrade em Configurações → Cobrança.",
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
    category: "Equipe e automações",
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
    category: "Primeiros passos",
    steps: [
      "No iPhone (Safari): toque no botão de compartilhar na barra do navegador, role até \"Adicionar à Tela de Início\", confira o nome e toque em Adicionar.",
      "No Android (Chrome): toque no menu de três pontinhos no canto superior direito, depois em \"Instalar aplicativo\" ou \"Adicionar à tela inicial\".",
      "Pronto — o ícone da sua agência aparece na tela inicial, abrindo igual um app de verdade.",
      "Isso só funciona nesse aparelho e navegador específico — repita em cada celular que a equipe da agência usar.",
      "Depois de instalado, ative as notificações no sininho dentro do app pra saber na hora de comentário novo, prazo próximo ou aprovação de cliente.",
    ],
  },
  {
    title: "Personalizar a logo e as cores da agência",
    category: "Personalização e organização",
    steps: [
      "Vá em Configurações → Geral e abra a seção \"Marca da agência\".",
      "Em \"Logo · modo escuro\" e \"Logo · modo claro\" (opcional), clique em \"Enviar logo\" pra subir cada versão — se não subir a versão clara, o app usa a escura também em telas claras.",
      "Se precisar, ajuste o tamanho e a posição da logo na barra lateral em \"Ajuste fino da logo na barra lateral\", ou clique em \"Restaurar automático\".",
      "Preencha \"Nome da agência\" e, se quiser, o \"Slogan\" (ou marque a opção de não mostrar nenhum).",
      "Em \"Identidade visual\", escolha a \"Cor principal\", \"Cor clara (fundos suaves)\", \"Cor da barra lateral\" e \"Cor de destaque nos gráficos\".",
      "Quer controlar a cor de elementos específicos (título, corpo do texto, botões, gradiente do topo)? Marque \"Modo avançado\" — dá pra voltar tudo com \"Restaurar cores originais\" quando quiser.",
    ],
  },
  {
    title: "Organizar tarefas e projetos além de posts, reels e stories",
    category: "Personalização e organização",
    steps: [
      "Pra algo pontual dentro de um cliente (uma reunião, uma entrega avulsa), abra o cliente → \"Mais\" → \"Atividades\" e clique em \"Registrar nova atividade\".",
      "Pra um projeto maior com várias etapas (ex: identidade visual, um evento), crie uma \"Campanha\" pra esse cliente em \"Mais\" → \"Campanhas\" — dá pra colocar briefing, materiais, valor e a pasta do Drive.",
      "Dentro da campanha, adicione quantos itens quiser como tarefas — não precisam ser post/reel de verdade.",
      "Marque um item como \"Interno\" se ele for só controle da equipe e não deve aparecer pro cliente em Posts/Reels/Preview de Feed.",
      "Hoje isso é organizado por cliente e por mês, sem um quadro kanban arrastável nem uma visão geral da agência inteira — se sua agência sente falta disso, manda a sugestão pelo ícone de interrogação (?) no topo.",
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
