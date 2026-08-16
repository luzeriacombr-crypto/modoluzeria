import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingDown, Info } from "lucide-react";
import { orgCostSettingsQO, clientMarginsQO, useApi } from "@/lib/luzeria/queries";
import { CONTENT_TYPE_LABEL, type ContentType } from "@/lib/luzeria/types";

const EFFORT_TYPES: ContentType[] = ["post", "reel", "story", "gravacao", "outros"];
const DAYS_OPTIONS = [30, 90, 180] as const;

const money = (v: number | null) =>
  v == null ? "—" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const inp = "w-full bg-[#1C1C1C] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] transition-colors";

function CostSettingsForm() {
  const { data: settings, isLoading } = useQuery(orgCostSettingsQO());
  const api = useApi();
  const [hourlyCost, setHourlyCost] = useState<string | number>("");
  const [avgHours, setAvgHours] = useState<Record<string, string | number>>({});

  useEffect(() => {
    if (!settings) return;
    setHourlyCost(settings.hourlyCost ?? "");
    setAvgHours(settings.avgHoursByType ?? {});
  }, [settings]);

  if (isLoading || !settings) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="animate-spin text-white/40" size={24} /></div>;
  }

  function save() {
    api.setOrgCostSettings.mutate({
      data: {
        hourlyCost: hourlyCost === "" ? null : Number(hourlyCost),
        avgHoursByType: Object.fromEntries(
          EFFORT_TYPES.map((t) => [t, Number(avgHours[t]) || 0]),
        ),
      },
    });
  }

  return (
    <div className="bg-[#161616] border border-white/[0.07] rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white">Custo-hora da equipe</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 block mb-1">Custo-hora (R$)</label>
          <input type="number" min="0" step="0.01" value={hourlyCost}
            onChange={(e) => setHourlyCost(e.target.value)} placeholder="Não definido" className={inp} />
        </div>
      </div>
      <div>
        <label className="text-xs text-white/50 block mb-2">Média de horas por tipo de conteúdo</label>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {EFFORT_TYPES.map((t) => (
            <div key={t}>
              <label className="text-[11px] text-white/40 block mb-1">{CONTENT_TYPE_LABEL[t]}</label>
              <input type="number" min="0" step="0.1" value={avgHours[t] ?? ""}
                onChange={(e) => setAvgHours((prev) => ({ ...prev, [t]: e.target.value }))}
                className={inp} />
            </div>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={api.setOrgCostSettings.isPending}
        className="rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
        {api.setOrgCostSettings.isPending ? "Salvando…" : "Salvar custo-hora"}
      </button>
    </div>
  );
}

export function ClientMarginPanel() {
  const [days, setDays] = useState<30 | 90 | 180>(30);
  const { data, isLoading } = useQuery(clientMarginsQO(days));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingDown size={16} className="text-[rgb(var(--lz-brand-rgb))]" />
        <h2 className="text-white font-semibold">Margem por cliente</h2>
      </div>

      <CostSettingsForm />

      <div className="flex items-center gap-2 text-white/60 text-xs bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2">
        <Info size={14} className="shrink-0" />
        Custo é uma estimativa (itens finalizados × horas médias × custo-hora), não é apontamento real de horas nem contabilidade oficial.
      </div>

      <div className="flex items-center gap-1.5">
        {DAYS_OPTIONS.map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${days === d ? "text-[#0D0D0D]" : "text-white/60 hover:text-white bg-white/[0.05]"}`}
            style={days === d ? { backgroundColor: "rgb(var(--lz-brand-rgb))" } : undefined}>
            {d} dias
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="animate-spin text-white/40" size={32} /></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="text-center py-12 px-6 bg-white/[0.03] border border-white/10 rounded-2xl">
          <p className="text-white/50 text-sm">Nenhum cliente ativo encontrado.</p>
        </div>
      ) : (
        <div className="bg-[#161616] border border-white/[0.07] rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.07]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-white/60">Cliente</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Contrato</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Entregues</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Horas est.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Custo est.</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-white/60">Margem</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.clientId} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3 text-sm text-white flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: r.clientColor }} />
                    {r.clientName}
                  </td>
                  <td className="px-4 py-3 text-sm text-white/70 text-right">{money(r.contractValue)}</td>
                  <td className="px-4 py-3 text-sm text-white/70 text-right">{r.deliveredCount}</td>
                  <td className="px-4 py-3 text-sm text-white/70 text-right">{r.estimatedHours}h</td>
                  <td className="px-4 py-3 text-sm text-white/70 text-right">{money(r.estimatedCost)}</td>
                  <td className="px-4 py-3 text-sm text-right font-semibold"
                    style={{ color: r.margin == null ? "rgba(255,255,255,0.4)" : r.margin < 0 ? "#FF6B6B" : "#4ADE80" }}>
                    {money(r.margin)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
