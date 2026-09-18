-- Contexto extra por cliente pra alimentar a prévia de planejamento por
-- IA, além do histórico e da base de conhecimento da agência (que é
-- geral, não por cliente): texto colado (não link de Drive/pasta — mais
-- barato e previsível, e hoje não sabemos ler Google Docs nativo de
-- dentro do Drive, só PDF/.txt/.md).
ALTER TABLE public.clients ADD COLUMN content_briefing text;
ALTER TABLE public.clients ADD COLUMN recent_roteiros text;
