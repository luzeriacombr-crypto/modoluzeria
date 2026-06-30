## Nova aba "Preview de Feed" por cliente

Aba estilo grid do Instagram (3 colunas) com posts e reels do mês selecionado que estão em **Pronto para publicar**. Ordem do feed é independente da ordem nas abas Posts/Reels e é salva por mês.

### Mudanças

**Banco (migration)**
- Nova coluna `content_items.feed_order int` (nullable). Itens sem ordem definida caem no final por `idx`.
- Não mexe nas policies existentes (mesmo padrão das outras colunas de `content_items`).

**Backend** — `src/lib/luzeria/api.functions.ts`
- `getMonth` passa a retornar `feedOrder` em cada item.
- Nova serverFn `updateFeedOrder({ monthId, orderedItemIds[] })` que grava `feed_order = posição` em lote. Permissão: admin (master/setor).

**Tipos & queries** — `src/lib/luzeria/types.ts`, `queries.ts`
- Adicionar `feedOrder?: number` em `ContentItem`.
- Hook `updateFeedOrder` no `useApi()` com invalidação do mês.

**UI** — `src/components/luzeria/ClientView.tsx`
- Nova tab `"feed"` (label "Preview de Feed") em todos os clientes (social media, pack digital e avulsos), entre "Reels" e "Perfil do Cliente" (ou no fim para avulsos).
- Renderiza novo componente `<FeedPreview />`.

**Novo componente** — `src/components/luzeria/FeedPreview.tsx`
- Combina `month.posts + month.reels` filtrando `status === "PRONTO_PARA_PUBLICAR"`.
- Ordena por `feedOrder` (asc, nulls last → por tipo+idx).
- Garante mínimo de 12 células: completa com placeholders vazios estilo IG (quadrado cinza vazio).
- Grid 3 colunas, gap 2px, células `aspect-square`, estilo perfil do Instagram.
- Thumbnail = primeira imagem do item (mesma fonte do `RowThumb` em `ContentRow`). Sem mídia → placeholder com nº do item e badge "POST"/"REEL".
- Ícone overlay no canto: câmera para carrossel (>1 mídia), reels (filme) para reels.
- Click numa célula abre o `DetailPanel` daquele item (via `useUI().openDetail`).

**Reordenação**
- Desktop: drag-and-drop nativo HTML5 (`draggable`, `onDragStart/Over/Drop`) — sem dependência nova. Visual: célula arrastada fica com opacidade reduzida, alvo de drop ganha outline `#C8D44E`.
- Apenas usuários admin (master/setor) podem arrastar; membros só visualizam.
- Mobile: drag desabilitado; mostra apenas visualização (touch listeners não ativam draggable).
- Ao soltar, chama `updateFeedOrder.mutate` com a nova sequência de IDs. Placeholders vazios não entram na ordem.

**Importante:** a aba "Preview de Feed" NÃO altera `idx` dos itens nas abas Posts/Reels — só persiste em `feed_order`.

### Detalhes técnicos

- Migration: `ALTER TABLE public.content_items ADD COLUMN feed_order int;` + index `(month_id, feed_order)`.
- Reordenação otimista: atualiza cache do React Query antes da resposta para drag fluido.
- Quando um item sai de "Pronto para publicar", some do feed automaticamente (filtro client-side). `feed_order` permanece salvo, então se voltar reaparece na mesma posição relativa.
- Placeholders são puramente visuais (não persistidos).