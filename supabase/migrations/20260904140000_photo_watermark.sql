-- Marca d'água por agência pra proteger as fotos da Seleção de Fotos: cada
-- agência sobe seu próprio PNG (mesmo bucket/prefixo de pasta já usado pra
-- logo — "org-logos/{orgId}/..." — então a policy de storage existente
-- (avatars_org_logo_insert/update/delete, criada em org_logo_upload.sql)
-- já cobre esse novo arquivo automaticamente, sem precisar de policy nova.

ALTER TABLE public.orgs ADD COLUMN photo_watermark_path text;
