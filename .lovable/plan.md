## Edge Function: `admin-auth-operations`

Criar `supabase/functions/admin-auth-operations/index.ts` e fazer deploy.

### Fluxo do handler (POST JSON)

1. CORS: responder `OPTIONS` com `Access-Control-Allow-*`.
2. Ler `Authorization: Bearer <jwt>` do header. Sem token → 401.
3. Criar `supabaseUser` (URL + anon key, `global.headers.Authorization`) e chamar `supabaseUser.auth.getUser()` para obter `user.id`. Falha → 401.
4. Criar `supabaseAdmin` (URL + `SUPABASE_SERVICE_ROLE_KEY`).
5. Chamar `supabaseAdmin.rpc('is_master', { _user_id: user.id })`. Se `false` → 403.
6. Ler `{ operation, ...params }` do body e despachar:
   - `createUser` `{ email, password, name, role }` → `admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })`. Se `role` vier, inserir/atualizar `user_roles` via `supabaseAdmin.from('user_roles').upsert({ user_id, role })`.
   - `deleteUser` `{ targetUserId }` → `admin.deleteUser(targetUserId)`.
   - `sendPasswordReset` `{ email }` → `admin.generateLink({ type: 'recovery', email })` (retorna `action_link`).
   - `updateUser` `{ targetUserId, email?, password?, name? }` → `admin.updateUserById(targetUserId, { email, password, user_metadata: name ? { name } : undefined })`.
   - Operação desconhecida → 400.
7. Respostas: `{ success: true, data }` em sucesso, `{ success: false, error: string }` em erro (status 200/4xx/500 conforme caso), sempre com headers CORS + `content-type: application/json`.

### Config

Sem entrada em `supabase/config.toml` — funções gerenciadas já sobem com `verify_jwt = false` por padrão; a verificação de JWT/master é feita manualmente dentro do handler (necessário para poder ler o body e retornar JSON estruturado em vez de 401 opaco).

Secrets já disponíveis: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (anon), `SUPABASE_SERVICE_ROLE_KEY`.

### Deploy

Após criar o arquivo, chamar `supabase--deploy_edge_functions` com `["admin-auth-operations"]` e validar rapidamente com `supabase--curl_edge_functions` (uma chamada sem token deve retornar 401; uma com token de master deve responder à operação).

### Observação

A lógica equivalente já existe nos server functions do app (`src/lib/luzeria/api.functions.ts`) e continua funcionando — a Edge Function é adicional, pensada para chamadas externas ao app. Nenhum código de frontend é alterado.
