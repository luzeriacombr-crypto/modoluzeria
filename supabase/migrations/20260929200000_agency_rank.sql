-- Selo "Agência Top N" — ranking entre TODAS as agências do Modo Criador
-- pela mesma pontuação do Programa de Níveis (computeAgencyPoints).
-- Calculado 1x por dia por um cron externo (mesmo padrão de
-- retention-cleanup), gravado aqui e lido por cada org via a RLS que já
-- existe ("read own org": id = current_org_id()) — nenhuma policy nova
-- necessária, e nenhuma query cross-org acontece na leitura, só no cron.
alter table orgs
  add column if not exists agency_rank integer,
  add column if not exists agency_rank_points integer,
  add column if not exists agency_rank_streak_days integer not null default 0,
  add column if not exists agency_rank_computed_at timestamptz;

comment on column orgs.agency_rank is 'Posição (1 = melhor) no ranking de pontos entre agências elegíveis (exclui revenda/revendidas e demo). Null = fora do ranking ou nunca calculado.';
comment on column orgs.agency_rank_points is 'Pontuação usada pro cálculo do agency_rank nesse dia (mesma fórmula de computeAgencyPoints).';
comment on column orgs.agency_rank_streak_days is 'Dias corridos seguidos com agency_rank <= 20 (zera assim que sai do Top 20).';
comment on column orgs.agency_rank_computed_at is 'Quando o cron calculou esses valores pela última vez.';
