-- Backfill: itens que já têm 2+ responsáveis em item_assignees mas só
-- ganharam finalização (crédito de horas/custo na margem por cliente) pra
-- um deles. Isso acontece quando um responsável foi adicionado DEPOIS do
-- item já ter sido marcado como pronto/concluído — o gatilho que credita a
-- finalização só roda no momento da transição de status, então quem entrou
-- depois nunca ficou registrado.
with target as (
  select ci.id as item_id
  from content_items ci
  where ci.status in ('PRONTO_PARA_PUBLICAR','CONCLUIDO','FINALIZADO')
),
missing as (
  select ia.item_id, ia.user_id
  from item_assignees ia
  join target t on t.item_id = ia.item_id
  where not exists (
    select 1 from finalizations f where f.item_id = ia.item_id and f.user_id = ia.user_id
  )
),
resolved as (
  select m.item_id, m.user_id,
    coalesce(
      (select f.finalized_at from finalizations f where f.item_id = m.item_id order by f.finalized_at asc limit 1),
      (select st.at from status_transitions st where st.item_id = m.item_id and st.to_status in ('PRONTO_PARA_PUBLICAR','CONCLUIDO','FINALIZADO') order by st.at desc limit 1),
      now()
    ) as finalized_at
  from missing m
)
insert into public.finalizations (user_id, item_id, finalized_at)
select user_id, item_id, finalized_at from resolved;
