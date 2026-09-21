import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { setMyTasksDefaultLayout } from "@/lib/luzeria/my-tasks-layout.functions";
import { myTasksDefaultLayoutQO, topMembersQO, myTasksQO, myTodayQO, productivityQO, myActivityCountsQO, memberFinalizationsQO, myWorkStatsQO, profilesQO, myMentionsQO, weeklyClientRemindersQO, todayPublicationsQO, upcomingCalendarEventsQO, clientsQO, clientPaymentsQO, contentStatusesQO, myStoriesTodayQO, useMe, useApi } from "@/lib/luzeria/queries";
import { STATUS_ORDER, CONTENT_TYPE_LABEL, POST_FORMAT_LABEL, hasPermission, getStatusMeta, type Status } from "@/lib/luzeria/types";
import { getStatusIcon } from "./icons";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, List, CalendarDays, CalendarClock, Clock, Check, X, AtSign, MessageCircle, Instagram, ChevronDown, ChevronUp, ChevronRight, Plus, ChevronLeft, Film, Image as ImageIcon, Wallet, Video, FileText, Send, Video as VideoIcon, MapPin, Users, SlidersHorizontal, Eye, EyeOff, Lock, RotateCcw, Crown, Medal, Flame, GripVertical } from "lucide-react";
import { formatMonth, deadlineInfo } from "@/lib/luzeria/utils";
import { MyWeekView } from "./MyWeekView";
import { getDailyVerse } from "@/lib/luzeria/daily-verse";
import { StoriesInspiracoesButton, StoriesInspiracoesModal } from "@/components/luzeria/StoriesInspiracoesModal";

const ProductivityBlock = lazy(() =>
  import("./ProductivityChart").then((m) => ({ default: m.ProductivityBlock })),
);

// Cada seção de Minhas Demandas (publicações de hoje, avisos, menções, e
// cada status da lista) pode ser expandida/escondida — guarda um mapa
// { sectionId: aberto } no localStorage, aberto por padrão quando ausente.
const SECTIONS_OPEN_KEY = "lz.myTasksSectionsOpen";
function readOpenSections(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SECTIONS_OPEN_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function SectionHeader({ icon, iconBg, iconColor, label, count, open, onToggle }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; count: number;
  open: boolean; onToggle: () => void;
}) {
  return (
    <button onClick={onToggle} className="w-full flex items-center gap-2 mb-2.5 text-left">
      <span className="rounded-md p-1" style={{ backgroundColor: iconBg, color: iconColor }}>{icon}</span>
      <h2 className="text-[11.5px] uppercase font-semibold tracking-wide text-foreground/60">{label}</h2>
      <span className="text-[11px] text-foreground/40">· {count}</span>
      <span className="ml-auto text-foreground/40">
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </span>
    </button>
  );
}


// ---- Personalização da página (ordem + o que fica visível), por pessoa/aparelho.
const MY_TASKS_BLOCKS: { id: string; label: string; hint: string; locked?: boolean }[] = [
  { id: "daily", label: "Rotina do dia", hint: "Stories e tarefas de rotina que caem hoje", locked: true },
  { id: "kpis", label: "Resumo", hint: "Atrasadas, hoje e próximos 7 dias (também filtram a lista)" },
  { id: "month", label: "Seu mês", hint: "Atividades e estatísticas de trabalho" },
  { id: "agenda", label: "Agenda do Google", hint: "Seus compromissos dos próximos dias" },
  { id: "pubs", label: "Publicações de hoje", hint: "O que vai ao ar hoje no Instagram" },
  { id: "list", label: "Lista de demandas", hint: "O coração da página", locked: true },
  { id: "whatsapp", label: "Avisar clientes no WhatsApp", hint: "Atualizações semanais pendentes" },
  { id: "payments", label: "Pagamentos próximos", hint: "Cobranças que vencem em breve" },
  { id: "mentions", label: "Mencionado em", hint: "Comentários em que te marcaram" },
  { id: "productivity", label: "Produtividade", hint: "Gráfico de entregas do mês" },
];
const LOCKED_BLOCKS = new Set(MY_TASKS_BLOCKS.filter((b) => b.locked).map((b) => b.id));
type MyTasksLayout = { order: string[]; hidden: string[] };
const DEFAULT_LAYOUT: MyTasksLayout = { order: MY_TASKS_BLOCKS.map((b) => b.id), hidden: [] };

function normalizeLayout(raw: any): MyTasksLayout {
  const known = new Set(MY_TASKS_BLOCKS.map((b) => b.id));
  const saved: string[] = Array.isArray(raw?.order) ? raw.order.filter((id: string) => known.has(id)) : [];
  // Blocos novos (que a pessoa nunca viu) entram no fim, na ordem padrão.
  const order = [...saved, ...DEFAULT_LAYOUT.order.filter((id) => !saved.includes(id))];
  const hidden: string[] = Array.isArray(raw?.hidden) ? raw.hidden.filter((id: string) => known.has(id) && !LOCKED_BLOCKS.has(id)) : [];
  return { order, hidden };
}

function useMyTasksLayout(userId: string | undefined, teamDefault: MyTasksLayout | null | undefined): {
  layout: MyTasksLayout; setLayout: (l: MyTasksLayout) => void; reset: () => void;
} {
  const key = `lz.myTasksLayout.${userId ?? "anon"}`;
  const read = (): MyTasksLayout | null => {
    if (typeof window === "undefined") return null;
    try { const raw = window.localStorage.getItem(key); return raw ? normalizeLayout(JSON.parse(raw)) : null; } catch { return null; }
  };
  const [saved, setSaved] = useState<MyTasksLayout | null>(read);
  // O usuário só chega depois do carregamento: relê quando a chave passa a ter o id de verdade.
  useEffect(() => { setSaved(read()); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const layout = saved ?? (teamDefault ? normalizeLayout(teamDefault) : DEFAULT_LAYOUT);
  const setLayout = (l: MyTasksLayout) => {
    setSaved(l);
    try { window.localStorage.setItem(key, JSON.stringify(l)); } catch { /* noop */ }
  };
  // "Restaurar padrão": apaga a personalização e volta pro padrão da casa.
  const reset = () => {
    setSaved(null);
    try { window.localStorage.removeItem(key); } catch { /* noop */ }
  };
  return { layout, setLayout, reset };
}

function CustomizeLayoutModal({ layout, available, onChange, onReset, onSetTeamDefault, onClose }: {
  layout: MyTasksLayout; available: Set<string>; onChange: (l: MyTasksLayout) => void; onReset: () => void;
  onSetTeamDefault?: () => void; onClose: () => void;
}) {
  const rows = layout.order.filter((id) => available.has(id));
  const meta = (id: string) => MY_TASKS_BLOCKS.find((b) => b.id === id)!;
  const [dragId, setDragId] = useState<string | null>(null);
  const rowEls = useRef<Record<string, HTMLDivElement | null>>({});
  const box = useRef<HTMLDivElement>(null);

  // Aplica a nova ordem dos itens visíveis mantendo os "escondidos do modal" nos seus lugares.
  const applyVisibleOrder = (visible: string[]) => {
    const slots = layout.order.map((id, i) => (available.has(id) ? i : -1)).filter((i) => i >= 0);
    const order = [...layout.order];
    slots.forEach((slot, k) => { order[slot] = visible[k]; });
    onChange({ ...layout, order });
  };
  const moveTo = (id: string, target: number) => {
    const from = rows.indexOf(id);
    if (from < 0 || target === from) return;
    const next = [...rows];
    next.splice(from, 1);
    next.splice(target, 0, id);
    applyVisibleOrder(next);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragId) return;
    const y = e.clientY;
    // Rola o modal quando o dedo/mouse chega perto da borda.
    const c = box.current;
    if (c) {
      const r = c.getBoundingClientRect();
      if (y < r.top + 48) c.scrollBy({ top: -14 });
      else if (y > r.bottom - 48) c.scrollBy({ top: 14 });
    }
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const el = rowEls.current[rows[i]];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (y < r.top + r.height / 2) { target = i; break; }
    }
    moveTo(dragId, target);
  };
  const toggle = (id: string) => {
    if (LOCKED_BLOCKS.has(id)) return;
    const hidden = layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id];
    onChange({ ...layout, hidden });
  };
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div ref={box} className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl p-5 max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-base font-semibold text-foreground">Personalizar página</h3>
          <button onClick={onClose} aria-label="Fechar" className="text-foreground/40 hover:text-foreground shrink-0"><X size={16} /></button>
        </div>
        <p className="text-[12.5px] text-foreground/55 mb-4">Arraste pela alça <GripVertical size={12} className="inline -mt-0.5" /> para mudar a ordem e use o olho para ocultar. Fica salvo neste aparelho.</p>
        <div className="grid gap-2" onPointerMove={onPointerMove} onPointerUp={() => setDragId(null)} onPointerCancel={() => setDragId(null)}>
          {rows.map((id, i) => {
            const b = meta(id), hidden = layout.hidden.includes(id) && !b.locked, dragging = dragId === id;
            return (
              <div key={id} ref={(el) => { rowEls.current[id] = el; }}
                className="flex items-center gap-2 rounded-xl border px-2 py-2.5 transition-shadow"
                style={{
                  opacity: hidden ? 0.5 : 1,
                  borderColor: dragging ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                  boxShadow: dragging ? "0 8px 24px rgba(0,0,0,0.35)" : undefined,
                  background: dragging ? "color-mix(in srgb, var(--foreground) 5%, var(--card))" : undefined,
                }}>
                <button type="button" aria-label={`Arrastar ${b.label}`}
                  onPointerDown={(e) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDragId(id); }}
                  onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); moveTo(id, i - 1); } if (e.key === "ArrowDown") { e.preventDefault(); moveTo(id, i + 1); } }}
                  className="shrink-0 p-1.5 rounded-md text-foreground/45 hover:text-foreground cursor-grab active:cursor-grabbing"
                  style={{ touchAction: "none" }}>
                  <GripVertical size={18} />
                </button>
                <div className="min-w-0 flex-1 select-none">
                  <div className="text-[13px] font-semibold text-foreground truncate">{b.label}</div>
                  <div className="text-[11px] text-foreground/45 truncate">{b.locked ? "Sempre visível" : b.hint}</div>
                </div>
                {b.locked ? (
                  <span className="shrink-0 text-foreground/35 p-1.5" title="Este bloco não pode ser ocultado"><Lock size={15} /></span>
                ) : (
                  <button onClick={() => toggle(id)} aria-label={hidden ? "Mostrar" : "Ocultar"} title={hidden ? "Mostrar" : "Ocultar"}
                    className="shrink-0 p-1.5 rounded-md hover:bg-foreground/[0.06]" style={{ color: hidden ? undefined : "var(--lz-accent-ink)" }}>
                    {hidden ? <EyeOff size={16} className="text-foreground/40" /> : <Eye size={16} />}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {onSetTeamDefault && (
          <button onClick={onSetTeamDefault} className="mt-4 w-full text-[12px] font-bold px-4 py-2.5 rounded-xl border border-dashed border-foreground/25 text-foreground/75 hover:text-foreground hover:border-foreground/45 transition-colors">
            Definir esta ordem como padrão para todo o Modo Criador
          </button>
        )}
        <div className="flex items-center justify-between mt-4">
          <button onClick={onReset} className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-foreground/55 hover:text-foreground">
            <RotateCcw size={12} /> Restaurar padrão
          </button>
          <button onClick={onClose} className="lz-btn-primary text-[13px] font-bold px-5 py-2 rounded-full">Pronto</button>
        </div>
      </div>
    </div>
  );
}

const RANK_INFO = [
  { Icon: Crown, color: "#D7FF3F", msg: "Você está em primeiro lugar, parabéns!" },
  { Icon: Medal, color: "#4A9EFF", msg: "Você está em segundo lugar, vamos em frente!" },
  { Icon: Flame, color: "#A78BFA", msg: "Você está em terceiro lugar, ótimo ritmo!" },
];

/** Ícone da colocação (top 3 do ranking do mês) ao lado do nome. Passa o mouse
 * ou toca pra ver a mensagem. */
function RankBadge({ position }: { position: number }) {
  const [open, setOpen] = useState(false);
  const info = RANK_INFO[position];
  if (!info) return null;
  const { Icon } = info;
  return (
    <span className="relative inline-flex align-middle ml-2"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label={info.msg} aria-expanded={open}
        onClick={() => setOpen((v) => !v)} onBlur={() => setOpen(false)}
        className="inline-flex items-center justify-center rounded-full transition-transform hover:scale-110"
        style={{ width: 34, height: 34, background: `${info.color}26`, color: info.color, boxShadow: `0 0 0 1px ${info.color}55 inset` }}>
        <Icon size={18} strokeWidth={2.2} />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-0 top-full mt-2 z-30 w-max max-w-[240px] rounded-xl px-3 py-2 text-[12.5px] font-semibold leading-snug shadow-2xl"
          style={{ background: "#fff", color: "#0D0D0D" }}>
          {info.msg}
        </span>
      )}
    </span>
  );
}

export function MyTasks() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: contentStatuses = [] } = useQuery(contentStatusesQO());
  const effectiveStatusOrder = useMemo(() => {
    const hiddenKeys = new Set(contentStatuses.filter((r) => r.hidden).map((r) => r.key));
    const combined = [...STATUS_ORDER, ...contentStatuses.filter((r) => r.isCustom).sort((a, b) => a.sortOrder - b.sortOrder).map((r) => r.key)];
    return combined.filter((s) => !hiddenKeys.has(s)) as Status[];
  }, [contentStatuses]);
  const labelOverrides = useMemo(() => new Map(contentStatuses.map((r) => [r.key, r.label])), [contentStatuses]);
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { setCleaningDone, markMentionRead, logClientStageUpdate, setAgencyStoriesDone } = useApi();
  const [viewAs, setViewAs] = useState<string>("");
  const targetId = isAdmin && viewAs ? viewAs : me?.id;
  const { data: allTasks = [], isLoading: tasksLoading, isError: tasksError } = useQuery({
    ...myTasksQO(targetId),
    enabled: !!targetId,
  });
  // Só finalizado/concluído some da lista principal — "Pronto para
  // publicar" continua aparecendo, porque ainda precisa de alguém de olho
  // (programar ou publicar na hora certa). Achado num caso real: um post
  // de data comemorativa ficou "Pronto para publicar" dias sem ninguém
  // notar, e perdeu a data — porque sumia daqui e ficava perdido no meio
  // do quadro do cliente.
  const tasks = allTasks.filter((t: any) => t.status !== "FINALIZADO" && t.status !== "CONCLUIDO");
  const { selectMonth, openItem, flash, openFicha, openStageComposer } = useUI();
  const navigate = useNavigate();
  const isMeView = !isAdmin || !viewAs || viewAs === me?.id;
  const disabledFeatures = new Set(me?.disabledFeatures ?? []);
  const whatsappRemindersEnabled = !disabledFeatures.has("whatsapp_reminders");
  const { data: mentions = [] } = useQuery({ ...myMentionsQO(), enabled: isMeView });
  const { data: weeklyReminders = [] } = useQuery({ ...weeklyClientRemindersQO(), enabled: isAdmin && isMeView && whatsappRemindersEnabled });
  const canFinanceiro = me?.role === "master" || hasPermission(me, "view_financeiro");
  const { data: paymentsData } = useQuery({ ...clientPaymentsQO(), enabled: canFinanceiro && isMeView });
  const upcomingPayments = (paymentsData?.clients ?? [])
    .filter((c) => !c.paidThisPeriod)
    .map((c) => ({ ...c, daysUntil: Math.round((new Date(c.nextDueDate + "T00:00:00").getTime() - new Date(new Date().toDateString()).getTime()) / 86400000) }))
    .filter((c) => c.daysUntil <= 7)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  const googleCalendarEnabled = !disabledFeatures.has("google_calendar");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(readOpenSections);
  const isSectionOpen = (id: string) => openSections[id] ?? true;
  const toggleSection = (id: string) => {
    setOpenSections((prev) => {
      const next = { ...prev, [id]: !(prev[id] ?? true) };
      try { window.localStorage.setItem(SECTIONS_OPEN_KEY, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  };
  const monthKey = useUI((s) => s.selectedMonthKey);
  const { data: rankData } = useQuery({ ...topMembersQO("month", monthKey), enabled: !!monthKey && !!me?.id });
  const myRankIdx = (() => {
    if (!isMeView || !me?.id) return -1;
    const list = rankData?.ranking ?? [];
    const i = list.findIndex((r: any) => r.id === me.id);
    return i >= 0 && i < 3 && (list[i] as any).count > 0 ? i : -1;
  })();
  const { data: prod } = useQuery(productivityQO(monthKey, targetId));

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // JS Sunday=0..Saturday=6 → our weekday Monday=0..Saturday=5 (Sunday => -1 skip)
  const dow = now.getDay();
  const weekdayIdx = dow === 0 ? -1 : dow - 1;
  const { data: today } = useQuery({
    ...myTodayQO(todayStr, weekdayIdx, targetId),
    enabled: !!targetId,
  });
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const { data: todayPublications = [] } = useQuery({
    ...todayPublicationsQO(todayStart, todayEnd, targetId),
    enabled: !!targetId,
  });
  const [inspiracoesAbertas, setInspiracoesAbertas] = useState(false);
  // Escala de Stories do perfil da própria agência (Equipe → Rotina).
  const { data: storiesHoje = [] } = useQuery({
    ...myStoriesTodayQO(targetId),
    enabled: !!targetId,
  });

  const [filter, setFilter] = useState<"all" | "late" | "today" | "week">("all");
  const [clientFilter, setClientFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<"status" | "due">("status");
  const daysOf = (t: any): number | null => deadlineInfo(t.dueDate, t.status).days;
  const kpi = {
    late: tasks.filter((t: any) => (daysOf(t) ?? 0) < 0).length,
    today: tasks.filter((t: any) => daysOf(t) === 0).length,
    week: tasks.filter((t: any) => { const d = daysOf(t); return d !== null && d >= 0 && d <= 6; }).length,
    all: tasks.length,
  };
  const clientChips = useMemo(() => {
    const m = new Map<string, { id: string; name: string; color: string; n: number }>();
    tasks.forEach((t: any) => {
      const c = m.get(t.clientId) ?? { id: t.clientId, name: t.clientName, color: t.clientColor, n: 0 };
      c.n += 1; m.set(t.clientId, c);
    });
    return [...m.values()].sort((a, b) => b.n - a.n);
  }, [tasks]);
  const filteredTasks = tasks.filter((t: any) => {
    if (clientFilter && t.clientId !== clientFilter) return false;
    const d = daysOf(t);
    if (filter === "late") return d !== null && d < 0;
    if (filter === "today") return d === 0;
    if (filter === "week") return d !== null && d >= 0 && d <= 6;
    return true;
  });
  const dueGroups = [
    { id: "due:late", label: "Atrasadas", color: "#FF4444", test: (d: number | null) => d !== null && d < 0 },
    { id: "due:today", label: "Hoje", color: "#F5A623", test: (d: number | null) => d === 0 },
    { id: "due:week", label: "Esta semana", color: "#4A9EFF", test: (d: number | null) => d !== null && d > 0 && d <= 6 },
    { id: "due:later", label: "Mais pra frente", color: "#8A8A8A", test: (d: number | null) => d !== null && d > 6 },
    { id: "due:none", label: "Sem prazo", color: "#8A8A8A", test: (d: number | null) => d === null },
  ].map((g) => ({
    ...g,
    items: filteredTasks
      .filter((t: any) => g.test(daysOf(t)))
      .sort((a: any, b: any) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
  })).filter((g) => g.items.length > 0);

  const grouped: Record<Status, typeof tasks> = Object.fromEntries(
    effectiveStatusOrder.map((s) => [s, [] as typeof tasks])
  ) as Record<Status, typeof tasks>;
  filteredTasks.forEach((t) => {
    const s = t.status as Status;
    if (grouped[s]) grouped[s].push(t);
  });
  // Sort each group by due date asc; nulls last.
  (Object.keys(grouped) as Status[]).forEach((s) => {
    grouped[s] = [...grouped[s]].sort((a: any, b: any) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    });
  });

  const targetProfile = profiles.find((p) => p.id === targetId);
  const [view, setView] = useState<"list" | "week">("list");
  const [showNovaDemanda, setShowNovaDemanda] = useState(false);
  const dailyVerse = getDailyVerse();
  const { data: teamDefault } = useQuery(myTasksDefaultLayoutQO());
  const { layout, setLayout, reset: resetLayout } = useMyTasksLayout(me?.id, teamDefault);
  const setTeamDefault = useServerFn(setMyTasksDefaultLayout);
  const qc = useQueryClient();
  const [showCustomize, setShowCustomize] = useState(false);

  const blocks: Record<string, React.ReactNode> = {
    kpis: <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" data-tour="my-kpis">
        {([
          { id: "late", label: "Atrasadas", n: kpi.late, danger: true },
          { id: "today", label: "Para hoje", n: kpi.today },
          { id: "week", label: "Próximos 7 dias", n: kpi.week },
          { id: "all", label: "Todas abertas", n: kpi.all },
        ] as const).map((k) => {
          const on = filter === k.id;
          return (
            <button key={k.id} type="button" aria-pressed={on}
              onClick={() => setFilter(on && k.id !== "all" ? "all" : k.id)}
              className="text-left rounded-2xl bg-card border px-4 py-3.5 transition hover:-translate-y-0.5"
              style={{ borderColor: on ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 7%, transparent)", boxShadow: on ? "0 0 0 1px rgb(var(--lz-brand-rgb)) inset" : undefined }}>
              <span className="block text-[30px] font-extrabold leading-none tabular-nums tracking-tight"
                style={{ color: "danger" in k && k.danger && k.n > 0 ? "#FF5A47" : undefined }}>{k.n}</span>
              <span className="block mt-1.5 text-[11.5px] font-medium text-foreground/60">{k.label}</span>
            </button>
          );
        })}
      </div>
</>,
    agenda: isMeView && googleCalendarEnabled ? <AgendaRail /> : null,
    daily: <>
      {storiesHoje.length > 0 && (
        <div className="space-y-3 mb-8 lz-stagger">
          {storiesHoje.map((turno) => (
            <div key={turno.id}>
              <DailyTaskCard
                icon={<Instagram size={18} />}
                title={`É seu dia de fazer Stories no perfil da ${me?.orgName ?? "agência"}`}
                status={turno.doneAt ? "done" : "pending"}
                canAct={!isAdmin || !viewAs || viewAs === me?.id}
                onDone={() => setAgencyStoriesDone.mutate({ data: { id: turno.id, done: true } })}
              />
              <div className="mt-2">
                <StoriesInspiracoesButton onClick={() => setInspiracoesAbertas(true)} />
              </div>
            </div>
          ))}
        </div>
      )}
      <StoriesInspiracoesModal open={inspiracoesAbertas} onClose={() => setInspiracoesAbertas(false)} />

      {((today?.cleaningTasks?.length ?? 0) > 0) && (
        <div className="space-y-3 mb-8 lz-stagger">
          {(() => {
            const isMe = !isAdmin || !viewAs || viewAs === me?.id;
            return (
              <>
                {today?.cleaningTasks?.map(({ taskId, taskName: rawName }) => {
                  const st = (today?.cleaningStatuses ?? []).find((s) => s.taskId === taskId)?.status ?? "pending";
                  const raw = rawName || "rotina";
                  const taskName = raw.charAt(0).toLowerCase() + raw.slice(1);
                  return (
                    <DailyTaskCard
                      key={taskId}
                      icon={<Sparkles size={18} />}
                      title={`É seu dia de ${taskName}`}
                      status={st}
                      canAct={isMe}
                      onDone={() => setCleaningDone.mutate({ data: { taskId, weekday: weekdayIdx, occurrenceDate: todayStr, done: true } })}
                    />
                  );
                })}
              </>
            );
          })()}
        </div>
      )}
</>,
    pubs: isMeView && todayPublications.length > 0 ? (
<>
          <RailCard icon={<Instagram size={11} />} iconBg="rgba(var(--lz-brand-light-rgb),0.18)" iconColor="var(--lz-accent-ink)"
            label="Publicações de hoje" count={todayPublications.length}
            open={isSectionOpen("today-publications")} onToggle={() => toggleSection("today-publications")}>
            {todayPublications.map((p) => (
              <RailRow key={p.id}
                lead={new Date(p.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                title={p.title}
                sub={<><span style={{ color: p.clientColor }}>{p.clientName}</span> · {p.type === "post" && p.postFormat
                  ? (POST_FORMAT_LABEL[p.postFormat as keyof typeof POST_FORMAT_LABEL] ?? p.postFormat)
                  : (CONTENT_TYPE_LABEL[p.type as keyof typeof CONTENT_TYPE_LABEL] ?? p.type)}</>}
                onClick={() => {
                  navigate({ to: "/cliente/$clientId", params: { clientId: p.clientId } });
                  selectMonth(p.monthKey);
                  setTimeout(() => { openItem(p.id); flash(p.id); }, 30);
                  setTimeout(() => flash(null), 2050);
                }} />
            ))}
          </RailCard>
        
</>
) : null,
    whatsapp: isAdmin && isMeView && whatsappRemindersEnabled && weeklyReminders.length > 0 ? (
<>
          <RailCard icon={<MessageCircle size={11} />} iconBg="rgba(37,211,102,0.18)" iconColor="#25D366"
            label="Avisar clientes no WhatsApp" count={weeklyReminders.length}
            open={isSectionOpen("weekly-reminders")} onToggle={() => toggleSection("weekly-reminders")}>
            {weeklyReminders.map((r) => (
              <div key={r.clientId} className="flex items-center gap-2.5 px-1.5 py-2">
                <button onClick={() => { openFicha(r.clientId); openStageComposer(r.clientId); }} className="flex-1 min-w-0 text-left hover:opacity-80 transition">
                  <span className="block text-[12.5px] font-semibold truncate" style={{ color: r.clientColor }}>{r.clientName}</span>
                  <span className="block text-[11px] text-foreground/45 truncate">{r.stageName ?? "Sem etapa definida"}</span>
                </button>
                <button
                  onClick={() => logClientStageUpdate.mutate({ data: { clientId: r.clientId, stageId: r.stageId ?? undefined, message: r.stageDescription ?? "Atualização enviada.", trigger: "weekly_nudge" } })}
                  className="shrink-0 text-[10.5px] font-extrabold px-2.5 py-1.5 rounded-full inline-flex items-center gap-1"
                  style={{ backgroundColor: "#25D366", color: "#06210F" }}>
                  <Check size={11} strokeWidth={3} /> Marcar feito
                </button>
              </div>
            ))}
          </RailCard>
        
</>
) : null,
    payments: canFinanceiro && isMeView && upcomingPayments.length > 0 ? (
<>
          <RailCard icon={<Wallet size={11} />} iconBg="rgba(91,168,138,0.18)" iconColor="#5BA88A"
            label="Pagamentos próximos" count={upcomingPayments.length}
            open={isSectionOpen("upcoming-payments")} onToggle={() => toggleSection("upcoming-payments")}>
            {upcomingPayments.map((p) => (
              <RailRow key={p.id}
                title={p.name} titleColor={p.color}
                sub={new Date(p.nextDueDate + "T00:00:00").toLocaleDateString("pt-BR")}
                trail={<span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: "rgba(245,166,35,0.14)", color: "#F5A623" }}>
                  {p.daysUntil < 0 ? `Atrasado ${Math.abs(p.daysUntil)}d` : p.daysUntil === 0 ? "Vence hoje" : `em ${p.daysUntil}d`}</span>}
                onClick={() => navigate({ to: "/configuracoes", search: { tab: "pagamentos" } })} />
            ))}
          </RailCard>
        
</>
) : null,
    mentions: isMeView && mentions.length > 0 ? (
<>
          <RailCard icon={<AtSign size={11} />} iconBg="rgba(var(--lz-brand-light-rgb),0.18)" iconColor="var(--lz-accent-ink)"
            label="Mencionado em" count={mentions.length}
            open={isSectionOpen("mentions")} onToggle={() => toggleSection("mentions")}>
            {mentions.map((m: any) => (
              <RailRow key={m.mentionId}
                title={<>{m.authorName ? <span className="text-foreground/50">{m.authorName}: </span> : null}{m.snippet || m.title}</>}
                sub={<><span style={{ color: m.clientColor }}>{m.clientName}</span> · {CONTENT_TYPE_LABEL[m.type as keyof typeof CONTENT_TYPE_LABEL] ?? "Item"} {String(m.idx).padStart(2, "0")}</>}
                onClick={() => {
                  markMentionRead.mutate({ data: { mentionId: m.mentionId } });
                  navigate({ to: "/cliente/$clientId", params: { clientId: m.clientId } });
                  selectMonth(m.monthKey);
                  setTimeout(() => { openItem(m.itemId); flash(m.itemId); }, 30);
                  setTimeout(() => flash(null), 2050);
                }} />
            ))}
          </RailCard>
        
</>
) : null,
    month: <>
      {targetId && <ActivityCountsWidget monthKey={monthKey} userId={targetId} />}

      {targetId && <WorkStatsWidget monthKey={monthKey} userId={targetId} />}
</>,
    list: <>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="inline-flex bg-card border border-foreground/6 rounded-xl p-1" data-tour="my-week">
          {[
            { id: "list" as const, label: "Lista", Icon: List },
            { id: "week" as const, label: "Minha Semana", Icon: CalendarDays },
          ].map((v) => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${
                view === v.id ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/60 hover:text-foreground"}`}>
              <v.Icon size={12} /> {v.label}
            </button>
          ))}
        </div>
        {view === "list" && (
          <div className="inline-flex bg-card border border-foreground/6 rounded-xl p-1">
            {([{ id: "status", label: "Por etapa" }, { id: "due", label: "Por prazo" }] as const).map((g) => (
              <button key={g.id} onClick={() => setGroupBy(g.id)}
                className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-colors ${
                  groupBy === g.id ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/60 hover:text-foreground"}`}>
                {g.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {clientChips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-5 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
          {[{ id: null as string | null, name: "Todos os clientes", color: "", n: tasks.length }, ...clientChips].map((c) => {
            const on = clientFilter === c.id;
            return (
              <button key={c.id ?? "all"} onClick={() => setClientFilter(c.id)} aria-pressed={on}
                className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition"
                style={{
                  background: on ? "var(--foreground)" : "var(--card)",
                  color: on ? "var(--background)" : "color-mix(in srgb, var(--foreground) 65%, transparent)",
                  borderColor: on ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                }}>
                {c.color && <span className="w-[7px] h-[7px] rounded-full" style={{ background: c.color }} />}
                {c.name} <span className="text-[10.5px] opacity-70">{c.n}</span>
              </button>
            );
          })}
        </div>
      )}

      {view === "week" ? (
        <MyWeekView userId={isAdmin && viewAs ? viewAs : undefined} />
      ) : tasksError ? (
        <div className="border border-dashed rounded-lg p-16 text-center" style={{ borderColor: "rgba(231,111,81,0.35)" }}>
          <p className="text-sm" style={{ color: "#E76F51" }}>Não consegui carregar suas demandas. Confira sua conexão.</p>
        </div>
      ) : tasksLoading ? (
        <div className="space-y-2.5" aria-label="Carregando demandas">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-lg bg-foreground/[0.04] animate-pulse" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-2xl p-16 text-center">
          <p className="text-foreground/50 text-sm">Tudo em dia — nenhuma demanda aberta pra você.</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-2xl p-12 text-center">
          <p className="text-foreground/50 text-sm">Nenhuma demanda com esse filtro.</p>
          <button onClick={() => { setFilter("all"); setClientFilter(null); }} className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: "var(--lz-accent-ink)" }}>Limpar filtros</button>
        </div>
      ) : (
        <div className="space-y-5 lz-stagger">
          {(groupBy === "status"
            ? effectiveStatusOrder.filter((s) => grouped[s].length).map((s) => {
                const m = getStatusMeta(s, labelOverrides); const I = getStatusIcon(s);
                return { id: `status:${s}`, label: m.label, bg: m.bg, color: m.color, icon: <I size={11} />, items: grouped[s], showStage: false };
              })
            : dueGroups.map((g) => ({ id: g.id, label: g.label, bg: hexA(g.color, 0.18), color: g.color, icon: <Clock size={11} />, items: g.items, showStage: true }))
          ).map((g) => {
            const open = isSectionOpen(g.id);
            return (
              <div key={g.id}>
                <SectionHeader icon={g.icon} iconBg={g.bg} iconColor={g.color} label={g.label} count={g.items.length}
                  open={open} onToggle={() => toggleSection(g.id)} />
                {open && (
                  <div className="grid gap-2 lz-stagger">
                    {g.items.map((t: any) => (
                      <TaskRow key={t.id} t={t} showStage={g.showStage} labelOverrides={labelOverrides}
                        onOpen={() => { navigate({ to: "/cliente/$clientId", params: { clientId: t.clientId } }); selectMonth(t.monthKey); setTimeout(() => openItem(t.id), 30); }} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
</>,
    productivity: <>
      {prod && (
        <Suspense fallback={<div className="mt-10 h-[290px] rounded-lg" style={{ background: "var(--card)", border: "1px solid rgba(var(--lz-brand-light-rgb),0.15)" }} />}>
          <ProductivityBlock prod={prod} monthKey={monthKey} />
        </Suspense>
      )}
</>,
  };
  const isBlockShown = (id: string) => !!blocks[id] && (!layout.hidden.includes(id) || LOCKED_BLOCKS.has(id));
  const availableBlocks = new Set<string>([
    "kpis", "daily", "pubs", "mentions", "month", "list", "productivity",
    ...(googleCalendarEnabled && isMeView ? ["agenda"] : []),
    ...(isAdmin && whatsappRemindersEnabled ? ["whatsapp"] : []),
    ...(canFinanceiro ? ["payments"] : []),
  ]);

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-5xl mx-auto" data-tour="my-tasks">
      {!isMeView && targetProfile && (
        <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mb-4 px-3 py-2 rounded-lg text-[12.5px]"
          style={{ backgroundColor: "rgba(74,158,255,0.12)", color: "#7EB3FF" }}>
          <Avatar profile={targetProfile} size={18} />
          <span className="font-semibold">Vendo como {targetProfile.name}</span>
          <span className="text-foreground/40">— tudo abaixo é da perspectiva dele(a), não sua.</span>
          <button
            onClick={() => setViewAs("")}
            className="ml-auto font-bold uppercase tracking-wide text-[11px] hover:underline shrink-0"
          >
            Voltar pra mim
          </button>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-foreground/40 mb-2">Minhas demandas</p>
          <h1 className="text-[32px] sm:text-[44px] font-semibold text-foreground leading-[1.02] tracking-tight">
            Olá,{" "}
            {(() => {
              const raw = ((isMeView ? me?.name : targetProfile?.name) ?? "você").trim().split(" ")[0];
              return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
            })()}!{" "}
            <img src="/emoji/1f929.png" alt="🤩" width={44} height={44} className="inline-block h-[0.95em] w-[0.95em] align-[-0.12em]" />
            {myRankIdx >= 0 && <RankBadge position={myRankIdx} />}
          </h1>
          {!disabledFeatures.has("daily_verse") && (
            <div className="max-w-sm mt-3">
              <p className="italic text-foreground/60 text-[13px] leading-relaxed text-balance">"{dailyVerse.text}"</p>
              <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.09em]" style={{ color: "var(--lz-accent-ink)" }}>{dailyVerse.reference}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {isAdmin && (<>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/40 shrink-0">Ver como:</span>
              <select value={viewAs} onChange={(e) => setViewAs(e.target.value)}
                className="bg-card border border-foreground/10 text-sm text-foreground rounded-lg px-3 py-2 outline-none focus:border-[rgb(var(--lz-brand-rgb))] min-w-0 flex-1 sm:flex-none">
                <option value="">{me?.name} (eu)</option>
                {profiles.filter((p) => p.id !== me?.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {targetProfile && targetId !== me?.id && <Avatar profile={targetProfile} size={28} />}
            </div>
            <button
              onClick={() => setShowNovaDemanda(true)}
              className="lz-btn-primary text-[13px] font-bold px-5 py-2.5 rounded-full inline-flex items-center gap-1.5 shrink-0 self-start"
            >
              <Plus size={14} /> Nova demanda
            </button>
          </>)}
          <button onClick={() => setShowCustomize(true)}
            className="text-[13px] font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5 shrink-0 self-start border border-foreground/12 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition-colors">
            <SlidersHorizontal size={14} /> Personalizar
          </button>
        </div>
      </div>

      {showNovaDemanda && <NovaDemandaModal onClose={() => setShowNovaDemanda(false)} />}
      {showCustomize && (
        <CustomizeLayoutModal layout={layout} available={availableBlocks} onChange={setLayout} onReset={resetLayout} onClose={() => setShowCustomize(false)}
          onSetTeamDefault={me?.isPlatformAdmin ? async () => {
            if (!(await requestConfirm("Usar esta ordem e estes blocos como padrão para todas as agências? Quem já personalizou a própria página mantém a dela; todo o resto passa a ver esta ordem."))) return;
            try {
              await setTeamDefault({ data: { layout } });
              await qc.invalidateQueries({ queryKey: ["my-tasks-default-layout"] });
              toast.success("Pronto! Esta é a nova ordem padrão.");
            } catch (e: any) { toast.error(e?.message ?? "Erro ao salvar o padrão."); }
          } : undefined} />
      )}

      <div className="space-y-6">
        {layout.order.filter(isBlockShown).map((id) => <div key={id} className="min-w-0 flex flex-col gap-4 [&>*]:!mb-0">{blocks[id]}</div>)}
      </div>
    </div>
  );
}

function NovaDemandaModal({ onClose }: { onClose: () => void }) {
  const { data: clients = [] } = useQuery(clientsQO());
  const { addContentItem } = useApi();
  const { selectClient, openItem } = useUI();
  const monthKey = useUI((s) => s.selectedMonthKey);
  const [pickedClient, setPickedClient] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState("");

  const activeClients = clients
    .filter((c) => !c.archived && c.category !== "Ex-clientes")
    .filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name));

  function create(type: "post" | "reel") {
    if (!pickedClient || addContentItem.isPending) return;
    addContentItem.mutate(
      { data: { clientId: pickedClient.id, key: monthKey, type } },
      {
        // Não navega — o DetailPanel é global (renderizado no App.tsx), então
        // só de setar cliente + item selecionados ele já abre em popup, sem
        // sair da tela de Minhas Demandas.
        onSuccess: (res: any) => {
          selectClient(pickedClient.id);
          openItem(res.id, null);
          onClose();
        },
      },
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="w-full max-w-md bg-card border border-foreground/10 rounded-2xl p-6 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {!pickedClient ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-foreground">Pra qual cliente?</span>
              <button onClick={onClose} className="text-foreground/40 hover:text-foreground"><X size={16} /></button>
            </div>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-3 shrink-0"
            />
            <div className="overflow-y-auto flex-1 -mx-2 px-2 space-y-1">
              {activeClients.length === 0 ? (
                <div className="text-center text-foreground/30 text-sm py-8">Nenhum cliente encontrado.</div>
              ) : activeClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setPickedClient({ id: c.id, name: c.name })}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-foreground/5 transition text-left"
                >
                  <Avatar profile={{ name: c.name, color: c.color, icon: c.icon, avatarUrl: c.photoUrl }} size={28} />
                  <span className="text-sm text-foreground truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-5">
              <button onClick={() => setPickedClient(null)} className="text-foreground/40 hover:text-foreground p-1 -ml-1 rounded shrink-0">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-bold text-foreground flex-1 truncate">{pickedClient.name}</span>
              <button onClick={onClose} className="text-foreground/40 hover:text-foreground shrink-0"><X size={16} /></button>
            </div>
            <p className="text-xs text-foreground/40 mb-4">O que você quer criar?</p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => create("post")}
                disabled={addContentItem.isPending}
                className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-foreground/15 text-foreground/60 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] transition disabled:opacity-50"
              >
                <ImageIcon size={22} />
                <span className="text-sm font-semibold">Post</span>
              </button>
              <button
                onClick={() => create("reel")}
                disabled={addContentItem.isPending}
                className="flex flex-col items-center justify-center gap-2 py-8 rounded-xl border border-dashed border-foreground/15 text-foreground/60 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] transition disabled:opacity-50"
              >
                <Film size={22} />
                <span className="text-sm font-semibold">Reel</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DeadlinePill({ dueDate, status }: { dueDate?: string | null; status: string }) {
  const info = deadlineInfo(dueDate, status);
  if (info.level === "done") return null;
  return (
    <span
      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded px-1.5 py-0.5"
      style={{ backgroundColor: info.bg, color: info.color }}
      title={dueDate ? `Prazo: ${dueDate}` : "Sem prazo definido"}
    >
      <Clock size={10} /> {info.label}
    </span>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  gravacao: "vídeos gravados", roteiro: "roteiros", sistema: "sistemas", outros: "outras atividades",
};

/** "Hoje"/"Amanhã" comparando no fuso de Brasília — um evento às 23h de
 * "amanhã" em UTC ainda pode ser "hoje" em São Paulo, e vice-versa. Pro
 * resto da janela, o nome do dia da semana por extenso. */
function dayGroupLabel(dateStr: string): string {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const now = new Date();
  const todayStr = fmt.format(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = fmt.format(tomorrow);
  if (dateStr === todayStr) return "Hoje";
  if (dateStr === tomorrowStr) return "Amanhã";
  const weekday = new Date(`${dateStr}T00:00:00-03:00`).toLocaleDateString("pt-BR", { weekday: "long" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

/** Agrupa a lista (já vem ordenada por horário da API do Google) em blocos
 * por dia local de Brasília, preservando a ordem. */
function groupEventsByDay(events: any[]): { dateStr: string; events: any[] }[] {
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
  const groups: { dateStr: string; events: any[] }[] = [];
  for (const ev of events) {
    const dateStr = fmt.format(new Date(ev.start));
    const last = groups[groups.length - 1];
    if (last && last.dateStr === dateStr) last.events.push(ev);
    else groups.push({ dateStr, events: [ev] });
  }
  return groups;
}

function RailCard({ icon, iconBg, iconColor, label, count, open, onToggle, children }: {
  icon: React.ReactNode; iconBg: string; iconColor: string; label: string; count: number;
  open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <section className="bg-card border border-foreground/6 rounded-2xl p-3.5">
      <SectionHeader icon={icon} iconBg={iconBg} iconColor={iconColor} label={label} count={count} open={open} onToggle={onToggle} />
      {open && <div className="-mt-1 divide-y divide-foreground/5">{children}</div>}
    </section>
  );
}

function RailRow({ lead, title, titleColor, sub, trail, onClick }: {
  lead?: string; title: React.ReactNode; titleColor?: string; sub?: React.ReactNode; trail?: React.ReactNode; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-2.5 px-1.5 py-2 rounded-lg text-left hover:bg-foreground/[0.04] transition-colors">
      {lead && <span className="text-[11px] font-bold text-foreground/50 tabular-nums w-10 shrink-0">{lead}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-semibold truncate" style={titleColor ? { color: titleColor } : undefined}>{title}</span>
        {sub && <span className="block text-[11px] text-foreground/45 truncate">{sub}</span>}
      </span>
      {trail}
    </button>
  );
}

function TaskRow({ t, showStage, labelOverrides, onOpen }: {
  t: any; showStage: boolean; labelOverrides: Map<string, string>; onOpen: () => void;
}) {
  const sm = getStatusMeta(t.status as Status, labelOverrides);
  return (
    <button onClick={onOpen}
      className="w-full grid grid-cols-[5px_minmax(0,1fr)_auto] gap-3.5 items-center bg-card border border-foreground/6 rounded-[14px] py-3 pr-3.5 text-left overflow-hidden transition hover:translate-x-[3px] hover:border-foreground/15">
      <span className="self-stretch rounded-r" style={{ background: t.clientColor }} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground truncate">{t.title}</span>
        <span className="flex flex-wrap items-center gap-2 mt-1 text-[11.5px]">
          <span className="inline-flex items-center gap-1.5 font-bold" style={{ color: t.clientColor }}>
            <i className="w-[7px] h-[7px] rounded-full" style={{ background: t.clientColor }} />{t.clientName}
          </span>
          <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded bg-foreground/[0.06] text-foreground/55">
            {t.type === "post" ? "Post" : t.type === "reel" ? "Reels" : "Item"} {String(t.idx).padStart(2, "0")}
          </span>
          {t.clientCategory === "Avulsos" && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>Avulso</span>
          )}
          {showStage && (
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ background: sm.bg, color: sm.color }}>{sm.label}</span>
          )}
        </span>
      </span>
      <DeadlinePill dueDate={t.dueDate} status={t.status} />
    </button>
  );
}

const BR_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
function eventDay(ev: any): string {
  return ev.allDay ? String(ev.start).slice(0, 10) : BR_FMT.format(new Date(ev.start));
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/** Agenda do Google em linha do tempo: tira dos próximos 7 dias + eventos do
 * dia escolhido, com marcador de "agora" e destaque pro que está rolando. */
function AgendaRail() {
  const { data } = useQuery(upcomingCalendarEventsQO());
  const [openEvent, setOpenEvent] = useState<any | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const events: any[] = data?.events ?? [];
  const days = useMemo(() => {
    const today = BR_FMT.format(new Date());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${today}T12:00:00-03:00`);
      d.setDate(d.getDate() + i);
      const str = BR_FMT.format(d);
      return {
        str, isToday: i === 0,
        wd: i === 0 ? "hoje" : d.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" }).replace(".", ""),
        num: Number(str.slice(8, 10)),
      };
    });
  }, []);
  if (!data?.connected || !events.length) return null;
  const byDay = new Map<string, any[]>();
  events.forEach((e) => { const k = eventDay(e); byDay.set(k, [...(byDay.get(k) ?? []), e]); });
  const selected = picked ?? days.find((d) => byDay.has(d.str))?.str ?? days[0].str;
  const list = (byDay.get(selected) ?? []).slice().sort((a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1));
  const isToday = selected === days[0].str;
  const nowMs = Date.now();
  const nextIdx = isToday ? list.findIndex((e) => !e.allDay && new Date(e.start).getTime() > nowMs) : -1;

  return (
    <section className="bg-card border border-foreground/6 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="rounded-md p-1" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}><CalendarClock size={11} /></span>
        <h2 className="text-[11.5px] uppercase font-semibold tracking-wide text-foreground/60">Agenda</h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10.5px] font-bold px-2 py-0.5 rounded-full" style={{ color: "#5BC48A", background: "rgba(91,196,138,0.14)" }}>
          <i className="w-1.5 h-1.5 rounded-full" style={{ background: "#5BC48A" }} />Google Agenda
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {days.map((d) => {
          const on = d.str === selected, has = byDay.has(d.str);
          return (
            <button key={d.str} onClick={() => setPicked(d.str)} aria-pressed={on}
              className="rounded-xl py-1.5 text-center transition-colors hover:bg-foreground/[0.05]"
              style={on ? { background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" } : undefined}>
              <span className="block text-[9.5px] font-bold uppercase tracking-wide" style={{ opacity: on ? 0.65 : 0.4 }}>{d.wd}</span>
              <span className="block text-[15px] font-bold tabular-nums leading-tight">{d.num}</span>
              <i className="block w-1 h-1 rounded-full mx-auto mt-1" style={{ background: on ? "#0D0D0D" : "rgb(var(--lz-brand-rgb))", opacity: has ? 1 : 0 }} />
            </button>
          );
        })}
      </div>
      {list.length === 0 ? (
        <p className="text-center text-[12.5px] text-foreground/40 py-5">Dia livre. Nenhum compromisso.</p>
      ) : (
        <div className="grid gap-2 md:grid-cols-2 md:gap-x-5">
          {list.map((ev, i) => {
            const endMs = ev.end ? new Date(ev.end).getTime() : null;
            const past = isToday && !ev.allDay && endMs !== null && endMs < nowMs;
            const live = isToday && !ev.allDay && new Date(ev.start).getTime() <= nowMs && (endMs ?? 0) > nowMs;
            return (
              <div key={ev.id}>
                {i === nextIdx && (
                  <div className="grid grid-cols-[44px_1fr] gap-2.5 items-center mb-2 text-[10px] font-extrabold tracking-wider" style={{ color: "#FF5A47" }}>
                    <span>AGORA</span><span className="h-[2px] rounded" style={{ background: "#FF5A47" }} />
                  </div>
                )}
                <button onClick={() => setOpenEvent(ev)} className={`w-full grid grid-cols-[44px_minmax(0,1fr)] gap-2.5 text-left group ${past ? "opacity-50" : ""}`}>
                  <span className="text-[11.5px] font-bold text-foreground/55 tabular-nums pt-2.5">{ev.allDay ? "Dia todo" : fmtTime(ev.start)}</span>
                  <span className="rounded-xl px-3 py-2 border-l-[3px] transition-transform group-hover:translate-x-0.5"
                    style={{
                      borderColor: "rgb(var(--lz-brand-rgb))",
                      background: live ? "rgba(var(--lz-brand-light-rgb),0.16)" : "color-mix(in srgb, var(--foreground) 5%, transparent)",
                      boxShadow: live ? "0 0 0 1px rgb(var(--lz-brand-rgb)) inset" : undefined,
                    }}>
                    <b className="block text-[13px] font-semibold leading-tight text-foreground">{ev.title}</b>
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[11px] text-foreground/55">
                      {!ev.allDay && ev.end && <span className="tabular-nums">{fmtTime(ev.start)} – {fmtTime(ev.end)}</span>}
                      {ev.attendees?.length > 0 && <span className="inline-flex items-center gap-1"><Users size={10} />{ev.attendees.length === 1 ? ev.attendees[0] : `${ev.attendees[0]} +${ev.attendees.length - 1}`}</span>}
                      {ev.meetLink && <span className="inline-flex items-center gap-1 font-bold px-1.5 py-0.5 rounded-full" style={{ color: "#6FA4FF", background: "rgba(111,164,255,0.14)" }}><VideoIcon size={10} />Meet</span>}
                      {ev.location && <span className="inline-flex items-center gap-1 truncate max-w-[140px]"><MapPin size={10} />{String(ev.location).split(",")[0]}</span>}
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
      {openEvent && <CalendarEventModal event={openEvent} onClose={() => setOpenEvent(null)} />}
    </section>
  );
}

function CalendarEventModal({ event, onClose }: { event: any; onClose: () => void }) {
  const timeRange = event.allDay
    ? "Dia todo"
    : `${new Date(event.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}${
        event.end ? ` – ${new Date(event.end).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""
      }`;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-sm bg-card border border-foreground/10 rounded-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-base font-semibold text-foreground">{event.title}</h3>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground shrink-0"><X size={16} /></button>
        </div>
        <p className="text-[13px] text-foreground/60">{timeRange}</p>
        {event.attendees?.length > 0 && (
          <p className="text-[13px] text-foreground/50 mt-2">👥 {event.attendees.join(", ")}</p>
        )}
        {event.location && (
          <p className="text-[13px] text-foreground/50 mt-2">📍 {event.location}</p>
        )}
        {event.description && (
          <p className="text-[13px] text-foreground/70 mt-4 leading-relaxed whitespace-pre-wrap">{event.description}</p>
        )}
        {event.meetLink && (
          <a href={event.meetLink} target="_blank" rel="noopener noreferrer"
            className="mt-6 mr-2 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            <VideoIcon size={12} /> Entrar no Meet
          </a>
        )}
        {event.link && (
          <a
            href={event.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-2 rounded-md border border-foreground/15 text-foreground/80 hover:text-foreground hover:border-foreground/30"
          >
            <CalendarClock size={12} /> Abrir no Google Agenda
          </a>
        )}
      </div>
    </div>
  );
}

function ActivityCountsWidget({ monthKey, userId }: { monthKey: string; userId: string }) {
  const { data: counts } = useQuery(myActivityCountsQO(monthKey, userId));
  const entries = counts
    ? (Object.entries(counts) as [string, number][]).filter(([, n]) => n > 0)
    : [];
  const [openType, setOpenType] = useState<string | null>(null);
  const { data: finalizations = [], isLoading: itemsLoading } = useQuery({
    ...memberFinalizationsQO(userId, "month", monthKey),
    enabled: openType !== null,
  });
  const items = finalizations.filter((f: any) => f.type === openType);
  const { selectMonth, openItem, flash } = useUI();
  const navigate = useNavigate();

  if (entries.length === 0) return null;

  function openActivity(itemId: string, clientId: string, itemMonthKey: string) {
    navigate({ to: "/cliente/$clientId", params: { clientId } });
    selectMonth(itemMonthKey);
    setTimeout(() => { openItem(itemId); flash(itemId); }, 30);
  }

  return (
    <div className="mb-6 bg-card rounded-lg overflow-hidden" data-tour="activity-counts">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="rounded p-1" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>
          <List size={11} />
        </span>
        <h2 className="text-[11.5px] uppercase font-semibold tracking-wide text-foreground/60">Atividades registradas em {formatMonth(monthKey)}</h2>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pb-3.5">
        {entries.map(([type, n]) => (
          <button
            key={type}
            type="button"
            onClick={() => setOpenType((t) => (t === type ? null : type))}
            className="text-xs font-semibold px-2.5 py-1 rounded-full transition-colors"
            style={{
              backgroundColor: openType === type ? "rgba(var(--lz-brand-light-rgb),0.28)" : "rgba(var(--lz-brand-light-rgb),0.12)",
              color: "var(--lz-accent-ink)",
            }}
          >
            {n} {ACTIVITY_LABELS[type] ?? type}
          </button>
        ))}
      </div>
      {openType && (
        <div className="border-t border-foreground/6 px-4 py-2">
          {itemsLoading ? (
            <p className="text-xs text-foreground/40 py-1.5">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-foreground/40 py-1.5">Nenhuma atividade encontrada.</p>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.05]">
              {items.map((f: any) => (
                <button
                  key={f.itemId}
                  type="button"
                  onClick={() => openActivity(f.itemId, f.clientId, monthKey)}
                  className="flex items-center justify-between gap-3 py-2 text-left hover:text-foreground text-foreground/70 transition-colors"
                >
                  <span className="text-[13px] truncate">{f.title || "(sem título)"}</span>
                  <span className="text-[11px] text-foreground/40 shrink-0">{f.clientName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** color-mix aceita qualquer sintaxe de cor válida (hex, rgb(), var()...) —
 * mesmo helper de AdminDashboard.tsx, duplicado aqui porque não é exportado
 * de lá. */
function hexA(color: string, a: number) {
  return `color-mix(in srgb, ${color} ${a * 100}%, transparent)`;
}

/** Quantos dias já correram desse mês — mês atual usa o dia de hoje; mês
 * passado (ou futuro) usa o mês inteiro, pra "média por dia" não ficar
 * absurda olhando um mês que já fechou. */
function daysElapsedInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const now = new Date();
  if (now.getFullYear() === y && now.getMonth() + 1 === m) return now.getDate();
  return daysInMonth;
}

type WorkTypeKey = "reels" | "posts" | "gravacao" | "roteiro" | "publicacoes";

/** Classes fixas (o Tailwind JIT só reconhece string literal, não dá pra
 * montar "grid-cols-" + n em runtime) — número de colunas acompanha
 * quantos tipos estão ativos, pra sempre preencher a largura toda em vez
 * de reservar espaço pra 4 e sobrar vazio quando só tem 1 ou 2. */
const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-2 md:grid-cols-3",
  4: "grid-cols-2 md:grid-cols-4",
};
const WORK_TYPE_META: Record<WorkTypeKey, { label: string; color: string; icon: (size: number) => React.ReactNode }> = {
  reels: { label: "Reels editados", color: "var(--lz-accent-ink)", icon: (s) => <Film size={s} /> },
  posts: { label: "Posts editados", color: "#4A9EFF", icon: (s) => <ImageIcon size={s} /> },
  gravacao: { label: "Gravações concluídas", color: "#B392F0", icon: (s) => <Video size={s} /> },
  roteiro: { label: "Roteiros concluídos", color: "#5BA88A", icon: (s) => <FileText size={s} /> },
  publicacoes: { label: "Publicações finalizadas", color: "#FF8C42", icon: (s) => <Send size={s} /> },
};

/** Card duplo (feito/meta + média por dia) repetido por tipo de trabalho
 * — só entra o tipo que a pessoa tiver pelo menos 1 feito no mês; sem
 * meta configurada pra esse tipo, mostra só o número (sem fração). */
function WorkStatsWidget({ monthKey, userId }: { monthKey: string; userId: string }) {
  const { data: stats } = useQuery(myWorkStatsQO(userId, monthKey));
  const [open, setOpen] = useState<WorkTypeKey | null>(null);
  const { selectMonth, openItem, openFicha, flash } = useUI();
  const navigate = useNavigate();

  if (!stats) return null;
  const types = (Object.keys(WORK_TYPE_META) as WorkTypeKey[]).filter((k) => stats[k].done > 0);
  if (types.length === 0) return null;

  function openVideo(itemId: string, clientId: string) {
    navigate({ to: "/cliente/$clientId", params: { clientId } });
    selectMonth(monthKey);
    setTimeout(() => { openItem(itemId); flash(itemId); }, 30);
  }

  const days = daysElapsedInMonth(monthKey);
  const openSection = open ? stats[open] : null;

  return (
    <div className="mb-6">
      <div className={`grid gap-3 ${GRID_COLS_CLASS[Math.min(types.length, 4)]}`}>
        {types.map((key) => {
          const section = stats[key];
          const meta = WORK_TYPE_META[key];
          const perDay = (section.done / days).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
          return (
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => setOpen((o) => (o === key ? null : key))}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen((o) => (o === key ? null : key)); }}
              className="text-left rounded-2xl border px-4 py-3.5 cursor-pointer transition hover:-translate-y-0.5"
              style={{
                background: `color-mix(in srgb, ${meta.color} 11%, var(--card))`,
                borderColor: open === key ? meta.color : hexA(meta.color, 0.3),
                boxShadow: open === key ? `0 0 0 1px ${meta.color} inset` : undefined,
              }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <span className="h-6 w-6 rounded-lg inline-flex items-center justify-center shrink-0" style={{ background: hexA(meta.color, 0.16), color: meta.color }}>
                  {meta.icon(14)}
                </span>
                <span className="text-[11.5px] font-bold truncate" style={{ color: meta.color }}>{meta.label}</span>
                <ChevronDown size={13} className={`ml-auto shrink-0 text-foreground/35 transition-transform ${open === key ? "rotate-180" : ""}`} />
              </div>
              <div className="text-[30px] font-extrabold leading-none tracking-tight tabular-nums" style={{ color: meta.color }}>
                {section.done}{section.goal != null && <span className="text-foreground/35 font-bold text-lg">/{section.goal}</span>}
              </div>
              {section.goal != null && section.goal > 0 && (
                <div className="h-1 rounded-full mt-2.5 overflow-hidden" style={{ background: "color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, (section.done / section.goal) * 100)}%`, background: meta.color }} />
                </div>
              )}
              <div className="text-[11.5px] text-foreground/50 mt-2">
                <span className="font-bold tabular-nums text-foreground/75">{perDay}</span> por dia · {section.goal != null ? "meta do mês" : formatMonth(monthKey)}
              </div>
            </div>
          );
        })}
      </div>

      {open && openSection && (
        <div className="mt-2 bg-card border border-foreground/6 rounded-lg px-4 py-2">
          {open === "gravacao" ? (
            (openSection.byClient ?? []).length === 0 ? (
              <p className="text-xs text-foreground/40 py-1.5">Nenhuma gravação encontrada.</p>
            ) : (
              <div className="flex flex-col divide-y divide-white/[0.05]">
                {(openSection.byClient ?? []).map((c) => (
                  <button
                    key={c.clientId}
                    type="button"
                    onClick={() => openFicha(c.clientId)}
                    className="flex items-center justify-between gap-3 py-2 text-left hover:text-foreground text-foreground/70 transition-colors"
                  >
                    <span className="text-[13px] truncate">{c.clientName}</span>
                    <span className="text-[11px] text-foreground/40 shrink-0">{c.count} vídeo{c.count === 1 ? "" : "s"}</span>
                  </button>
                ))}
              </div>
            )
          ) : openSection.items.length === 0 ? (
            <p className="text-xs text-foreground/40 py-1.5">Nenhum item encontrado.</p>
          ) : (
            <div className="flex flex-col divide-y divide-white/[0.05]">
              {openSection.items.map((it) => (
                <button
                  key={it.itemId}
                  type="button"
                  onClick={() => openVideo(it.itemId, it.clientId)}
                  className="flex items-center justify-between gap-3 py-2 text-left hover:text-foreground text-foreground/70 transition-colors"
                >
                  <span className="text-[13px] truncate">{it.title || "(sem título)"}</span>
                  <span className="text-[11px] text-foreground/40 shrink-0">{it.clientName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DailyTaskCard({
  icon,
  title,
  subtitle,
  status,
  canAct,
  onDone,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  status: "pending" | "done" | "missed";
  canAct: boolean;
  onDone: () => void;
}) {
  const done = status === "done";
  const missed = status === "missed";
  return (
    <div
      className="rounded-lg p-4 flex items-center gap-3 transition-opacity"
      style={{
        backgroundColor: missed ? "rgba(255,68,68,0.08)" : "rgba(var(--lz-brand-light-rgb),0.1)",
        borderLeft: `3px solid ${missed ? "#FF4444" : "rgb(var(--lz-brand-rgb))"}`,
        opacity: done ? 0.5 : 1,
      }}
    >
      <div
        className="h-9 w-9 rounded-md flex items-center justify-center shrink-0"
        style={{
          backgroundColor: missed ? "rgba(255,68,68,0.2)" : "rgba(var(--lz-brand-light-rgb),0.2)",
          color: missed ? "#FF4444" : "var(--lz-accent-ink)",
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold text-foreground">{title}</div>
        {subtitle && <div className="text-[11px] text-foreground/60">{subtitle}</div>}
      </div>
      {!missed && (
        <button
          onClick={done ? undefined : onDone}
          disabled={!canAct || done}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 shrink-0"
          style={{
            backgroundColor: "rgb(var(--lz-brand-rgb))",
            color: "#0D0D0D",
            cursor: done ? "default" : canAct ? "pointer" : "not-allowed",
          }}
        >
          <Check size={12} strokeWidth={3} />
          {done ? "Feito" : "Marcar feito"}
        </button>
      )}
    </div>
  );
}