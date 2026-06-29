Do I know what the issue is? Sim: o erro não parece estar no link salvo, e sim no contexto onde ele é aberto. O Google Drive bloqueia abertura herdada de iframe/sandbox do preview; por isso `window.open` e variações podem continuar gerando `ERR_BLOCKED_BY_RESPONSE` no preview, mesmo com `_blank`.

Arquivos isolados:
- `src/components/luzeria/DetailPanel.tsx`: botão `Abrir no Drive` e função `openDriveLink`.
- `src/components/luzeria/ContentRow.tsx`: apenas indicador visual de link, sem abertura direta.

Plano de alternativa mais confiável:

1. Trocar o botão do Drive para um link real do navegador
   - Renderizar `Abrir no Drive` como `<a href="..." target="_blank" rel="noopener noreferrer">` em vez de depender só de `window.open`.
   - Manter `preventDefault` fora desse fluxo para não interferir no comportamento nativo do navegador.

2. Adicionar fallback garantido: copiar link
   - Ao lado de `Abrir no Drive`, adicionar um botão discreto `Copiar link`.
   - Se o preview/sandbox bloquear o Drive, o usuário consegue colar o link em uma nova aba manualmente, que é o único método 100% confiável dentro de sandbox restrito.

3. Mostrar aviso apenas quando necessário
   - Se o app detectar que está dentro do preview/iframe, mostrar uma mensagem pequena: “Se o Drive bloquear no preview, copie o link e cole em uma nova aba.”
   - No app publicado/acesso direto, manter visual limpo.

4. Preservar a lógica existente
   - Não alterar dados, permissões, banco, status, responsáveis, editor, comentários ou layout geral.
   - Apenas mudar a forma de abrir/copiar o link do Drive.

5. Validar
   - Confirmar que o link salvo vira uma URL válida com `https://`.
   - Confirmar que o clique não tenta iframe nem navegação interna.
   - Confirmar que existe fallback de cópia quando o navegador/preview bloquear o Google Drive.