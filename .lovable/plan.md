Pelo que encontrei, o “Prazo” funciona porque usa o campo antigo `due_date`, que já existe há mais tempo e é uma data simples. A “Data de publicação” usa um campo novo, `scheduled_at`, com data e hora. No backend atual da prévia, esse campo existe e o último teste salvou com sucesso: o item ficou com `scheduled_at = 2026-07-15 01:37:00+00`.

O problema provável é um destes dois pontos:

1. A tela/domínio onde você está testando ainda está usando uma versão antiga do app ou do backend onde `scheduled_at` não existia.
2. A data está salvando, mas a tela não atualiza corretamente o item aberto depois do salvamento, porque o estado local do modal só é reiniciado quando troca de item, não quando o mesmo item recebe novos dados.

Plano de correção:

1. Verificar o fluxo exato do campo “Data de publicação” no modal de item.
2. Ajustar o salvamento para tratar `scheduled_at` de forma tão direta quanto `due_date`, evitando divergência entre o valor local e o valor salvo.
3. Garantir que, após salvar ou limpar a data de publicação, o cache do mês/item seja atualizado e o modal reflita o valor salvo sem depender de fechar e abrir.
4. Confirmar que a migração que adiciona `scheduled_at` está presente no backend usado pela versão publicada, não apenas na prévia.
5. Validar o fluxo: selecionar data de publicação, salvar, recarregar a tela e conferir se a data continua aparecendo no item e no preview do cliente.