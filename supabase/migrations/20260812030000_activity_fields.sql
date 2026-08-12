-- Dedicated fields for "Mais atividades" (gravação/roteiro/sistema/outros),
-- replacing the previous ad-hoc reuse of drive_link for "Local" (which
-- conflicted with the real Drive-file-link sync on that same column).
alter table content_items
  add column activity_location text,
  add column filmmaker text,
  add column activity_quantity integer;

update content_items
  set activity_location = drive_link, drive_link = ''
  where type = 'gravacao' and drive_link is not null and drive_link <> '';
