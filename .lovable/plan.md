Vou fechar **Autogestão**, **Rastreabilidade** e **Automação** em uma rodada só. Sem mexer no que já existe.

## 1. Autogestão do membro

**Minha Semana** (nova rota dentro de "Minhas Demandas", como aba)
- Kanban horizontal por dia da semana (Seg → Dom), coluna de "Atrasados" no início
- Cada card: cliente (badge colorido) · título · tipo · status · ícone de prazo
- Drag opcional pra trocar `due_date` (clique direito → "Mover para…")
- Filtro: só meus itens (default), todos do setor (admin)

**Metas individuais**
- Aba "Metas" na página de Perfil — membro define meta mensal por tipo (Posts, Reels, Stories, Outros)
- Master pode definir/editar meta de qualquer um pela aba Equipe
- Widget no topo de "Minhas Demandas": ring de progresso por tipo com cor #C8D44E quando ≥ meta, #FF8C42 quando < 70 % do esperado pro dia do mês

**Carga de trabalho**
- No Ranking do Dashboard e no `MemberDetailPanel`: barrinha "Em aberto agora: N itens" com cor de aviso quando > 8
- Tooltip lista os 3 mais antigos em aberto

## 2. Rastreabilidade

**Timeline de atividade por item**
- Nova seção colapsável no `DetailPanel`: "Histórico" — lê `activity_log` + `status_transitions` + `comments` mesclados por data
- Linha tipo: avatar · "trocou status PLANEJAMENTO → CRIACAO" · "há 2 h"
- Inclui criações, mudanças de prazo, ratings, retrabalho, comentários do sistema

**Menções @nome em comentários**
- Input de comentário com autocomplete `@` (lista membros ativos)
- Ao salvar: parse `@uuid` → insere em `mentions` + cria notificação "Você foi mencionado em [item]"
- Render do comentário destaca menções em #C8D44E

**Notificações de prazo**
- Job diário às 8 h que varre `content_items` com `due_date` entre hoje e amanhã e status ≠ FINALIZADO
- Cria notificação pra cada `item_assignees`: "Vence hoje" / "Vence amanhã" / "Atrasado"
- Anti-spam: tabela `deadline_notifications_log (item_id, kind, sent_on date)` única por dia

## 3. Automação

**Cron real semanal de recorrências**
- Job toda segunda 6 h chama `generateRecurring` pra cada cliente com template ativo
- Reusa lógica que já existe no botão manual
- Server route `/api/public/hooks/recurring-weekly` valida `apikey`

**Avaliação de qualidade obrigatória ao finalizar**
- Quando admin troca status pra FINALIZADO sem `quality_rating` definido: abre modal "Avalie esta entrega" antes de fechar
- Membro comum (não-admin) continua não vendo o campo — só admin avalia
- Configurável: toggle "Exigir avaliação ao finalizar" em Configurações (default ligado)

---

## Detalhes técnicos

**Migrations**
- Nova tabela `deadline_notifications_log (item_id uuid, kind text, sent_on date, unique(item_id, kind, sent_on))` + GRANT/RLS (só service_role escreve, admin lê)
- Nova coluna `clients.weekly_target_posts`, `weekly_target_reels` (opcional, futuro)
- Settings flag: usar tabela `app_settings (key, value jsonb)` ou row única em `cleaning_settings` — vou criar `app_settings` dedicada

**Server functions novas** (em `src/lib/luzeria/roadmap.functions.ts`)
- `getMyWeek({ from, to })` → itens do user agrupados por dia
- `getMyGoalsProgress(monthKey)` → meta vs entregue por tipo
- `getItemTimeline(itemId)` → merge de activity_log + status_transitions + comments ordenado desc
- `createMention({ itemId, commentId, mentionedUserIds })` — chama dentro do save de comment
- `getAppSettings()` / `updateAppSettings()` (master only)

**Server routes (cron)**
- `/api/public/hooks/deadline-reminders` (diário 8h)
- `/api/public/hooks/recurring-weekly` (segundas 6h)
- Ambos validam `apikey` header com `SUPABASE_PUBLISHABLE_KEY`
- pg_cron + pg_net (já habilitados — verifico antes)

**UI nova**
- `src/components/luzeria/MyWeekView.tsx` — kanban por dia
- `src/components/luzeria/GoalsWidget.tsx` — ring de progresso no header de Minhas Demandas
- `src/components/luzeria/GoalsEditor.tsx` — usado em Perfil e em MemberDetailPanel
- `src/components/luzeria/ItemTimeline.tsx` — colapsável no DetailPanel
- `src/components/luzeria/MentionInput.tsx` — textarea com autocomplete @
- `src/components/luzeria/QualityModal.tsx` — disparado no finalizar
- `src/components/luzeria/WorkloadBadge.tsx` — usado no ranking e no MemberDetailPanel

**Mudanças em arquivos existentes**
- `DetailPanel.tsx`: troca `<textarea>` de comentário pelo `MentionInput`, adiciona seção Timeline, intercepta troca de status pra FINALIZADO pra abrir QualityModal quando flag ligada
- `MinhasView` (ou equiv.): adiciona tab "Hoje | Minha Semana", insere `GoalsWidget` no topo
- `ProfilePage.tsx`: adiciona aba "Metas"
- `Settings.tsx`: nova seção "Geral" com toggle "Exigir avaliação ao finalizar" (só Master)
- `AdminDashboard.tsx` ranking + `MemberDetailPanel.tsx`: insere `WorkloadBadge`

**Não toco em:** Dashboard hero, sidebar, MobileNav, fluxo de Auth, Stories, Limpeza, Drive link workaround, qualquer integração externa.

---

## Ordem de execução

1. Migration (`deadline_notifications_log`, `app_settings`) + GRANT/RLS
2. Server functions e server routes novas
3. UI: `GoalsWidget` + `GoalsEditor` + `MyWeekView` + tab em Minhas Demandas
4. UI: `ItemTimeline` + `MentionInput` no `DetailPanel`
5. UI: `QualityModal` + toggle em Settings + intercept no DetailPanel
6. UI: `WorkloadBadge` no ranking e MemberDetailPanel
7. Cron SQL (pg_cron schedule pros 2 endpoints) — passo final via insert tool
8. Typecheck e smoke test

Estima 1 rodada longa. Posso seguir?