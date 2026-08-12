-- Lets the platform admin (Luzeria) record a WhatsApp number per agency,
-- shown in the "Agências no Modo Criador" panel so they know who the
-- agency contact is and can reach out directly.
alter table public.orgs add column whatsapp text;
