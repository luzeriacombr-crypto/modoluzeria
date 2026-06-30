Ajuste no título "Coisas para fazer" em Minhas Demandas para não quebrar em duas linhas.

## O que será feito
- Em `src/components/luzeria/MyTasks.tsx`, o título principal `Coisas para fazer` ganhará `whitespace-nowrap` para forçar uma única linha.
- Ajustaremos o tamanho da fonte no mobile (ex: `text-[24px] sm:text-[32px]`) para garantir que o texto não estoure o container em telas estreitas, mantendo a aparência atual no desktop.

## Arquivo alterado
- `src/components/luzeria/MyTasks.tsx`

## Verificação
- Visualização no preview em resolução mobile para confirmar que o título permanece em uma única linha.