Mostrar uma miniatura 40x40 à esquerda do número em cada linha de Post/Reel, usando o primeiro arquivo anexado ao item no Google Drive.

## Mudança

**`src/components/luzeria/ContentRow.tsx`**
- Adicionar componente local `RowThumb({ itemId })` renderizado entre o número e o título:
  - Consulta `itemFilesQO(itemId)` (cache já existe).
  - Pega o primeiro arquivo (independente do tipo) e dele o `driveFileId`.
  - Usa `driveThumbnailQO(driveFileId)` para obter a URL assinada da miniatura.
  - Renderiza um `<div>` 40x40 com `border-radius: 8px`, `overflow: hidden`, `bg #1C1C1C` e a `<img>` em `object-cover`.
  - Fallback (sem arquivo / sem thumbnail / loading): mesmo quadrado com ícone `ImageIcon` em `rgba(255,255,255,0.2)`.
- Ajustar o gap da linha para acomodar o thumb sem quebrar o layout (largura fixa, `shrink-0`).

Sem mudanças de backend nem de schema — usa exatamente as queries já existentes (`itemFilesQO` + `driveThumbnailQO`), que já estão com `staleTime` longo.

## Observação de performance
Cada linha dispara 2 queries leves, com cache compartilhado pelo React Query (30 min para o thumb). Em meses com muitos posts (~30), é confortável; nada é re-buscado em re-renders.
