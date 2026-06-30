## Objetivo
Adicionar botão "Resetar senha" na tela de gestão de usuários (Configurações → Equipe ativa) que envia um link de redefinição por email para o usuário escolhido.

## Mudanças

### Backend — `src/lib/luzeria/api.functions.ts`
Adicionar `adminSendPasswordReset` (createServerFn, POST):
- Middleware `requireActiveProfile` + verifica `is_admin`.
- Carrega `supabaseAdmin` dentro do handler.
- Usa `supabaseAdmin.auth.admin.generateLink({ type: "recovery", email })` para gerar o link de recuperação e disparar o email do Supabase Auth.
- Recebe `{ userId }`, busca o email via `admin_list_profile_emails` (ou direto pelo `auth.admin.getUserById`).
- Retorna `{ ok: true }`.

### Queries — `src/lib/luzeria/queries.ts`
Expor `adminSendPasswordReset` no hook `useApi()` como `useMutation`.

### UI — `src/components/luzeria/Settings.tsx`
Em cada card da lista "Equipe ativa", adicionar botão "Resetar senha" (ícone `KeyRound` do lucide):
- Estilo discreto, alinhado com o checkbox/select de role.
- `onClick` abre confirmação inline (`window.confirm` ou toast.promise) e chama `adminSendPasswordReset.mutate({ data: { userId: p.id } })`.
- Toast de sucesso: "Email de redefinição enviado para {email}".
- Desabilita-se enquanto pending; permitido inclusive para o próprio admin.

## Detalhes técnicos
- O email é enviado pelo template padrão `recovery` do Supabase Auth (já configurado).
- Redirect: `redirectTo` aponta para `${SITE_URL}/reset-password` — como não existe essa rota hoje, o link levará à home logada. Se quiser uma página dedicada de redefinir senha (`/reset-password` com `supabase.auth.updateUser({ password })`), posso incluir no mesmo passo — me avise.