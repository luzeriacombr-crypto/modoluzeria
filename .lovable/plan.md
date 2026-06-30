## Capa customizada para Reels

Permitir definir a **capa do Reel** de duas formas: capturando um frame do vídeo ou subindo uma imagem separada. A capa escolhida passa a ser usada em todos os pontos onde hoje aparece a miniatura do item.

### Banco
- Nova coluna `content_items.cover_url text` (URL pública da imagem da capa).
- Nova coluna `content_items.cover_source text` (`"frame" | "upload"`) só para referência/UI.
- Novo bucket de storage `reel-covers` (público, para leitura via `<img>`).
- Policies: insert/update/delete restritos a admin (master/setor) e membros responsáveis pelo item.

### Backend — `src/lib/luzeria/api.functions.ts`
- `getMonth` passa a retornar `coverUrl` e `coverSource` em cada item.
- Nova serverFn `setItemCover({ itemId, coverUrl, coverSource })` para gravar/limpar capa.
- Nova serverFn `uploadItemCover({ itemId, fileBase64, contentType })` que grava no bucket `reel-covers` e devolve a URL pública (usada tanto para upload de imagem quanto para o frame capturado pelo navegador).

### Tipos & queries
- `src/lib/luzeria/types.ts`: `coverUrl?: string`, `coverSource?: "frame" | "upload"` em `ContentItem`.
- `src/lib/luzeria/queries.ts`: hooks `setItemCover` e `uploadItemCover`, invalidando `month`, `item-files` e `feed`.

### UI — onde a capa aparece
1. **`FeedPreview.tsx`**: se `coverUrl` existir, usar como thumb da célula (preferência sobre primeira mídia do Drive).
2. **`ContentRow.tsx` (`RowThumb`)**: idem — `coverUrl` ganha prioridade.
3. **`DetailPanel.tsx`** (modal de detalhe): preview de mídia (aspect 4/5) mostra `coverUrl` quando definido.

### UI — editor de capa (novo)
Novo componente `src/components/luzeria/ReelCoverEditor.tsx`, acessível por um botão **"Definir capa"** ao lado/abaixo do `MediaPreview` no `DetailPanel`, **apenas para itens type `reel`**.

Modal com duas abas:
- **Frame do vídeo**:
  - `<video>` oculto carrega a primeira mídia do item que for vídeo (busca em `item_files` por mime começando em `video/`; se nenhum existir, mostra estado vazio com CTA pra anexar vídeo).
  - Scrubber (`<input type="range">` de 0 → `duration`) sincronizado com `video.currentTime`.
  - Botão "Capturar frame" desenha o frame atual num `<canvas>` (mesmo tamanho do vídeo), exporta como JPEG via `canvas.toBlob`, converte para base64 e chama `uploadItemCover` com `coverSource: "frame"`.
- **Upload de imagem**:
  - `<input type="file" accept="image/*">`, preview, valida ≤ 5 MB, chama `uploadItemCover` com `coverSource: "upload"`.

Ambas as abas mostram preview da capa atual e botão "Remover capa" (chama `setItemCover` com `coverUrl: null`).

Permissões: só admin (master/setor) ou responsáveis do item podem editar a capa — espelha as policies do storage.

### Detalhes técnicos
- Captura de frame: precisa `video.crossOrigin = "anonymous"` para o canvas não ficar "tainted". URLs do Drive já são servidas com CORS adequado pelo proxy interno de `drive.functions.ts` (sem mudança nele).
- Storage path: `reel-covers/{item_id}/{timestamp}.jpg`. Ao definir nova capa, apagar arquivo anterior do bucket pra não acumular lixo.
- Fallback: quando `coverUrl` for null, comportamento atual (primeira mídia ou placeholder) permanece intacto.
- Mobile: o editor abre normalmente; scrubber funciona com touch (HTML range nativo).

### Não muda
- Posts continuam só com a primeira mídia como thumb (sem editor de capa). Se você quiser estender pra Posts/Carrosséis também, é só pedir.
