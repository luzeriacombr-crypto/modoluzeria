## O que muda

Apenas o bloco "Hoje" do **Minhas Demandas** (`src/components/luzeria/MyTasks.tsx`, linhas ~98–176). Nada de lógica nova — só apresentação. As mutations existentes (`setStoryDone`, `setCleaningDone`) e os dados (`today.stories`, `today.cleaningTaskIdx`, `today.cleaningStatuses`, `today.storyStatus`) continuam iguais. A persistência "até o fim do dia" já existe (a função `auto_mark_missed` zera no fim do dia marcando como atrasado).

## Card de Stories

- Título: **"É seu dia nos Stories Luzeria"**
- Subtítulo: **"Publique pelo menos uma sequência com 5."**
- Ícone: mantém `Camera` no quadradinho verde à esquerda.
- Botão: **"Marcar feito"** (já existente, sem mudanças visuais).

## Card de Limpeza

- Hoje existe **um único card** com lista de tarefas e checkboxes.
- Vira **um card por tarefa do dia**, cada um idêntico ao card de Stories:
  - Ícone `Sparkles` no quadradinho verde.
  - Título: **"É seu dia de {tarefa}"** — usando `CLEANING_TASKS[ti]` com a primeira letra em minúscula (ex.: "É seu dia de limpar os espelhos"). Se a tarefa já vier em minúscula, mantém.
  - Sem subtítulo (ou um subtítulo curto neutro — confirmar se quiser algum).
  - Botão "Marcar feito" próprio, chamando `setCleaningDone` com o `taskIdx` daquele card.
- **Checkboxes removidos.**

## Comportamento do "Marcar feito"

Aplicado igual nos dois tipos de card:

- Estado **pendente**: botão verde `#C8D44E`, texto `#0D0D0D`, label "Marcar feito" com ícone `Check`.
- Ao clicar → estado **feito**:
  - Label vira **"✓ Feito"**.
  - Fundo `#C8D44E`, texto `#0D0D0D` (igual).
  - Botão `disabled` (sem ação ao clicar de novo, sem hover).
  - O card inteiro recebe `opacity: 0.5`.
- Estado **missed** (fim do dia sem marcar): card com a borda/realce vermelho atual, botão oculto. Mantém o comportamento existente.
- A marcação persiste pelo dia via os mesmos registros no banco (`stories_schedule.status` e `cleaning_log.status`).

> Observação: o botão "Desfazer" do card de Stories some, porque uma vez marcado fica travado até o fim do dia, conforme pedido. Se quiser manter um caminho para desfazer engano, me avise.

## Detalhes técnicos

- Editar somente `src/components/luzeria/MyTasks.tsx`.
- Extrair uma pequena função/JSX helper `DailyTaskCard({ icon, title, subtitle, status, onDone })` para reusar entre Stories e cada tarefa de Limpeza, mantendo o mesmo estilo do card de Stories atual (`rgba(200,212,78,0.1)` + borda esquerda `#C8D44E`, container `rounded-lg p-4 flex items-center gap-3`, ícone 36×36 verde).
- Para Limpeza, mapear `today.cleaningTaskIdx` para N cards, cruzando com `today.cleaningStatuses` para resolver o status individual.
- Para o título "É seu dia de …", normalizar a primeira letra do nome da tarefa em minúscula (`task.charAt(0).toLowerCase() + task.slice(1)`).
- Sem mudanças em backend, migrations, queries ou outros componentes.

## Fora de escopo

- Página `StoriesView` e `CleaningView` (calendário/escala semanal) ficam como estão.
- Lógica de "missed" automática no fim do dia (`auto_mark_missed`) — já existe.
