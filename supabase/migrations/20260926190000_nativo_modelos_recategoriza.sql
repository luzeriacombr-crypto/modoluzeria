-- Nativo: recategoriza os 26 Modelos do Nativo pelo critério do Junior:
-- Aesthetic = tem emoji / é mais elaborado; Minimalista = simples, poucos
-- elementos; na dúvida, as duas. Um modelo pode ter várias categorias
-- (doc->'categories'); a categoria "Adesivo" deixa de existir.
-- Pra reverter: UPDATE ... SET doc = doc - 'categories' (volta a valer doc->>'category').

UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Manchete espalhada';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Capa editorial';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Mistura de estilos';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Frase com estrelas';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Minimalista"]'::jsonb), '{category}', '"Minimalista"') WHERE kind = 'official' AND name = 'Carrossel frase quebrada';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Balão do iMessage';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Caixa de mensagem';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Efeito de vidro';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Palavras gigantes';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Frase com sublinhado';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Título serifado com laços';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Título em arco';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Letra de mão e sans';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Letra de mão sublinhada';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Etiquetas azuis';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Peso misto com painel';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Minimalista"]'::jsonb), '{category}', '"Minimalista"') WHERE kind = 'official' AND name = 'Frase espalhada amarela';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Certo e errado';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Etiquetas e adesivo';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Letra recortada';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Título adesivo serifado';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Minimalista"]'::jsonb), '{category}', '"Minimalista"') WHERE kind = 'official' AND name = 'Duas fotos, duas frases';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Minimalista"]'::jsonb), '{category}', '"Minimalista"') WHERE kind = 'official' AND name = 'Duas fotos com peso misto';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Minimalista"]'::jsonb), '{category}', '"Minimalista"') WHERE kind = 'official' AND name = 'Três faixas em itálico';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Minimalista"]'::jsonb), '{category}', '"Minimalista"') WHERE kind = 'official' AND name = 'Quatro fotos com frase';
UPDATE public.nativo_projects SET doc = jsonb_set(jsonb_set(doc, '{categories}', '["Aesthetic", "Minimalista"]'::jsonb), '{category}', '"Aesthetic"') WHERE kind = 'official' AND name = 'Etiquetas coloridas';
