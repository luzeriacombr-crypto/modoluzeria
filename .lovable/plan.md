# Plano: Automações & Lembretes + Performance/Polish Mobile

Duas frentes em paralelo, mantendo toda a lógica e UI existentes.

---

## Parte 1 — Automações & Lembretes

### 1.1 Motor de alertas de atraso (server-side)
- Nova server function `runDeadlineAlerts` (em `src/lib/luzeria/automations.functions.ts`) que roda diariamente via `pg_cron` + `pg_net` chamando `/api/public/hooks/deadline-alerts`.
- Regras de notificação:
  - **D-2** do prazo: aviso "Prazo se aproximando" para responsável + editor.
  - **D-0** (mesmo dia): aviso "Vence hoje".
  - **D+1** em diante: aviso "Em atraso" (1x por dia, com cooldown).
- Deduplicação via `deadline_notifications_log` (já existe) — chave `(item_id, kind, sent_on)`.

### 1.2 Resumo diário "Minha agenda" (push interno)
- Notificação `daily_digest` gerada às 8h (Brasília) para cada colaborador ativo, listando:
  - Demandas com prazo hoje
  - Stories do dia (se for o turno dele)
  - Limpeza do dia (se for ele)
  - Itens travados que voltaram a estar disponíveis
- Aparece no sino + dropdown desktop com badge especial "📅 Hoje".

### 1.3 Recorrências automáticas (extensão do que já existe)
- Auditar `recurring_templates`: garantir geração no 1º dia do mês para todos os clientes ativos.
- Adicionar tela em **Configurações → Recorrências** (Master) para visualizar próxima execução e disparar manualmente "Gerar agora".

### 1.4 Lembrete por e-mail (opcional, opt-in no perfil)
- Toggle "Receber resumo diário por e-mail" em `ProfilePage.tsx`.
- Usa infraestrutura de e-mail da Lovable Cloud (domínio próprio se já configurado, fallback default).
- Conteúdo idêntico ao digest interno.

---

## Parte 2 — Performance & Polish Mobile

### 2.1 Modal de detalhes em mobile (bottom sheet refinado)
- Swipe-down para fechar (gesto nativo, threshold 100px).
- Header sticky com título + botão fechar maior (44x44 hit target).
- Tabs internas (Briefing | Mídia | Arquivos | Comentários) ao invés de scroll longo de duas colunas empilhadas.

### 2.2 Gestos e ergonomia mobile
- Swipe-left na linha de conteúdo (`ContentRow.tsx`) revela ações rápidas: ✓ Concluir, 💬 Comentar, 🗑 Excluir.
- Long-press em card de "Minhas Demandas" abre menu de status sem precisar abrir modal.
- Pull-to-refresh nas listas principais (Minhas Demandas, Cliente).

### 2.3 Performance de queries
- Paginação/virtualização em listas longas:
  - `ClientView` com mais de 30 itens → `react-virtual` (já leve).
  - Histórico de comentários paginado (20 por página).
- Lazy-load de miniaturas com `IntersectionObserver` (só busca URL do Drive quando entra no viewport).
- Cache de URLs assinadas do Drive por 50min (atualmente refaz request todo render).

### 2.4 Polish de formulários complexos
- Auto-save (debounce 1500ms) em Briefing/Legenda no `DetailPanel` — remove botão Salvar manual.
- Indicador visual "Salvando…" / "✓ Salvo" no canto do modal.
- Atalhos teclado: `Esc` fecha, `Cmd+Enter` envia comentário.

---

## Detalhes Técnicos

**Banco:**
- Tabela `notification_preferences` (user_id, daily_digest_enabled, email_enabled, digest_hour).
- Índice em `content_items(deadline_at)` para varredura eficiente do cron.

**Cron jobs (pg_cron):**
- `deadline-alerts` — diário 07:00 BRT
- `daily-digest` — diário 08:00 BRT
- `recurring-monthly` — dia 1 às 06:00 BRT

**Rotas server:**
- `src/routes/api/public/hooks/deadline-alerts.ts`
- `src/routes/api/public/hooks/daily-digest.ts`
- `src/routes/api/public/hooks/recurring-monthly.ts`

**Componentes novos:**
- `src/components/luzeria/AutomationsTab.tsx` (Settings)
- `src/hooks/useSwipeGesture.ts`
- `src/hooks/usePullToRefresh.ts`

**Dependências:**
- `@tanstack/react-virtual` (virtualização)
- Demais usam APIs nativas (Pointer/Touch events).

---

## Ordem de execução
1. Backend de automações (cron + tabela + server functions + rotas hook).
2. UI de preferências de notificação no perfil.
3. Aba de Recorrências em Configurações.
4. Bottom sheet com tabs + gestos.
5. Virtualização + cache de miniaturas.
6. Auto-save no modal de detalhes.

Posso quebrar em entregas menores se preferir validar etapa por etapa.