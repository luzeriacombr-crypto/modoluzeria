-- The app code (listClients, updateClient in api.functions.ts) already reads/writes
-- clients.photo_url, but the column was never actually created in production.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS photo_url text;
