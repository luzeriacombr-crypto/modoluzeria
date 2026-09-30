-- Notificação única "Precisa de ajuda? Visite nossos tutoriais" pra agências
-- novas ou com pouca atividade ainda (ver runTutorialNudge em
-- activation.functions.ts, rodando junto no cron diário de activation-nudges).
ALTER TABLE public.orgs ADD COLUMN tutorial_nudge_sent_at timestamptz;
