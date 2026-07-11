-- Google Calendar integration was cancelled before rollout. Drop the unused
-- table rather than leave dead schema holding credential-shaped columns
-- (refresh_token, access_token) around.
DROP TABLE IF EXISTS public.user_calendar_tokens;
