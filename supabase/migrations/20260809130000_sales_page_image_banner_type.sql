-- Novo tipo de bloco "image_banner": uma única imagem ocupando a seção de
-- ponta a ponta na horizontal (sem texto, sem container centralizado).
ALTER TABLE public.sales_page_blocks DROP CONSTRAINT sales_page_blocks_type_check;
ALTER TABLE public.sales_page_blocks ADD CONSTRAINT sales_page_blocks_type_check
  CHECK (type IN ('hero','bullet_list','steps','feature','gallery','text_blurb','image_banner'));
