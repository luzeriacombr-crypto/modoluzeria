## 1. Atraso nas entregas no relatório (Configurações → Relatórios)

Hoje cada finalização guarda `finalized_at`, e o item tem `due_date` (prazo interno). Vou comparar os dois e expor o atraso.

**Backend — `getReport` e `getMemberReportDetail` em `src/lib/luzeria/api.functions.ts`:**
- No `select` de `finalizations`, incluir `content_items.due_date`.
- Calcular `lateDays = ceil((finalized_at - due_date) / 1d)` quando `due_date` existir e `finalized_at > due_date`. Caso contrário, `lateDays = 0` / `null`.
- Retornar `lateDays` em cada linha do histórico e em cada item de Posts/Reels/Outros do detalhe do membro.
- Acrescentar agregados por membro no ranking: `lateCount` (quantas entregas atrasadas) e `avgLateDays`.

**Frontend:**
- `src/components/luzeria/ReportsTab.tsx` (linha 259, linha do histórico): quando `h.lateDays > 0`, mostrar badge vermelha discreta `ATRASO X DIA(S)` à direita do título. Adicionar coluna/contador "Atrasadas" no resumo de cada membro.
- `src/components/luzeria/MemberReportPanel.tsx` (`ListBlock`): mesma badge ao lado da data, para Posts, Reels, Reels editados e Outros.
- Stories e Limpeza ficam de fora (não têm prazo definido por item).

## 2. Menções em comentários disparam notificação + aparecem em "Minhas Demandas"

Hoje `addComment` só insere o comentário. O parser `@[nome](uuid)` já existe em `MentionInput`. Já existe a tabela `mentions` (6 colunas) e `notifications`.

**Backend — `src/lib/luzeria/api.functions.ts`:**
- No `addComment`: extrair UUIDs do regex `@\[[^\]]+\]\(([0-9a-f-]{36})\)`, deduplicar, ignorar o próprio autor.
- Para cada mencionado: `insert` em `mentions` (item_id, comment_id, mentioned_user_id, author_id) e `insert` em `notifications` com `type='mention'`, `item_id`, mensagem `"{autor} mencionou você em {tipo} #{idx} — {cliente}"`. A `NotificationsBell` já navega para o item ao clicar.
- Adicionar `listMyMentions` (serverFn) que retorna itens onde o usuário tem menção pendente (sem notificação lida correspondente), com `clientName`, `clientColor`, `monthKey`, `type`, `idx`, `title`, `lastMentionAt`, `snippet` do comentário.

**Frontend — `src/components/luzeria/MyTasks.tsx`:**
- Nova seção "Mencionado em" acima/abaixo das tarefas, exibindo os itens retornados por `listMyMentions`. Cada card abre o item (mesmo padrão `selectClient + selectMonth + openItem + flash`) e marca a notificação de menção como lida ao clicar.
- Badge `@MENÇÃO` em destaque (verde `#C8D44E`).

**Query:** registrar `myMentionsQO` em `src/lib/luzeria/queries.ts` e invalidar junto com notificações.

## 3. Duplicar mês: copiar só a quantidade de posts/reels

Hoje `duplicateMonth` copia `title` e `item_assignees`. Vou enxugar.

**Backend — `duplicateMonth` em `src/lib/luzeria/api.functions.ts`:**
- Continuar criando o novo `months` row.
- Buscar do mês origem apenas `count` de itens por `type` (`post`, `reel`, `outros`).
- Inserir N novos `content_items` por tipo com `idx` sequencial, `title = ''` (ou `null`), `status = 'PLANEJAMENTO'`, sem assignees, sem cópia de `due_date`, `caption`, `briefing`, arquivos, comentários, etc.
- Remover todo o bloco de carry-over de `item_assignees`.

## Detalhes técnicos

- Migration necessária? Não. `mentions`, `notifications`, `due_date` e `finalizations.finalized_at` já existem.
- Cálculo de atraso é feito no servidor (UTC, em dias inteiros arredondados para cima) para o número bater com o que o usuário enxerga no card.
- `listMyMentions` filtra por `notifications.read = false AND type = 'mention'` para manter a lista "viva" e sumir sozinha quando o usuário visualiza.
