## Objetivo
Em **Coisas para fazer**, cada tarefa passa a mostrar o prazo de entrega e um indicador de urgência por cor, para o membro saber de relance o que está no tranquilo, o que está chegando e o que precisa virar hoje.

## Regras de cor (baseadas em `due_date`)
Calculadas a partir da diferença em dias entre hoje e a data de entrega:

| Faixa | Rótulo | Cor | Quando |
|---|---|---|---|
| 🔴 Urgente | "Atrasado" / "Vence hoje" / "Vence amanhã" | `#FF4444` | dias restantes ≤ 1 (ou já passou) |
| 🟡 Próximo | "Em X dias" | `#F5A623` | 2 a 3 dias restantes |
| 🟢 Tranquilo | "Em X dias" ou data curta | `#C8D44E` | 4 dias ou mais |
| ⚪ Sem prazo | "Sem prazo" | `rgba(255,255,255,0.3)` | `due_date` nulo |

Tarefas já com status **FINALIZADO** não recebem badge de urgência (continuam neutras).

## Onde aparece
1. **Lista agrupada por status** em `src/components/luzeria/MyTasks.tsx` — adicionar à direita de cada linha uma pílula compacta com ícone de relógio + texto curto ("Vence hoje", "Em 3 dias", "Atrasado 2d", "Sem prazo") usando a cor da faixa.
2. **Minha Semana** (`MyWeekView.tsx`) — pequeno ponto colorido no canto do card seguindo a mesma lógica (sem texto, só o dot, para não poluir o card).

## Ordenação
Dentro de cada bloco de status na lista, ordenar por `due_date` ascendente (sem prazo vai para o fim). Mantém o agrupamento por status como está hoje.

## Mudanças técnicas

```text
src/lib/luzeria/api.functions.ts
  └─ listMyTasks: incluir `due_date` no SELECT e no objeto retornado (dueDate)

src/components/luzeria/MyTasks.tsx
  ├─ helper local `deadlineInfo(dueDate, status)` → { label, color, days }
  ├─ pílula renderizada à direita do título de cada tarefa
  └─ sort por dueDate dentro de cada grupo de status

src/components/luzeria/MyWeekView.tsx
  └─ dot colorido no card usando o mesmo helper (extrair helper p/ utils se ficar duplicado)
```

Nenhuma alteração de schema — `content_items.due_date` já existe e já é gravado pelo `DetailPanel`. Apenas leitura adicional + UI.

## O que NÃO entra
- Edição de prazo nesta tela (continua sendo no painel de detalhe).
- Notificações — já existem via cron `send_deadline_reminders`.
- Filtros por urgência (posso adicionar depois se quiser).
