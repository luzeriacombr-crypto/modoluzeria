## Criar função SQL `get_public_feed` (SECURITY DEFINER)

### Objetivo
Expor os dados do preview público via uma função SQL única, em vez de depender apenas do server function `getPublicFeed`. Assim o feed pode ser lido diretamente via `supabase.rpc('get_public_feed', { _token })` (útil para clientes públicos e para simplificar o backend).

### Assinatura
```sql
public.get_public_feed(_token text) RETURNS jsonb
```
- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`.
- Retorna `NULL` se o token não existir ou estiver revogado (`revoked_at IS NOT NULL`).

### Estrutura do JSON retornado
```jsonc
{
  "client": { "name", "color", "description" },
  "month":  { "key" },
  "items": [
    {
      "id", "type", "idx", "title", "caption",
      "due_date", "feed_order", "cover_path",
      "files": [
        { "id", "drive_file_id", "mime_type", "web_view_url", "sort_order" }
      ],
      "feedback": [
        { "id", "author_name", "text", "created_at" }
      ]
    }
  ]
}
```
- Filtro dos itens: `month_id = token.month_id AND status = 'PRONTO_PARA_PUBLICAR'`.
- Ordem dos itens: `feed_order NULLS LAST, type (post antes de reel), idx`.
- Ordem dos arquivos: `sort_order, created_at`.
- Ordem do feedback: `created_at DESC`.

Observação: URLs assinadas de capa (`reel-covers`) e thumbs do Drive **continuam** sendo geradas no server function (precisam de service role e chamada HTTP externa). O SQL devolve apenas `cover_path` e `drive_file_id`.

### Segurança
- `SECURITY DEFINER` + `search_path = public` (padrão do projeto).
- `REVOKE ALL ... FROM PUBLIC` e depois `GRANT EXECUTE ON FUNCTION public.get_public_feed(text) TO anon, authenticated`.
  - Justificativa: o token já é o mecanismo de autorização; sem token válido a função retorna `NULL`.
- Só lê dados; nenhuma escrita.
- Não retorna colunas sensíveis (nada de `client_secrets`, `email`, `user_id` de assignees, etc.).

### Arquivos
- Migração SQL nova criando a função com os `GRANT/REVOKE` acima. Nenhum código de aplicação é alterado neste passo.

### Fora de escopo
- Não alterar `feed-share.functions.ts` nem a rota `/preview/$token`.
- Não gerar signed URLs nem thumbnails dentro do SQL.
- Não adicionar endpoint público de escrita (feedback continua via server function existente).
