## Problema

No painel de detalhe do post/reel, a seção **MÍDIA** está mostrando o fallback "Abrir no Drive" porque ela hoje depende do campo legado `driveLink` (que está vazio nesse item). Os arquivos reais ficam abaixo, em **Arquivos**, e o primeiro deles já tem thumbnail (igual ao que aparece na lista).

A correção é apontar a prévia de mídia para o **primeiro arquivo anexado** do item — exatamente o que o `RowThumb` já faz na listagem. Além disso, o usuário pediu para poder **reordenar** os arquivos (a coluna `sort_order` já existe na tabela `item_files`, então é só usar).

---

## Mudanças

### 1. `src/components/luzeria/DetailPanel.tsx` — Mídia usa o primeiro arquivo anexado
- Substituir o componente `DrivePreview` (que recebe `url: string`) por um `MediaPreview({ itemId, onEmpty })`:
  - Lê `itemFilesQO(itemId)`, pega o **primeiro arquivo** (menor `sort_order`).
  - Usa `driveThumbnailQO(file.driveFileId)` para a miniatura — mesma fonte do `RowThumb` e do `FileThumb`.
  - Quando há thumbnail: renderiza `<img>` cobrindo o card 200px. Clique abre `file.webViewUrl` em nova aba (`target="_blank" rel="noopener noreferrer"`), com overlay de hover já existente.
  - Sem thumbnail mas com arquivo (PDF/doc/etc.): mostra ícone + nome do arquivo, ainda clicável para o `webViewUrl`.
  - Sem arquivos: mantém o CTA atual ("Cole o link / Envie um arquivo") que faz scroll para a seção de Arquivos abaixo.
- Remover do `MediaPreview` qualquer dependência de `item.driveLink`. O campo `driveLink` permanece no schema/tipo (não mexer), apenas deixa de governar a prévia.
- Atualizar a chamada em `<ModalSection label="Mídia">` para `<MediaPreview itemId={item.id} onEmpty={...} />`.

### 2. Backend — server function de reordenação
Novo `reorderItemFiles` em `src/lib/luzeria/drive.functions.ts`:
- `createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])`.
- Input (zod): `{ itemId: string, orderedIds: string[] }`.
- Handler: para cada id, faz `update item_files set sort_order = index where id = ? and item_id = ?` usando o supabase do contexto (RLS já restringe a quem pode editar o item).
- Não cria nova tabela, não altera schema.

### 3. `src/lib/luzeria/queries.ts` — expor mutation
- Em `useApi()`, adicionar `reorderItemFiles` análogo aos demais (`useServerFn` + `useMutation`), invalidando `itemFilesQO(itemId)` em `onSuccess`.

### 4. `src/components/luzeria/FilesSection.tsx` — reordenar arquivos
- Adicionar drag handle por linha (`GripVertical` à esquerda do thumb) visível quando `canEdit`.
- Implementar drag-and-drop nativo HTML5 (`draggable`, `onDragStart/Over/Drop`) — sem dependência nova:
  - Estado local `orderedFiles` derivado de `files` (sincronizado via `useEffect` quando muda do servidor).
  - Ao soltar, atualiza estado local imediatamente (UX otimista) e chama `reorderItemFiles.mutate({ data: { itemId, orderedIds } })`.
- Em mobile (sem drag confortável), adicionar dois botões pequenos ↑ / ↓ ao lado do handle que reordenam por 1 posição.
- O primeiro item da lista vira automaticamente a prévia da seção Mídia (porque o `MediaPreview` lê o primeiro de `itemFilesQO`, que está ordenado por `sort_order`).

---

## Notas técnicas
- Sem migração de banco — `item_files.sort_order` e o `.order("sort_order")` em `listItemFiles` já existem.
- Sem novas dependências (drag nativo HTML5).
- Performance: as queries `itemFilesQO` e `driveThumbnailQO` já têm cache compartilhado com o `RowThumb`, então abrir o detalhe reaproveita a thumbnail e não dispara nova chamada ao Drive.
