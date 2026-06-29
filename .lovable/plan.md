
## Objetivo

Adicionar controle de execução nas escalas de **Limpeza** e **Stories**:
- Cada responsável vê um botão para marcar **Feito** ou **Pendente**.
- Se o dia passar e ninguém marcar Feito, o sistema marca automaticamente **Não feito** (vermelho).
- Status visível para todos; quem alterou e quando ficam registrados.

---

## Como vai aparecer

### Stories (calendário do mês)
Em cada dia com responsável, no canto inferior do card aparece um selo de status:
- ⚪ **Pendente** (default) — cinza
- 🟢 **Feito** — verde `#C8D44E`
- 🔴 **Não feito** — vermelho `#FF4444` (aplicado automaticamente após o dia)

Clicar no card abre o picker do responsável (como hoje). Se você for o responsável (ou Master), aparece também um mini-toggle **Feito / Pendente** dentro do picker — ou direto no card via menu de contexto.

Também em **Minhas Demandas → bloco "Hoje é seu dia de Stories"**: ganha botão "Marcar como feito" / "Desfazer".

### Limpeza (tabela semanal)
Cada célula com responsável ganha um pequeno indicador de status à direita (mesmo código de cor). Como a tabela é semanal recorrente, o status é por **ocorrência da semana atual** (segunda → domingo).

No bloco **"Tarefas de limpeza hoje"** em Minhas Demandas: cada item da lista vira uma linha com checkbox **Feito** ao lado.

Filtro visual: na visão "Limpeza" mostra status da semana corrente. Setas de "semana anterior / próxima" para Master consultar histórico (opcional, fora do MVP — apenas semana atual primeiro).

---

## Regras de negócio

- **Quem pode marcar Feito/Pendente:** o responsável da célula/dia, ou Master/Setor.
- **Não feito é automático:** só é setado pelo sistema, ninguém marca manualmente. Se voltar a marcar Feito num dia anterior, sobrescreve "Não feito".
- **Auto-marcação:** um job diário às 23:59 BRT varre Stories de ontem e Limpeza de ontem (por dia da semana correspondente) e marca como Não feito tudo que ainda estiver Pendente.
- **Histórico:** registra `done_at` e `done_by` (quem marcou) para aparecer no relatório.

---

## Detalhes técnicos

### Banco (migração)

**Stories** — adicionar colunas em `stories_schedule`:
- `status` text default 'pending' check in ('pending','done','missed')
- `done_at` timestamptz null
- `done_by` uuid null

**Limpeza** — nova tabela `cleaning_log` (status por ocorrência de semana, já que `cleaning_schedule` é template recorrente):
```text
cleaning_log
  id uuid pk
  task_idx int
  weekday int            -- 0..5 (Seg..Sáb)
  occurrence_date date   -- data real daquela ocorrência (chave única com task_idx+weekday)
  user_id uuid null      -- snapshot do responsável escalado
  status text            -- 'done' | 'missed'
  done_at timestamptz
  done_by uuid
  UNIQUE(task_idx, weekday, occurrence_date)
```
Status "pending" é implícito (sem linha).

**RLS:** leitura para todos os autenticados; insert/update pelo responsável OU admin.

**GRANTs** padrão para `authenticated` e `service_role`.

### Job automático (pg_cron)
Novo cron diário às **02:59 UTC** (≈ 23:59 BRT):
- Stories: `UPDATE stories_schedule SET status='missed' WHERE day < CURRENT_DATE AND status='pending' AND user_id IS NOT NULL`
- Limpeza: para cada `cleaning_schedule` ativa de `weekday = (ontem)`, se não existir `cleaning_log` da data de ontem → INSERT com `status='missed'`.

### Server functions (em `src/lib/luzeria/api.functions.ts`)
- `setStoryDone({ day, done: boolean })`
- `setCleaningDone({ taskIdx, weekday, occurrenceDate, done: boolean })`
- Query existente `cleaningQO` / `storiesQO` passa a retornar o status.

### Frontend
- `StoriesView.tsx`: selo de status na célula + ação no picker.
- `CleaningView.tsx`: bolinha de status na célula (semana corrente).
- `MyTasks.tsx`: botões "Marcar como feito" nos blocos "Hoje é seu dia de Stories" e "Tarefas de limpeza hoje".
- Sem mudanças em tipos públicos quebradoras — apenas extensão.

### Relatório (Configurações → Relatório)
Aba existente ganha contadores rápidos no rodapé: "Stories no mês: X feitos / Y não feitos" e o mesmo para Limpeza. (Implementação leve; expandir depois se quiser.)

---

## Pergunta antes de implementar

Para **Limpeza**, o auto "Não feito" deve considerar:
- (a) **Só dias úteis Seg–Sáb** (CLEANING_DAYS atual, ignora domingo), OU
- (b) **Todos os dias** que tenham escala marcada para aquele dia da semana?

Se você não responder, sigo com **(a)** que é o comportamento mais alinhado à escala atual.
