-- Marca d'água com padrão de texto embutido (listras diagonais repetindo
-- um texto customizável), como alternativa a subir um PNG próprio.
-- 'mode' escolhe qual das duas (ou nenhuma) vale pra essa org.

ALTER TABLE public.orgs
  ADD COLUMN photo_watermark_mode text NOT NULL DEFAULT 'none'
    CHECK (photo_watermark_mode IN ('none', 'text', 'image'));

ALTER TABLE public.orgs ADD COLUMN photo_watermark_text text;

ALTER TABLE public.orgs
  ADD COLUMN photo_watermark_opacity integer NOT NULL DEFAULT 35
    CHECK (photo_watermark_opacity BETWEEN 5 AND 90);

ALTER TABLE public.orgs
  ADD COLUMN photo_watermark_density text NOT NULL DEFAULT 'media'
    CHECK (photo_watermark_density IN ('baixa', 'media', 'alta'));

-- Quem já tinha subido um PNG (photo_watermark_path preenchido) antes dessa
-- migração continua funcionando: liga automaticamente o modo 'image'.
UPDATE public.orgs SET photo_watermark_mode = 'image' WHERE photo_watermark_path IS NOT NULL;
