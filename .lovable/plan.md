
## Objetivo
Refazer apenas a aba "Clientes" do `MobileNav.tsx` (versão mobile) para ficar visualmente alinhada ao resto do app.

## Mudanças (somente `src/components/luzeria/MobileNav.tsx`)

1. **Agrupar por categoria** na ordem: Social Media → Pack Digital → Avulsos → Ex-clientes (e quaisquer extras no final). Mesma lógica usada na sidebar (`c.category || "Social Media"`, filtra `!c.archived`).

2. **Header de cada seção**: pill discreto no topo do grupo
   - Texto: nome da categoria em uppercase + contador
   - Cor do texto: a mesma usada na sidebar (`Social Media`/`Pack Digital` = `#5BA88A`, `Avulsos` = `#C8D44E`, `Ex-clientes` = `#E76F51`)
   - Pequena barra/linha divisória abaixo, bem leve

3. **Card de cliente** (substitui o `<li>` atual):
   - Grid de 1 coluna, gap 10px, padding lateral 16px
   - Cada card: `rounded-2xl`, padding 14px, altura confortável (~64px)
   - Fundo: cor do cliente com alpha baixo (~15%), usando `color-mix(in oklab, <c.color> 18%, transparent)`
   - Borda sutil: `color-mix(in oklab, <c.color> 35%, transparent)` com 1px
   - Conteúdo: Avatar (36px) + nome em branco semibold + estrela `#C8D44E` se favorito + chevron `›` à direita em branco/40%
   - `active:scale-[0.98]` para feedback de toque

4. **Estado vazio por grupo**: se a categoria não tem clientes (ex.: Avulsos), pula a seção (não exibe header). Se nenhum cliente, mantém mensagem central.

5. **Header da tela**: manter "Clientes" sticky atual; adicionar contagem total à direita em `text-white/40`.

## Fora do escopo
- Desktop não muda.
- Lógica de seleção (`selectClient` / `setTab("home")`) e demais views intactas.
- Sem alterações em store, queries ou estilos globais.
