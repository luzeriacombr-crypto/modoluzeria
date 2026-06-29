# Roadmap consolidado — Luzeria Estúdio v2

Tudo aprovado. Plano final em **4 fases**, com a aba **Relatório** em Configurações sendo expandida progressivamente a cada fase.

---

## FASE 1 — Ficha do Cliente + Prazos + Lead Time + Status "Bloqueado"

### 16. Ficha do Cliente
Painel lateral ao clicar no nome do cliente (ícone de info na sidebar).
- **Sobre o cliente** — texto livre (briefing, tom de voz, do's & don'ts)
- **Links importantes** — lista editável (label + URL + tipo: Drive, Instagram, site, planilha, WhatsApp)
- **Contatos** — nome + cargo + telefone/email
- **Senhas/acessos** — campo protegido (só Master e Setor)
- **Responsáveis fixos** — quem cuida desse cliente por padrão
- Editável por Master/Setor; Membro só visualiza (sem senhas)

### 1. Deadline por item
- Campo `due_date` em Post/Reel/Outro
- Badge: verde (no prazo), amarelo (≤3 dias), vermelho (atrasado)
- Ordenação por prazo em "Minhas Demandas"

### 6. Lead time (tempo de ciclo)
- `started_at` e `finished_at` automáticos
- Métrica de tempo médio de entrega por categoria e por membro

### B. Status "Aguardando cliente / Bloqueado"
- Novo estado no pipeline com **motivo obrigatório**
- Tempo nesse estado **não conta como atraso da agência**
- Visualmente diferenciado (cinza-laranja)

**Relatório (aba Visão Geral + Produtividade):**
- Tempo médio de entrega
- % de itens bloqueados e por quê
- Itens atrasados vs no prazo

---

## FASE 2 — Autogestão diária

### 5. "Meu Dia"
- Nova tab em "Minhas Demandas" com o que vence hoje/amanhã
- Contador de carga semanal

### 3. Checklist por tarefa
- Subtarefas no painel de detalhe (templates por tipo: Reel ≠ Post)
- % conclusão visível na lista

### 4. Briefing e referências
- Campo de texto rico + upload de imagens/links de referência por item

### A. Metas individuais por membro
- Cada membro tem meta mensal (ex: Maria = 15 reels)
- Definida pelo Master no painel do membro
- Aparece no ranking como "12/15 (80%)"

**Relatório (aba Por Membro expandida):**
- Meta vs entregue por membro
- Carga atual (WIP) por membro
- Performance individual

---

## FASE 3 — Coleta de dados estratégicos

### 7. Tempo parado por status
- Timestamp de cada mudança → identifica gargalos do processo
- Gráfico "Onde os itens travam?"

### 8. Retrabalho
- Contar `reopened_count` por item
- Vira métrica de qualidade

### 9. Histórico do item
- Timeline visível no painel: quem mudou o quê e quando

### 11. Aprovação do cliente
- Status final: "Aprovado de primeira" vs "Pediu ajustes"
- % de aprovação por editor

### D. Avaliação interna de qualidade
- Ao finalizar item, Master/Setor dá nota rápida (👍 ok / ⭐ excelente / ⚠️ ajustar)
- Compõe métrica de qualidade junto com retrabalho e aprovação

**Relatório (nova aba Qualidade):**
- % aprovação 1ª vez por membro
- Notas internas médias
- Retrabalho por membro
- Mapa de gargalos por status

---

## FASE 4 — Processo, escala e exportação

### 13. Recorrência automática
- Template mensal por cliente (X posts + Y reels)
- Botão "Gerar mês de [mês]" cria tudo automaticamente

### 12. Comentários com @menção + resolução
- @nome dispara notificação direta
- Botão "marcar como resolvido"

### 14. Folgas e feriados
- Calendário de ausências (afeta Stories/Limpeza e capacidade)

### 15. Onboarding de cliente novo
- Wizard de 3 passos: dados + ficha + template recorrente

### C. Log de presença/atividade
- Última vez no app, última ação
- Aparece no painel do membro (sem ser vigilância — sinal de engajamento)

### E. Export PDF do relatório
- Além do Excel já existente, exportar relatório mensal em PDF formatado

**Relatório (aba Por Cliente + Export expandido):**
- Entregas por cliente, prazo médio, status
- Botões: Excel | PDF
- Filtros: período, cliente, membro, categoria

---

## Estrutura final da aba Relatório (Configurações)

```
CONFIGURAÇÕES
├── Equipe (já existe)
└── Relatório
    ├── Visão Geral       — resumo mês, lead time, bloqueados
    ├── Produtividade     — tempo parado, gargalos, meta vs entregue
    ├── Qualidade         — aprovação 1ª vez, notas, retrabalho
    ├── Por Membro        — meta, carga, presença, performance
    ├── Por Cliente       — entregas, prazo médio, ficha resumo
    └── Export            — Excel | PDF, filtros avançados
```

---

## Tabelas novas/alteradas (resumo técnico)

- `clients` → `description`, `notes`
- `client_links`, `client_contacts`, `client_secrets` (nova) — ficha
- `content_items` → `due_date`, `started_at`, `finished_at`, `reopened_count`, `blocked_reason`, `client_approval`, `internal_rating`
- `item_checklists`, `item_references` (novas)
- `status_history` (nova) — para tempo parado
- `member_goals` (nova) — metas individuais mensais
- `member_absences` (nova) — folgas
- `client_templates` (nova) — recorrência
- `content_items` ganha novo status `BLOQUEADO` no enum

Tudo com RLS no padrão Master/Setor/Membro já estabelecido.

---

## Ordem de execução

Vou começar **agora pela Fase 1** completa (Ficha do Cliente + Prazos + Lead Time + Status Bloqueado + Relatório base). Ao terminar, sigo para a Fase 2, e assim por diante.

Cada fase termina com a aba Relatório atualizada com as novas métricas daquela fase, então você já vai vendo dados úteis desde a primeira entrega.