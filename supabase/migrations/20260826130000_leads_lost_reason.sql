-- Motivo do "perdido" — mostrado no board pra entender padrões de perda
-- (preço, timing, concorrência etc.), preenchido na hora de marcar o
-- lead como perdido.
alter table public.leads
  add column if not exists lost_reason text;
