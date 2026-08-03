-- upsertClientContact (api.functions.ts) and the contact form's "Observações"
-- field have always sent a notes value, but client_contacts was created
-- without that column — every save has been failing with a PostgREST
-- "schema cache" error.
ALTER TABLE public.client_contacts ADD COLUMN notes text NOT NULL DEFAULT '';
