
## Mudanças em `src/components/luzeria/MobileNav.tsx` (aba Clientes mobile)

1. **Header "Clientes" não-flutuante**: o overlay já tem `pt-14` mas o header sticky com `bg-[#0D0D0D]` está deixando o conteúdo aparecer atrás por causa de `z-index`/transparência. Vou:
   - Trocar o container externo: remover `pt-14` e mover o header para fora da área scrollável (estrutura flex coluna: header fixo no topo + área `flex-1 overflow-y-auto`).
   - Header com fundo sólido `#0D0D0D` e `border-b` mais visível, sem `sticky`.

2. **Grid de 2 colunas** dentro de cada categoria:
   - `grid grid-cols-2 gap-2.5`
   - Card menor: padding reduzido (`px-3 py-2.5`), avatar 32px, nome em `text-xs font-semibold` com `truncate`, remove o chevron (não cabe bem em 2 colunas) e mantém apenas a estrela de favorito no canto superior direito quando aplicável.
   - Mantém o fundo tintado com a cor do cliente (`color-mix` 18%) e borda 35%.

3. **Header de categoria**: continua igual (pill + linha), ocupando largura total acima do grid.

Sem outras mudanças (desktop, lógica, store intactos).
