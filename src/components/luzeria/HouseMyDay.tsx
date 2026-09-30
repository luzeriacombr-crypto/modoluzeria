// House (Fase 2) — "Meu dia": a home da pessoa da equipe. Checklist do dia,
// barras das metas mínimas, próximos conteúdos com prazo e o "+ Lead"
// (esse fica fixo em todas as telas da House, ver HouseLeads.tsx).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Check, ChevronRight, ClipboardList, Instagram, ListChecks, Target, Plus, Undo2, UserPlus, Hand } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { useMe, profilesQO, contentStatusesQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { getMyDay, setChecklistDone, type MyDay } from "@/lib/luzeria/house-day.functions";
import { logActivity, undoActivity, listUnassignedItems } from "@/lib/luzeria/house-team.functions";
import { useApi } from "@/lib/luzeria/queries";
import { CADENCE_LABEL, checklistDueLabel } from "@/lib/luzeria/house-checklists";
import { statusLabel, getStatusMeta } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { HouseStoryIdeas } from "./HouseStoryIdeas";

export const myDayQueryKey = ["house-my-day"];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function HouseMyDay() {
  const me = useMe().data;
  const fetchDay = useServerFn(getMyDay);
  const { data: day, isLoading, error } = useQuery({ queryKey: myDayQueryKey, queryFn: () => fetchDay(), staleTime: 60_000 });
  const firstName = me?.name.split(" ")[0] ?? "";
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-5xl mx-auto pb-28">
      <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Meu dia</div>
      <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight leading-tight mt-1">
        {firstName ? `Bom trabalho hoje, ${firstName}!` : "Meu dia"}
      </h1>
      <p className="text-sm text-foreground/50 mt-1 first-letter:uppercase">{todayLabel}</p>

      {isLoading && <div className="mt-8 text-sm text-foreground/40">Carregando…</div>}
      {error && <div className="mt-8 text-sm" style={{ color: "#E76F51" }}>Não consegui carregar seu dia. Tenta atualizar a página.</div>}
      {day && (
        <div className="mt-6 grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <GoalsCard day={day} />
            <LogCard day={day} />
            <HouseStoryIdeas />
            <ChecklistCard day={day} />
          </div>
          <div className="space-y-4">
            <UnassignedCard />
            <UpcomingCard day={day} />
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icon, title, right, children }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-2xl p-5 border border-foreground/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-4">
        <h2 className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-foreground/60">
          <span style={{ color: "var(--lz-accent-ink)" }}>{icon}</span>{title}
        </h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function GoalsCard({ day }: { day: MyDay }) {
  const [, m] = day.planning.monthKey.split("-").map(Number);
  const planningMonth = MONTHS[m - 1];
  const planning = day.planning;
  return (
    <Card icon={<Target size={14} />} title="Metas"
      right={day.stories.source === "instagram" ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-foreground/40"><Instagram size={11} /> direto do Instagram</span>
      ) : (
        <span className="text-[10px] text-foreground/40" title="Conecte o Instagram da marca pra contar direto de lá, inclusive o que for postado pelo app do Instagram">Modo Criador + registros da equipe</span>
      )}>
      <div className="space-y-4">
        <GoalBar label="Stories hoje" done={day.stories.done} goal={day.isWorkday ? day.stories.goal : 0}
          hint={day.isWorkday ? undefined : "Fim de semana — sem meta hoje"} />
        <GoalBar label="Posts no feed esta semana" done={day.posts.done} goal={day.posts.goal} />
        <div>
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-foreground/80">Planejamento de {planningMonth}</span>
            <span className="text-xs font-semibold" style={{ color: planning.delivered ? "var(--lz-accent-ink)" : planning.daysLeft < 0 ? "#FF6B6B" : "var(--foreground)" }}>
              {planning.delivered ? "Entregue ✓"
                : planning.daysLeft < 0 ? `Atrasado ${-planning.daysLeft} dia${planning.daysLeft === -1 ? "" : "s"}`
                : planning.daysLeft === 0 ? "Vence hoje"
                : `Até ${planning.deadlineDate.slice(8, 10)}/${planning.deadlineDate.slice(5, 7)} · faltam ${planning.daysLeft} dia${planning.daysLeft === 1 ? "" : "s"}`}
            </span>
          </div>
          <Bar pct={planning.delivered ? 100 : 0} color={planning.delivered ? undefined : planning.daysLeft < 0 ? "#FF6B6B" : undefined} />
        </div>
      </div>
    </Card>
  );
}

function GoalBar({ label, done, goal, hint }: { label: string; done: number; goal: number; hint?: string }) {
  const pct = goal > 0 ? Math.min(100, Math.round((done / goal) * 100)) : done > 0 ? 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="text-foreground/80">{label}</span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: goal > 0 && done >= goal ? "var(--lz-accent-ink)" : "var(--foreground)" }}>
          {hint ?? `${done} de ${goal}`}
        </span>
      </div>
      <Bar pct={pct} />
    </div>
  );
}

function Bar({ pct, color }: { pct: number; color?: string }) {
  return (
    <div className="h-2 rounded-full bg-foreground/[0.08] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color ?? "rgb(var(--lz-brand-rgb))" }} />
    </div>
  );
}

function ChecklistCard({ day }: { day: MyDay }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const me = useMe().data;
  const toggleFn = useServerFn(setChecklistDone);
  const toggle = useMutation({
    mutationFn: (v: { itemId: string; done: boolean }) => toggleFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: myDayQueryKey });
      const prev = qc.getQueryData<MyDay>(myDayQueryKey);
      if (prev) qc.setQueryData<MyDay>(myDayQueryKey, { ...prev, checklist: prev.checklist.map((i) => i.id === v.itemId ? { ...i, done: v.done, late: v.done ? false : i.late } : i) });
      return { prev };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(myDayQueryKey, ctx.prev); toastFriendlyError(e, "Não consegui salvar"); },
    onSettled: () => qc.invalidateQueries({ queryKey: myDayQueryKey }),
  });
  const pending = day.checklist.filter((i) => !i.done).length;
  const isAdmin = me?.role === "master" || me?.role === "setor";

  return (
    <Card icon={<ListChecks size={14} />} title="Checklist"
      right={<span className="text-[11px] text-foreground/40">{day.checklist.length === 0 ? "" : pending === 0 ? "Tudo feito 🎉" : `${pending} pendente${pending > 1 ? "s" : ""}`}</span>}>
      {day.checklist.length === 0 ? (
        <div className="text-sm text-foreground/50">
          Nenhum checklist pra hoje.
          {isAdmin && (
            <button onClick={() => navigate({ to: "/rotina" })} className="ml-1 font-semibold underline underline-offset-2" style={{ color: "var(--lz-accent-ink)" }}>
              Criar checklists
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-1.5">
          {day.checklist.map((i) => (
            <li key={i.id}>
              <button onClick={() => toggle.mutate({ itemId: i.id, done: !i.done })}
                className="w-full flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.04] active:scale-[0.99]"
                style={{ background: i.late ? "rgba(255,107,107,0.06)" : undefined }}>
                <span className="mt-0.5 h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors"
                  style={i.done
                    ? { backgroundColor: "rgb(var(--lz-brand-rgb))", borderColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
                    : { borderColor: "color-mix(in srgb, var(--foreground) 25%, transparent)" }}>
                  {i.done && <Check size={13} strokeWidth={3} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${i.done ? "text-foreground/40 line-through" : "text-foreground"}`}>{i.title}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-foreground/40 mt-0.5">
                    {CADENCE_LABEL[i.cadence]} · {checklistDueLabel(i)}
                    {i.late && <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: "#FF6B6B" }}><AlertTriangle size={10} /> atrasado</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UpcomingCard({ day }: { day: MyDay }) {
  const navigate = useNavigate();
  const { selectMonth, openItem } = useUI();
  const { data: profiles = [] } = useQuery(profilesQO());
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const { data: contentStatuses = [] } = useQuery(contentStatusesQO());
  const labelOverrides = new Map(contentStatuses.map((r) => [r.key, r.label]));
  const todayKey = day.todayKey;

  function open(it: MyDay["upcoming"][number]) {
    navigate({ to: "/cliente/$clientId", params: { clientId: it.clientId } });
    selectMonth(it.monthKey);
    setTimeout(() => openItem(it.id), 30);
  }

  return (
    <Card icon={<CalendarClock size={14} />} title="Próximos conteúdos">
      {day.upcoming.length === 0 ? (
        <div className="text-sm text-foreground/50 flex items-center gap-2"><ClipboardList size={15} /> Nada com prazo no fluxo de produção.</div>
      ) : (
        <ul className="space-y-1">
          {day.upcoming.map((it) => {
            const late = it.dueDate < todayKey;
            const meta = getStatusMeta(it.status, labelOverrides);
            return (
              <li key={it.id}>
                <button onClick={() => open(it)} className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-foreground/[0.04] transition-colors">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[10px] uppercase font-bold" style={{ color: late ? "#FF6B6B" : "var(--foreground)", opacity: late ? 1 : 0.5 }}>
                      {late ? "atraso" : it.dueDate === todayKey ? "hoje" : new Date(`${it.dueDate}T12:00:00`).toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}
                    </div>
                    <div className="text-sm font-bold tabular-nums text-foreground">{it.dueDate.slice(8, 10)}/{it.dueDate.slice(5, 7)}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-foreground truncate">{it.title}</div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: meta.bg, color: meta.color }}>{statusLabel(it.status, false, labelOverrides)}</span>
                      {it.mine && <span className="text-[10px] font-semibold" style={{ color: "var(--lz-accent-ink)" }}>seu</span>}
                    </div>
                  </div>
                  <div className="flex -space-x-1.5 shrink-0">
                    {it.assigneeIds.slice(0, 3).map((id) => {
                      const p = byId.get(id);
                      return p ? <Avatar key={id} name={p.name} color={p.color} avatarUrl={p.avatarUrl} size={22} /> : null;
                    })}
                  </div>
                  <ChevronRight size={14} className="text-foreground/25 shrink-0" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Registro rápido do que a pessoa postou direto no Instagram — dá o
 * crédito no ranking e conta nas metas quando não há Instagram conectado. */
function LogCard({ day }: { day: MyDay }) {
  const qc = useQueryClient();
  const logFn = useServerFn(logActivity);
  const undoFn = useServerFn(undoActivity);
  const after = () => { qc.invalidateQueries({ queryKey: myDayQueryKey }); qc.invalidateQueries({ queryKey: ["house-owner-panel"] }); };
  const add = useMutation({
    mutationFn: (kind: "story" | "post" | "reel") => logFn({ data: { kind } }),
    onMutate: (kind) => {
      const prev = qc.getQueryData<MyDay>(myDayQueryKey);
      if (prev) qc.setQueryData<MyDay>(myDayQueryKey, { ...prev, myLogsToday: { ...prev.myLogsToday, [kind]: prev.myLogsToday[kind] + 1 } });
    },
    onError: (e: any) => { after(); toastFriendlyError(e, "Não consegui registrar"); },
    onSettled: after,
  });
  const undo = useMutation({
    mutationFn: (kind: "story" | "post" | "reel") => undoFn({ data: { kind } }),
    onSettled: after,
  });
  const items = [
    { kind: "story" as const, label: "Story" },
    { kind: "post" as const, label: "Post" },
    { kind: "reel" as const, label: "Reels" },
  ];
  return (
    <Card icon={<Hand size={14} />} title="Postei agora"
      right={<span className="text-[10px] text-foreground/40">o que você postou direto no Instagram</span>}>
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const n = day.myLogsToday?.[it.kind] ?? 0;
          return (
            <div key={it.kind} className="rounded-xl p-2.5 text-center" style={{ background: "color-mix(in srgb, var(--foreground) 4%, transparent)" }}>
              <button onClick={() => add.mutate(it.kind)}
                className="w-full inline-flex items-center justify-center gap-1 rounded-lg py-2.5 text-sm font-bold active:scale-95 transition-transform"
                style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
                <Plus size={15} strokeWidth={2.5} /> {it.label}
              </button>
              <div className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-foreground/55">
                <span className="tabular-nums">{n} hoje</span>
                {n > 0 && (
                  <button onClick={() => undo.mutate(it.kind)} title="Desfazer o último" className="p-0.5 rounded text-foreground/40 hover:text-foreground"><Undo2 size={11} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** Lembrete: itens em produção sem ninguém como responsável — quem fez
 * precisa se atribuir pra contar no ranking. */
function UnassignedCard() {
  const me = useMe().data;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { selectMonth, openItem } = useUI();
  const listFn = useServerFn(listUnassignedItems);
  const { data: items = [] } = useQuery({ queryKey: ["house-unassigned"], queryFn: () => listFn(), staleTime: 60_000 });
  const { addAssignee } = useApi();
  if (items.length === 0 || !me) return null;
  return (
    <Card icon={<UserPlus size={14} />} title="Sem responsável"
      right={<span className="text-[10px] text-foreground/40">se foi você, assuma pra contar no ranking</span>}>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/[0.03]">
            <button onClick={() => { navigate({ to: "/cliente/$clientId", params: { clientId: it.clientId } }); selectMonth(it.monthKey); setTimeout(() => openItem(it.id), 30); }}
              className="flex-1 min-w-0 text-left text-sm text-foreground/85 truncate">
              {it.title || "Sem título"}
              {it.dueDate && <span className="text-[11px] text-foreground/40"> · {it.dueDate.slice(8, 10)}/{it.dueDate.slice(5, 7)}</span>}
            </button>
            <button onClick={() => addAssignee.mutate({ data: { itemId: it.id, userId: me.id } }, {
              onSuccess: () => { qc.invalidateQueries({ queryKey: ["house-unassigned"] }); qc.invalidateQueries({ queryKey: myDayQueryKey }); },
            })}
              className="shrink-0 text-[11px] font-bold px-2.5 py-1.5 rounded-md"
              style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
              Assumir
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
