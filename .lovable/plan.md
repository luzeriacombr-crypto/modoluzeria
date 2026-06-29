## Objetivo
Aumentar a miniatura exibida nas listas de Posts/Reels/Outros (`ContentRow.tsx`) para uma proporção 4:5 (igual ao Instagram) e um tamanho visível, sem quebrar o layout da linha.

## Tamanho proposto
Passar de **40×40 px (1:1)** para **48×60 px (4:5)**. A altura de 60 px ainda cabe confortavelmente dentro da linha atual (`h-16` = 64 px), mantendo alinhamento vertical.

## Alterações
1. **`src/components/luzeria/ContentRow.tsx`**
   - Ajustar o container `RowThumb` para `w-12 h-15` (48×60 px) mantendo `rounded-md`, `overflow-hidden` e `object-cover`.
   - Garantir que a imagem preencha a proporção 4:5 sem distorcer.
   - Manter o fallback `ImageIcon` centralizado.

2. **Verificação de layout**
   - Confirmar que o card de linha continua alinhado (`items-center`) e que a miniatura não extrapola a altura da row.
   - No mobile, a miniatura deve escalar proporcionalmente junto com o restante do conteúdo.

3. **Teste rápido no preview**
   - Abrir a lista de clientes/posts e verificar se a miniatura está visível e na proporção correta.