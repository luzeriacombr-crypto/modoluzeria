# Plano: Editor em Reels + Relatório em Configurações

## 1. Campo "Editor" nos Reels

### Backend (migration)
- Adicionar coluna `editor_id uuid` em `public.content_items` (FK → `profiles.id` ON DELETE SET NULL).
- Atualizar policies existentes mantendo: Adm Master, Adm Setor e qualquer assignee do item podem fazer UPDATE de `editor_id`. Como já existe policy de update para esses papéis em `content_items`, basta garantir que o campo seja gravável via `updateItem`.

### Server function (`api.functions.ts`)
- Adicionar `editorId` ao schema do `updateItem` (string UUID nullable).
- Incluir `editor_id` no SELECT do `getMonth`, `listMyTasks`, `getMemberFinalizations`, etc., para popular no tipo `ContentItem`.

### Types
- `types.ts`: adicionar `editorId?: string | null` em `ContentItem`.

### UI
- `DetailPanel.tsx`: quando `item.type === "reel"`, abaixo do seletor de "Tipo de Vídeo" adicionar bloco "EDITOR" com dropdown de profiles ativos (label + avatar). Permissão: master, setor ou se `me.id` ∈ assignees.
- `ContentRow.tsx`: em reels, mostrar ícone `Scissors` + iniciais do editor à direita em `rgba(255,255,255,0.4)`, com `title` = nome completo.

## 2. Aba "Relatório" em Configurações

### Estrutura
- `Settings.tsx` passa a ter tabs: **Equipe** (atual) e **Relatório** (master only).
- Novo componente `ReportsTab.tsx` em `src/components/luzeria/`.

### Server functions novas (em `api.functions.ts`)
Todas com `requireSupabaseAuth` + checagem `has_role(_, 'master')`:

- `getReport({ userId?, from, to, type?, clientId? })` retorna:
  - `summary`: totais finalizados (total, posts, reels, outros).
  - `byMember[]`: { userId, name, role, color, posts, reels, outros, stories, cleaning, total }.
  - `byEditorFormat[]`: { editorId, name, lofi, facil, basico, avancado, total } usando `editor_id` em items finalizados tipo `reel`.
  - `history[]` (paginado server-side via limit/offset): { id, finalizedAt, userId, userName, clientId, clientName, clientColor, source ('content'|'stories'|'cleaning'|'avulso'), type, title, reelType?, editorId?, editorName? }.
  - `formatTotals`: { lofi, facil, basico, avancado }.

- `getMemberReportDetail({ userId, from, to })`: 
  - `monthly[]` (últimos 6 meses): { monthKey, count }.
  - `posts[]`, `reels[]`, `editedReels[]`, `outros[]`, `stories[]`, `cleaning[]` cronológicos.

Fontes de dados:
- Finalizações de posts/reels/outros: tabela `finalizations` (já existe) JOIN `content_items` JOIN `clients` JOIN `months`.
- Stories: `stories_schedule` (entradas atribuídas).
- Limpeza: `cleaning_schedule`.
- Avulsos: clientes com categoria "Avulsos".

### UI ReportsTab
- Filtros no topo (Membro, Período preset+custom, Tipo, Cliente) + botão "Aplicar filtros" (#C8D44E).
- Botão "Exportar .xlsx" no topo direito.
- Seção 1: cards (Finalizadas, Posts, Reels, Outros).
- Seção 2: tabela `byMember` ordenada desc, linha do topo em #C8D44E, click → abre `MemberReportPanel` (slide-in 480px).
- Seção 3: tabela `byEditorFormat` + 4 mini cards de formato.
- Seção 4: histórico com paginação 50/pág.

### MemberReportPanel
- Reusa shell do `MemberDetailPanel` existente; conteúdo conforme spec (bar chart 6 meses, listas separadas, timeline).
- Bar chart simples em divs (mesma abordagem do AdminDashboard).

### Exportação Excel
- `bun add xlsx` (SheetJS). Geração 100% client-side.
- 4 abas: "Resumo", "Por Membro", "Reels por Formato", "Histórico".
- Nome: `Relatorio_Luzeria_{Mes}_{Ano}.xlsx` baseado no filtro de período (mês do `to`).

## Arquivos afetados
- **Migration**: adiciona `editor_id` em `content_items`.
- **Edit**: `api.functions.ts`, `queries.ts`, `types.ts`, `DetailPanel.tsx`, `ContentRow.tsx`, `Settings.tsx`.
- **Novos**: `ReportsTab.tsx`, `MemberReportPanel.tsx`, `report-export.ts` (xlsx helpers).
- **Dep**: `xlsx`.

## Observações
- Editor é independente de assignees: não dispara `notify_on_assignment` nem `record_finalizations`.
- Permissão de edição do campo Editor validada no server (`updateItem`): aceita quando caller é master/setor OU está em `item_assignees`.
- Relatório roda inteiramente em server functions filtradas por master para evitar exposição via RLS.

Confirma para eu implementar?
