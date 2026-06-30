
# Fluidez de hover em todo o app

## Objetivo
Garantir que praticamente todo elemento clicável (botões, abas, linhas, cards de cliente, ícones de ação, items de sidebar, dropdowns) tenha um feedback visual claro ao passar o mouse — sem mudar nenhuma lógica nem layout.

## Princípios visuais (padrão único para o app inteiro)
- **Transições suaves**: `transition-all duration-200 ease-out` como base.
- **Botão accent (#C8D44E)**: hover deixa levemente mais brilhante + leve `scale-[1.02]` + sombra suave esverdeada.
- **Botão secundário / ghost**: fundo passa de transparente para `rgba(255,255,255,0.06)` e borda/texto ganham +20% de opacidade.
- **Botão destrutivo**: hover vermelho mais saturado + leve glow.
- **Ícones de ação (ex: 3 pontinhos, lixeira, edit, X)**: ganham fundo circular `rgba(255,255,255,0.08)` + ícone fica branco puro.
- **Linhas de conteúdo (Posts/Reels) e itens de lista**: fundo passa de `#1C1C1C` para `#242424` + leve `translate-x-[2px]` indicando interatividade.
- **Cards (cliente, dashboard, métricas)**: borda fica accent translúcida + sombra elevada + `scale-[1.01]`.
- **Tabs/abas**: a aba não-ativa ganha underline animado tipo `story-link` ao hover.
- **Itens da sidebar**: fundo `rgba(255,255,255,0.05)` + ícone com leve translação à direita.
- **Links de texto**: underline animado de esquerda para direita.
- **Cursor**: garantir `cursor-pointer` em tudo que for clicável (algumas divs hoje não têm).

## Onde aplicar
Vou varrer e padronizar nestes componentes:
- `Sidebar.tsx` — itens de cliente, categorias, botões de ação.
- `MobileNav.tsx` — cards de cliente e bottom nav.
- `ContentRow.tsx` — linhas de Posts/Reels (hover na linha inteira + nos ícones).
- `DetailPanel.tsx` — botões do modal, dropdown de status, ações de capa.
- `AdminDashboard.tsx` — cards de métrica, ranking, toggle.
- `MyTasks.tsx`, `MyWeekView.tsx`, `StoriesView.tsx`, `CleaningView.tsx` — cards de tarefa e botões "Marcar feito".
- `Notifications.tsx`, `MentionInput.tsx` — itens da lista.
- `Settings.tsx`, `ProfilePage.tsx`, `AvatarEditor.tsx` — botões de admin e formulário.
- `FeedPreview.tsx`, `FilesSection.tsx`, `ReelCoverEditor.tsx` — células e botões.
- `StatusBadge.tsx`, `Avatar.tsx`, `WorkloadBadge.tsx` — quando clicáveis.
- `Modals.tsx`, `QualityModal.tsx`, `AssigneePicker.tsx` — botões e opções.

## Como vou implementar (técnico)
1. Adicionar utilitários reutilizáveis em `src/styles.css`:
   - `@utility btn-hover-accent` (botão accent)
   - `@utility btn-hover-ghost` (botão fantasma)
   - `@utility icon-hover` (ícone com fundo circular ao hover)
   - `@utility row-hover` (linhas de lista)
   - `@utility card-hover` (cards)
   - Reaproveitar `.story-link` (já existe) para links de texto.
2. Aplicar essas classes nos componentes acima, substituindo hovers ad-hoc inconsistentes.
3. Garantir `cursor-pointer` e `transition` em elementos clicáveis que hoje não têm.
4. Respeitar `disabled:` (sem hover quando desabilitado) e `prefers-reduced-motion` (sem scale/translate).

## Fora do escopo
- Nenhuma alteração em lógica, dados, rotas, permissões ou layout.
- Sem trocar paleta, fontes ou componentes existentes — só adicionar a camada de feedback.
