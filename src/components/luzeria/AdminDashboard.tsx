import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Users, Target, Package, CheckCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Trophy, Sparkles, Flame, Crown, Medal,
  X, CheckCircle2, Inbox,
} from "lucide-react";
import { adminDashboardQO, memberFinalizationsQO, topMembersQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { formatMonth } from "@/lib/luzeria/utils";
import { Avatar } from "./Avatar";

type Period = "month" | "3m" | "6m" | "year";
const PERIOD_LABEL: Record<Period, string> = {
  month: "Este mês",
  "3m": "Últimos 3 meses",
  "6m": "Últimos 6 meses",
  year: "Este ano",
};

function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pctColor(p: number) {
  if (p >= 80) return "#C8D44E";
  if (p >= 50) return "#FF8C42";
  return "#FF4444";
}

// Paleta criativa derivada das cores já presentes no app.
const PALETTE = {
  lime: "#C8D44E",
  limeDeep: "#8FA832",
  green: "#5BA88A",
  greenDeep: "#2D4A3E",
  blue: "#4A9EFF",
  blueDeep: "#0D2B4A",
  orange: "#FF8C42",
  orangeDeep: "#4A2800",
  purple: "#B392F0",
  purpleDeep: "#3D2B5E",
  coral: "#E76F51",
};

export function AdminDashboard() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { selectedMonthKey, selectMonth } = useUI();
  const [period, setPeriod] = useState<Period>("month");
  const { updateClient } = useApi();

  const dashboard = useQuery(adminDashboardQO(selectedMonthKey));
  const top = useQuery(topMembersQO(period, selectedMonthKey));
  const [openMember, setOpenMember] = useState<null | { id: string; name: string; color: string }>(null);

  // Modo TV: quando a sidebar está oculta, reflag o dashboard a cada 5 minutos.
  const sidebarHidden = useUI((s) => s.sidebarHidden);
  const qc = useQueryClient();
  useEffect(() => {
    if (!sidebarHidden) return;
    const id = window.setInterval(() => {
      qc.invalidateQueries({ queryKey: ["admin-dashboard"] });
      qc.invalidateQueries({ queryKey: ["top-members"] });
    }, 5 * 60 * 1000);
    return () => window.clearInterval(id);
  }, [sidebarHidden, qc]);

  const data = dashboard.data;
  const t = data?.totals;
  const message = useMemo(() => {
    const p = t?.percent ?? 0;
    if (p >= 90) return "Equipe incrível! 🔥 Meta quase batida.";
    if (p >= 70) return "Bom ritmo! Vamos fechar forte.";
    return "Atenção: precisamos acelerar o mês.";
  }, [t?.percent]);

  const maxCount = top.data?.ranking[0]?.count ?? 0;

  // Distribuição por categoria (visível só de clientes não-arquivados retornados pelo backend).
  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; done: number }>();
    (data?.clients ?? []).forEach((c) => {
      if (c.archived) return;
      const cat = c.category || "Social Media";
      const cur = map.get(cat) ?? { total: 0, done: 0 };
      cur.total += c.total; cur.done += c.done;
      map.set(cat, cur);
    });
    return [...map.entries()].map(([name, v]) => ({
      name, ...v, percent: v.total ? Math.round((v.done / v.total) * 100) : 0,
    }));
  }, [data?.clients]);

  const CAT_COLOR: Record<string, string> = {
    "Social Media": PALETTE.green,
    "Pack Digital": PALETTE.blue,
    "Avulsos": PALETTE.lime,
  };

  const overall = t?.percent ?? 0;

  return (
    <div className="px-5 md:px-10 py-8 max-w-[1320px] mx-auto">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-2xl mb-6"
        style={{
          background:
            "radial-gradient(120% 140% at 0% 0%, rgba(200,212,78,0.18) 0%, rgba(91,168,138,0.10) 35%, rgba(28,28,28,0) 70%), " +
            "radial-gradient(80% 120% at 100% 100%, rgba(26,58,46,0.55) 0%, rgba(28,28,28,0) 65%), " +
            "linear-gradient(180deg, #161616 0%, #111111 100%)",
          border: "1px solid rgba(200,212,78,0.18)",
        }}>
        {/* Glow blobs */}
        <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: PALETTE.lime }} />
        <div className="pointer-events-none absolute -bottom-24 right-10 h-72 w-72 rounded-full opacity-25 blur-3xl"
          style={{ background: "#1A3A2E" }} />


        <div className="relative grid md:grid-cols-[1fr_auto] gap-8 p-6 md:p-8 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
              style={{ backgroundColor: "rgba(200,212,78,0.15)", color: PALETTE.lime }}>
              <Sparkles size={11} /> Dashboard
            </div>
            <h1 className="mt-3 text-[32px] md:text-[44px] font-extrabold leading-[1.05] tracking-tight text-white">
              Luzeria <span style={{ color: PALETTE.lime }}>Estúdio</span>
            </h1>
            <p className="mt-2 italic text-white/70 text-sm md:text-base">{message}</p>

            {/* Month selector */}
            <div className="mt-5 inline-flex items-center gap-1 rounded-full bg-black/30 backdrop-blur p-1 border border-white/10">
              <button onClick={() => selectMonth(shiftMonth(selectedMonthKey, -1))}
                className="h-8 w-8 rounded-full hover:bg-white/10 text-white/70 flex items-center justify-center transition">
                <ChevronLeft size={15} />
              </button>
              <div className="px-4 text-white text-sm font-semibold min-w-[140px] text-center">
                {formatMonth(selectedMonthKey)}
              </div>
              <button onClick={() => selectMonth(shiftMonth(selectedMonthKey, +1))}
                className="h-8 w-8 rounded-full hover:bg-white/10 text-white/70 flex items-center justify-center transition">
                <ChevronRight size={15} />
              </button>
            </div>
          </div>

          {/* Big donut */}
          <BigDonut percent={overall} done={t?.done ?? 0} total={t?.planned ?? 0} />
        </div>
      </div>

      {/* Metric strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        <MetricCard tone={PALETTE.lime}      icon={<Users size={16} />}          label="Clientes ativos" value={t?.clients ?? 0} />
        <MetricCard tone={PALETTE.blue}      icon={<Target size={16} />}         label="Meta do mês"     value={t?.planned ?? 0} />
        <MetricCard tone={"#1A3A2E"}          icon={<Package size={16} />}        label="Entregues"       value={t?.done ?? 0} />
        <MetricCard tone={PALETTE.green}     icon={<CheckCircle size={16} />}    label="Em dia"          value={t?.ontime ?? 0} />
        <MetricCard tone={PALETTE.coral}     icon={<AlertTriangle size={16} />}  label="Abaixo"          value={t?.behind ?? 0} />
      </div>

      {/* Category breakdown */}
      {byCategory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
          {byCategory.map((c) => {
            const color = CAT_COLOR[c.name] ?? PALETTE.green;
            return (
              <div key={c.name} className="relative overflow-hidden rounded-xl p-4 bg-[#161616] border border-white/[0.06]">
                <div className="absolute -top-10 -right-10 h-28 w-28 rounded-full opacity-20 blur-2xl" style={{ background: color }} />
                <div className="flex items-center justify-between relative">
                  <div className="text-[11px] uppercase tracking-wider font-bold" style={{ color }}>{c.name}</div>
                  <div className="text-white text-sm font-bold tabular-nums">{c.percent}%</div>
                </div>
                <div className="mt-2 text-white/60 text-xs">
                  <span className="text-white font-semibold">{c.done}</span> de {c.total} entregues
                </div>
                <div className="mt-3 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${c.percent}%`, background: `linear-gradient(90deg, ${color}, ${PALETTE.lime})` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clients table */}
      <div className="rounded-xl bg-[#161616] border border-white/[0.07] overflow-hidden mb-6">
        <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: PALETTE.lime }} />
          <span className="text-[11px] uppercase tracking-wider text-white/70 font-bold">Clientes</span>
          <span className="text-[11px] text-white/30">— {formatMonth(selectedMonthKey)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-white/40">
                <th className="text-left px-5 py-2 font-semibold">Cliente</th>
                <th className="px-3 py-2 font-semibold">Ativo</th>
                <th className="px-3 py-2 font-semibold">Posts</th>
                <th className="px-3 py-2 font-semibold">Reels</th>
                <th className="px-3 py-2 font-semibold">Entregues</th>
                <th className="px-3 py-2 font-semibold">%</th>
                <th className="px-3 py-2 font-semibold text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {(data?.clients ?? []).map((c) => {
                const inactive = c.archived;
                const statusLabel =
                  c.total === 0 ? "Sem itens" :
                  c.percent >= 100 ? "Meta batida" :
                  c.percent >= 80 ? "Em dia" : "Abaixo";
                const statusColor =
                  c.total === 0 ? { bg: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.5)" } :
                  c.percent >= 100 ? { bg: "rgba(200,212,78,0.15)", color: "#C8D44E" } :
                  c.percent >= 80 ? { bg: "rgba(74,158,255,0.15)", color: "#4A9EFF" } :
                                    { bg: "rgba(255,68,68,0.15)", color: "#FF4444" };
                return (
                  <tr key={c.id} className={`border-t border-white/[0.04] ${inactive ? "opacity-40" : ""}`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} color={c.color} size={26} />
                        <span className="text-white font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => updateClient.mutate({ data: { id: c.id, patch: { archived: !c.archived } } })}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${!c.archived ? "bg-[#C8D44E]" : "bg-white/15"}`}>
                        <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${!c.archived ? "translate-x-[18px]" : "translate-x-[3px]"}`} />
                      </button>
                    </td>
                    <td className="px-3 py-3 text-center text-white/80">{c.posts}</td>
                    <td className="px-3 py-3 text-center text-white/80">{c.reels}</td>
                    <td className="px-3 py-3 text-center text-white/80">{c.done}</td>
                    <td className="px-3 py-3 text-center font-semibold" style={{ color: pctColor(c.percent) }}>
                      {c.percent}%
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: statusColor.bg, color: statusColor.color }}>
                        {statusLabel === "Abaixo" && <AlertTriangle size={11} />}
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {(data?.clients ?? []).length === 0 && (
                <tr><td colSpan={7} className="px-5 py-8 text-center text-white/40 text-sm">Nenhum cliente.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top members */}
      <div className="rounded-xl bg-[#161616] border border-white/[0.07] p-5 mb-6 relative overflow-hidden">
        <div className="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full opacity-15 blur-3xl" style={{ background: PALETTE.lime }} />
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5 relative">
          <h2 className="text-white font-semibold inline-flex items-center gap-2">
            <Trophy size={16} className="text-[#C8D44E]" />
            Top Membros <span className="text-white/40 font-normal">— {PERIOD_LABEL[period]}</span>
          </h2>
          <div className="flex items-center gap-1 bg-[#0D0D0D] rounded-md p-1 text-xs">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded transition ${period === p ? "bg-[#C8D44E] text-[#0D0D0D] font-semibold" : "text-white/60 hover:text-white"}`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 relative">
          {(top.data?.ranking ?? []).map((r, i) => {
            const pct = maxCount ? (r.count / maxCount) * 100 : 0;
            const rankColor =
              i === 0 ? PALETTE.lime :
              i === 1 ? PALETTE.blue :
              i === 2 ? PALETTE.purple :
                        "rgba(255,255,255,0.35)";
            const rankIcon =
              i === 0 ? <Crown size={13} /> :
              i === 1 ? <Medal size={13} /> :
              i === 2 ? <Flame size={13} /> : null;
            const canOpen = isAdmin || r.id === me?.id;
            return (
              <button
                key={r.id}
                disabled={!canOpen}
                onClick={() => canOpen && setOpenMember({ id: r.id, name: r.name, color: r.color })}
                className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors text-left ${canOpen ? "hover:bg-white/[0.05] cursor-pointer" : "cursor-default"}`}
              >
                <div className="w-8 inline-flex items-center justify-center gap-1 text-[11px] font-bold tabular-nums"
                  style={{ color: rankColor }}>
                  {rankIcon ?? String(i + 1).padStart(2, "0")}
                </div>
                <Avatar name={r.name} color={r.color} size={30} />
                <div className="flex-1 min-w-0">
                  <div className="text-white text-sm font-medium truncate mb-1 flex items-center gap-2">
                    {r.name}
                    {r.id === me?.id && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>Você</span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${rankColor}, ${PALETTE.lime})` }} />
                  </div>
                </div>
                <div className="text-white font-bold tabular-nums w-10 text-right">{r.count}</div>
              </button>
            );
          })}
          {(top.data?.ranking ?? []).length === 0 && (
            <div className="text-white/40 text-sm text-center py-8">Sem finalizações no período.</div>
          )}
        </div>
      </div>

      {openMember && (
        <MemberDetailPanel
          member={openMember}
          monthKey={selectedMonthKey}
          initialPeriod={period}
          onClose={() => setOpenMember(null)}
        />
      )}
    </div>
  );
}

/* ============== MEMBER DETAIL PANEL ============== */

function MemberDetailPanel({
  member, monthKey, initialPeriod, onClose,
}: {
  member: { id: string; name: string; color: string };
  monthKey: string;
  initialPeriod: Period;
  onClose: () => void;
}) {
  const me = useMe().data;
  const role = me?.role;
  const roleLabel =
    role === "master" ? "Adm Master" :
    role === "setor" ? "Adm de Setor" : "Membro";

  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [filter, setFilter] = useState<"all" | "post" | "reel" | "outros">("all");

  const q = useQuery(memberFinalizationsQO(member.id, period, monthKey));
  const list = q.data ?? [];
  const filtered = filter === "all" ? list : list.filter((t) => t.type === filter);

  const counts = useMemo(() => ({
    post: list.filter((t) => t.type === "post").length,
    reel: list.filter((t) => t.type === "reel").length,
    outros: list.filter((t) => t.type === "outros").length,
  }), [list]);

  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!panelRef.current?.contains(e.target as Node)) onClose(); };
    const t = setTimeout(() => document.addEventListener("mousedown", h), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", h); };
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]" />
      <div ref={panelRef}
        className="fixed z-50 bg-[#0D0D0D] border-white/10 flex flex-col lz-slide-in
          inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl border-t
          md:rounded-none md:border-t-0 md:border-l md:right-0 md:top-0 md:bottom-0 md:left-auto md:w-[480px] md:max-h-none">
        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-white/[0.08]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <Avatar name={member.name} color={member.color} size={48} />
              <div className="min-w-0">
                <div className="text-white font-bold text-[17px] truncate">{member.name}</div>
                <div className="mt-1 inline-flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
                  {roleLabel}
                </div>
              </div>
            </div>
            <button onClick={onClose} className="text-white/50 hover:text-white p-1 rounded hover:bg-white/5 transition">
              <X size={16} />
            </button>
          </div>
          <p className="text-[12px] text-white/60 mt-3">
            <span className="text-white font-semibold">{list.length}</span> tarefa{list.length === 1 ? "" : "s"} finalizada{list.length === 1 ? "" : "s"} em <span className="text-white/80">{formatMonth(monthKey)}</span>
          </p>
        </div>

        {/* Filter chips */}
        <div className="px-6 pt-4 pb-3 flex items-center gap-2 flex-wrap">
          {([
            { id: "all", label: "Todos" },
            { id: "post", label: "Posts" },
            { id: "reel", label: "Reels" },
            { id: "outros", label: "Outros" },
          ] as const).map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="px-3 py-1.5 rounded-full text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: filter === f.id ? "#C8D44E" : "rgba(255,255,255,0.06)",
                color: filter === f.id ? "#0D0D0D" : "rgba(255,255,255,0.7)",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {q.isLoading && <div className="px-2 py-8 text-center text-white/40 text-xs">Carregando…</div>}
          {!q.isLoading && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Inbox size={28} className="text-white/20 mb-3" />
              <p className="text-white/40 text-xs">Nenhuma tarefa finalizada neste período</p>
            </div>
          )}
          <ul className="space-y-1.5">
            {filtered.map((t) => {
              const isAvulso = t.clientCategory === "Avulsos";
              const typeLabel = t.type === "post" ? "POST" : t.type === "reel" ? "REEL" : "OUTRO";
              return (
                <li key={t.itemId + t.finalizedAt}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded"
                        style={{
                          backgroundColor: isAvulso ? "rgba(200,212,78,0.15)" : `${t.clientColor}22`,
                          color: isAvulso ? "#C8D44E" : t.clientColor,
                        }}>
                        {isAvulso ? "AVULSO" : t.clientName}
                      </span>
                      <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wider"
                        style={{ backgroundColor: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)" }}>
                        {typeLabel}
                      </span>
                    </div>
                    <div className="text-white text-sm truncate">{t.title}</div>
                    <div className="text-[10px] text-white/40 mt-0.5">{formatFinalized(t.finalizedAt)}</div>
                  </div>
                  <CheckCircle2 size={18} style={{ color: "#C8D44E" }} className="shrink-0" />
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.08] px-6 py-4 space-y-3 bg-[#0D0D0D]">
          <div className="text-[11px] text-white/60">
            <span className="text-white font-bold">{counts.post}</span> posts ·{" "}
            <span className="text-white font-bold">{counts.reel}</span> reels ·{" "}
            <span className="text-white font-bold">{counts.outros}</span> outros
          </div>
          <div className="flex items-center gap-1 bg-[#161616] rounded-md p-1 text-[10px] flex-wrap">
            {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
              <button key={p} onClick={() => setPeriod(p)}
                className="px-2.5 py-1.5 rounded transition flex-1"
                style={{
                  backgroundColor: period === p ? "#C8D44E" : "transparent",
                  color: period === p ? "#0D0D0D" : "rgba(255,255,255,0.6)",
                  fontWeight: period === p ? 700 : 500,
                }}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function formatFinalized(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) +
    " · " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function MetricCard({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: number | string; tone: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 transition-transform hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(160deg, ${hexA(tone, 0.16)} 0%, rgba(22,22,22,1) 70%)`,
        border: `1px solid ${hexA(tone, 0.22)}`,
      }}>
      <div className="absolute -top-8 -right-8 h-24 w-24 rounded-full opacity-20 blur-2xl" style={{ background: tone }} />
      <div className="relative flex items-center justify-between mb-3">
        <div className="h-7 w-7 rounded-md inline-flex items-center justify-center"
          style={{ background: hexA(tone, 0.18), color: tone }}>
          {icon}
        </div>
      </div>
      <div className="relative text-[34px] font-extrabold leading-none mb-1.5 tabular-nums text-white">
        {value}
      </div>
      <div className="relative text-[10.5px] uppercase tracking-wider font-bold" style={{ color: hexA(tone, 0.9) }}>{label}</div>
    </div>
  );
}

function BigDonut({ percent, done, total }: { percent: number; done: number; total: number }) {
  const size = 168, stroke = 14, r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0 mx-auto md:mx-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="bigdonut" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#C8D44E" />
            <stop offset="55%" stopColor="#8FA832" />
            <stop offset="100%" stopColor="#5BA88A" />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={r} stroke="url(#bigdonut)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - percent/100)} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[44px] font-extrabold tabular-nums leading-none text-white">{percent}%</div>
        <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold mt-1">Entregue</div>
        <div className="text-[11px] text-white/70 mt-0.5"><span className="font-bold text-[#C8D44E]">{done}</span> / {total}</div>
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0,2), 16);
  const g = parseInt(h.slice(2,4), 16);
  const b = parseInt(h.slice(4,6), 16);
  return `rgba(${r},${g},${b},${a})`;
}