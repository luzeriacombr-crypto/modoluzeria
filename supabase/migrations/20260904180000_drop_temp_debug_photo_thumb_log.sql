-- Limpeza: a causa raiz do bug (checagem de `parents` por arquivo
-- individual não confiável) já foi identificada e corrigida em
-- getPublicPhotoThumbnails — a tabela de diagnóstico temporária não é mais
-- necessária.
DROP TABLE IF EXISTS public._debug_photo_thumb_log;
