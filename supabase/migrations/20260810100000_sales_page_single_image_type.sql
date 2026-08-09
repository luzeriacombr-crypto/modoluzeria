-- Novo tipo de bloco "single_image": uma única imagem CONTIDA (largura
-- normal da página, com padding e cantos arredondados) — complementa o
-- image_banner (ponta a ponta) com uma variante mais discreta.
ALTER TABLE public.sales_page_blocks DROP CONSTRAINT sales_page_blocks_type_check;
ALTER TABLE public.sales_page_blocks ADD CONSTRAINT sales_page_blocks_type_check
  CHECK (type IN ('hero','bullet_list','steps','feature','gallery','text_blurb','image_banner','single_image'));
