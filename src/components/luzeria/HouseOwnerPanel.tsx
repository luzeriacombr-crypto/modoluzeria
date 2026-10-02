// House (Fase 4) — Painel do dono: o mês inteiro numa tela. Metas
// cumpridas, stories e posts publicados, leads por origem, taxa de avanço
// (lead → agendou → compareceu), projetos em andamento e checklists
// atrasados. O dono configura aqui as metas de leads e a variável.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AlertTriangle, Trophy, ChevronLeft, ChevronRight, FileText, FolderKanban, Instagram, Settings2, Target, Users, Wallet, X } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { useMe } from "@/lib/luzeria/queries";
import { getOwnerPanel, saveHouseTargets, type OwnerPanel } from "@/lib/luzeria/house-owner.functions";
import { getTeamRanking, RANKING_POINTS } from "@/lib/luzeria/house-team.functions";
import { Avatar } from "./Avatar";
import { useHouseBrand } from "@/lib/luzeria/house-brand-store";
import { HouseBrandSwitcher } from "./HouseBrandSwitcher";
import { houseDateKey, LEAD_ORIGINS, LEAD_ORIGIN_LABEL } from "@/lib/luzeria/house-checklists";
import { monthLabel, shiftMonth, PROJECT_TEMPLATES } from "@/lib/luzeria/house-projects";

const pctLabel = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const money = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function MonthSwitcher({ monthKey, onChange }: { monthKey: string; onChange: (k: string) => void }) {
  const current = houseDateKey().slice(0, 7);
  return (
    <div className="inline-flex items-center gap-1 bg-card rounded-full p-1 border border-foreground/[0.06]">
      <button onClick={() => onChange(shiftMonth(monthKey, -1))} aria-label="Mês anterior" className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5"><ChevronLeft size={16} /></button>
      <span className="px-2 text-sm font-semibold text-foreground min-w-[150px] text-center first-letter:uppercase">{monthLabel(monthKey)}</span>
      <button onClick={() => onChange(shiftMonth(monthKey, 1))} disabled={monthKey >= current} aria-label="Próximo mês"
        className="h-8 w-8 rounded-full flex items-center justify-center text-foreground/60 hover:text-foreground hover:bg-foreground/5 disabled:opacity-25"><ChevronRight size={16} /></button>
    </div>
  );
}

export function HouseOwnerPanel() {
  const me = useMe().data;
  const navigate = useNavigate();
  const fetchPanel = useServerFn(getOwnerPanel);
  const [monthKey, setMonthKey] = useState(() => houseDateKey().slice(0, 7));
  const [configOpen, setConfigOpen] = useState(false);
  const { brandParam } = useHouseBrand();
  const { data, isLoading, error } = useQuery({
    queryKey: ["house-owner-panel", monthKey, brandParam ?? "all"],
    queryFn: () => fetchPanel({ data: { monthKey, brandId: brandParam } }),
    staleTime: 60_000,
  });
  const isMaster = me?.role === "master";

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-6xl mx-auto pb-28">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Painel do dono</div>
          <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-0.5">Visão do mês</h1>
        </div>
        <div className="flex items-center gap-2">
          <MonthSwitcher monthKey={monthKey} onChange={setMonthKey} />
          {isMaster && (
            <button onClick={() => setConfigOpen(true)} title="Metas de leads e variável"
              className="h-10 w-10 rounded-full flex items-center justify-center bg-card border border-foreground/[0.06] text-foreground/60 hover:text-foreground"><Settings2 size={16} /></button>
          )}
        </div>
      </div>

      <HouseBrandSwitcher className="mt-4" />
      {isLoading && <div className="mt-8 text-sm text-foreground/40">Calculando o mês…</div>}
      {error && <div className="mt-8 text-sm" style={{ color: "#E76F51" }}>Não consegui carregar o painel.</div>}
      {data && (
        <div className="mt-6 space-y-4">
          <HeroRow data={data} />
          {data.byBrand.length > 1 && <ByBrandCard data={data} />}
          <div className="grid gap-4 lg:grid-cols-2">
            <LeadsCard data={data} />
            <OriginCard data={data} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProjectsCard data={data} onOpen={(id) => navigate({ to: "/projetos", search: { id } as any })} />
            <LateChecklistsCard data={data} />
          </div>
          <RankingCard monthKey={monthKey} brandParam={brandParam} />
          {data.variable && <VariableCard data={data} />}
          <button onClick={() => navigate({ to: "/relatorio", search: { mes: monthKey } as any })}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-bold"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            <FileText size={15} /> Relatório de {monthLabel(monthKey)}
          </button>
        </div>
      )}
      {configOpen && data && <TargetsModal settings={data.settings} onClose={() => setConfigOpen(false)} />}
    </div>
  );
}

function ByBrandCard({ data }: { data: OwnerPanel }) {
  const pctOf = (done: number, goal: number) => (goal > 0 ? Math.round(Math.min(1, done / goal) * 100) : done > 0 ? 100 : 0);
  return (
    <Card icon={<Users size={14} />} title="Por marca">
      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm min-w-[520px]">
          <thead>
            <tr className="text-[10.5px] uppercase tracking-wider text-foreground/45">
              <th className="text-left font-semibold px-2 py-2">Marca</th>
              <th className="text-right font-semibold px-2 py-2">Stories</th>
              <th className="text-right font-semibold px-2 py-2">Posts/Reels</th>
              <th className="text-right font-semibold px-2 py-2">Leads</th>
              <th className="text-right font-semibold px-2 py-2">Agendados</th>
            </tr>
          </thead>
          <tbody>
            {data.byBrand.map((b) => (
              <tr key={b.brandId} className="border-t border-foreground/[0.06]">
                <td className="px-2 py-2.5 font-semibold text-foreground">{b.name}</td>
                <td className="text-right tabular-nums px-2 py-2.5 text-foreground/80">{b.stories.done} / {b.stories.goal} <span className="text-foreground/40">({pctOf(b.stories.done, b.stories.goal)}%)</span></td>
                <td className="text-right tabular-nums px-2 py-2.5 text-foreground/80">{b.posts.done} / {b.posts.goal} <span className="text-foreground/40">({pctOf(b.posts.done, b.posts.goal)}%)</span></td>
                <td className="text-right tabular-nums px-2 py-2.5 text-foreground/80">{b.leads} / {b.leadsGoal}</td>
                <td className="text-right tabular-nums px-2 py-2.5 text-foreground/80">{b.scheduled}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Card({ icon, title, right, children, className = "" }: { icon: React.ReactNode; title: string; right?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`bg-card rounded-2xl p-5 border border-foreground/[0.06] ${className}`}>
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

function Bar({ pct, title }: { pct: number; title?: string }) {
  return (
    <div className="h-2 rounded-full bg-foreground/[0.08] overflow-hidden" title={title}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round(Math.min(1, pct) * 100)}%`, background: "rgb(var(--lz-brand-rgb))" }} />
    </div>
  );
}

function HeroRow({ data }: { data: OwnerPanel }) {
  const p = data.planning;
  const planningText = p.delivered ? (p.onTime ? "Entregue no prazo" : "Entregue com atraso")
    : p.onTime === false ? "Prazo vencido" : p.applies === false ? "Não se aplica (conta nova)" : `Prazo ${p.deadline.slice(8, 10)}/${p.deadline.slice(5, 7)}`;
  return (
    <div className="grid gap-4 md:grid-cols-[260px_1fr]">
      <section className="rounded-2xl p-6 border border-foreground/[0.06] flex flex-col justify-center"
        style={{ background: "linear-gradient(135deg, rgba(var(--lz-brand-rgb),0.14), var(--card) 70%)" }}>
        <div className="text-xs uppercase font-bold tracking-wider text-foreground/55">Metas cumpridas</div>
        <div className="text-[56px] leading-none font-extrabold tracking-tight text-foreground mt-2 tabular-nums">{pctLabel(data.goalsPct)}</div>
        <div className="text-xs text-foreground/45 mt-2">
          média de stories, posts, planejamento{data.checklists.pct != null ? " e checklists" : ""}{data.isCurrent ? " até hoje" : ""}
        </div>
      </section>
      <section className="bg-card rounded-2xl p-5 border border-foreground/[0.06] grid gap-5 sm:grid-cols-2">
        <Metric label="Stories publicados" value={`${data.stories.done}`} goal={`meta ${data.stories.goal}`} pct={data.stories.pct}
          note={data.stories.source === "instagram" ? `Instagram · ${data.stories.trackedDays} dia(s) registrados` : "pelo Modo Criador"} />
        <Metric label="Posts no feed" value={`${data.posts.done}`} goal={`meta ${data.posts.goal}`} pct={data.posts.pct}
          note={data.posts.source === "instagram" ? "direto do Instagram" : "pelo Modo Criador"} />
        <Metric label={`Planejamento de ${monthLabel(p.targetMonth).split(" ")[0]}`} value={p.delivered ? "✓" : "—"} goal={planningText}
          pct={p.delivered ? (p.onTime ? 1 : 0.5) : 0} />
        <Metric label="Checklists" value={data.checklists.pct == null ? "—" : pctLabel(data.checklists.pct)}
          goal={`${data.checklists.done} feitos · ${data.checklists.missed} atrasados`} pct={data.checklists.pct ?? 0} />
      </section>
    </div>
  );
}

function Metric({ label, value, goal, pct, note }: { label: string; value: string; goal: string; pct: number; note?: string }) {
  return (
    <div>
      <div className="text-xs text-foreground/55">{label}</div>
      <div className="flex items-baseline gap-2 mt-1 mb-2">
        <span className="text-2xl font-extrabold tabular-nums text-foreground">{value}</span>
        <span className="text-xs text-foreground/45">{goal}</span>
      </div>
      <Bar pct={pct} title={`${Math.round(pct * 100)}% da meta`} />
      {note && <div className="text-[10.5px] text-foreground/40 mt-1.5 flex items-center gap-1">{note.startsWith("Instagram") || note.startsWith("direto") ? <Instagram size={10} /> : null}{note}</div>}
    </div>
  );
}

function LeadsCard({ data }: { data: OwnerPanel }) {
  const l = data.leads;
  const steps = [
    { label: "Leads", value: l.total, rate: null as number | null, goal: l.goal },
    { label: "Agendaram", value: l.scheduled, rate: l.scheduleRate, goal: l.scheduledGoal },
    { label: "Compareceram", value: l.attended, rate: l.attendRate, goal: 0 },
  ];
  const max = Math.max(1, l.total);
  return (
    <Card icon={<Users size={14} />} title="Taxa de avanço">
      <div className="space-y-3.5">
        {steps.map((s, i) => (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-sm mb-1.5">
              <span className="text-foreground/80">{s.label}</span>
              <span className="tabular-nums">
                <span className="font-bold text-foreground">{s.value}</span>
                {s.goal > 0 && <span className="text-xs text-foreground/45"> / meta {s.goal}</span>}
                {i > 0 && <span className="text-xs text-foreground/55"> · {pctLabel(s.rate)} {i === 1 ? "dos leads" : "dos agendados"}</span>}
              </span>
            </div>
            <div className="h-7 rounded-lg bg-foreground/[0.05] overflow-hidden" title={`${s.label}: ${s.value}`}>
              <div className="h-full rounded-lg" style={{ width: `${Math.max(s.value ? 4 : 0, (s.value / max) * 100)}%`, background: "rgb(var(--lz-brand-rgb))", opacity: 1 - i * 0.22 }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function OriginCard({ data }: { data: OwnerPanel }) {
  const entries = LEAD_ORIGINS.map((o) => ({ o, n: data.leads.byOrigin[o] ?? 0 })).sort((a, b) => b.n - a.n);
  const max = Math.max(1, ...entries.map((e) => e.n));
  return (
    <Card icon={<Instagram size={14} />} title="Leads por origem">
      {data.leads.total === 0 ? (
        <div className="text-sm text-foreground/45">Nenhum lead registrado nesse mês.</div>
      ) : (
        <ul className="space-y-2.5">
          {entries.map(({ o, n }) => (
            <li key={o} className="grid grid-cols-[130px_1fr_32px] items-center gap-3" title={`${LEAD_ORIGIN_LABEL[o]}: ${n}`}>
              <span className="text-sm text-foreground/75 truncate">{LEAD_ORIGIN_LABEL[o]}</span>
              <div className="h-5 rounded-md bg-foreground/[0.05] overflow-hidden">
                <div className="h-full rounded-md" style={{ width: `${(n / max) * 100}%`, background: "rgb(var(--lz-brand-rgb))" }} />
              </div>
              <span className="text-sm font-bold tabular-nums text-foreground text-right">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProjectsCard({ data, onOpen }: { data: OwnerPanel; onOpen: (id: string) => void }) {
  return (
    <Card icon={<FolderKanban size={14} />} title="Projetos em andamento">
      {data.projects.length === 0 ? (
        <div className="text-sm text-foreground/45">Nenhum projeto em andamento.</div>
      ) : (
        <ul className="space-y-2">
          {data.projects.map((p) => (
            <li key={p.id}>
              <button onClick={() => onOpen(p.id)} className="w-full text-left rounded-lg px-3 py-2.5 hover:bg-foreground/[0.04] transition">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-foreground truncate">{p.title}</span>
                  <span className="text-[11px] text-foreground/45 shrink-0">
                    {PROJECT_TEMPLATES.find((t) => t.id === p.template)?.label}
                    {p.eventDate ? ` · ${p.eventDate.slice(8, 10)}/${p.eventDate.slice(5, 7)}` : ""}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex-1"><Bar pct={p.total ? p.done / p.total : 0} title={`${p.done} de ${p.total} tarefas`} /></div>
                  <span className="text-[11px] tabular-nums text-foreground/55">{p.done}/{p.total}</span>
                  {p.lateTasks > 0 && <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: "#FF6B6B" }}><AlertTriangle size={11} /> {p.lateTasks} atrasada{p.lateTasks > 1 ? "s" : ""}</span>}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function LateChecklistsCard({ data }: { data: OwnerPanel }) {
  return (
    <Card icon={<AlertTriangle size={14} />} title="Checklists atrasados">
      {data.lateChecklists.length === 0 ? (
        <div className="text-sm text-foreground/45">Nada atrasado nesse mês. 👏</div>
      ) : (
        <ul className="space-y-1">
          {data.lateChecklists.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-foreground/[0.03]">
              <span className="flex items-center gap-2 text-sm text-foreground/80 min-w-0">
                <AlertTriangle size={12} className="shrink-0" style={{ color: "#FF6B6B" }} />
                <span className="truncate">{c.title}</span>
              </span>
              <span className="text-[11px] text-foreground/45 tabular-nums shrink-0">
                {new Date(c.at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function VariableCard({ data }: { data: OwnerPanel }) {
  const v = data.variable!;
  const rows = [
    { label: "Execução das metas", w: v.weights.goals, s: v.scores.goals },
    { label: "Leads registrados", w: v.weights.leads, s: v.scores.leads },
    { label: "Leads que agendaram", w: v.weights.scheduled, s: v.scores.scheduled },
  ];
  return (
    <Card icon={<Wallet size={14} />} title="Variável da equipe"
      right={<span className="text-sm font-bold text-foreground tabular-nums">{money(v.valueCents)} <span className="text-xs font-normal text-foreground/45">de {money(v.maxCents)}</span></span>}>
      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-foreground/65">{r.label} <span className="text-foreground/40">· peso {r.w}%</span></span>
              <span className="font-bold tabular-nums text-foreground">{pctLabel(r.s)}</span>
            </div>
            <Bar pct={r.s} />
          </div>
        ))}
      </div>
      <div className="text-xs text-foreground/50 mt-4">Resultado ponderado: <strong className="text-foreground">{pctLabel(v.totalPct)}</strong></div>
    </Card>
  );
}

function TargetsModal({ settings, onClose }: { settings: OwnerPanel["settings"]; onClose: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveHouseTargets);
  const [leadsGoal] = useState(String(settings.leadsGoal));
  const [scheduledGoal] = useState(String(settings.scheduledGoal));
  const [bg, setBg] = useState(settings.brandGoals.map((g) => ({ ...g })));
  const setBrand = (id: string, k: "storiesPerWorkday" | "feedPostsPerWeek" | "leadsGoalMonth" | "scheduledGoalMonth", v: string) =>
    setBg((rows) => rows.map((r) => r.brandId === id ? { ...r, [k]: Math.max(0, Math.round(Number(v) || 0)) } : r));
  const [enabled, setEnabled] = useState(settings.variableEnabled);
  const [max, setMax] = useState(settings.variableMaxCents ? String(settings.variableMaxCents / 100) : "");
  const [w, setW] = useState(settings.weights);
  const wSum = w.goals + w.leads + w.scheduled;
  const save = useMutation({
    mutationFn: () => saveFn({ data: {
      leadsGoal: Math.max(0, Math.round(Number(leadsGoal) || 0)),
      scheduledGoal: Math.max(0, Math.round(Number(scheduledGoal) || 0)),
      variableEnabled: enabled,
      variableMaxCents: Math.max(0, Math.round((Number(String(max).replace(",", ".")) || 0) * 100)),
      weights: w,
      brandGoals: bg.map((g) => ({ brandId: g.brandId, storiesPerWorkday: g.storiesPerWorkday, feedPostsPerWeek: g.feedPostsPerWeek, leadsGoalMonth: g.leadsGoalMonth, scheduledGoalMonth: g.scheduledGoalMonth })),
    } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["house-owner-panel"] }); qc.invalidateQueries({ queryKey: ["house-report"] }); toast.success("Metas salvas."); onClose(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });
  const num = (v: string, set: (x: string) => void) => (
    <input type="number" inputMode="numeric" min={0} value={v} onChange={(e) => set(e.target.value)} className="lz-input w-24 text-center" />
  );

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <div className="w-full md:max-w-md bg-card rounded-t-2xl md:rounded-2xl p-6 border border-foreground/10 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-foreground flex items-center gap-2"><Target size={16} /> Metas e variável</h3>
          <button onClick={onClose} className="p-1 rounded text-foreground/50 hover:text-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-5">
          {bg.map((g) => (
            <div key={g.brandId} className="space-y-2.5">
              {bg.length > 1 && <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/55">{g.name}</div>}
              <label className="flex items-center justify-between gap-3 text-sm text-foreground/80">Stories por dia útil {num(String(g.storiesPerWorkday), (v) => setBrand(g.brandId, "storiesPerWorkday", v))}</label>
              <label className="flex items-center justify-between gap-3 text-sm text-foreground/80">Posts no feed por semana {num(String(g.feedPostsPerWeek), (v) => setBrand(g.brandId, "feedPostsPerWeek", v))}</label>
              <label className="flex items-center justify-between gap-3 text-sm text-foreground/80">Leads registrados por mês {num(String(g.leadsGoalMonth), (v) => setBrand(g.brandId, "leadsGoalMonth", v))}</label>
              <label className="flex items-center justify-between gap-3 text-sm text-foreground/80">Agendamentos por mês {num(String(g.scheduledGoalMonth), (v) => setBrand(g.brandId, "scheduledGoalMonth", v))}</label>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-foreground/[0.08]">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">Calcular variável da equipe</span>
            <button onClick={() => setEnabled((v) => !v)}
              className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${enabled ? "bg-[rgb(var(--lz-brand-rgb))]" : "bg-foreground/15"}`}>
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-foreground transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </label>
          {enabled && (
            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between gap-3 text-sm text-foreground/80">
                Valor máximo (R$)
                <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="decimal" placeholder="ex: 500" className="lz-input w-28 text-right" />
              </label>
              <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/45 pt-1">Pesos</div>
              {([["goals", "Execução das metas"], ["leads", "Leads registrados (vs. meta)"], ["scheduled", "Leads que agendaram (vs. meta)"]] as const).map(([k, label]) => (
                <label key={k} className="flex items-center justify-between gap-3 text-sm text-foreground/80">
                  {label}
                  <span className="flex items-center gap-1">
                    <input type="number" min={0} max={100} value={w[k]} onChange={(e) => setW((p) => ({ ...p, [k]: Math.max(0, Math.min(100, Number(e.target.value) || 0)) }))}
                      className="lz-input w-20 text-center" />%
                  </span>
                </label>
              ))}
              <div className="text-[11px]" style={{ color: wSum === 100 ? "color-mix(in srgb, var(--foreground) 45%, transparent)" : "#E7A951" }}>
                Soma dos pesos: {wSum}%{wSum !== 100 && " (o cálculo usa a proporção entre eles)"}
              </div>
            </div>
          )}
        </div>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="mt-6 w-full rounded-md py-3 text-sm font-bold disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {save.isPending ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </div>
  );
}


function RankingCard({ monthKey, brandParam }: { monthKey: string; brandParam?: string }) {
  const fetchRanking = useServerFn(getTeamRanking);
  const { data: rows = [], isLoading } = useQuery({ queryKey: ["house-ranking", monthKey, brandParam ?? "all"], queryFn: () => fetchRanking({ data: { monthKey, brandId: brandParam } }), staleTime: 60_000 });
  const cols: { key: "stories" | "posts" | "contents" | "demands" | "leads" | "scheduled" | "checklists" | "tasks"; label: string; pts: number }[] = [
    { key: "stories", label: "Stories", pts: RANKING_POINTS.story },
    { key: "posts", label: "Posts/Reels", pts: RANKING_POINTS.post },
    { key: "contents", label: "Conteúdos", pts: RANKING_POINTS.content },
    { key: "demands", label: "Demandas", pts: RANKING_POINTS.demand },
    { key: "leads", label: "Leads", pts: RANKING_POINTS.lead },
    { key: "scheduled", label: "Agendados", pts: RANKING_POINTS.scheduled },
    { key: "checklists", label: "Checklists", pts: RANKING_POINTS.checklist },
    { key: "tasks", label: "Tarefas", pts: RANKING_POINTS.task },
  ];
  return (
    <Card icon={<Trophy size={14} />} title="Ranking da equipe"
      right={<span className="text-[10px] text-foreground/40">conta o que cada um registrou ou concluiu como responsável</span>}>
      {isLoading ? <div className="text-sm text-foreground/40">Carregando…</div> : rows.length === 0 ? (
        <div className="text-sm text-foreground/45">Sem equipe ativa.</div>
      ) : (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wider text-foreground/45">
                <th className="text-left font-semibold px-2 py-2">Pessoa</th>
                {cols.map((c) => <th key={c.key} className="text-right font-semibold px-2 py-2" title={`${c.pts} ponto(s) cada`}>{c.label}</th>)}
                <th className="text-right font-bold px-2 py-2 text-foreground/70">Pontos</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.userId} className="border-t border-foreground/[0.06]">
                  <td className="px-2 py-2.5">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="w-5 text-center text-xs font-bold tabular-nums" style={{ color: i === 0 && r.points > 0 ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 45%, transparent)" }}>{i + 1}º</span>
                      <Avatar name={r.name} color={r.color} avatarUrl={r.avatarPath} size={26} />
                      <span className="font-semibold text-foreground truncate">{r.name}</span>
                    </span>
                  </td>
                  {cols.map((c) => <td key={c.key} className="text-right tabular-nums px-2 py-2.5 text-foreground/75">{r[c.key] || <span className="text-foreground/25">0</span>}</td>)}
                  <td className="text-right tabular-nums px-2 py-2.5 font-extrabold text-foreground">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10.5px] text-foreground/40 mt-3">
        Pontos: story 1 · post/reels 2 · conteúdo finalizado 3 · demanda 2 · lead 1 · agendamento 3 · checklist 1 · tarefa de projeto 1.
      </p>
    </Card>
  );
}
