import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users, Target, Package, TrendingUp, CheckCircle, AlertTriangle,
  ChevronLeft, ChevronRight, Trophy,
} from "lucide-react";
import { adminDashboardQO, topMembersQO, useApi, useMe } from "@/lib/luzeria/queries";
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

export function AdminDashboard() {
  const me = useMe().data;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const { selectedMonthKey, selectMonth } = useUI();
  const [period, setPeriod] = useState<Period>("month");
  const { updateClient } = useApi();

  const dashboard = useQuery(adminDashboardQO(selectedMonthKey));
  const top = useQuery(topMembersQO(period, selectedMonthKey));

  if (!isAdmin) {
    return <div className="p-10 text-white/40 text-sm">Acesso restrito a administradores.</div>;
  }

  const data = dashboard.data;
  const t = data?.totals;
  const message = useMemo(() => {
    const p = t?.percent ?? 0;
    if (p >= 90) return "Equipe incrível! 🔥 Meta quase batida.";
    if (p >= 70) return "Bom ritmo! Vamos fechar forte.";
    return "Atenção: precisamos acelerar o mês.";
  }, [t?.percent]);

  const maxCount = top.data?.ranking[0]?.count ?? 0;

  return (
    <div className="px-6 md:px-10 py-8 max-w-[1280px] mx-auto">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-[36px] font-bold leading-none" style={{ color: "#C8D44E" }}>Luzeria Estúdio</h1>
          <div className="mt-2 text-white/50 text-sm">
            Dashboard de Produção — {formatMonth(selectedMonthKey)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => selectMonth(shiftMonth(selectedMonthKey, -1))}
            className="h-8 w-8 rounded-md bg-[#1C1C1C] border border-white/10 hover:border-white/20 text-white/70 flex items-center justify-center transition">
            <ChevronLeft size={16} />
          </button>
          <div className="text-white/80 text-sm font-medium min-w-[120px] text-center">
            {formatMonth(selectedMonthKey)}
          </div>
          <button onClick={() => selectMonth(shiftMonth(selectedMonthKey, +1))}
            className="h-8 w-8 rounded-md bg-[#1C1C1C] border border-white/10 hover:border-white/20 text-white/70 flex items-center justify-center transition">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-10">
        <MetricCard icon={<Users size={16} />} label="CLIENTES" value={t?.clients ?? 0} />
        <MetricCard icon={<Target size={16} />} label="META DO MÊS" value={t?.planned ?? 0} />
        <MetricCard icon={<Package size={16} />} label="ENTREGUES" value={t?.done ?? 0} />
        <MetricCard icon={<TrendingUp size={16} />} label="% GERAL"
          value={`${t?.percent ?? 0}%`} valueColor={pctColor(t?.percent ?? 0)} />
        <MetricCard icon={<CheckCircle size={16} />} label="EM DIA"
          value={t?.ontime ?? 0} valueColor="#C8D44E" iconColor="#C8D44E" />
        <MetricCard icon={<AlertTriangle size={16} />} label="ABAIXO"
          value={t?.behind ?? 0} valueColor="#FF4444" iconColor="#FF4444" />
      </div>

      {/* Clients table */}
      <div className="rounded-lg bg-[#1C1C1C] border border-white/[0.07] overflow-hidden mb-10">
        <div className="px-5 py-3 border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-white/40 font-semibold">
          Clientes — {formatMonth(selectedMonthKey)}
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
      <div className="rounded-lg bg-[#1C1C1C] border border-white/[0.07] p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <h2 className="text-white font-semibold">
            Top Membros — <span className="text-white/50 font-normal">{PERIOD_LABEL[period]}</span>
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

        <div className="space-y-2.5">
          {(top.data?.ranking ?? []).map((r, i) => {
            const pct = maxCount ? (r.count / maxCount) * 100 : 0;
            const isFirst = i === 0;
            return (
              <div key={r.id} className="flex items-center gap-3">
                <div className="w-7 text-right font-bold text-[#C8D44E]">{String(i + 1).padStart(2, "0")}</div>
                <Avatar name={r.name} color={r.color} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white text-sm font-medium truncate">{r.name}</span>
                    {isFirst && <Trophy size={13} className="text-[#C8D44E]" />}
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: isFirst ? "#C8D44E" : "rgba(200,212,78,0.55)" }} />
                  </div>
                </div>
                <div className="text-white font-bold tabular-nums w-10 text-right">{r.count}</div>
              </div>
            );
          })}
          {(top.data?.ranking ?? []).length === 0 && (
            <div className="text-white/40 text-sm text-center py-8">Sem finalizações no período.</div>
          )}
        </div>
      </div>

      <p className="text-center italic text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
        {message}
      </p>
    </div>
  );
}

function MetricCard({
  icon, label, value, valueColor, iconColor,
}: { icon: React.ReactNode; label: string; value: number | string; valueColor?: string; iconColor?: string }) {
  return (
    <div className="rounded-lg bg-[#1C1C1C] border border-white/[0.07] p-5">
      <div className="text-white/40 mb-3" style={{ color: iconColor }}>{icon}</div>
      <div className="text-[40px] font-bold leading-none mb-2 tabular-nums" style={{ color: valueColor ?? "#FFFFFF" }}>
        {value}
      </div>
      <div className="text-[11px] uppercase tracking-wider text-white/40 font-semibold">{label}</div>
    </div>
  );
}