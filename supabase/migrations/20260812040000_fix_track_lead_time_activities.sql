-- track_lead_time() only stamped finished_at on PRONTO_PARA_PUBLICAR/FINALIZADO,
-- and started_at only on leaving PLANEJAMENTO — activities (gravação/roteiro/
-- sistema/outros) use a separate PENDENTE→CONCLUIDO pipeline that never
-- passes through those statuses, so marking an activity "Concluído" never
-- stamped finished_at, making it look perpetually unfinished in every report
-- that reads finished_at/status together.
create or replace function track_lead_time()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    if (old.status = 'PLANEJAMENTO' or old.status = 'PENDENTE')
       and new.status not in ('PLANEJAMENTO', 'PENDENTE')
       and new.started_at is null then
      new.started_at := now();
    end if;
    if new.status in ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO')
       and old.status not in ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO') then
      new.finished_at := now();
    end if;
    if old.status in ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO')
       and new.status not in ('PRONTO_PARA_PUBLICAR', 'FINALIZADO', 'CONCLUIDO') then
      new.finished_at := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

-- Backfill: activities already marked Concluído before this fix never got
-- finished_at stamped — set it from the last known status-change timestamp
-- so historical reports aren't permanently missing this data.
update content_items
  set finished_at = coalesce(last_status_change_at, updated_at)
  where status = 'CONCLUIDO' and finished_at is null;
