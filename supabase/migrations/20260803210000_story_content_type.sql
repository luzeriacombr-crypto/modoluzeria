-- Stories become real content_items (like Post/Reel: briefing, publish
-- date, file upload, assignee, status pipeline) instead of the lightweight
-- stories_schedule calendar. Also lets each client opt in/out of having
-- their Stories show up in assignees' "Minhas Demandas" list.
ALTER TYPE public.content_type ADD VALUE IF NOT EXISTS 'story';

ALTER TABLE public.clients ADD COLUMN notify_stories_in_tasks boolean NOT NULL DEFAULT false;
