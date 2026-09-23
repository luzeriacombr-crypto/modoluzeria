import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Footprints } from "lucide-react";
import { newUserJourneyReportQO } from "@/lib/luzeria/queries";

function formatDuration(totalSeconds: number) {
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest > 0 ? `${hours}h${rest}min` : `${hours}h`;
}

/** Recorte de "primeiros dias de uso" pra quem se cadastrou de verdade —
 * diferente do PageActivityReportPanel (que mistura todo mundo, de
 * qualquer época), esse olha só pros primeiros N dias de cada usuário
 * novo: qual página abre primeiro, onde passa mais tempo, e quantos nem
 * chegaram a navegar (sinal de que precisam de contato humano). */
export function NewUserJourneyReportPanel() {
  const [windowDays, setWindowDays] = useState<3 | 7 | 14>(7);
  const { data: report, isLoading } = useQuery(newUserJourneyReportQO(windowDays));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Footprints size={16} className="text-[var(--lz-accent-ink)]" />
          <h2 className="text-foreground font-semibold">Primeiros passos de quem se cadastrou</h2>
        </div>
        <div className="inline-flex items-center gap-1 bg-background rounded-md p-1 text-xs">
          {([3, 7, 14] as const).map((d) => (
            <button
              key={d}
              onClick={() => setWindowDays(d)}
              className={`px-2.5 py-1 rounded font-semibold transition ${windowDays === d ? "bg-foreground/10 text-foreground" : "text-foreground/40 hover:text-foreground/70"}`}
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
      ) : !report || report.cohortSize === 0 ? (
        <div className="text-center py-12 px-6 bg-foreground/[0.03] border border-foreground/10 rounded-2xl">
          <p className="text-foreground/50 text-sm">
            Ainda ninguém se cadastrou há {windowDays}+ dias desde que esse tracking começou (19/09). Tenta uma janela menor ou espera acumular mais dado.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 flex-wrap text-xs text-foreground/50">
            <span>{report.cohortSize} pessoa{report.cohortSize === 1 ? "" : "s"} completou os primeiros {windowDays} dias</span>
            {report.usersWithNoPageViews > 0 && (
              <span className="text-amber-500/90 font-medium">
                {report.usersWithNoPageViews} de {report.cohortSize} nunca navegaram por nenhuma página nesse período
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/7">
                <h3 className="text-sm font-semibold text-foreground">Primeira página que abrem</h3>
              </div>
              {report.firstPageRanking.length === 0 ? (
                <p className="px-4 py-6 text-sm text-foreground/40 text-center">Sem navegação registrada.</p>
              ) : (
                <table className="w-full">
                  <tbody>
                    {report.firstPageRanking.map((r) => (
                      <tr key={r.path} className="border-b border-foreground/4 last:border-0">
                        <td className="px-4 py-2.5 text-sm text-foreground/80 font-mono text-[12px]">{r.path}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-foreground/60 whitespace-nowrap">
                          {r.count} ({Math.round((r.count / report.cohortSize) * 100)}%)
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="bg-card border border-foreground/7 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-foreground/7">
                <h3 className="text-sm font-semibold text-foreground">Onde passam mais tempo</h3>
              </div>
              {report.topPagesByTime.length === 0 ? (
                <p className="px-4 py-6 text-sm text-foreground/40 text-center">Sem navegação registrada.</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-foreground/7">
                      <th className="text-left px-4 py-2 text-[11px] font-semibold text-foreground/50">Rota</th>
                      <th className="text-right px-4 py-2 text-[11px] font-semibold text-foreground/50">Pessoas</th>
                      <th className="text-right px-4 py-2 text-[11px] font-semibold text-foreground/50">Tempo médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topPagesByTime.map((r) => (
                      <tr key={r.path} className="border-b border-foreground/4 last:border-0">
                        <td className="px-4 py-2.5 text-sm text-foreground/80 font-mono text-[12px]">{r.path}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-foreground/60">{r.uniqueUsers}</td>
                        <td className="px-4 py-2.5 text-sm text-right text-foreground/60">{formatDuration(r.avgSecondsPerUser)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <p className="text-[11px] text-foreground/30">
            Considera só quem se cadastrou a partir de 19/09 (início do tracking) e já completou a janela inteira de {windowDays} dias — tempo alto numa página pode ser engajamento ou dificuldade, olha o contexto da rota pra interpretar.
          </p>
        </>
      )}
    </div>
  );
}
