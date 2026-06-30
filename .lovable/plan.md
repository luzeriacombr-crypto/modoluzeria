## Ajustes nas notificações (mobile)

### 1. Remover botão "Bell" da bottom nav mobile
`src/components/luzeria/MobileNav.tsx`:
- Remover o `<NavBtn icon={<Bell .../>} ...>` da barra inferior.
- Remover o painel `tab === "bell"` (sheet de notificações da bottom nav).
- Remover o estado/tipo `"bell"` do `useState<"home" | "clients" | "bell" | "me">`.
- Limpar imports não usados (`Bell`, `notificationsQO`, `markNotificationRead`, contagem `unread`).
- O sino do header (`NotificationsBell` em `App.tsx`) continua visível no mobile (já aparece hoje).

### 2. Popup de notificações ocupa a tela no mobile
`src/components/luzeria/Notifications.tsx`:
- Hoje o popup é fixo em `380px` posicionado abaixo do botão — no mobile estoura/atrapalha.
- Detectar mobile via `useIsMobile()`. Quando mobile:
  - Renderizar como **fullscreen sheet**: `position: fixed; inset: 0; width: 100vw; height: 100vh; border-radius: 0`.
  - Header do popup com botão "Fechar" (X) à esquerda além do "Marcar todas como lidas".
  - Lista ocupa altura restante com scroll próprio.
  - Adicionar backdrop escuro semi-transparente atrás (clicável para fechar).
- No desktop: manter exatamente o comportamento atual (popup 380px ancorado ao sino).

Sem mudanças de lógica/dados — apenas UI.
