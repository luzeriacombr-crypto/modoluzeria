## Diagnóstico

O backend de metas (`member_goals`, `setGoals`, `listGoals`, `getGoalProgress`) já existe e o `GoalsWidget` já renderiza o progresso em "Minhas Demandas" — **mas não há nenhuma interface para o Adm Master cadastrar a meta de cada membro**. Por isso a meta nunca aparece para o colaborador: o widget só renderiza quando há valores > 0 no banco, e hoje a tabela está vazia.

Além disso, quando não há meta, o membro não recebe nenhum sinal — ele simplesmente não vê o card.

## O que vou implementar

### 1. Aba "Metas" em Configurações (somente Adm Master)
Nova aba em `Settings.tsx` ao lado de "Relatório":
- Seletor de **mês** (default: mês atual, formato `YYYY-MM`).
- Tabela com **todos os membros ativos**, uma linha por pessoa:
  - Avatar + nome
  - 3 inputs numéricos: **Posts**, **Reels**, **Stories**
  - Botão "Salvar" por linha (ou salvar tudo no final)
- Pré-preenche com a meta atual do mês selecionado (se existir).
- Botão "Copiar metas do mês anterior" para acelerar o setup recorrente.
- Usa as server functions já existentes (`listGoals`, `setGoals`).

### 2. Feedback no widget "Minhas Demandas" quando não há meta
No `GoalsWidget.tsx`, em vez de retornar `null` quando todas as metas são 0, mostrar um estado vazio discreto:
- Texto pequeno: *"Seu adm ainda não definiu suas metas do mês."*
- Para Adm Master: link "Definir metas" que abre a nova aba em Configurações.

### 3. Mini-card de meta no Dashboard pessoal (opcional, leve)
Logo abaixo do hero de "Minhas Demandas", mostrar uma linha resumida:
*"Meta de Junho: 12 Posts · 8 Reels · 4 Stories"* — para reforçar visibilidade mesmo antes de bater o olho no widget.

## Considerações técnicas
- Nenhuma mudança de schema — `member_goals` já tem `user_id`, `month_key`, `posts_goal`, `reels_goal`, `stories_goal`.
- Permissões: a aba e o botão de salvar ficam atrás de `is_master(auth.uid())` no frontend; o RLS de `member_goals` já garante no backend.
- Sem alterações no AppTour por enquanto (posso adicionar um passo "Suas metas aparecem aqui" depois, se quiser).

## Outras coisas que notei faltando (sinalizo, não vou implementar agora sem seu OK)
- **Notificação automática** quando o membro está atrasado na meta (< 70% do esperado para o dia) — hoje só pinta laranja no ring, mas não avisa.
- **Histórico de metas batidas** no painel do membro (`MemberDetailPanel`) — mostraria meses anteriores e taxa de conclusão.
- **Meta padrão por papel** (ex.: todo membro novo começa com 10 posts) para evitar configurar do zero todo mês.

Quer que eu já inclua algum desses três no mesmo plano?