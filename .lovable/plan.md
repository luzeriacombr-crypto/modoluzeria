## Problema 1 — Cliente não consegue abrir sem login

O botão "Compartilhar preview" copia o link usando `window.location.origin`. Quando você está dentro do editor do Lovable, a origem é o domínio interno de pré-visualização (`id-preview--...lovableproject.com`), que **exige login do Lovable** — por isso o modo anônimo não abriu. A rota `/preview/$token` em si já é 100% pública (não tem `requireSupabaseAuth`).

**Correção:** o link copiado vai sempre apontar para o domínio público publicado (`https://modoluzeria.lovable.app/preview/<token>`), independentemente de onde você clicou em "Compartilhar". Isso garante que qualquer pessoa, em qualquer navegador, abra direto sem autenticação.

## Problema 2 — Modal igual ao Instagram, sem botões mexíveis

Hoje o modal mostra ícones decorativos do Instagram (coração, balão de comentário, avião, salvar) e um campo "Adicione um comentário…". No modo público vou:

- **Esconder** a barra de ações (Heart / MessageCircle / Send / Bookmark) — elas não fazem nada e confundem o cliente.
- **Esconder** o composer atual ("Adicione um comentário…" + botão Publicar).
- **Mostrar** um único botão destacado: **"Sugerir alteração"**.
- Ao clicar, abre o campo de texto com placeholder **"Descreva sua sugestão de alteração…"** + (na primeira vez) campo de nome. Botão final **"Enviar sugestão"**.
- Comentários já enviados continuam listados como "Sugestões" (rótulo da seção atualizado).
- No modo interno (equipe logada), a UI permanece como está hoje.

## Detalhes técnicos

### `src/components/luzeria/FeedPreview.tsx`
- Adicionar constante `PUBLIC_PREVIEW_BASE = "https://modoluzeria.lovable.app"`.
- Substituir os dois usos de `${window.location.origin}/preview/${token}` por `${PUBLIC_PREVIEW_BASE}/preview/${token}` (no input read-only e no `copyLink`).

### `src/components/luzeria/InstagramPostModal.tsx`
- Detectar modo público via prop `mode.kind === "public"`.
- Quando público:
  - Não renderizar o bloco da action bar (linhas dos ícones IG).
  - Substituir o composer pelo fluxo "Sugerir alteração":
    - Estado `composerOpen` (default `false`).
    - Botão primário "Sugerir alteração" (com ícone de lápis) → abre o composer.
    - Composer: nome (se não houver `initialAuthorName`) + `textarea` (3 linhas) com placeholder "Descreva sua sugestão de alteração…" + botões "Cancelar" e "Enviar sugestão".
    - Após envio bem-sucedido, fecha o composer, mantém o nome salvo (já existe via `localStorage`).
  - Trocar título da seção de comentários para "Sugestões · N" e textos vazios equivalentes ("Nenhuma sugestão ainda.").
- Quando interno (`mode.kind === "internal"`): manter exatamente o layout atual (action bar IG + composer simples).

### Sem alterações em
- `src/lib/luzeria/feed-share.functions.ts` (server fns já são públicas e validam token).
- `src/routes/preview.$token.tsx` (já está correto; só herda os novos textos do modal).
- Backend / RLS / triggers.

## Fora de escopo
- Não vou trocar o domínio publicado nem mexer em config de publicação.
- Não vou alterar o fluxo interno da equipe (só o modal em modo público).
