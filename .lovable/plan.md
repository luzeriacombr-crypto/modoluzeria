## Resumo
Redesign visual completo do app Luzeria + sistema de autenticação com 3 níveis de hierarquia, dashboard pessoal "Minhas Demandas", gerenciamento de colaboradores e notificações em tempo real.

Toda lógica atual de produção (clientes, meses, posts/reels, status, drive, comentários) é preservada — vai migrar para o backend (Lovable Cloud) para suportar multi-usuário e atribuições múltiplas.

---

## PARTE 1 — Backend (Lovable Cloud / Supabase)

Habilitar Lovable Cloud. Migrations:

**Auth & roles**
- `app_role` enum: `master`, `setor`, `member`
- `profiles` (id=auth.users.id, name, email, color, avatar_icon, active bool) + trigger `handle_new_user`
- `user_roles` (user_id, role) + função `has_role(uid, role)` SECURITY DEFINER
- Função `is_admin(uid)` = master OR setor (helper)

**Domínio**
- `clients` (id, name, color, icon, favorite, archived, niche, posts_per_week, reels_per_week, fixed_responsible_id, review_day, notes, created_at)
- `months` (id, client_id, key "YYYY-MM")
- `content_items` (id, month_id, type post|reel, idx, title, status, copy, drive_link, updated_at)
- `item_assignees` (item_id, user_id) — múltiplos responsáveis
- `comments` (id, item_id, author_id, text, is_system bool, created_at)
- `notifications` (id, user_id, type, item_id, message, read bool, created_at)

**RLS** (todas tabelas com `ENABLE ROW LEVEL SECURITY` + GRANTs explícitos):
- SELECT: qualquer authenticated (todos veem tudo, conforme spec)
- INSERT/UPDATE/DELETE em clients/months/items: apenas `is_admin`
- `item_assignees`: admin pode tudo; membro só pode inserir/deletar `user_id = auth.uid()` (auto-atribuição)
- `comments`: authenticated insere o próprio; admin deleta
- `profiles`: SELECT all authenticated; UPDATE master ou self (campos não-críticos)
- `user_roles`: SELECT authenticated; INSERT/UPDATE/DELETE só master
- `notifications`: SELECT/UPDATE só do próprio user; INSERT via trigger

**Triggers de notificação**
- Ao inserir em `item_assignees` → notifica user
- Ao mudar `status` em `content_items` → notifica todos assignees + cria comment system
- Ao inserir comment não-system → notifica todos assignees (exceto autor)

**Seed dos 5 colaboradores iniciais**: criar via Supabase Auth Admin com senha temporária (instruir o user a fazer reset). Como não temos as senhas, melhor: criar registros em `profiles` placeholder + roles, e instruir cada um a se cadastrar com o email exato — o trigger `handle_new_user` vincula a row existente pelo email (ou cria role default `member`, e o master promove depois).

Decisão: criar via `supabaseAdmin.auth.admin.createUser` numa server function de seed (executada uma vez pelo master no primeiro acesso) com senha aleatória e enviar magic link. **Simplificação**: deixar master criar via UI de "Novo colaborador" (usando admin API) — os 5 iniciais são inseridos via SQL apenas em `pending_invites` table OU instruímos cadastro manual. **Vou usar**: ao primeiro signup do email `junior.reis@live.com`, trigger atribui role `master` automaticamente; demais emails da lista recebem role pré-definida via tabela `role_assignments_pending` consultada no trigger.

---

## PARTE 2 — Frontend Auth

- `/auth`: tela login (email + senha + sign up) estilo Luzeria
- `_authenticated/` layout (managed) — toda app passa pra dentro
- `useAuth` hook expõe `user, profile, role, isMaster, isAdmin`
- `signOut` no rodapé sidebar

## PARTE 3 — Refatorar store

Substituir Zustand+localStorage por TanStack Query + server functions (`createServerFn` com `requireSupabaseAuth`):
- `listClients`, `createClient`, `updateClient`, `archiveClient`, `deleteClient`, `duplicateMonth`
- `listMonth(clientId, monthKey)` → posts + reels + assignees + comments
- `updateItem`, `setStatus`, `addAssignee`, `removeAssignee`, `addComment`
- `listNotifications`, `markRead`, `markAllRead`
- `listProfiles`, `updateRole`, `setActive`, `createCollaborator` (master only)

Realtime: subscribe a `notifications` e `content_items` para invalidar queries.

## PARTE 4 — Redesign Visual

Atualizar tokens em `src/styles.css`:
- Sidebar com gradiente vertical `#1A3A2E → #0D1F18`
- Font Inter via `<link>` em `__root.tsx`
- Animação `lz-flash` 1.5s, `slide-in` cubic-bezier
- Borda esquerda 3px accent no cliente ativo

Componentes redesenhados:
- `Sidebar`: gradiente, separador accent 20%, "Minhas Demandas" no topo com badge, rodapé com perfil + settings + logout
- `Dashboard`: header "Visão Geral" 32px, cards com borda top na cor + progress ring SVG + 5 chips com contagem
- `ClientView`: header com avatar 40, mês pill com chevrons, tabs underline
- `ContentRow` (64px): número accent, stack de avatares sobrepostos com tooltip, botão "+"
- `DetailPanel`: número uppercase + título 20px, status grid 2x3, stack de responsáveis com dropdown de atribuição, comentários system com left-border accent
- `MyTasks` page: agrupado por status, chip de cliente, dropdown "Ver como" pra admins
- `Collaborators` page (só master): lista, toggle ativo, dropdown role, "+ Novo"
- `NotificationsBell` no header: dropdown com lista, marcar como lida

Cores de avatar incluindo `#FFFFFF` (com texto `#0D0D0D`).

## PARTE 5 — Microinterações
- `scale(1.1)` 200ms em badge ao mudar status
- `translateY(-2px)` hover card
- Slide-in `cubic-bezier(0.16,1,0.3,1)` no painel
- `lz-flash` 1.5s na linha atualizada

---

## Detalhes técnicos
- Stack: TanStack Start + Supabase + TanStack Query
- Server functions em `src/lib/*.functions.ts` com `requireSupabaseAuth`
- Trigger pre-assign roles para os 5 emails iniciais
- Realtime via canal `postgres_changes` em `notifications` (filtrado por user_id)
- Validação Zod em todas inputs
- Loading: skeletons (mantém o princípio existente)

---

## Confirmações antes de partir
1. **OK criar conta dos 5 colaboradores via "self-signup" com role pré-atribuída por email?** Alternativa: master cria todos via admin API depois (mais trabalho de UX).
2. **OK desativar email confirmation** no Supabase pra acelerar onboarding interno?
3. **Migrar dados mock atuais (Thamara Leal Jun/2026 etc) para o banco como seed?**