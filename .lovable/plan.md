## Escopo

Mantém toda a arquitetura existente (Supabase, hierarquia de papéis, tabelas, queries TanStack, rotas). Foca em (a) refinamento visual premium "regra dos 3 gradientes", (b) funcionalidades novas pedidas (produtividade, gestos mobile, auto-atribuição, layout mobile completo), (c) ajustes finos na lista, badges, header e tela de login.

Não vou recriar componentes que já estão funcionando bem — vou refiná-los.

---

## 1. Design tokens (`src/styles.css`)

- Trocar `--sidebar-from/to` por **sidebar sólido** `#1A3A2E`. Manter `sidebar-gradient` utility mas apontando para cor sólida (sem quebrar imports).
- Adicionar utilities: `lz-btn-primary` (gradiente `#C8D44E → #A8B83E` + sombra), `lz-card` (fundo `#1C1C1C` + borda `rgba(255,255,255,0.07)`), `lz-panel` (`#1A1A1A`).
- Adicionar keyframe `lz-grow-bar` (scaleY 0→1, 300ms ease-out) para barras de produtividade.
- Header app: classe utility com `backdrop-filter: blur(16px)` e fundo `rgba(13,13,13,0.9)`.

## 2. Sidebar (`Sidebar.tsx`)

- Trocar fundo para sólido `#1A3A2E`.
- Cliente ativo: já tem a linha left 3px — manter, garantir fundo `rgba(200,212,78,0.12)`.
- Botão "+ Novo cliente" no header da seção Clientes: aplicar `lz-btn-primary` (mini variante).
- Avatar branco: quando `color === '#FFFFFF'`, renderizar inicial em `#0D0D0D` (ajustar `Avatar.tsx`).
- Adicionar `#FFFFFF` à `PRESET_COLORS` em `utils.ts`.

## 3. Header app + Notificações

- Aplicar `backdrop-blur` no header principal (provavelmente em `App.tsx` ou `ClientView.tsx`).
- Avatar do usuário: borda 2px `#C8D44E`.
- Sino (`Notifications.tsx`): badge vermelho `#E5484D` com contador, dropdown com timestamp relativo, "Marcar todas como lidas". Verificar se já existe e refinar.

## 4. Dashboard (`Dashboard.tsx`)

- Cards: borda top 3px na cor do cliente, hover `translateY(-2px)` + borda top vira `#C8D44E`.
- Progress ring: gradiente `#C8D44E → #8FA832` via `<linearGradient>` SVG (único gradiente de elemento).
- Header "Visão Geral": 40px font-weight 800, subtítulo com contagem em `#C8D44E`.

## 5. Lista de conteúdo (`ContentRow.tsx`)

- Altura 64px, número 14px bold `#C8D44E`, título 15px medium.
- Badge: ícone Lucide 12px + texto 11px uppercase bold, cores sólidas conforme spec.
- Stack de avatares 28px com tooltip; avatar vazio "+" abre dropdown de auto-atribuição (membro) ou atribuição (admin).
- Drive icon: opacity 0.4 vazio, `#C8D44E` preenchido.
- Animação `lz-flash` na linha recém-atualizada (já existe — garantir trigger via `lastUpdatedId` no UI store).

## 6. Detail panel (`DetailPanel.tsx`)

- Stack de avatares + botão "+" dropdown com lista de colaboradores.
- Membro: auto-atribuir/desatribuir somente a si mesmo. Admin: qualquer um.
- Slide-in `cubic-bezier(0.16,1,0.3,1)` 280ms (já configurado).

## 7. Minhas Demandas / Produtividade (`MyTasks.tsx`)

Adicionar bloco "Produtividade":
- Server fn `getProductivityStats({ userId, monthKey })` que conta `comments is_system + status FINALIZADO` agrupados por semana do mês, e os últimos 6 meses.
- Gráfico 4 barras (uma por semana). Barra de maior valor recebe gradiente; demais sólido `rgba(200,212,78,0.25)`. Número acima, hover tooltip com títulos finalizados.
- Linhas "Melhor semana" e "Média".
- Histórico 6 meses colapsável (linha do tempo horizontal).

## 8. Tela de login (`auth.tsx`)

- Card central `#1A1A1A`, borda `rgba(200,212,78,0.2)`.
- Inputs com focus borda `#C8D44E`.
- Botão "Entrar" com `lz-btn-primary`.

## 9. Configurações (`Settings.tsx`)

Garantir que Master vê:
- Lista colaboradores (avatar, nome, email, badge de função).
- Dropdown alterar função.
- Toggle ativar/desativar.
- Botão "Ver dashboard do colaborador" → seta `viewAsUserId` no UI store e abre Minhas Demandas.
- Modal "+ Novo colaborador".

(Setor admin não vê esta tela — botão settings só aparece para Master, já implementado.)

## 10. Mobile (< 768px)

Componente novo `MobileShell.tsx`:
- Bottom nav fixa com 4 ícones (Demandas, Clientes, Bell, Avatar). Active `#C8D44E`.
- Lista de clientes em tela cheia ao tocar em "Clientes".
- Header do cliente: "← Voltar" + avatar 32px + nome + mês.
- Tabs largura total.
- Lista 56px, badge só ícone, avatares 24px, sem quebra de linha.
- Detail: bottom sheet 90vh, drag-to-close (gesture via touch events simples).
- Swipe left = abrir popover de status; swipe right = marcar como visto (cria notification read).

Detectar mobile via `useIsMobile()` (já existe em `src/hooks/use-mobile.tsx`) e branch no `App.tsx`.

## 11. Microinterações

- Badge pulse 200ms ao mudar status (já existe `lz-pulse`).
- Card hover translateY (Tailwind transition).
- `lz-flash` na linha recém-atualizada.
- Skeleton screens (já existem) — manter.

---

## Notas técnicas

- Sem mudanças de schema. Produtividade é derivada de `comments` (linhas system de status change para `FINALIZADO`) ou `content_items.updated_at WHERE status = 'FINALIZADO'` — usar a segunda, mais simples.
- `getProductivityStats` é server fn protegida (`requireSupabaseAuth`). Admin pode passar `userId` arbitrário; membro só pode ler o próprio (validar no handler).
- Manter compatibilidade com `Sidebar` portal menu (recém-corrigido).
- Não tocar em `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts`, `types.ts`.

## Fora do escopo

- Não adiciono OAuth Google (não foi pedido aqui).
- Não migro para outra arquitetura de gestos (uso touch events nativos, sem libs novas).
- Não adiciono testes E2E — verificação visual via preview.
