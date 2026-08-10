-- Bug real reportado pelo Junior: Amaro (Luzeria) recebendo notificação push
-- de aprovação de item de OUTRA agência ("QUINTA - HAPPY HOUR COLISEU",
-- cliente da ORIM Marketing & Conteúdo).
--
-- Causa raiz: o trigger legado auto_assign_on_status() (migration
-- 20260723150000) tem os UUIDs do Amaro e da Jordânia HARDCODED e roda em
-- TODO content_items de TODA agência ao entrar em CRIACAO/REVISAO_ARTE/
-- REVISAO_INTERNA — sem nenhuma checagem de org_id. Sendo SECURITY DEFINER,
-- ele também ignora a policy de item_assignees corrigida na migration
-- 20260805120000 (que só protege o INSERT feito pelo app, não por trigger).
--
-- Esse comportamento já tinha sido generalizado pra automation_rules
-- (migration 20260801200000, comentário linha 3: "Generalizes the existing
-- hardcoded auto_assign_on_status() trigger... into a per-org rules table")
-- e a Luzeria já tem as 4 regras equivalentes cadastradas em
-- automation_rules (Amaro em CRIACAO, Jordânia em REVISAO_ARTE/
-- REVISAO_INTERNA/PRONTO_PARA_PUBLICAR) — ou seja, o trigger antigo ficou
-- pra trás, nunca foi removido, e desde então ficou re-vazando: toda vez que
-- QUALQUER agência move um post/reel pra Criação de arte ou Revisão, o
-- Amaro e/ou a Jordânia são inseridos em item_assignees (e o Amaro também
-- vira editor_id) daquele item, de outra agência.
--
-- Fix: remove o trigger/função legados (comportamento já coberto por
-- automation_rules pra Luzeria) e limpa os registros já vazados.

DROP TRIGGER IF EXISTS trg_auto_assign_on_status ON public.content_items;
DROP FUNCTION IF EXISTS public.auto_assign_on_status();

-- Limpeza: remove atribuições vazadas do Amaro/Jordânia em itens de
-- agências diferentes da Luzeria.
DELETE FROM public.item_assignees ia
USING public.content_items ci
WHERE ia.item_id = ci.id
  AND ia.user_id IN ('c6d74db9-ab7b-4002-89c7-02d5fa5cb662', 'afd35d3a-b41c-4c78-8085-d9ff0fa9e96a')
  AND ci.org_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';

-- Limpeza: desfaz o editor_id vazado (o trigger também escrevia direto
-- nessa coluna, fora do item_assignees).
UPDATE public.content_items
SET editor_id = NULL
WHERE editor_id = 'c6d74db9-ab7b-4002-89c7-02d5fa5cb662'
  AND org_id IS DISTINCT FROM '00000000-0000-0000-0000-000000000001';
