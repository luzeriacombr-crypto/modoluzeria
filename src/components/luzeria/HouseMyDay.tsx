// House (Fase 2) — "Meu dia": a home da pessoa da equipe. Checklist do dia,
// barras das metas mínimas, próximos conteúdos com prazo e o "+ Lead"
// (esse fica fixo em todas as telas da House, ver HouseLeads.tsx).
import { useGoToItem } from "@/lib/luzeria/go-to-item";
import { AnniversaryCard } from "@/components/luzeria/AnniversaryCard";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Check, ChevronRight, ClipboardList, Instagram, ListChecks, Target, Plus, Undo2, UserPlus, Hand, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { useMe, profilesQO, contentStatusesQO } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { getMyDay, setChecklistDone, type MyDay } from "@/lib/luzeria/house-day.functions";
import { logActivity, undoActivity, listUnassignedItems, listActivityLogs, deleteActivityLog } from "@/lib/luzeria/house-team.functions";
import { useApi } from "@/lib/luzeria/queries";
import { CADENCE_LABEL, checklistDueLabel } from "@/lib/luzeria/house-checklists";
import { statusLabel, getStatusMeta } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { HouseStoryIdeas } from "./HouseStoryIdeas";
import { UpcomingDatesCard } from "./CommemorativeDatesPanel";
import { HouseBrandSwitcher, HouseBrandSelect } from "./HouseBrandSwitcher";
import { useHouseBrand } from "@/lib/luzeria/house-brand-store";

export const myDayQueryKey = ["house-my-day"];
const dayKey = (brandParam?: string) => [...myDayQueryKey, brandParam ?? "all"];

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function HouseMyDay() {
  const me = useMe().data;
  const fetchDay = useServerFn(getMyDay);
  const { brandParam } = useHouseBrand();
  const { data: day, isLoading, error } = useQuery({ queryKey: dayKey(brandParam), queryFn: () => fetchDay({ data: { brandId: brandParam } }), staleTime: 60_000 });
  const firstName = me?.name.split(" ")[0] ?? "";
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-5xl mx-auto pb-28">
      <AnniversaryCard />
      <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Meu dia</div>
      <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight leading-tight mt-1">
        {firstName ? `Bom trabalho hoje, ${firstName}!` : "Meu dia"}
      </h1>
      <p className="text-sm text-foreground/50 mt-1 first-letter:uppercase">{todayLabel}</p>
      <HouseBrandSwitcher className="mt-4" />

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
            <UpcomingDatesCard brandId={brandParam} />
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
  const { brandParam } = useHouseBrand();
  const toggle = useMutation({
    mutationFn: (v: { itemId: string; done: boolean }) => toggleFn({ data: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: myDayQueryKey });
      const prev = qc.getQueryData<MyDay>(dayKey(brandParam));
      if (prev) qc.setQueryData<MyDay>(dayKey(brandParam), { ...prev, checklist: prev.checklist.map((i) => i.id === v.itemId ? { ...i, done: v.done, late: v.done ? false : i.late } : i) });
      return { prev };
    },
    onError: (e: any, _v, ctx) => { if (ctx?.prev) qc.setQueryData(dayKey(brandParam), ctx.prev); toastFriendlyError(e, "Não consegui salvar"); },
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
  const goToItem = useGoToItem();
  const { data: profiles = [] } = useQuery(profilesQO());
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const { data: contentStatuses = [] } = useQuery(contentStatusesQO());
  const labelOverrides = new Map(contentStatuses.map((r) => [r.key, r.label]));
  const todayKey = day.todayKey;

  function open(it: MyDay["upcoming"][number]) {
    goToItem({ itemId: it.id, clientId: it.clientId, monthKey: it.monthKey, type: it.type, status: it.status, openPanel: true });
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
const LOG_KIND_LABEL = { story: "Story", post: "Post", reel: "Reels" } as const;

function LogCard({ day }: { day: MyDay }) {
  const qc = useQueryClient();
  const me = useMe().data;
  const logFn = useServerFn(logActivity);
  const undoFn = useServerFn(undoActivity);
  const listFn = useServerFn(listActivityLogs);
  const deleteFn = useServerFn(deleteActivityLog);
  const [showList, setShowList] = useState(false);
  const [scope, setScope] = useState<"mine" | "team">("mine");
  const { brandParam, writeBrandId, multi } = useHouseBrand();
  // Com "todas as marcas" na tela, a pessoa escolhe em qual marca está registrando.
  const [pick, setPick] = useState<string | undefined>(undefined);
  const logBrand = brandParam ?? pick ?? writeBrandId;
  const isMaster = me?.role === "master";
  const after = () => {
    qc.invalidateQueries({ queryKey: myDayQueryKey });
    qc.invalidateQueries({ queryKey: ["house-activity-logs"] });
    qc.invalidateQueries({ queryKey: ["house-owner-panel"] });
    qc.invalidateQueries({ queryKey: ["house-ranking"] });
  };
  const undo = useMutation({
    mutationFn: (kind: "story" | "post" | "reel") => undoFn({ data: { kind, brandId: logBrand } }),
    onSettled: after,
  });
  const add = useMutation({
    mutationFn: (kind: "story" | "post" | "reel") => logFn({ data: { kind, brandId: logBrand } }),
    onMutate: (kind) => {
      const prev = qc.getQueryData<MyDay>(dayKey(brandParam));
      if (prev) qc.setQueryData<MyDay>(dayKey(brandParam), { ...prev, myLogsToday: { ...prev.myLogsToday, [kind]: prev.myLogsToday[kind] + 1 } });
    },
    onSuccess: (_r, kind) => {
      // Aviso com botão: errou o toque? Desfaz na hora.
      toast.success(`${LOG_KIND_LABEL[kind]} registrado`, {
        duration: 8000,
        action: { label: "Desfazer", onClick: () => undo.mutate(kind) },
      });
    },
    onError: (e: any) => { after(); toastFriendlyError(e, "Não consegui registrar"); },
    onSettled: after,
  });
  const { data: logs = [] } = useQuery({
    queryKey: ["house-activity-logs", scope, brandParam ?? "all"],
    queryFn: () => listFn({ data: { scope, brandId: brandParam } }),
    enabled: showList,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Registro apagado."); after(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui apagar"),
  });
  const items = [
    { kind: "story" as const, label: "Story" },
    { kind: "post" as const, label: "Post" },
    { kind: "reel" as const, label: "Reels" },
  ];
  const today = day.todayKey;
  return (
    <Card icon={<Hand size={14} />} title="Postei agora"
      right={<span className="text-[10px] text-foreground/40">o que você postou direto no Instagram</span>}>
      {multi && !brandParam && (
        <div className="mb-3"><HouseBrandSelect value={pick} onChange={setPick} /></div>
      )}
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
              <div className="mt-2 text-[11px] text-foreground/55 tabular-nums">{n} hoje</div>
              {n > 0 && (
                <button onClick={() => undo.mutate(it.kind)}
                  className="mt-1.5 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-foreground/70 hover:text-foreground hover:bg-foreground/[0.07] transition">
                  <Undo2 size={12} /> Desfazer
                </button>
              )}
            </div>
          );
        })}
      </div>

      <button onClick={() => setShowList((v) => !v)} className="mt-3 text-[11px] font-semibold text-foreground/50 hover:text-foreground">
        {showList ? "Esconder registros" : "Ver / apagar registros"}
      </button>
      {showList && (
        <div className="mt-2">
          {isMaster && (
            <div className="inline-flex items-center gap-1 bg-background rounded-full p-0.5 border border-foreground/[0.08] mb-2 text-[11px]">
              {(["mine", "team"] as const).map((sc) => (
                <button key={sc} onClick={() => setScope(sc)}
                  className={`px-2.5 py-1 rounded-full font-semibold ${scope === sc ? "bg-[rgb(var(--lz-brand-rgb))] text-black" : "text-foreground/55"}`}>
                  {sc === "mine" ? "Meus" : "Da equipe"}
                </button>
              ))}
            </div>
          )}
          {logs.length === 0 ? (
            <div className="text-xs text-foreground/45 py-2">Nenhum registro nos últimos 7 dias.</div>
          ) : (
            <ul className="space-y-0.5 max-h-56 overflow-y-auto">
              {logs.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04]">
                  <span className="flex-1 min-w-0 text-xs text-foreground/80 truncate">
                    {l.qty > 1 ? `${l.qty}× ` : ""}{LOG_KIND_LABEL[l.kind]}
                    {scope === "team" && l.userName ? ` · ${l.userName.split(" ")[0]}` : ""}
                  </span>
                  <span className="text-[10.5px] text-foreground/40 tabular-nums shrink-0">
                    {l.day === today ? "hoje" : `${l.day.slice(8, 10)}/${l.day.slice(5, 7)}`}{" "}
                    {new Date(l.createdAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
                  </span>
                  <button onClick={() => remove.mutate(l.id)} title="Apagar esse registro" aria-label="Apagar esse registro"
                    className="p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition shrink-0"><X size={13} /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
  const goToItem = useGoToItem();
  const listFn = useServerFn(listUnassignedItems);
  const { brandParam } = useHouseBrand();
  const { data: items = [] } = useQuery({ queryKey: ["house-unassigned", brandParam ?? "all"], queryFn: () => listFn({ data: { brandId: brandParam } }), staleTime: 60_000 });
  const { addAssignee } = useApi();
  if (items.length === 0 || !me) return null;
  return (
    <Card icon={<UserPlus size={14} />} title="Sem responsável"
      right={<span className="text-[10px] text-foreground/40">se foi você, assuma pra contar no ranking</span>}>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-foreground/[0.03]">
            <button onClick={() => goToItem({ itemId: it.id, clientId: it.clientId, monthKey: it.monthKey, type: it.type, status: it.status, openPanel: true })}
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
