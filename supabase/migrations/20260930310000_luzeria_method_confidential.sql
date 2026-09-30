-- Método Luzeria confidencial: as Houses USAM a base de conhecimento modelo
-- (a IA lê direto de knowledge_templates, ver luzeria-method.server.ts), mas
-- não veem nem editam o conteúdo. Desfaz a cópia aberta feita antes
-- (20260930300000): os documentos "· desenvolvido por Luzeria" saem da base
-- das Houses, e a função de cópia deixa de existir.

DELETE FROM public.org_content_knowledge k
 USING public.orgs o
 WHERE o.id = k.org_id AND o.account_type = 'house'
   AND k.title IN (SELECT title FROM public.knowledge_templates);

DROP FUNCTION IF EXISTS public.copy_knowledge_template(uuid);

-- Leitura só pela Luzeria (a política FOR ALL já restringe); sem SELECT
-- direto pra ninguém mais, nem por engano.
REVOKE SELECT ON public.knowledge_templates FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_templates TO authenticated;
