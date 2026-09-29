-- Guarda qual acesso ao Google Drive cada agência autorizou.
-- NULL = conexão antiga, feita com acesso completo ao Drive (`auth/drive`) —
-- continua valendo normalmente, ninguém precisa reconectar.
-- Conexões novas pedem só `drive.file` (o app enxerga apenas o que ele mesmo
-- criou ou o que a pessoa escolher na janela do Google), que não mostra o
-- aviso de "app não verificado". O app usa essa coluna pra trocar "colar
-- link do Drive" pelo botão "Escolher do Drive" só nessas agências.

ALTER TABLE public.org_google_credentials ADD COLUMN scope text;

-- Pra reverter (DOWN), rodar:
--   ALTER TABLE public.org_google_credentials DROP COLUMN IF EXISTS scope;
