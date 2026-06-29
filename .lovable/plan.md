# Tour guiado de primeiro acesso

Adicionar um tour interativo que aparece automaticamente após o `WelcomeOnboarding` (escolha de avatar) na primeira vez que o colaborador entra. O próprio app destaca cada área e explica o que ela faz, com botões **Anterior**, **Próximo** e **Pular**. Funciona em desktop e mobile.

## Como funciona

- Quando `profile.onboarded_at` é preenchido (já existe), olhamos um novo campo `tour_completed_at`. Se for `null`, o tour começa sozinho ao entrar no app.
- O tour é um overlay escuro com um "recorte" iluminado em volta do elemento atual + um tooltip ao lado com título, descrição curta, contador (ex. "3 de 8") e três botões: Anterior · Pular tour · Próximo.
- ESC ou clicar fora = pular. No fim aparece "Tudo pronto! Bons trabalhos 💚".
- Pode ser refeito a qualquer momento pelo botão **"Refazer tour"** na página de Perfil.

## Passos do tour (adaptados por papel)

Para **todos os colaboradores**:
1. Sidebar / categorias — "Aqui ficam seus clientes, organizados por categoria."
2. Minhas Demandas — "Tudo que é seu aparece aqui. Pílula colorida mostra urgência do prazo."
3. Aba Minha Semana — "Visão kanban por dia da semana."
4. Metas do mês (donuts) — "Seu progresso de Posts, Reels e Stories."
5. Detalhe de um item — "Clique pra abrir checklist, comentar, mudar status, marcar travado."
6. Menções `@nome` no comentário — "Avisa direto a pessoa."
7. Notificações (sino) — "Prazos, menções e tarefas novas chegam aqui."
8. Avatar / Perfil — "Edite foto, cor e refaça este tour quando quiser."

Passos extras só para **Adm Master / Setor**:
9. Dashboard — "Métricas, ranking e saúde da operação."
10. Configurações → Relatório — "Exporte produtividade, lead time, qualidade, travados."
11. Configurações → Equipe — "Aprovar membros novos e gerenciar acessos."

Em mobile, os passos que apontam pra sidebar passam a apontar pra bottom nav equivalente.

## Onde aparece o botão "Refazer tour"

- Página de Perfil, abaixo das opções de avatar.
- Configurações → Geral (Master), bloco "Ajuda".

## Detalhes técnicos

- **Banco**: nova coluna `profiles.tour_completed_at timestamptz null`. Migração pequena, sem mexer em RLS existente (a policy de update do próprio perfil já cobre).
- **Lib**: usar [`driver.js`](https://driverjs.com/) (~6kb, sem dependências, MIT, suporta dark mode e popovers customizados). Alternativa: escrever um componente próprio com `createPortal` (mais controle, ~150 linhas). Recomendo `driver.js` pra ir mais rápido.
- **Componente novo**: `src/components/luzeria/AppTour.tsx` — monta os passos com base em `useMe()` (role) e `useIsMobile()`, e dispara via `useEffect` quando `me.tour_completed_at == null`.
- **Marcadores nos elementos-alvo**: adicionar `data-tour="sidebar"`, `data-tour="my-tasks"`, `data-tour="goals"`, etc. em ~10 lugares já existentes (Sidebar, MyTasks, GoalsWidget, DetailPanel, Notifications, Avatar do header, AdminDashboard, ReportsTab, Settings/Equipe, MobileNav). Mudança mínima, só atributos.
- **Server fn nova**: `markTourCompleted` em `roadmap.functions.ts` (escreve `tour_completed_at = now()` no próprio perfil via `requireSupabaseAuth`).
- **Refazer tour**: zera o campo e remonta o componente.
- **Estilo**: popover com fundo `#1C1C1C`, borda `rgba(255,255,255,0.1)`, accent `#C8D44E` nos botões — combinando com o resto do app.

## Não muda

- Fluxo de login, `WelcomeOnboarding` (avatar), permissões, RLS.
- Nenhum dado existente é afetado — colaboradores que já passaram pelo onboarding **não** veem o tour automaticamente (a migração marca `tour_completed_at = onboarded_at` pra quem já está dentro). Eles podem rodar manualmente pelo Perfil se quiserem.

## Confirma antes de começar

1. Topa usar `driver.js` ou prefere componente próprio (mais trabalho, zero dependência)?
2. Quer que o tour rode também pra quem já está no app, ou só pra novos colaboradores (recomendo só novos + botão manual)?
3. A lista de passos acima cobre bem ou quer incluir/tirar algo (ex: Stories, Limpeza, Ficha do cliente)?
