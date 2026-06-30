# Preview de Feed estilo Instagram + compartilhamento com cliente

Transformar a aba **Preview de Feed** em algo muito próximo de um perfil real do Instagram, com modal de publicação, link público para o cliente e comentários por publicação.

## 1. Grid estilo Instagram (interno)

Manter o grid 3 colunas atual, mas com refinamentos:
- Badges de carrossel (ícone de pilha), Reel (ícone de play) e cover no canto superior direito, exatamente como o IG.
- Hover: overlay escuro com contagem de comentários do cliente (se houver).
- Clique em qualquer cell → abre o **modal de publicação** (novo, separado do DetailPanel de gestão).

## 2. Modal de publicação (look IG)

Modal centralizado, fundo **branco**, duas colunas no desktop / empilhado no mobile, sem nenhum dado interno (status, atribuições, briefing, qualidade — nada disso). Apenas:

- **Esquerda:** mídia em 4:5
  - Post único: imagem.
  - Carrossel: slider com setas + dots (swipe no mobile).
  - Reel: thumbnail da capa com botão play → abre o vídeo numa nova aba (link do Drive).
- **Direita:**
  - Header com logo/nome do cliente (avatar circular + @handle).
  - Legenda completa com "... mais" expansível.
  - Data e horário previstos de publicação (`dueDate` + horário se houver).
  - Bloco de **comentários do cliente** (lista + caixa para novo comentário).

## 3. Link público de compartilhamento

Botão **"Compartilhar preview"** no topo da aba (visível só para admin/setor). Gera/copia um link único do tipo:

```
/preview/<token>
```

- Token aleatório armazenado por mês+cliente (tabela nova `feed_share_tokens`).
- Rota **pública** (sem login), renderiza exatamente o mesmo grid + modal IG-style, **somente leitura para o conteúdo**, mas com comentários habilitados.
- Pode ser revogado ("Gerar novo link") no mesmo botão.

## 4. Comentários do cliente

- Nova tabela `client_feedback` por item: nome do cliente (texto livre), texto, data.
- No link público: o cliente digita o nome uma vez (salvo em localStorage) e comenta em qualquer publicação.
- Internamente: aparece dentro do modal IG da aba Preview **e** como uma nova seção "Feedback do cliente" no DetailPanel de gestão da publicação, para a equipe ver e responder no fluxo de revisão.
- Notificação interna: quando o cliente comenta, todos os assignees do item recebem notificação ("Cliente comentou em ...").

## Detalhes técnicos

- **Banco (migração):**
  - `feed_share_tokens(client_id, month_id, token unique, created_by, revoked_at)` + GRANTs + RLS (admin gerencia; SELECT por token via server fn pública).
  - `client_feedback(item_id, author_name, text, created_at)` + GRANTs + RLS (insert público via server fn que valida token; SELECT autenticado para a equipe).
- **Server fns** (`src/lib/luzeria/api.functions.ts`):
  - `getOrCreateShareToken({clientId, monthId})` – admin.
  - `revokeShareToken({token})` – admin.
  - `getPublicFeed({token})` – pública, retorna apenas dados necessários (itens PRONTO_PARA_PUBLICAR + ordem + caption + dueDate + arquivos/cover; nada interno).
  - `addClientFeedback({token, itemId, name, text})` – pública, valida token.
  - `listClientFeedback({itemId})` – autenticada para equipe.
- **Frontend:**
  - Novo `InstagramPostModal.tsx` (reutilizado interno e público).
  - Nova rota pública `src/routes/preview.$token.tsx` (sem auth, SSR ok).
  - Atualizar `FeedPreview.tsx`: botão Compartilhar + abertura do novo modal em vez do DetailPanel.
  - Adicionar seção "Feedback do cliente" no `DetailPanel.tsx`.

## Fora de escopo (não vou fazer agora)
- Reproduzir vídeo embutido no modal (mantém abrir em nova aba via Drive, evita problemas de CORS/streaming).
- Login do cliente / aprovação formal (apenas comentários por enquanto).
- Expiração automática do link (só revogação manual).
