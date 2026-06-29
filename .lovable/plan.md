
# Roadmap completo — Fases 2, 3, 4 + Relatório expandido

Vou entregar tudo em uma sequência única, agrupada por blocos coerentes. A Fase 1 (Ficha, Prazos, Bloqueado, Lead Time) já está no ar e serve de base.

---

## Bloco A — Banco de dados (uma migration)

Novas estruturas para suportar todas as fases:

- **`content_items`**: `checklist jsonb` (array de `{id, text, done}`), `rework_count int default 0`, `quality_rating smallint` (1–5, opcional), `last_status_change_at timestamptz`.
- **`status_transitions`**: log imutável de transições (`item_id`, `from_status`, `to_status`, `actor_id`, `duration_ms`, `at`). Alimenta tempo por status, lead time detalhado e retrabalho.
- **`activity_log`**: ações relevantes (`actor_id`, `entity_type`, `entity_id`, `action`, `meta jsonb`, `at`).
- **`mentions`**: `comment_id`, `mentioned_user_id`, `read_at` — dispara notificação.
- **`member_goals`**: `user_id`, `month_key`, `posts_goal`, `reels_goal`, `stories_goal` (Master define).
- **`recurring_templates`**: `client_id`, `type`, `title`, `cadence` (`weekly|monthly`), `day_of_week`/`day_of_month`, `default_assignees uuid[]`, `active boolean`.
- **`client_onboarding`**: `client_id`, checklist jsonb com itens default (briefing, acessos, paleta, tom de voz, primeira reunião), `completed_at`.

Triggers:
- `trg_status_transitions`: registra cada transição com duração desde a última.
- `trg_rework_count`: incrementa quando volta de `FINALIZADO` para qualquer outro status, ou de `APROVACAO` para `PRODUCAO`/`PLANEJAMENTO`.
- `trg_activity_log` em `content_items` (criação, mudança de prazo, atribuição).

RLS: mesma lógica das tabelas existentes — admin vê tudo, membro vê o que está atribuído ou que criou. `member_goals` e `recurring_templates` só escrita por Master. GRANTs explícitos por tabela.

Cron diário (`/api/public/hooks/recurring`): gera itens a partir de `recurring_templates` ativos para a próxima janela.

---

## Bloco B — Fase 2: Autogestão

1. **Minha Semana** (`/_authenticated/minha-semana`): nova rota acessada via sidebar (entre "Minhas Demandas" e Dashboard).
   - Cabeçalho com nome do dia + clima de produtividade (badge "Carga leve / OK / Pesada" com base em horas estimadas vs. capacidade diária = 6h).
   - Coluna por dia (Seg→Dom): cards das demandas com prazo dentro da semana, agrupados por status. Drag-and-drop entre dias (atualiza `due_date`).
   - Botão "Mover atrasados para hoje" no topo.
2. **Checklists no item** (DetailPanel): nova seção entre "Descrição" e "Drive". Adicionar/marcar/reordenar itens. Barra de progresso `done/total` ao lado do título do item na lista.
3. **Metas individuais** (visíveis para o próprio membro e para Master): widget no topo de "Minhas Demandas" com 3 barras (Posts/Reels/Stories — atual vs. meta do mês). Master configura em Configurações → Equipe → editar membro.
4. **Bloqueado em destaque**: card "🚧 Demandas bloqueadas" no topo do Dashboard e de "Minhas Demandas" quando houver — mostra título, cliente e motivo.

---

## Bloco C — Fase 3: Dados estratégicos

1. **Tempo por status** (a partir de `status_transitions`): mini-gráfico de barras na Ficha do Cliente (já existente) e por membro (no `MemberDetailPanel`). Mostra tempo médio em cada status.
2. **Retrabalho**: badge no item (ícone `RotateCcw` + número) quando `rework_count > 0`. Métrica de "Taxa de retrabalho" no Relatório.
3. **Qualidade**: ao mover para `FINALIZADO`, Master/Setor podem dar nota de 1–5 estrelas (opcional, modal não bloqueante). Média mostrada na Ficha do Cliente e no ranking.
4. **Log de atividade**: aba "Atividade" dentro do DetailPanel (timeline de mudanças). Lista colapsada por padrão.
5. **Menções `@nome`**: textarea de comentários com autocomplete; menção gera notificação e fica destacada no comentário.

---

## Bloco D — Fase 4: Escala

1. **Tarefas recorrentes**: aba "Recorrência" na Ficha do Cliente. Master cria templates (ex.: "Reels semanal toda terça"). Cron gera 1 semana à frente.
2. **Onboarding de cliente**: ao criar cliente, popular `client_onboarding` com checklist padrão. Aparece no topo da Ficha enquanto incompleto.
3. **Status "Em revisão do cliente"**: novo valor de enum (cor cinza-azulado) entre `APROVACAO` e `FINALIZADO`. Não conta como entregue até finalizar.

---

## Bloco E — Relatório expandido (Configurações → Relatório, só Master)

Reorganizar em sub-abas dentro da aba Relatório, mantendo os filtros globais (período, cliente, membro):

1. **Visão Geral** — resumo atual + cards de Lead Time médio, Taxa de Retrabalho, Qualidade Média, Tarefas Bloqueadas.
2. **Lead Time** — distribuição (histograma), top 5 mais rápidos, top 5 mais lentos, comparativo por categoria de cliente.
3. **Tempo por Status** — média de horas em cada status do pipeline; gráfico de barras horizontais.
4. **Retrabalho** — itens com `rework_count > 0`, agrupados por membro e por cliente.
5. **Qualidade** — média por membro, por cliente, distribuição das notas.
6. **Metas** — % de cumprimento das metas individuais do mês.
7. **Bloqueios** — itens atualmente bloqueados + histórico de bloqueios resolvidos (tempo médio para desbloquear).
8. **Atividade** — log filtrável (quem fez o quê e quando).

**Exportação**:
- Excel: novas abas correspondentes a cada sub-relatório.
- **PDF**: novo botão "Exportar PDF" usando `@react-pdf/renderer` (compatível com Worker). Layout A4 paisagem, capa com logo Luzeria + período, uma página por sub-relatório.

---

## Bloco F — Integrações cruzadas

- **Sidebar**: novo item "Minha Semana" (acima de "Minhas Demandas"); badge vermelho no item quando houver demandas atrasadas.
- **Notificações**: novos tipos `mention`, `due_soon` (24h antes), `blocked`, `rework`. Worker leve roda a cada 30min via cron para emitir `due_soon`.
- **MemberDetailPanel**: novas seções de Tempo por Status, Retrabalho e Qualidade.
- **Dashboard**: card extra "Saúde da operação" (Lead time médio + % retrabalho + bloqueados) abaixo dos 4 cards atuais.

---

## Detalhes técnicos

- Stack inalterado: TanStack Start + Supabase + Zustand UI store + React Query.
- Server functions novas em `src/lib/luzeria/*.functions.ts`, agrupadas por domínio (`goals.functions.ts`, `metrics.functions.ts`, `recurring.functions.ts`, `activity.functions.ts`, `mentions.functions.ts`, `quality.functions.ts`). Todas com `requireSupabaseAuth`.
- Cron jobs via `pg_cron` chamando `/api/public/hooks/recurring` e `/api/public/hooks/due-soon` (assinatura HMAC com novo secret `LUZERIA_CRON_SECRET`).
- PDF: `bun add @react-pdf/renderer` (Worker-compatível, sem binários nativos).
- Drag-and-drop em Minha Semana: `@dnd-kit/core` (puro JS, sem binários).
- Sem mudanças nas tabelas existentes além das colunas novas em `content_items`.

---

## Ordem de execução (uma sessão)

```text
1. Migration (Bloco A) → aprovação
2. Tipos + server functions + queries
3. Componentes Fase 2 (MinhaSemana, Checklist, Goals widget, BloqueadosCard)
4. Componentes Fase 3 (Atividade, Menções, Quality modal, badges retrabalho)
5. Componentes Fase 4 (Recorrência, Onboarding, novo status)
6. Relatório expandido + export PDF
7. Cron jobs + secret
8. Verificação: build + smoke test no preview
```

Vou avisar antes de mover para cada novo bloco se algo precisar de decisão sua (ex.: itens default do onboarding de cliente, capacidade diária do "clima de produtividade").
