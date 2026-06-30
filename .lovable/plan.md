
# Hover nos status e no tipo de Reel

## Mudanças
1. **Status badge** (`src/components/luzeria/StatusBadge.tsx`)
   - Trocar o atual `hover:opacity-90` por feedback mais visível: leve `scale(1.04)`, `brightness(1.1)` e um anel translúcido da cor do próprio status.
   - Adicionar um pequeno chevron que aparece no hover, sinalizando que é clicável.
   - Itens do dropdown: hover ganha fundo levemente colorido com a cor do status (em vez de cinza neutro) e translate-x sutil.

2. **Seletor de tipo de Reel** (no `DetailPanel.tsx`, e onde quer que apareça a label do tipo)
   - Aplicar a mesma família de hover: scale leve, borda accent translúcida e brilho no texto.
   - Garantir cursor-pointer e indicação de que abre um menu (chevron).

## Fora do escopo
- Sem mudanças em lógica, dados ou estados — apenas estilo/transições.
