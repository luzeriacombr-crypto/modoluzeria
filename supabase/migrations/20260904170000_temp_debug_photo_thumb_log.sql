-- Tabela de diagnóstico TEMPORÁRIA — investigando por que as fotos de uma
-- seleção específica ("Safira e Clylton", 61 fotos) não carregavam em
-- produção. Sem policy nenhuma pra anon/authenticated (só service_role
-- escreve; leitura só via SQL direto, nunca pelo app). Será removida numa
-- migração de limpeza assim que a causa real for corrigida.

CREATE TABLE public._debug_photo_thumb_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  file_id text NOT NULL,
  detail text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public._debug_photo_thumb_log TO service_role;
ALTER TABLE public._debug_photo_thumb_log ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy criada de propósito — RLS ligado + zero policies bloqueia
-- completamente anon/authenticated; só service_role (que ignora RLS) grava.
