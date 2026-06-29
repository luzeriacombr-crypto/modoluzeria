Estilizar as scrollbars do app para combinar com o tema escuro (fundo #1C1C1C, thumb verde escuro #2D4A3E com hover no accent #C8D44E).

## Mudança
Adicionar em `src/styles.css` regras globais de scrollbar:

- **WebKit** (Chrome/Safari/Edge):
  - `::-webkit-scrollbar` → largura/altura 10px
  - `::-webkit-scrollbar-track` → `transparent`
  - `::-webkit-scrollbar-thumb` → `#2D4A3E`, `border-radius: 8px`, `border: 2px solid transparent`, `background-clip: padding-box`
  - `::-webkit-scrollbar-thumb:hover` → `#C8D44E`
  - `::-webkit-scrollbar-corner` → `transparent`
- **Firefox**: `html { scrollbar-color: #2D4A3E transparent; scrollbar-width: thin; }`

Aplica globalmente — afeta o modal de detalhe (na captura) e toda a tela. Apenas CSS, sem alterar componentes.
