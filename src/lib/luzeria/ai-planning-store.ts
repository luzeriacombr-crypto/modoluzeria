import { create } from "zustand";
import type { MonthlyPlanResult } from "./ai-planning.functions";

/** Gera a prévia em segundo plano — fechar/minimizar o modal enquanto uma
 * geração está rodando não cancela nada, só esconde a tela (mesma ideia do
 * call-store.ts pra chamada de vídeo: o job vive aqui, sobrevive a
 * qualquer componente que abra/feche por cima dele). Uma bolha flutuante
 * (AiPlanningJobsTray, montada global no App.tsx) mostra o progresso e
 * deixa reabrir de qualquer tela. */
export type AiPlanningJobStatus = "configuring" | "loading" | "done" | "error";
export type AiPlanningJob = {
  clientId: string;
  clientName: string;
  status: AiPlanningJobStatus;
  result: MonthlyPlanResult | null;
  error: string | null;
};

interface AiPlanningState {
  jobs: Record<string, AiPlanningJob>;
  /** Qual job está com o modal aberto agora — null = tudo minimizado. */
  openClientId: string | null;
  _setJob: (job: AiPlanningJob) => void;
  _removeJob: (clientId: string) => void;
  _setOpen: (clientId: string | null) => void;
}

export const useAiPlanningStore = create<AiPlanningState>((set) => ({
  jobs: {},
  openClientId: null,
  _setJob: (job) => set((s) => ({ jobs: { ...s.jobs, [job.clientId]: job } })),
  _removeJob: (clientId) => set((s) => {
    const next = { ...s.jobs };
    delete next[clientId];
    return { jobs: next, openClientId: s.openClientId === clientId ? null : s.openClientId };
  }),
  _setOpen: (clientId) => set({ openClientId: clientId }),
}));

/** Abre o modal pra esse cliente — se não tiver job ainda, começa na tela
 * de configuração (briefing + tipos de conteúdo). */
export function openAiPlanningModal(clientId: string, clientName: string) {
  const s = useAiPlanningStore.getState();
  if (!s.jobs[clientId]) {
    s._setJob({ clientId, clientName, status: "configuring", result: null, error: null });
  }
  s._setOpen(clientId);
}

export function startAiPlanningJob(clientId: string, clientName: string) {
  useAiPlanningStore.getState()._setJob({ clientId, clientName, status: "loading", result: null, error: null });
}

export function resolveAiPlanningJob(clientId: string, result: MonthlyPlanResult) {
  const job = useAiPlanningStore.getState().jobs[clientId];
  if (job) useAiPlanningStore.getState()._setJob({ ...job, status: "done", result });
}

/** Edita o resultado já pronto (título/texto de um item, remover item) antes
 * de salvar — usado pelos campos editáveis da tela de resultado. */
export function updateAiPlanningJobResult(clientId: string, updater: (r: MonthlyPlanResult) => MonthlyPlanResult) {
  const job = useAiPlanningStore.getState().jobs[clientId];
  if (job?.result) useAiPlanningStore.getState()._setJob({ ...job, result: updater(job.result) });
}

export function failAiPlanningJob(clientId: string, error: string) {
  const job = useAiPlanningStore.getState().jobs[clientId];
  if (job) useAiPlanningStore.getState()._setJob({ ...job, status: "error", error });
}

/** Esconde o modal sem mexer no job — é o "minimizar". */
export function minimizeAiPlanningModal() {
  useAiPlanningStore.getState()._setOpen(null);
}

/** Reabre o modal de um job que já existe (clicando na bolha flutuante). */
export function reopenAiPlanningJob(clientId: string) {
  useAiPlanningStore.getState()._setOpen(clientId);
}

/** Descarta de vez (fecha o modal e apaga o job/a bolha). */
export function dismissAiPlanningJob(clientId: string) {
  useAiPlanningStore.getState()._removeJob(clientId);
}
