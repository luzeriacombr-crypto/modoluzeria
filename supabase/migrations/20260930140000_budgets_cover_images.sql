-- Orçamentos: capa e contracapa deixam de ser um degradê desenhado na hora
-- (não ficou legal visualmente) e passam a ser uma imagem que a própria
-- agência sobe pronta — a capa fica com espaço em branco de propósito pra
-- o Modo Criador escrever por cima (proposta, serviço, cliente, data); a
-- contracapa já vem completa, sem nada escrito em cima.
alter table public.budgets
  add column if not exists cover_image_path text,
  add column if not exists back_cover_image_path text;
