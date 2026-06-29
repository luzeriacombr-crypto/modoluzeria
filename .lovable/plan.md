
# Redesign do DetailPanel — Modal centralizado

Mantém 100% das funcionalidades atuais (status, responsáveis, editor, tipo de vídeo, prazo, checklist, qualidade, comentários, arquivos, motivo de travamento, retrabalho, timeline). Só muda o **container visual**, a **organização em 2 colunas**, e adiciona **Preview da mídia** + **Legenda**.

## 1. Container — slide lateral vira modal

Em `src/components/luzeria/DetailPanel.tsx`:

- Remover o slide-in lateral (`md:right-0 md:top-0 md:w-[420px]`) e o overlay atual.
- Novo wrapper: `fixed inset-0 z-50 flex items-center justify-center p-4`.
  - Overlay: `bg-black/75 backdrop-blur-[8px]`, clicar fora fecha.
  - Card: `w-[760px] max-w-full max-h-[90vh] rounded-2xl bg-[#1A1A1A] border border-white/[0.08] shadow-2xl flex flex-col overflow-hidden`.
  - Animação entrada: nova keyframe `lz-modal-in` em `src/styles.css` — `scale(0.96)+opacity 0 → scale(1)+opacity 1` em 200ms `cubic-bezier(0.16,1,0.3,1)`.
- Botão X mantido no canto superior direito.
- Substituir o listener `mousedown` por click no overlay (mais previsível com inputs/popovers internos).

## 2. Layout interno

```
┌─ HEADER (full) ─────────────────────────────────────┐
│ POST 01 · CLIENTE     [retrabalho×N]            [X] │
│ Título editável inline (22px bold)                  │
├─ COLUNA ESQUERDA 55% ──┬─ COLUNA DIREITA 45% ──────┤
│ Preview Drive (200px)  │ Status (grid 2 cols)      │
│ Briefing (textarea)    │ Responsáveis              │
│ Legenda (textarea+cnt) │ Editor (só Reels)         │
│ Comentários + timeline │ Tipo de Vídeo (só Reels)  │
│                        │ Prazo                     │
│                        │ Motivo travamento (cond.) │
│                        │ Checklist                 │
│                        │ Qualidade                 │
│                        │ Arquivos (FilesSection)   │
└────────────────────────┴───────────────────────────┘
```

- Grid responsivo: `md:grid md:grid-cols-[55fr_45fr] md:gap-6`, mobile vira coluna única com scroll.
- Cada coluna tem seu próprio scroll interno (`overflow-y-auto`) dentro do `max-h-[90vh]`.
- Labels de seção viram `text-[10px] uppercase font-bold tracking-wider text-[#C8D44E]` (helper `Section` já existe, ajustar cor).

## 3. Preview da mídia (novo)

Componente local `DrivePreview` na coluna esquerda:
- Reutiliza `getDriveThumbnail` (já usado em `FilesSection`) passando o `driveLink` (extrai o `fileId` via regex Drive padrão — `/d/([\w-]+)/` ou `id=([\w-]+)`).
- Renderiza `<img>` 200px de altura, largura total, `object-cover`, `rounded-[10px]`.
- Hover: overlay `bg-black/50` + `<ExternalLink />` centralizado.
- Click: `window.open(normalizedDriveUrl, '_blank', 'noopener,noreferrer')`.
- Vazio: área tracejada `border-dashed border-white/15` com ícone de upload e texto "Cole o link do Drive" — clicar abre o input de link existente.

## 4. Legenda (novo campo)

- DB: migration adicionando `caption text` em `public.content_items` (default `''`, not null).
- Tipos: estender `ContentItem` com `caption: string`.
- Mapeamento: incluir em `addContentItem`, `getMonth`, `updateItem` (whitelist do patch) em `src/lib/luzeria/api.functions.ts`.
- UI: textarea `bg-[#252525] rounded-md` com contador de caracteres (canto inferior direito, `text-white/50`), salva no `onBlur` igual ao briefing.

## 5. Mobile (bottom sheet)

- `< md`: modal vira `inset-x-0 bottom-0 rounded-t-2xl max-h-[92vh] w-full` com handle bar no topo (já existe).
- Conteúdo: coluna única scrollável; ordem = esquerda → direita.

## 6. Renomear "Copy" → "Briefing"

- Apenas a label visível no modal vira "BRIEFING". O campo no banco (`copy`) continua como está para não quebrar dados existentes.

## Detalhes técnicos

- Arquivos a editar: `src/components/luzeria/DetailPanel.tsx` (reescrita estrutural), `src/lib/luzeria/types.ts`, `src/lib/luzeria/api.functions.ts`, `src/styles.css`.
- Migration nova: `caption` em `content_items`.
- Nenhuma mudança em `Sidebar`, `ContentRow`, `MyTasks`, lógica de status/RLS/permissões.
- `QualityModal`, `MentionInput`, `FilesSection`, `ItemTimeline`, `Avatar` — todos reaproveitados sem mudança.
- Z-index: modal `z-50`; `FilesSection` e dropdowns internos sobem para `z-[60]` se necessário para não serem cortados pelo `overflow-hidden` do card.
