Alterar o preview de mídia no `DetailPanel.tsx` (componente `MediaPreview`) para usar proporção 4:5 (vertical, formato de feed do Instagram) em vez da altura fixa atual de 200px.

## Mudança

Em `src/components/luzeria/DetailPanel.tsx`, nas duas variantes do `MediaPreview` (estado vazio + estado com arquivo), trocar `h-[200px]` por `aspect-[4/5]` mantendo `w-full`. Isso fará o bloco crescer verticalmente respeitando a largura da coluna, exibindo o conteúdo no mesmo formato dos posts/carrosséis.

Nada mais muda — borda tracejada, cores, ícone de upload, comportamento de clique e a thumbnail (`object-cover`) permanecem iguais.