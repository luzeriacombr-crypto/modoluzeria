-- Separa "o que está editando" de "o que está no ar": edições de texto/
-- imagem passam a gravar aqui em vez de direto em `content`, e só viram
-- públicas quando o master clica em "Publicar" (copia draft_content ->
-- content). Reordenar, ocultar/mostrar e criar/remover seção continuam
-- imediatos — só o conteúdo (texto/imagem) passa pelo rascunho.
ALTER TABLE public.sales_page_blocks ADD COLUMN draft_content jsonb;
