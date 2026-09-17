import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, BarChart3 } from "lucide-react";
import { pageActivityReportQO } from "@/lib/luzeria/queries";

function formatDuration(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h${rest}min` : `${hours}h`;
}

/** Ranking de rotas mais/menos usadas em todo o Modo Criador (todas as
 * agências), pra achar gargalo/feature esquecida — dado de uso do
 * produto, não de uma agência específica, por isso vive aqui e não no
 * relatório de cada cliente. */
export function PageActivityReportPanel() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data: rows = [], isLoading } = useQuery(pageActivityReportQO(days));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-[var(--lz-accent-ink)]" />
          <h2 className="text-foreground font-semibold">Páginas mais e menos usadas</h2>
        </div>
        <div className="inline-flex items-center gap-1 bg-background rounded-md p-1 text-xs">
          {([7, 30, 90] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-2.5 py-1 rounded font-semibold transition ${days === d ? "bg-foreground/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-foreground/40" size={32} />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">Ainda sem dados de uso nesse período.</p>
        </div>
      ) : (
        <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-foreground/7">
                <th className="text-left px-4 py-3 text-xs font-semibold text-foreground/60">Rota</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">Visitas</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">Usuários únicos</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">Tempo total</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-foreground/60">Tempo médio</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.path} className="border-b border-foreground/4 hover:bg-foreground/[0.02] transition">
                  <td className="px-4 py-3 text-sm text-foreground/80 font-mono text-[12px]">{r.path}</td>
                  <td className="px-4 py-3 text-sm text-right text-foreground/70">{r.visits}</td>
                  <td className="px-4 py-3 text-sm text-right text-foreground/70">{r.uniqueUsers}</td>
                  <td className="px-4 py-3 text-sm text-right text-foreground/70">{formatDuration(r.totalSeconds)}</td>
                  <td className="px-4 py-3 text-sm text-right text-foreground/70">{r.avgSeconds}s</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px] text-foreground/30">
        Ordenado por mais visitado primeiro — role até o fim pra ver o que quase ninguém usa. Rota é o padrão da tela (ex: cliente/$id representa todos os clientes), não uma página específica.
      </p>
    </div>
  );
}
