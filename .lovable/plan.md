## Objetivo

Aplicar a nova nomenclatura e ordem do pipeline de status solicitada:

1. **Planejamento** → rascunho/ideia em discussão.
2. **Copy** → redação sendo escrita.
3. **Posts** → Criação de arte → Revisão de arte.
4. **Reels** → Em gravação → Em edição.
5. **Revisão interna** → alguém da equipe revisa.
6. **Revisão cliente** → cliente aprova ou pede ajustes.
7. **Agendamento** → peça pronta, falta programar.
8. **Revisão agendamento** → última checada antes de publicar.
9. **Travado / Bloqueado** → impedimento (não entrega métricas).
10. **Pronto para publicar** → publicado/entregue (registra hora de entrega e nota de qualidade).

O usuário confirmou:
- "Pronto para publicar" **substitui** o atual "Finalizado".
- Deve-se alterar **rótulos e chaves internas** (não só labels visíveis).

---

## Mapeamento de mudanças

| Atual (chave) | Novo (chave) | Novo label visível |
| --- | --- | --- |
| `FINALIZADO` | `PRONTO_PARA_PUBLICAR` | "Pronto para publicar" |
| `BLOQUEADO` | `TRAVADO` | "Travado" |

A ordem geral já está próxima do desejado; o ajuste principal é garantir que os status específicos de Posts e Reels apareçam **após Copy e antes de Revisão interna**, e que os nomes finais reflitam a nova nomenclatura em todos os dropdowns, filtros, badges e relatórios.

---

## 1. Banco de dados (migração)

- Renomear os valores do enum `public.content_status`:
  - `'FINALIZADO'` → `'PRONTO_PARA_PUBLICAR'`
  - `'BLOQUEADO'` → `'TRAVADO'`
- Atualizar todas as linhas de `public.content_items.status` que ainda usam os valores antigos.
- Verificar se há dados históricos em `public.status_transitions` (texto livre). Decisão: manter os valores antigos no histórico ou fazer backfill? (Sugestão: manter histórico como está, já que é uma transição real; o app passa a gravar apenas os novos valores.)
- Atualizar as funções/triggers que hardcodam os valores antigos:
  - `public.track_lead_time()` (verifica `FINALIZADO` para setar `finished_at`)
  - `public.track_status_transition()` (verifica `FINALIZADO` e `REVISAO%` para rework)
  - `public.record_finalizations()` (insere em `finalizations` ao virar `FINALIZADO`)
  - `public.on_status_change()` (mensagens de notificação)
  - `public.send_daily_digest()` (conta demandas não finalizadas)
  - `public.send_deadline_reminders()` (exclui status finalizado)
- Garantir que nenhuma outra função ou view referencie `'FINALIZADO'` ou `'BLOQUEADO'`.

---

## 2. Tipos e constantes (frontend)

- `src/lib/luzeria/types.ts`
  - Substituir o tipo `Status` para refletir as novas chaves.
  - Atualizar `STATUS_META`, `STATUS_ORDER`, `GLOBAL_STATUS_ORDER`, `POST_EXTRA_STATUS`, `REEL_EXTRA_STATUS` e a função `statusOptionsFor()`.
- `src/components/luzeria/icons.tsx`
  - Atualizar o mapa `STATUS_ICONS` para usar as novas chaves.
- `src/integrations/supabase/types.ts`
  - Atualizar o enum gerado do Supabase para incluir `PRONTO_PARA_PUBLICAR` e `TRAVADO` e remover `FINALIZADO`/`BLOQUEADO`.

---

## 3. Lógica de negócio e UI

Buscar e atualizar todas as referências literais nos arquivos `.ts` e `.tsx`:

- `src/lib/luzeria/api.functions.ts` — contagens de finalizados, filtros de dashboard, meta de mês, ranking de membros, geração de itens recorrentes, etc.
- `src/lib/luzeria/roadmap.functions.ts` — lead time, kanban "Minha Semana", estatísticas por status.
- `src/components/luzeria/DetailPanel.tsx` — condição de exibir nota de qualidade, botão de finalizar, status bloqueado, etc.
- `src/components/luzeria/ContentRow.tsx` — exibição de prazo e status.
- `src/lib/luzeria/utils.ts` — função utilitária que verifica status finalizado.
- Dashboards, relatórios, filtros de "Minhas Demandas" e todos os badges/dropdowns.

Em todos os pontos, garantir que o comportamento anterior seja preservado:
- `PRONTO_PARA_PUBLICAR` continua registrando `finished_at` e nota de qualidade.
- `TRAVADO` continua exigindo motivo e não entrega métricas.
- Itens que saem de `PRONTO_PARA_PUBLICAR` voltam para o pipeline e incrementam `rework_count`.

---

## 4. Validação

- Rodar typecheck (`bunx tsc --noEmit` / `tsgo`) para garantir que nenhuma referência antiga sobreviveu.
- Verificar se a migração de banco aplica sem erros.
- Testar fluxos críticos:
  - Criar item novo → status padrão `PLANEJAMENTO`.
  - Mover item até `PRONTO_PARA_PUBLICAR` → `finished_at` e `finalizations` registrados.
  - Mover item para `TRAVADO` → motivo obrigatório e sem impacto em métricas de entrega.
  - Reabrir item de `PRONTO_PARA_PUBLICAR` → `rework_count` incrementa e `finished_at` limpo.

---

## 5. Não incluído nesta mudança

- Não alterar permissões de quem pode mover cada status (o usuário só pediu a lógica/nomenclatura).
- Não alterar o visual dos badges além dos labels/cores necessários.
- Não criar novos status intermediários (ex.: entre "Revisão agendamento" e "Pronto para publicar").

---

## Nota técnica

O enum do banco possui um valor residual `"START"` que não existe no frontend. Sugestão: aproveitar a migração para removê-lo do enum, já que não é usado no app e pode causar confusão futura. Caso contrário, ele pode ser ignorado — ele não aparece nas listagens atuais.