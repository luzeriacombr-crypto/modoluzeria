import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bell, Calendar, PlayCircle, Repeat, Sparkles, Timer } from "lucide-react";
import { cronJobsQO, useApi } from "@/lib/luzeria/queries";

const JOB_META: Record<string, { label: string; description: string; icon: React.ComponentType<any> }> = {
  luzeria_deadline_reminders: {
    label: "Alertas de prazo",
    description: "Avisa responsáveis sobre demandas que vencem hoje, amanhã ou estão atrasadas.",
    icon: Bell,
  },
  luzeria_daily_digest: {
    label: "Resumo diário",
    description: "Envia 1 notificação por colaborador com a agenda do dia (demandas, stories e limpeza).",
    icon: Calendar,
  },
  luzeria_recurring_daily: {
    label: "Geração de recorrências",
    description: "Cria automaticamente os itens recorrentes do mês para cada cliente.",
    icon: Repeat,
  },
  "auto-mark-missed-daily": {
    label: "Marcar não-feitos",
    description: "Marca como 'não feito' stories e limpeza do dia anterior que não foram concluídos.",
    icon: Timer,
  },
};

function humanCron(expr: string) {
  // very small helper for the few crons we use
  const map: Record<string, string> = {
    "0 12 * * *": "Todo dia às 09:00 (Brasília)",
    "0 11 * * *": "Todo dia às 08:00 (Brasília)",
    "0 6 * * *":  "Todo dia às 03:00 (Brasília)",
    "59 2 * * *": "Todo dia às 23:59 (Brasília)",
  };
  return map[expr] ?? expr;
}

function relativeTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60_000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.round(h / 24);
  return `há ${d}d`;
}

export function AutomationsTab() {
  const { data: jobs = [], isLoading } = useQuery(cronJobsQO());
  const { runDailyDigestNow, runDeadlineRemindersNow } = useApi();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
          <Sparkles size={12} /> Automações ativas
        </h2>
        <div className="bg-[#1C1C1C] rounded-lg overflow-hidden">
          {isLoading && (
            <div className="px-5 py-6 text-sm text-white/40">Carregando…</div>
          )}
          {!isLoading && jobs.length === 0 && (
            <div className="px-5 py-6 text-sm text-white/40">Nenhuma automação encontrada.</div>
          )}
          {jobs.map((j) => {
            const meta = JOB_META[j.jobname] ?? {
              label: j.jobname, description: "", icon: Sparkles,
            };
            const Icon = meta.icon;
            return (
              <div key={j.jobname}
                className="flex items-start gap-4 px-5 py-4 border-b border-white/[0.05] last:border-b-0">
                <div className="h-9 w-9 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: "rgba(200,212,78,0.15)", color: "#C8D44E" }}>
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-white truncate">{meta.label}</div>
                    {j.active ? (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: "rgba(200,212,78,0.18)", color: "#C8D44E" }}>Ativa</span>
                    ) : (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-white/10 text-white/50">Pausada</span>
                    )}
                  </div>
                  {meta.description && (
                    <div className="text-[11px] text-white/50 mt-1">{meta.description}</div>
                  )}
                  <div className="text-[11px] text-white/40 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span>⏱ {humanCron(j.schedule)}</span>
                    <span>Última execução: {relativeTime(j.lastStart)}{j.lastStatus ? ` · ${j.lastStatus}` : ""}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="text-xs uppercase font-bold text-white/50 tracking-wider mb-3 flex items-center gap-1.5">
          <PlayCircle size={12} /> Disparar agora
        </h2>
        <div className="bg-[#1C1C1C] rounded-lg p-5 grid sm:grid-cols-2 gap-3">
          <button
            disabled={runDeadlineRemindersNow.isPending}
            onClick={() => runDeadlineRemindersNow.mutate({} as any, {
              onSuccess: (r: any) => toast.success(`Alertas enviados: ${r.sent}`),
              onError: (e: any) => toast.error(e?.message ?? "Falhou"),
            })}
            className="lz-btn-primary rounded-md py-2.5 text-xs disabled:opacity-50">
            {runDeadlineRemindersNow.isPending ? "Enviando…" : "Rodar alertas de prazo"}
          </button>
          <button
            disabled={runDailyDigestNow.isPending}
            onClick={() => runDailyDigestNow.mutate({} as any, {
              onSuccess: (r: any) => toast.success(`Resumos enviados: ${r.sent}`),
              onError: (e: any) => toast.error(e?.message ?? "Falhou"),
            })}
            className="lz-btn-primary rounded-md py-2.5 text-xs disabled:opacity-50">
            {runDailyDigestNow.isPending ? "Enviando…" : "Rodar resumo diário"}
          </button>
        </div>
        <p className="text-[11px] text-white/30 mt-3">
          Útil para testar. As notificações respeitam as preferências de cada colaborador (configuráveis no perfil).
        </p>
      </div>
    </div>
  );
}