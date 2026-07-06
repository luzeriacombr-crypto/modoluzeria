# Migração: Lovable Cloud → Supabase próprio

Guia passo-a-passo pra tirar o banco da organização do Lovable Cloud e passar
pra uma conta Supabase sua. Depois de concluir, o app roda sem nenhuma
dependência do Lovable no runtime (o código já está fora, só falta o banco).

> **Tempo estimado:** 2–4 horas se tudo der certo na primeira. Faça em uma
> janela em que o app pode ficar em manutenção por ~30 min no cut-over final.

---

## 0. Por que esse caminho

O Lovable Cloud **não permite** transferir o projeto Supabase pra sua conta,
nem te dá acesso owner no dashboard do supabase.com. A única forma de
independência real é criar um Supabase seu, migrar schema+dados+auth+storage,
e apontar o app pra ele.

---

## 1. Pré-requisitos

- Conta em [supabase.com](https://supabase.com) + projeto novo criado
  (região sugerida: mesma da Vercel — provavelmente `us-east-1` ou `sa-east-1`).
- [Supabase CLI](https://supabase.com/docs/guides/cli):
  `brew install supabase/tap/supabase` ou `npm i -g supabase`.
- `psql` (vem com Postgres client: `brew install libpq` no macOS).
- Acesso admin na Vercel pra trocar env vars.
- Acesso ao Google Cloud Console (se for reconfigurar OAuth Google do zero).

---

## 2. Inventário do que existe hoje

Extraído direto do projeto atual — serve de checklist na hora de validar.

**Tabelas do schema `public` (30):**
`activity_log`, `app_settings`, `cleaning_log`, `cleaning_schedule`,
`cleaning_settings`, `client_contacts`, `client_drive_map`, `client_feedback`,
`client_links`, `client_onboarding`, `client_secrets`, `clients`, `comments`,
`content_items`, `deadline_notifications_log`, `email_role_assignments`,
`feed_share_tokens`, `finalizations`, `item_assignees`, `item_files`,
`member_goals`, `mentions`, `months`, `notification_preferences`,
`notifications`, `profiles`, `recurring_templates`, `status_transitions`,
`stories_schedule`, `user_roles`.

**Funções DB (21):**
`has_role`, `is_master`, `is_admin`, `on_status_change`, `touch_updated_at`,
`log_item_activity`, `handle_new_user`, `record_finalizations`,
`track_lead_time`, `notify_on_mention`, `get_public_feed`,
`generate_recurring_for_month`, `verify_public_token_file`, `get_my_email`,
`admin_list_profile_emails`, `luzeria_admin_list_cron_jobs`,
`track_status_transition`, `notify_on_client_feedback`, `notify_on_comment`,
`notify_on_assignment`, `send_daily_digest`, `send_deadline_reminders`,
`auto_mark_missed`, `add_public_feedback`.

**Storage buckets:** `avatars`, `reel-covers` (ambos privados).

**Edge Functions:** `admin-auth-operations`.

**Cron jobs (pg_cron):** todos com prefixo `luzeria_*` e `auto-mark*`.
Liste antes com:
```sql
SELECT jobname, schedule, active, command
  FROM cron.job
 WHERE jobname LIKE 'luzeria_%' OR jobname LIKE 'auto-mark%';
```

**Enums:** `app_role` (`master`, `setor`, `member`).

**Secrets usados pela app:**
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` (OAuth do Google Drive — não é uma API key única; ver `src/lib/luzeria/drive.functions.ts`)
- `ONESIGNAL_REST_API_KEY`

Nota: `LOVABLE_API_KEY` não é usada em nenhum lugar do código (confirmado por busca no repo) — não precisa migrar.

---

## 3. Passo a passo

### A. Exportar dados do Cloud atual

1. No Lovable: aba **Cloud → Overview → Advanced settings →
   Export project data → Export data**. Baixa um dump SQL.
2. Aba **Cloud → Storage**: baixar os arquivos dos buckets `avatars` e
   `reel-covers`. Salvar em `./storage-backup/avatars/` e
   `./storage-backup/reel-covers/`.
3. **Antes de sair**, exportar a lista de cron jobs (rodar a query acima no
   SQL Editor do Cloud e salvar num `.sql`).

### B. Preparar o projeto Supabase novo

1. Criar projeto em supabase.com. Anotar:
   - `Project URL` (ex: `https://xxxx.supabase.co`)
   - `Project Ref` (ex: `xxxx`)
   - `anon key` (formato `sb_publishable_...` ou JWT)
   - `service_role key`
   - Senha do DB
2. No SQL Editor, habilitar extensões:
   ```sql
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   CREATE EXTENSION IF NOT EXISTS pg_cron;
   CREATE EXTENSION IF NOT EXISTS pg_net;
   ```

### C. Aplicar o schema

Opção 1 (recomendada) — CLI:
```bash
supabase link --project-ref <SEU_REF>
supabase db push
```
Isso aplica tudo que está em `supabase/migrations/` em ordem cronológica.

Opção 2 — manual: colar cada arquivo de `supabase/migrations/` no SQL Editor,
em ordem.

### D. Restaurar dados

```bash
psql "postgresql://postgres:<SENHA>@db.<REF>.supabase.co:5432/postgres" \
  -f dump.sql
```

Se o dump vier separando schema e dados, aplicar só a parte de `COPY`/`INSERT`
depois que o passo C rodou (senão dá conflito de `CREATE TABLE`).

Storage:
1. Buckets `avatars` e `reel-covers` já criados (privados) via SQL direto em
   `storage.buckets`.
2. **Decisão do time (2026-07-05): não migrar os arquivos antigos.** O
   download pelo painel do Lovable Cloud estava com bug (pastas retornando
   "0 files"). Como avatar é trivial de reenviar e as capas de reel podem ser
   recriadas sob demanda, optou-se por deixar os buckets vazios e deixar a
   equipe reenviar/recriar o que precisar depois do cut-over.

### E. Recriar o trigger em `auth.users`

Dumps do Supabase geralmente **não incluem** triggers no schema `auth`. Rode
manualmente no SQL Editor do projeto novo:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

A função `public.handle_new_user()` já veio pelas migrations no passo C.

### F. Recriar auth

1. **Providers** (Authentication → Providers):
   - Email/Password: ativar. Confirm email conforme o comportamento atual.
   - Google: ativar, colar Client ID/Secret. Se for criar novos no
     [Google Cloud Console](https://console.cloud.google.com/apis/credentials),
     adicionar como Authorized redirect URI:
     `https://<REF>.supabase.co/auth/v1/callback`.
2. **URL Configuration:**
   - Site URL: sua URL de produção (Vercel).
   - Redirect URLs (adicionar todas):
     - `https://lzrmode.lovable.app` (se ainda for usar)
     - URL da Vercel de produção
     - URL(s) de preview da Vercel (com wildcard se possível)
     - `http://localhost:8080`
3. **Email templates:** copiar textos que estavam no Cloud (confirmação,
   recuperação de senha, magic link).
4. **Usuários:** o dump do passo D traz `auth.users` com hashes. Validar
   fazendo login com uma conta conhecida antes de seguir.

### G. Recriar cron jobs

No SQL Editor do projeto novo, rodar os `SELECT cron.schedule(...)`
equivalentes aos exportados no passo A. Ajustar URLs que apontam pra edge
functions ou pra `/api/public/*` da app pra usar seu novo domínio da Vercel.

Exemplo típico do que aparece:
```sql
SELECT cron.schedule(
  'luzeria_daily_digest',
  '0 9 * * *',
  $$ SELECT public.send_daily_digest(); $$
);
```

### H. Redeployar Edge Function `admin-auth-operations`

```bash
supabase functions deploy admin-auth-operations --project-ref <SEU_REF>
```

Secrets da function (Project Settings → Edge Functions → Secrets):
`SUPABASE_SERVICE_ROLE_KEY` já vem por padrão. Adicionar as demais que a
function usa (checar o `index.ts` dela).

### I. Configurar secrets no seu Supabase novo

Project Settings → Edge Functions → Secrets:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`
- `ONESIGNAL_REST_API_KEY`

### J. Trocar env vars na Vercel

Substituir estas variáveis pelas do seu projeto novo:

| Variável | Valor |
|---|---|
| `SUPABASE_URL` | Project URL |
| `SUPABASE_PUBLISHABLE_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |
| `SUPABASE_PROJECT_ID` | Project Ref |
| `VITE_SUPABASE_URL` | mesma da URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | mesma da anon |
| `VITE_SUPABASE_PROJECT_ID` | mesmo do ref |
| `GOOGLE_CLIENT_ID` | copiar atual (Google Cloud Console) |
| `GOOGLE_CLIENT_SECRET` | copiar atual (Google Cloud Console) |
| `GOOGLE_REFRESH_TOKEN` | copiar atual |
| `ONESIGNAL_REST_API_KEY` | copiar atual (e rotacionar depois) |

Nota: `SUPABASE_ANON_KEY` e `LOVABLE_API_KEY` não são usadas no código — não precisam ser configuradas.

Rebuild na Vercel. Fazer o cut-over primeiro em preview.

### K. Checklist de validação (nessa ordem, em preview antes de prod)

1. Login com email/senha → OK.
2. Login com Google → OK. Se falhar, redirect URI errado no Google Console
   ou no Supabase.
3. Listar clientes/tarefas → OK (RLS + GRANTs).
4. Criar item + atribuir a alguém → notificação chega pro atribuído.
5. Upload de arquivo (avatar ou capa de reel) → aparece no bucket certo.
6. Cron: aguardar próxima execução ou rodar manual:
   ```sql
   SELECT public.send_daily_digest();
   SELECT public.auto_mark_missed();
   ```
7. Edge function `admin-auth-operations`: criar/desativar usuário via UI de
   admin.
8. Feed público (`/preview/:token`): abrir link de compartilhamento de um
   cliente e conferir que carrega + aceita feedback.

### L. Depois que tudo estiver rodando

- **Rotacionar `ONESIGNAL_REST_API_KEY`** — está no `.env` versionado no git
  hoje, então considere comprometida.
- **Tirar `.env` do git:**
  ```bash
  git rm --cached .env
  echo ".env" >> .gitignore
  git commit -m "chore: remove .env from git"
  ```
- **Parar de usar o Cloud antigo:** o Lovable não tem botão de "desconectar".
  Uma vez que o app aponta pro Supabase novo, o Cloud fica órfão. Você pode
  pedir deleção ao suporte do Lovable ou simplesmente ignorar (vai continuar
  cobrando enquanto existir, então deletar é melhor).

---

## 4. Pontos de atenção específicos deste projeto

- **Trigger `handle_new_user`**: obrigatório recriar manualmente (passo E).
  Sem ele, novos signups não geram `profiles` nem `user_roles` e o app trava
  no primeiro login novo.
- **`profiles.active` default = false**: novos usuários só ficam ativos se
  o email deles existe em `email_role_assignments`. Confirme que essa tabela
  veio no dump — senão nenhum novo usuário consegue passar do gate de
  `requireActiveProfile`.
- **Enum `app_role`**: se você adicionou algum valor via UI do Cloud fora das
  migrations, precisa reproduzir no novo projeto antes de aplicar o schema.
- **Formato de chaves Supabase (`sb_publishable_*` vs JWT antigo):** o código
  em `src/integrations/supabase/client.ts` (função `isNewSupabaseApiKey`) já
  lida com os dois formatos. Qualquer um funciona.
- **Google Drive:** a autenticação é 100% OAuth (`GOOGLE_CLIENT_ID` +
  `GOOGLE_CLIENT_SECRET` + `GOOGLE_REFRESH_TOKEN`, ver `getAccessToken()` em
  `src/lib/luzeria/drive.functions.ts`). Não há API key separada. O Client ID
  precisa ter o domínio novo (Vercel) autorizado no Google Cloud Console se
  o domínio mudar.
- **Realtime:** o app usa `supabase.channel("content-realtime")` em
  `src/components/luzeria/App.tsx` (escuta `content_items` e
  `content_comments`). Confirmar que essas duas tabelas estão na publication
  `supabase_realtime` do projeto novo — senão as atualizações ao vivo da
  equipe param de funcionar silenciosamente.

---

## 5. Rollback

Se algo der errado no cut-over, reverter é trivial: voltar as env vars da
Vercel pros valores originais do Cloud e rebuild. Enquanto o Cloud não for
deletado, ele continua funcional.

---

## 6. Ordem resumida (TL;DR)

1. Export dump + storage do Cloud.
2. Criar projeto Supabase novo + extensões.
3. `supabase db push` (schema).
4. `psql -f dump.sql` (dados) + upload storage.
5. Recriar trigger `on_auth_user_created`.
6. Configurar auth providers + redirect URLs.
7. Recriar cron jobs.
8. Deploy edge function.
9. Configurar secrets no Supabase.
10. Trocar env vars na Vercel → rebuild → testar em preview → promover.
11. Rotacionar `ONESIGNAL_REST_API_KEY`, tirar `.env` do git, deletar Cloud
    antigo.