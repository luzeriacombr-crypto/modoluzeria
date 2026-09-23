import { Sparkles, Check, AlertTriangle, X } from "lucide-react";
import { useAiPlanningStore, dismissAiPlanningJob, reopenAiPlanningJob } from "@/lib/luzeria/ai-planning-store";

/** Bolhas flutuantes pros planejamentos rodando em segundo plano — clicar
 * reabre o modal (AIPlanningPreview, que lê o mesmo store), o X descarta
 * sem precisar abrir. Só aparece job que não está com o modal já aberto
 * na tela (senão duplicaria a mesma informação). */
export function AiPlanningJobsTray() {
  const jobs = useAiPlanningStore((s) => s.jobs);
  const openClientId = useAiPlanningStore((s) => s.openClientId);

  const visible = Object.values(jobs).filter((j) => j.clientId !== openClientId && j.status !== "configuring");
  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-6 z-[500] flex flex-col-reverse gap-2">
      {visible.map((job) => (
        <button
          key={job.clientId}
          onClick={() => reopenAiPlanningJob(job.clientId)}
          className="group flex items-center gap-2.5 pl-3 pr-2 py-2.5 rounded-full shadow-2xl transition hover:opacity-95"
          style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          {job.status === "loading" && (
            <span className="relative w-6 h-6 flex items-center justify-center shrink-0">
              <span className="absolute inset-0 rounded-full animate-ping" style={{ background: "rgba(var(--lz-brand-rgb),0.3)" }} />
              <span className="relative w-6 h-6 rounded-full flex items-center justify-center" style={{ background: "rgba(var(--lz-brand-rgb),0.18)" }}>
                <Sparkles size={12} style={{ color: "var(--lz-accent-ink)" }} />
              </span>
            </span>
          )}
          {job.status === "done" && (
            <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(74,222,128,0.18)" }}>
              <Check size={12} color="#4ADE80" />
            </span>
          )}
          {job.status === "error" && (
            <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: "rgba(239,68,68,0.18)" }}>
              <AlertTriangle size={12} color="#F87171" />
            </span>
          )}
          <div className="text-left leading-tight">
            <div className="text-[11px] font-bold text-white">Planejamento</div>
            <div className="text-[11px] text-white/50 max-w-[140px] truncate">
              {job.clientName}
              {job.status === "loading" && <span className="inline-block ml-0.5 animate-pulse">…</span>}
              {job.status === "done" && " · pronto"}
              {job.status === "error" && " · deu erro"}
            </div>
          </div>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); dismissAiPlanningJob(job.clientId); }}
            className="ml-1 p-1 rounded-full text-white/30 hover:text-white hover:bg-white/10 transition shrink-0"
          >
            <X size={12} />
          </span>
        </button>
      ))}
    </div>
  );
}
