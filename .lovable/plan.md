# Guia de Migração: Lovable Cloud → Supabase próprio

Vou criar um único arquivo `MIGRATION.md` na raiz do repo, em português, com o passo-a-passo completo pra você executar do seu lado. Nada de código da app muda nesse commit — é só documentação.

## O que vai no MIGRATION.md

### 1. Pré-requisitos
- Conta em supabase.com + projeto novo criado (região sugerida: mesma da Vercel).
- Supabase CLI instalado (`brew install supabase/tap/supabase` ou npm).
- `psql` disponível (vem com Postgres client).
- Acesso à Vercel pra trocar env vars.

### 2. Inventário do que existe hoje (extraído do seu projeto)
- **30 tabelas** no schema `public` (lista completa: `activity_log`, `app_settings`, `cleaning_log`, `clients`, `content_items`, `profiles`, `user_roles`, etc.)
- **21 funções DB** (`has_role`, `is_master`, `handle_new_user`, `send_daily_digest`, `auto_mark_missed`, `get_public_feed`, etc.)
- **2 buckets de storage**: `avatars`, `reel-covers` (privados)
- **1 Edge Function**: `admin-auth-operations`
- **Cron jobs** (`pg_cron`): `luzeria_*` e `auto-mark*` (listados por `luzeria_admin_list_cron_jobs`)
- **Enums**: `app_role` (`master`, `setor`, `member`)
- **Secrets em uso pela app**: `GOOGLE_DRIVE_API_KEY`, `LOVABLE_API_KEY`, `ONESIGNAL_REST_API_KEY`

### 3. Passo a passo (na ordem exata)

**A. Exportar dados do Cloud atual**
1. Aqui no Lovable: aba **Cloud → Overview → Advanced settings → Export project data → Export data**. Baixa o dump SQL.
2. Aba **Cloud → Storage**: baixar os arquivos dos buckets `avatars` e `reel-covers` (ou script via CLI usando as credenciais atuais).

**B. Preparar o projeto Supabase novo**
1. Criar o projeto no supabase.com, anotar: `Project URL`, `anon key`, `service_role key`, `Project Ref`, senha do DB.
2. Habilitar extensões necessárias no SQL Editor: `pgcrypto`, `pg_cron`, `pg_net` (esta última pros webhooks/HTTP de cron).

**C. Aplicar o schema**
1. Ligar o CLI ao projeto novo: `supabase link --project-ref <SEU_REF>`.
2. Rodar as migrations já versionadas: `supabase db push` (aplica tudo que está em `supabase/migrations/`).
3. Alternativa manual: copiar cada arquivo de migration em ordem cronológica e colar no SQL Editor.

**D. Restaurar dados**
1. Restaurar dump: `psql "postgresql://postgres:<SENHA>@db.<REF>.supabase.co:5432/postgres" -f dump.sql`.
2. Recriar os buckets (`avatars`, `reel-covers`, privados) no dashboard → Storage.
3. Fazer upload dos arquivos exportados via CLI: `supabase storage cp --recursive ./avatars ss:///avatars`.

**E. Recriar auth**
1. Providers: habilitar Email/Password + Google (Authentication → Providers). Colar mesmo Client ID/Secret do Google que você usa hoje, ou gerar novos no Google Cloud Console e atualizar redirect URIs.
2. Templates de e-mail: copiar os textos que estavam no Cloud.
3. Site URL + Redirect URLs: adicionar `https://lzrmode.lovable.app`, sua URL da Vercel, e `http://localhost:8080`.
4. Usuários: o dump do passo D já traz `auth.users`. Confirmar que emails/hashes vieram junto (a UI de export do Cloud inclui).

**F. Recriar cron jobs**
1. No SQL Editor do novo projeto, rodar os `SELECT cron.schedule(...)` equivalentes aos que rodam hoje (a lista sai de `SELECT * FROM cron.job WHERE jobname LIKE 'luzeria_%' OR jobname LIKE 'auto-mark%'`).
2. Ajustar URLs dos jobs que chamam edge functions ou endpoints públicos (`/api/public/*`) pra apontar pro seu novo domínio.

**G. Redeployar Edge Function `admin-auth-operations`**
1. `supabase functions deploy admin-auth-operations --project-ref <SEU_REF>`.
2. Configurar secrets da function (`SUPABASE_SERVICE_ROLE_KEY` já vem por padrão; adicionar as demais que a function usa).

**H. Configurar secrets no seu Supabase novo**
Adicionar (Project Settings → Edge Functions → Secrets):
- `GOOGLE_DRIVE_API_KEY`
- `ONESIGNAL_REST_API_KEY`
- `LOVABLE_API_KEY` (se for continuar usando o AI Gateway do Lovable; senão, trocar por chave direta do provider)

**I. Trocar env vars na Vercel**
Substituir estas variáveis pelas do seu projeto novo:

| Variável | Onde pega |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | anon key (formato `sb_publishable_...` ou JWT) |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_ANON_KEY` | anon key (compatibilidade) |
| `SUPABASE_PROJECT_ID` | Project Ref |
| `VITE_SUPABASE_URL` | mesma da URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | mesma da anon |
| `VITE_SUPABASE_PROJECT_ID` | mesmo do ref |
| `GOOGLE_DRIVE_API_KEY`, `ONESIGNAL_REST_API_KEY`, `LOVABLE_API_KEY` | copiar as atuais |

Rebuild na Vercel e testar.

**J. Checklist de validação (nessa ordem, em preview antes de prod)**
1. Login com email/senha → OK.
2. Login com Google → OK (senão, redirect URI errado).
3. Listar clientes/tarefas → OK (RLS + GRANTs).
4. Criar item + atribuir → notificação chega.
5. Upload de arquivo → aparece no bucket certo.
6. Cron: aguardar próxima execução ou rodar manual (`SELECT cron.schedule(...)` de teste).
7. Edge function admin-auth: criar/desativar usuário via UI de admin.
8. Feed público (`/preview/:token`) abre pro cliente.

**K. Depois que tudo estiver rodando**
- Rotacionar `ONESIGNAL_REST_API_KEY` (está no `.env` versionado hoje).
- Tirar `.env` do git.
- Cancelar/pausar o projeto Cloud antigo (aba **Cloud → Overview → Advanced settings**) — o Lovable não tem botão de "desconectar", mas você pode simplesmente parar de usar. O Cloud continua existindo até você pedir deleção pra eles.

### 4. Pontos de atenção específicos do seu projeto
- **`handle_new_user` trigger em `auth.users`**: precisa ser recriado manualmente no novo Supabase (o dump costuma vir sem triggers no schema `auth`). Vou incluir o SQL no MIGRATION.md.
- **`app_role` enum**: se algum novo valor foi adicionado depois da última migration, checar antes.
- **`profiles.active = false` por default**: pré-autorizações em `email_role_assignments` precisam vir junto no dump — o handle_new_user depende delas.
- **Chaves novas vs antigas do Supabase**: seu projeto já lida com formato `sb_publishable_*` e `sb_secret_*` (`isNewSupabaseApiKey` em `client.ts`). O novo projeto Supabase pode vir com qualquer um dos formatos — a app aguenta os dois.

## Não incluído neste plano

- Nenhuma mudança em código da aplicação.
- Nenhuma migration nova.
- Nenhum toque em `.env`, `client.ts`, `client.server.ts`, `auth-middleware.ts` (arquivos auto-gerados).

## Entregável

Um único arquivo: `MIGRATION.md` na raiz. Depois de aprovado, você segue o guia no seu ritmo e volta se travar em algum passo.
