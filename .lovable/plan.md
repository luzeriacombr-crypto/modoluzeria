## Diagnóstico

O preview (id-preview--...lovable.app) roda sempre a última versão do código. Já o site publicado (lzrmode.lovable.app) só é atualizado quando você clica em **Publicar/Atualizar**. Como a correção do campo "Data de publicação" foi feita depois da última publicação, o site em produção ainda está com a versão antiga — por isso funciona no preview mas não no site.

Backend (banco de dados + coluna `scheduled_at`) já está no ar, pois migrations são aplicadas imediatamente. O que falta é apenas o frontend.

## Plano

1. Republicar o projeto para levar as correções do `DetailPanel.tsx` (campos separados de data e hora + sincronização de estado) ao site em produção.
2. Após a publicação (~1 min), confirmar em `lzrmode.lovable.app` que a "Data de publicação" salva e persiste após reload.

Sem alterações de código nesta etapa — só publicação.