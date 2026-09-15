-- Flag por agência pra travar mutações no servidor (usado só na Views
-- Agência, a demo pública) sem afetar nenhuma agência real. Master
-- continua isento (ver assertNotDemoReadOnly em require-active.ts) pra
-- poder manter os dados da demo pelo próprio app.
ALTER TABLE public.orgs ADD COLUMN demo_read_only boolean NOT NULL DEFAULT false;
