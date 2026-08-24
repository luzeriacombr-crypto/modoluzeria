-- Adiciona o cargo "Designer" (sem permissões especiais, igual Editor/
-- Videomaker/Redator(a)) pra toda agência que já existe — NOT EXISTS pra
-- não duplicar se essa agência já tiver criado/renomeado um cargo com esse
-- nome. Agências novas já ganham via DEFAULT_CARGOS (cargos.functions.ts).
INSERT INTO public.cargos (org_id, name, permissions)
SELECT o.id, 'Designer', ARRAY[]::text[]
FROM public.orgs o
WHERE NOT EXISTS (
  SELECT 1 FROM public.cargos c WHERE c.org_id = o.id AND c.name = 'Designer'
);
