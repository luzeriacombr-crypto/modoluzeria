Trocar a lista de status vertical do painel de detalhes por um dropdown compacto: mostra só o status ativo, e ao clicar abre um menu flutuante com todas as opções. Ao escolher, o menu fecha e exibe o novo status.

### O que será feito

1. **Substituir lista expandida por botão dropdown** em `src/components/luzeria/DetailPanel.tsx`:
   - Estado local `open` para controlar abertura/fechamento do menu.
   - Botão fechado mostra ícone + label do status atual, com cor de fundo do `STATUS_META` e largura total da seção.
   - Ao clicar, abre menu flutuante posicionado abaixo, com as opções em lista vertical.

2. **Manter lógica existente**:
   - Seleção continua usando `setItemStatus.mutate`.
   - Ao escolher `PRONTO_PARA_PUBLICAR` com avaliação obrigatória ativa, exibe o diálogo de nota antes de confirmar.

3. **Design do menu flutuante**:
   - Cada opção ocupa uma linha inteira com ícone à esquerda e texto uppercase bold.
   - Opção ativa recebe fundo sólido da sua cor.
   - Opções inativas ficam com fundo `rgba(255,255,255,0.05)`.
   - Menu usa fundo escuro (#1C1C1C), borda sutil, sombra e z-index adequado para não ser cortado pelo modal.

4. **Fechamento automático**:
   - Clique fora do menu fecha as opções.
   - Após selecionar, o menu fecha.

5. **Verificação**:
   - Build (`bun run build`) e typecheck passam sem erro.
   - Testar no painel de detalhes de Posts e Reels para confirmar que o dropdown abre, seleciona e ocupa menos espaço.