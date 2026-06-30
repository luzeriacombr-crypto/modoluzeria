## Ajuste no preview mobile: botão "Sugerir alteração"

### Problema
Na versão mobile do preview público (`/preview/<token>`), o botão verde "Sugerir alteração" no modal fica muito próximo da borda inferior da tela, dificultando o toque.

### Solução
Ajustar o `InstagramPostModal.tsx` para dar mais respiro na parte inferior no mobile:

1. Aumentar o `padding-bottom` do container do composer público em telas pequenas (`px-4 py-3 md:py-4 md:pb-6` ou similar).
2. Aumentar a altura/área de toque do botão "Sugerir alteração" no mobile (`py-3.5` / `min-h-[48px]`).
3. Garantir que, ao abrir o textarea de sugestão, os botões "Cancelar" e "Enviar sugestão" também tenham área confortável e padding inferior adequado.
4. Adicionar padding-bottom extra no scroll/conteúdo quando o composer estiver aberto, evitando que o conteúdo fique colado na barra inferior.

### Arquivos alterados
- `src/components/luzeria/InstagramPostModal.tsx` — ajustes de padding e área de toque no modo público/mobile.

### Fora de escopo
- Não alterar o layout desktop.
- Não alterar o fluxo interno da equipe.
- Não mudar cores, tipografia ou comportamento do modal além do espaçamento inferior.