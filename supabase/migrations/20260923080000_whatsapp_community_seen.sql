-- Popup avisando sobre o grupo de WhatsApp da comunidade — só master vê, e
-- só uma vez (marca aqui quando fecha ou entra, nunca mais aparece).
ALTER TABLE public.profiles ADD COLUMN whatsapp_community_seen_at timestamptz;
