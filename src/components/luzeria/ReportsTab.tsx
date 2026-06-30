import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, Filter, ChevronDown, Clock, AlertOctagon, RotateCcw, Star,
  BarChart3, Activity, Layers,
} from "lucide-react";
import { profilesQO, clientsQO, reportQO, reportExtrasQO, type ReportFilters } from "@/lib/luzeria/queries";
import { Avatar } from "./Avatar";
import { REEL_TYPE_LABEL, STATUS_META, type ReelType, type Status } from "@/lib/luzeria/types";
import { exportReportXlsx } from "@/lib/luzeria/report-export";
import { MemberReportPanel } from "./MemberReportPanel";

type Preset = "month" | "last" | "3m" | "6m" | "year" | "custom";

const PRESET_LABEL: Record<Preset, string> = {
  month: "Este mês",
  last: "Último mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  year: "Este ano",
  custom: "Personalizado",
};

function rangeFor(preset: Preset, customFrom?: string, customTo?: string) {
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth();
  let from: Date, to: Date;
  switch (preset) {
    case "month": from = new Date(y, m, 1); to = new Date(y, m + 1, 1); break;
    case "last": from = new Date(y, m - 1, 1); to = new Date(y, m, 1); break;
    case "3m": from = new Date(y, m - 2, 1); to = new Date(y, m + 1, 1); break;
    case "6m": from = new Date(y, m - 5, 1); to = new Date(y, m + 1, 1); break;
    case "year": from = new Date(y, 0, 1); to = new Date(y + 1, 0, 1); break;
    case "custom":
      from = customFrom ? new Date(customFrom) : new Date(y, m, 1);
      to = customTo ? new Date(new Date(customTo).getTime() + 86400000) : new Date(y, m + 1, 1);
      break;
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export function ReportsTab() {
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: clients = [] } = useQuery(clientsQO());

  const [pUser, setPUser] = useState<string>("");
  const [pPreset, setPPreset] = useState<Preset>("month");
  const [pType, setPType] = useState<ReportFilters["type"]>("all");
  const [pClient, setPClient] = useState<string>("");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [filters, setFilters] = useState<ReportFilters>(() => ({
    userId: null, type: "all", clientId: null,
    ...rangeFor("month"),
  }));

  const { data: report, isLoading } = useQuery(reportQO(filters));
  const { data: extras } = useQuery(reportExtrasQO(filters));

  const [openMember, setOpenMember] = useState<any | null>(null);
  const [page, setPage] = useState(0);
  const PER = 50;

  type Tab = "produtividade" | "lead" | "status" | "retrabalho" | "qualidade" | "bloqueios";
  const [tab, setTab] = useState<Tab>("produtividade");
  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "produtividade", label: "Produtividade", icon: <BarChart3 size={13} /> },
    { id: "lead", label: "Lead time", icon: <Clock size={13} /> },
    { id: "status", label: "Tempo por status", icon: <Activity size={13} /> },
    { id: "retrabalho", label: "Retrabalho", icon: <RotateCcw size={13} /> },
    { id: "qualidade", label: "Qualidade", icon: <Star size={13} /> },
    { id: "bloqueios", label: "Travados", icon: <AlertOctagon size={13} /> },
  ];

  function apply() {
    const r = rangeFor(pPreset, customFrom, customTo);
    setFilters({
      userId: pUser || null,
      type: pType,
      clientId: pClient || null,
      from: r.from, to: r.to,
    });
    setPage(0);
  }

  const presetLabel = PRESET_LABEL[pPreset];
  const histPage = useMemo(() => {
    const all = report?.history ?? [];
    return { rows: all.slice(page * PER, (page + 1) * PER), total: all.length };
  }, [report, page]);

  return (
    <div>
      {/* Filtros */}
      <div className="bg-[#1C1C1C] rounded-lg p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-[#C8D44E]" />
          <span className="text-xs uppercase font-bold tracking-wider text-white/70">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <FilterSelect label="Membro" value={pUser} onChange={setPUser}
            options={[{ value: "", label: "Todos" }, ...profiles.map((p) => ({ value: p.id, label: p.name }))]} />
          <FilterSelect label="Período" value={pPreset} onChange={(v) => setPPreset(v as Preset)}
            options={Object.entries(PRESET_LABEL).map(([v, l]) => ({ value: v, label: l }))} />
          <FilterSelect label="Tipo" value={pType ?? "all"} onChange={(v) => setPType(v as any)}
            options={[
              { value: "all", label: "Todos" },
              { value: "post", label: "Posts" },
              { value: "reel", label: "Reels" },
              { value: "outros", label: "Outros" },
              { value: "stories", label: "Stories" },
              { value: "cleaning", label: "Limpeza" },
            ]} />
          <FilterSelect label="Cliente" value={pClient} onChange={setPClient}
            options={[{ value: "", label: "Todos" }, ...clients.map((c) => ({ value: c.id, label: c.name }))]} />
        </div>
        {pPreset === "custom" && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <label className="text-[10px] uppercase font-bold tracking-wider text-white/50">
              De
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="mt-1 w-full bg-[#0D0D0D] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
            </label>
            <label className="text-[10px] uppercase font-bold tracking-wider text-white/50">
              Até
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="mt-1 w-full bg-[#0D0D0D] border border-white/10 rounded-md px-2 py-1.5 text-xs text-white outline-none focus:border-[#C8D44E]" />
            </label>
          </div>
        )}
        <div className="flex items-center justify-between mt-4">
          <button onClick={apply}
            className="text-xs font-bold px-4 py-2 rounded-md transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}>
            Aplicar filtros
          </button>
          <button
            disabled={!report}
            onClick={() => report && exportReportXlsx(report, { from: filters.from, to: filters.to, label: presetLabel })}
            className="text-xs font-semibold px-4 py-2 rounded-md border inline-flex items-center gap-2 transition-colors disabled:opacity-30"
            style={{ borderColor: "#C8D44E", color: "#C8D44E", backgroundColor: "transparent" }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(200,212,78,0.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}>
            <Download size={13} /> Exportar .xlsx
          </button>
        </div>
      </div>

      {isLoading && <p className="text-white/50 text-sm">Carregando…</p>}

      {/* Sub-tabs */}
      <div className="mb-6 flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-colors"
            style={{
              backgroundColor: tab === t.id ? "#C8D44E" : "rgba(255,255,255,0.04)",
              color: tab === t.id ? "#0D0D0D" : "rgba(255,255,255,0.7)",
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {report && tab === "produtividade" && (
        <>
          {/* Seção 1 - Visão geral */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <MetricCard label="Tarefas finalizadas" value={report.summary.total} accent />
            <MetricCard label="Posts finalizados" value={report.summary.posts} />
            <MetricCard label="Reels finalizados" value={report.summary.reels} />
            <MetricCard label="Outros finalizados" value={report.summary.outros} />
          </div>

          {/* Seção 2 - Por membro */}
          <Section title="Breakdown por membro">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/50">
                  <th className="text-left px-3 py-2">Membro</th>
                  <th className="text-right px-2 py-2">Posts</th>
                  <th className="text-right px-2 py-2">Reels</th>
                  <th className="text-right px-2 py-2">Outros</th>
                  <th className="text-right px-2 py-2">Stories</th>
                  <th className="text-right px-2 py-2">Limpeza</th>
                  <th className="text-right px-2 py-2">Total</th>
                  <th className="text-right px-2 py-2">Atrasadas</th>
                  <th className="text-right px-3 py-2">% do time</th>
                </tr>
              </thead>
              <tbody>
                {report.byMember.length === 0 && (
                  <tr><td colSpan={9} className="px-3 py-4 text-white/40 text-center">Sem entregas no período.</td></tr>
                )}
                {report.byMember.map((m: any, i: number) => (
                  <tr key={m.userId}
                    onClick={() => setOpenMember(m)}
                    className="border-t border-white/[0.05] hover:bg-white/[0.03] cursor-pointer transition-colors">
                    <td className="px-3 py-2.5 flex items-center gap-2">
                      <Avatar profile={{ id: m.userId, name: m.name, color: m.color, icon: m.icon } as any} size={26} />
                      <span className="font-semibold" style={{ color: i === 0 ? "#C8D44E" : "#FFF" }}>{m.name}</span>
                    </td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{m.posts}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{m.reels}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{m.outros}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{m.stories}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{m.cleaning}</td>
                    <td className="text-right px-2 py-2.5 font-bold tabular-nums" style={{ color: i === 0 ? "#C8D44E" : "#FFF" }}>{m.total}</td>
                    <td className="text-right px-2 py-2.5 tabular-nums">
                      {m.lateCount > 0 ? (
                        <span title={`Média de atraso: ${m.avgLateDays} dia(s)`} className="font-bold" style={{ color: "#FF6B6B" }}>
                          {m.lateCount}
                        </span>
                      ) : (
                        <span className="text-white/30">0</span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2.5 text-white/60 tabular-nums">{m.pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>

          {/* Seção 3 - Reels por formato */}
          <Section title="Reels por formato (editor)">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-white/50">
                  <th className="text-left px-3 py-2">Editor</th>
                  <th className="text-right px-2 py-2">Lo-fi</th>
                  <th className="text-right px-2 py-2">Fácil</th>
                  <th className="text-right px-2 py-2">Básico</th>
                  <th className="text-right px-2 py-2">Avançado</th>
                  <th className="text-right px-3 py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {report.byEditorFormat.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-4 text-white/40 text-center">Nenhum reel com editor no período.</td></tr>
                )}
                {report.byEditorFormat.map((r: any) => (
                  <tr key={r.editorId ?? "none"} className="border-t border-white/[0.05]">
                    <td className="px-3 py-2.5 text-white/80">{r.name}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{r.lofi}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{r.facil}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{r.basico}</td>
                    <td className="text-right px-2 py-2.5 text-white/70 tabular-nums">{r.avancado}</td>
                    <td className="text-right px-3 py-2.5 font-bold text-white tabular-nums">{r.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <MetricCard label="Lo-fi" value={report.formatTotals.lofi} />
              <MetricCard label="Fácil" value={report.formatTotals.facil} />
              <MetricCard label="Básico" value={report.formatTotals.basico} />
              <MetricCard label="Avançado" value={report.formatTotals.avancado} />
            </div>
          </Section>

          {/* Seção 4 - Histórico */}
          <Section title={`Histórico (${histPage.total})`}>
            {histPage.rows.length === 0 ? (
              <p className="text-white/40 text-sm px-3 py-4 text-center">Sem registros no período.</p>
            ) : histPage.rows.map((h: any, i: number) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-t border-white/[0.05] text-xs">
                <span className="text-white/40 tabular-nums w-32 shrink-0">{new Date(h.finalizedAt).toLocaleString("pt-BR")}</span>
                <Avatar profile={{ id: h.userId, name: h.userName, color: h.userColor } as any} size={22} />
                <span className="text-white/80 w-28 truncate">{h.userName}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold shrink-0"
                  style={{ backgroundColor: (h.clientColor ?? "#444") + "33", color: h.clientColor ?? "#FFF" }}>
                  {h.clientName ?? "—"}
                </span>
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shrink-0"
                  style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
                  {h.type === "post" ? "POST" : h.type === "reel" ? "REEL" : h.type === "outros" ? "OUTRO" : h.type === "stories" ? "STORIES" : "LIMPEZA"}
                </span>
                <span className="text-white flex-1 truncate">{h.title}</span>
                {h.type === "reel" && h.reelType && (
                  <span className="text-[10px] text-white/50 shrink-0">{REEL_TYPE_LABEL[h.reelType as ReelType]}</span>
                )}
                {h.type === "reel" && h.editorName && (
                  <span className="text-[10px] text-white/50 shrink-0">✂ {h.editorName}</span>
                )}
                {h.lateDays > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0"
                    style={{ backgroundColor: "rgba(255,107,107,0.18)", color: "#FF6B6B" }}>
                    Atraso {h.lateDays}d
                  </span>
                )}
              </div>
            ))}
            {histPage.total > PER && (
              <div className="flex items-center justify-between mt-3 px-3 text-xs text-white/60">
                <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}
                  className="px-3 py-1 rounded border border-white/10 hover:border-white/30 disabled:opacity-30">
                  Anterior
                </button>
                <span>Página {page + 1} de {Math.ceil(histPage.total / PER)}</span>
                <button disabled={(page + 1) * PER >= histPage.total} onClick={() => setPage((p) => p + 1)}
                  className="px-3 py-1 rounded border border-white/10 hover:border-white/30 disabled:opacity-30">
                  Próxima
                </button>
              </div>
            )}
          </Section>
        </>
      )}

      {extras && tab === "lead" && <LeadTimeView data={extras.leadTime} />}
      {extras && tab === "status" && <StatusDurationView data={extras.statusDuration} />}
      {extras && tab === "retrabalho" && <ReworkView data={extras.rework} />}
      {extras && tab === "qualidade" && <QualityView data={extras.quality} />}
      {extras && tab === "bloqueios" && <BlockedView data={extras.blocked} />}

      {openMember && (
        <MemberReportPanel
          member={openMember}
          from={filters.from} to={filters.to}
          onClose={() => setOpenMember(null)}
        />
      )}
    </div>
  );
}

/* ============== ROADMAP SUB-VIEWS ============== */

function formatHours(h: number) {
  if (!h) return "—";
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function LeadTimeView({ data }: { data: any }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-8">
        <MetricCard label="Lead time médio" value={formatHours(data.avgHours) as any} accent />
        <MetricCard label="Entregas analisadas" value={data.count} />
      </div>
      <Section title="Top 5 mais rápidas">
        <LeadTable rows={data.fastest} accent />
      </Section>
      <Section title="Top 5 mais lentas">
        <LeadTable rows={data.slowest} />
      </Section>
    </>
  );
}

function LeadTable({ rows, accent }: { rows: any[]; accent?: boolean }) {
  if (!rows.length) return <p className="text-white/40 text-sm px-3 py-6 text-center">Sem dados.</p>;
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-white/50">
          <th className="text-left px-3 py-2">Tarefa</th>
          <th className="text-left px-3 py-2">Cliente</th>
          <th className="text-right px-3 py-2">Tempo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-white/[0.05]">
            <td className="px-3 py-2.5 text-white/80 truncate max-w-[300px]">{r.title}</td>
            <td className="px-3 py-2.5 text-white/60">{r.clientName}</td>
            <td className="px-3 py-2.5 text-right tabular-nums font-bold"
              style={{ color: accent ? "#C8D44E" : "#FFFFFF" }}>{formatHours(r.hours)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function StatusDurationView({ data }: { data: any[] }) {
  if (!data.length) return <p className="text-white/40 text-sm px-3 py-8 text-center">Sem transições registradas.</p>;
  const max = Math.max(...data.map((d) => d.avgHours));
  return (
    <Section title="Tempo médio que cada status consome">
      <div className="p-4 space-y-3">
        {data.map((d) => {
          const meta = STATUS_META[d.status as Status];
          const pct = max ? (d.avgHours / max) * 100 : 0;
          return (
            <div key={d.status}>
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-semibold" style={{ color: meta?.color ?? "#FFF" }}>{meta?.label ?? d.status}</span>
                <span className="text-white/60 tabular-nums">{formatHours(d.avgHours)} <span className="text-white/30">· {d.count} transições</span></span>
              </div>
              <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta?.color ?? "#C8D44E" }} />
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function ReworkView({ data }: { data: any }) {
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-8">
        <MetricCard label="Itens com retrabalho" value={data.total} />
        <MetricCard label="Taxa de retrabalho" value={`${data.ratePercent}%` as any} accent />
      </div>
      <Section title="Itens que mais voltaram">
        {data.items.length === 0 ? (
          <p className="text-white/40 text-sm px-3 py-6 text-center">Nenhum retrabalho no período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-white/50">
                <th className="text-left px-3 py-2">Tarefa</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Tipo</th>
                <th className="text-right px-3 py-2">Voltas</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((r: any) => (
                <tr key={r.id} className="border-t border-white/[0.05]">
                  <td className="px-3 py-2.5 text-white/80 truncate max-w-[280px]">{r.title}</td>
                  <td className="px-3 py-2.5 text-white/60">{r.clientName}</td>
                  <td className="px-3 py-2.5 text-white/60 uppercase text-[10px]">{r.type}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold" style={{ color: "#FF8C42" }}>×{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>
    </>
  );
}

function QualityView({ data }: { data: any }) {
  const dist: Record<number, number> = data.distribution ?? {};
  const total = Object.values(dist).reduce((a: number, b: any) => a + b, 0) as number;
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-8">
        <MetricCard label="Nota média" value={data.avg > 0 ? `${data.avg}/5` as any : "—" as any} accent />
        <MetricCard label="Itens avaliados" value={data.count} />
      </div>
      <Section title="Distribuição">
        <div className="p-4 space-y-2">
          {[5, 4, 3, 2, 1].map((n) => {
            const c = dist[n] ?? 0;
            const pct = total ? (c / total) * 100 : 0;
            return (
              <div key={n} className="flex items-center gap-3">
                <div className="inline-flex items-center gap-0.5 w-20">
                  {Array.from({ length: n }).map((_, i) => (
                    <Star key={i} size={11} fill="#C8D44E" color="#C8D44E" />
                  ))}
                </div>
                <div className="flex-1 h-2 rounded-full bg-white/[0.05] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "#C8D44E" }} />
                </div>
                <span className="text-xs text-white/60 tabular-nums w-12 text-right">{c}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function BlockedView({ data }: { data: any[] }) {
  return (
    <Section title={`Itens bloqueados agora (${data.length})`}>
      {data.length === 0 ? (
        <p className="text-white/40 text-sm px-3 py-8 text-center">Nenhum item bloqueado no momento. 🎉</p>
      ) : data.map((b) => (
        <div key={b.id} className="flex items-center gap-3 px-4 py-3 border-t border-white/[0.05]">
          <AlertOctagon size={14} style={{ color: "#FF6B6B" }} />
          <span className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: (b.clientColor ?? "#444") + "33", color: b.clientColor ?? "#FFF" }}>
            {b.clientName}
          </span>
          <span className="text-white text-sm flex-1 truncate">{b.title}</span>
        </div>
      ))}
    </Section>
  );
}

function MetricCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="bg-[#1C1C1C] rounded-lg p-4">
      <div className="text-[10px] uppercase font-bold tracking-wider text-white/50">{label}</div>
      <div className="text-[28px] font-bold tabular-nums mt-1" style={{ color: accent ? "#C8D44E" : "#FFFFFF" }}>{value}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs uppercase font-bold tracking-wider text-white/50 mb-3">{title}</h2>
      <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">{children}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase font-bold tracking-wider text-white/50">{label}</span>
      <div className="relative mt-1">
        <select value={value} onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-[#0D0D0D] border border-white/10 rounded-md px-2 py-1.5 pr-7 text-xs text-white outline-none focus:border-[#C8D44E]">
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
      </div>
    </label>
  );
}