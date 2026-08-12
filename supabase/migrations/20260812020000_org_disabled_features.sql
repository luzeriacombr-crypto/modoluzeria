-- Lets each agency hide features they don't use (post formats, WhatsApp
-- reminders, Rotina, Calendário, Instagram, Stories, Drive) from their own
-- team, without affecting other agencies or deleting any underlying data.
alter table orgs add column disabled_features text[] not null default '{}';
