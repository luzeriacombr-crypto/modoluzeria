import { useQuery } from "@tanstack/react-query";
import { myTasksQO, myTodayQO, productivityQO, myActivityCountsQO, memberFinalizationsQO, profilesQO, myMentionsQO, weeklyClientRemindersQO, todayPublicationsQO, todayCalendarEventsQO, clientsQO, clientPaymentsQO, useMe, useApi } from "@/lib/luzeria/queries";
import { STATUS_META, STATUS_ORDER, CONTENT_TYPE_LABEL, POST_FORMAT_LABEL, isDoneStatus, hasPermission, type Status } from "@/lib/luzeria/types";
import { STATUS_ICONS } from "./icons";
import { useUI } from "@/lib/luzeria/ui-store";
import { Avatar } from "./Avatar";
import { useState, lazy, Suspense } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, List, CalendarDays, CalendarClock, Clock, Check, X, AtSign, MessageCircle, Instagram, ChevronDown, ChevronRight, Plus, ChevronLeft, Film, Image as ImageIcon, Wallet } from "lucide-react";
import { formatMonth, deadlineInfo } from "@/lib/luzeria/utils";
import { GoalsWidget } from "./GoalsWidget";
import { MyWeekView } from "./MyWeekView";
import { getDailyVerse } from "@/lib/luzeria/daily-verse";

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

export function MyTasks() {
  const me = useMe().data;
  const { data: profiles = [] } = useQuery(profilesQO());
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { setCleaningDone, markMentionRead, logClientStageUpdate } = useApi();
  const [viewAs, setViewAs] = useState<string>("");
  const targetId = isAdmin && viewAs ? viewAs : me?.id;
  const { data: allTasks = [] } = useQuery({
    ...myTasksQO(targetId),
    enabled: !!targetId,
  });
  // Já finalizado/entregue/pronto pra publicar some da lista principal —
  // deixa a página focada no que ainda precisa de atenção.
  const tasks = allTasks.filter((t: any) => !isDoneStatus(t.status as Status));
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

  const grouped: Record<Status, typeof tasks> = Object.fromEntries(
    STATUS_ORDER.map((s) => [s, [] as typeof tasks])
  ) as Record<Status, typeof tasks>;
  tasks.forEach((t) => {
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

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-5xl mx-auto" data-tour="my-tasks">
      {!isMeView && targetProfile && (
        <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-[12.5px]"
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
      <div className="mb-4">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[15px] font-semibold uppercase tracking-wide mb-1.5"
          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
          Olá, {(() => {
            const raw = ((isMeView ? me?.name : targetProfile?.name) ?? "você").trim().split(" ")[0];
            return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
          })()}! 🤩
        </div>
        {!disabledFeatures.has("daily_verse") && (
          <div className="max-w-sm">
            <p className="italic text-foreground/60 text-[13px] leading-relaxed text-balance">
              "{dailyVerse.text}"
            </p>
            <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "color-mix(in srgb, var(--lz-accent-ink) 80%, transparent)" }}>
              {dailyVerse.reference}
            </p>
          </div>
        )}
      </div>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-9">
        <div>
          <h1 className="text-[24px] sm:text-[32px] font-semibold text-foreground leading-none tracking-tight whitespace-nowrap">Coisas para fazer</h1>
          <p className="text-sm text-foreground/50 mt-2.5">
            {tasks.length} {tasks.length === 1 ? "tarefa atribuída" : "tarefas atribuídas"}
          </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <button
              onClick={() => setShowNovaDemanda(true)}
              className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-1.5 shrink-0 self-start"
            >
              <Plus size={14} /> Nova demanda
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground/40 shrink-0">Ver como:</span>
              <select value={viewAs} onChange={(e) => setViewAs(e.target.value)}
                className="bg-card border border-foreground/10 text-sm text-foreground rounded-md px-3 py-1.5 outline-none focus:border-[rgb(var(--lz-brand-rgb))] min-w-0 flex-1 sm:flex-none">
                <option value="">{me?.name} (eu)</option>
                {profiles.filter((p) => p.id !== me?.id).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              {targetProfile && targetId !== me?.id && <Avatar profile={targetProfile} size={28} />}
            </div>
          </div>
        )}
      </div>

      {showNovaDemanda && <NovaDemandaModal onClose={() => setShowNovaDemanda(false)} />}

      {targetId && !targetProfile?.hideGoalsWidget && <div data-tour="goals"><GoalsWidget monthKey={monthKey} userId={targetId} /></div>}

      {targetId && <ActivityCountsWidget monthKey={monthKey} userId={targetId} />}

      {isMeView && googleCalendarEnabled && <TodayCalendarWidget />}

      {isMeView && todayPublications.length > 0 && (
        <div className="mb-6">
          <SectionHeader
            icon={<Instagram size={11} />}
            iconBg="rgba(var(--lz-brand-light-rgb),0.18)" iconColor="var(--lz-accent-ink)"
            label="Publicações de hoje" count={todayPublications.length}
            open={isSectionOpen("today-publications")} onToggle={() => toggleSection("today-publications")}
          />
          {isSectionOpen("today-publications") && (
          <div className="bg-card rounded-lg overflow-hidden lz-stagger">
            {todayPublications.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  navigate({ to: "/cliente/$clientId", params: { clientId: p.clientId } });
                  selectMonth(p.monthKey);
                  setTimeout(() => { openItem(p.id); flash(p.id); }, 30);
                  setTimeout(() => flash(null), 2050);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors text-left border-b border-foreground/5 last:border-b-0"
              >
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: p.clientColor + "33", color: p.clientColor.toUpperCase() === "#FFFFFF" ? "#FFFFFF" : p.clientColor }}>
                  {p.clientName}
                </span>
                <span className="text-[11px] text-foreground/50 uppercase font-semibold shrink-0">
                  {p.type === "post" && p.postFormat
                    ? (POST_FORMAT_LABEL[p.postFormat as keyof typeof POST_FORMAT_LABEL] ?? p.postFormat)
                    : (CONTENT_TYPE_LABEL[p.type as keyof typeof CONTENT_TYPE_LABEL] ?? p.type)}
                </span>
                <span className="text-sm text-foreground/90 truncate flex-1">{p.title}</span>
                <span className="text-[10px] text-foreground/40 shrink-0 tabular-nums">
                  {new Date(p.scheduledAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      {isAdmin && isMeView && whatsappRemindersEnabled && weeklyReminders.length > 0 && (
        <div className="mb-6">
          <SectionHeader
            icon={<MessageCircle size={11} />}
            iconBg="rgba(37,211,102,0.18)" iconColor="#25D366"
            label="Avisar clientes no WhatsApp" count={weeklyReminders.length}
            open={isSectionOpen("weekly-reminders")} onToggle={() => toggleSection("weekly-reminders")}
          />
          {isSectionOpen("weekly-reminders") && (
          <div className="bg-card rounded-lg overflow-hidden lz-stagger">
            {weeklyReminders.map((r) => (
              <div key={r.clientId} className="flex items-center gap-3 px-4 py-3 border-b border-foreground/5 last:border-b-0">
                <button
                  onClick={() => { openFicha(r.clientId); openStageComposer(r.clientId); }}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition"
                >
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: r.clientColor + "33", color: r.clientColor.toUpperCase() === "#FFFFFF" ? "#FFFFFF" : r.clientColor }}>
                    {r.clientName}
                  </span>
                  <span className="text-sm text-foreground/70 truncate">{r.stageName ?? "Sem etapa definida"}</span>
                </button>
                <button
                  onClick={() => logClientStageUpdate.mutate({
                    data: {
                      clientId: r.clientId, stageId: r.stageId ?? undefined,
                      message: r.stageDescription ?? "Atualização enviada.", trigger: "weekly_nudge",
                    },
                  })}
                  className="shrink-0 text-[11px] font-semibold px-3 py-1.5 rounded-md inline-flex items-center gap-1.5"
                  style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                >
                  <Check size={12} strokeWidth={3} /> Marcar feito
                </button>
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {canFinanceiro && isMeView && upcomingPayments.length > 0 && (
        <div className="mb-6">
          <SectionHeader
            icon={<Wallet size={11} />}
            iconBg="rgba(91,168,138,0.18)" iconColor="#5BA88A"
            label="Pagamentos próximos" count={upcomingPayments.length}
            open={isSectionOpen("upcoming-payments")} onToggle={() => toggleSection("upcoming-payments")}
          />
          {isSectionOpen("upcoming-payments") && (
          <div className="bg-card rounded-lg overflow-hidden lz-stagger">
            {upcomingPayments.map((p) => (
              <button
                key={p.id}
                onClick={() => navigate({ to: "/configuracoes", search: { tab: "pagamentos" } })}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors text-left border-b border-foreground/5 last:border-b-0"
              >
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: p.color + "33", color: p.color.toUpperCase() === "#FFFFFF" ? "#FFFFFF" : p.color }}>
                  {p.name}
                </span>
                <span className="text-sm text-foreground/70 flex-1">
                  {p.daysUntil < 0 ? `Atrasado há ${Math.abs(p.daysUntil)}d` : p.daysUntil === 0 ? "Vence hoje" : `Vence em ${p.daysUntil}d`}
                </span>
                <span className="text-[11px] text-foreground/40 shrink-0 tabular-nums">
                  {new Date(p.nextDueDate + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      {isMeView && mentions.length > 0 && (
        <div className="mb-6">
          <SectionHeader
            icon={<AtSign size={11} />}
            iconBg="rgba(var(--lz-brand-light-rgb),0.18)" iconColor="var(--lz-accent-ink)"
            label="Mencionado em" count={mentions.length}
            open={isSectionOpen("mentions")} onToggle={() => toggleSection("mentions")}
          />
          {isSectionOpen("mentions") && (
          <div className="bg-card rounded-lg overflow-hidden lz-stagger">
            {mentions.map((m: any) => (
              <button
                key={m.mentionId}
                onClick={() => {
                  markMentionRead.mutate({ data: { mentionId: m.mentionId } });
                  navigate({ to: "/cliente/$clientId", params: { clientId: m.clientId } });
                  selectMonth(m.monthKey);
                  setTimeout(() => { openItem(m.itemId); flash(m.itemId); }, 30);
                  setTimeout(() => flash(null), 2050);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors text-left border-b border-foreground/5 last:border-b-0"
              >
                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider shrink-0"
                  style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>
                  @MENÇÃO
                </span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: m.clientColor + "33", color: m.clientColor.toUpperCase() === "#FFFFFF" ? "#FFFFFF" : m.clientColor }}>
                  {m.clientName}
                </span>
                <span className="text-[11px] text-foreground/50 uppercase font-semibold shrink-0">
                  {CONTENT_TYPE_LABEL[m.type as keyof typeof CONTENT_TYPE_LABEL] ?? "Item"} {String(m.idx).padStart(2, "0")}
                </span>
                <span className="text-sm text-foreground/90 truncate flex-1">
                  {m.authorName ? <span className="text-foreground/50">{m.authorName}: </span> : null}{m.snippet || m.title}
                </span>
                <span className="text-[10px] text-foreground/40 shrink-0 tabular-nums">
                  {new Date(m.mentionedAt).toLocaleDateString("pt-BR")}
                </span>
              </button>
            ))}
          </div>
          )}
        </div>
      )}

      <div className="inline-flex bg-card border border-foreground/6 rounded-lg p-1 mb-6" data-tour="my-week">
        {[
          { id: "list" as const, label: "Lista", Icon: List },
          { id: "week" as const, label: "Minha Semana", Icon: CalendarDays },
        ].map((v) => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-md transition-colors ${
              view === v.id ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/60 hover:text-foreground"}`}>
            <v.Icon size={12} /> {v.label}
          </button>
        ))}
      </div>

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

      {view === "week" ? (
        <MyWeekView userId={isAdmin && viewAs ? viewAs : undefined} />
      ) : tasks.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-16 text-center">
          <p className="text-foreground/50 text-sm">Sem tarefas no momento.</p>
        </div>
      ) : (
        <div className="space-y-6 lz-stagger">
          {STATUS_ORDER.map((s) => {
            if (!grouped[s].length) return null;
            const m = STATUS_META[s]; const I = STATUS_ICONS[s];
            const sectionId = `status:${s}`;
            const open = isSectionOpen(sectionId);
            return (
              <div key={s}>
                <SectionHeader
                  icon={<I size={11} />}
                  iconBg={m.bg} iconColor={m.color}
                  label={m.label} count={grouped[s].length}
                  open={open} onToggle={() => toggleSection(sectionId)}
                />
                {open && (
                <div className="bg-card rounded-lg overflow-hidden lz-stagger">
                  {grouped[s].map((t) => (
                    <button key={t.id}
                      onClick={() => { navigate({ to: "/cliente/$clientId", params: { clientId: t.clientId } }); selectMonth(t.monthKey); setTimeout(() => openItem(t.id), 30); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03] transition-colors text-left border-b border-foreground/5 last:border-b-0">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: t.clientColor + "33", color: t.clientColor.toUpperCase() === "#FFFFFF" ? "#FFFFFF" : t.clientColor }}>
                        {t.clientName}
                      </span>
                      {t.clientCategory === "Avulsos" && (
                        <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
                          Avulso
                        </span>
                      )}
                      <span className="text-[11px] text-foreground/50 uppercase font-semibold">
                        {t.type === "post" ? "Post" : t.type === "reel" ? "Reels" : "Item"} {String(t.idx).padStart(2, "0")}
                      </span>
                      <span className="text-sm text-foreground truncate flex-1">{t.title}</span>
                      <DeadlinePill dueDate={(t as any).dueDate} status={t.status} />
                    </button>
                  ))}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {prod && (
        <Suspense fallback={<div className="mt-10 h-[290px] rounded-lg" style={{ background: "var(--card)", border: "1px solid rgba(var(--lz-brand-light-rgb),0.15)" }} />}>
          <ProductivityBlock prod={prod} monthKey={monthKey} />
        </Suspense>
      )}
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

function TodayCalendarWidget() {
  const { data } = useQuery(todayCalendarEventsQO());
  const [openEvent, setOpenEvent] = useState<any | null>(null);
  if (!data?.connected || !data.events?.length) return null;
  return (
    <div className="mb-6 bg-card rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <span className="rounded p-1" style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "var(--lz-accent-ink)" }}>
          <CalendarClock size={11} />
        </span>
        <h2 className="text-[11px] uppercase font-bold tracking-wider text-foreground/60">Hoje na agenda</h2>
      </div>
      <div className="divide-y divide-white/[0.05] lz-stagger">
        {data.events.map((ev: any) => (
          <button
            key={ev.id}
            onClick={() => setOpenEvent(ev)}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-foreground/[0.03] transition-colors text-left"
          >
            <span className="text-[11px] text-foreground/40 tabular-nums shrink-0">
              {ev.allDay ? "Dia todo" : new Date(ev.start).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-sm text-foreground/90 truncate block">{ev.title}</span>
              {ev.attendees?.length > 0 && (
                <span className="text-[11px] text-foreground/40 truncate block">com {ev.attendees.join(", ")}</span>
              )}
            </span>
          </button>
        ))}
      </div>
      {openEvent && <CalendarEventModal event={openEvent} onClose={() => setOpenEvent(null)} />}
    </div>
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
      <div className="w-full max-w-sm bg-card border border-foreground/10 rounded-2xl p-6" onClick={(e) => e.stopPropagation()}>
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