import { create } from "zustand";

interface GuidedTutorialState {
  /** Título do tutorial em help-content.ts — chave pra achar os passos em guided-tutorials.ts. */
  activeTitle: string | null;
  /** Cliente escolhido (quando o guia precisa de um) — null enquanto o seletor de cliente está aberto. */
  clientId: string | null;
  stepIdx: number;
  /** Guia que precisa de cliente, mas a pessoa ainda não escolheu — mostra o seletor antes de começar os passos de verdade. */
  pickingClientFor: string | null;
  start: (title: string, clientId?: string) => void;
  askForClient: (title: string) => void;
  pickClient: (clientId: string) => void;
  next: () => void;
  prev: () => void;
  close: () => void;
}

export const useGuidedTutorial = create<GuidedTutorialState>((set) => ({
  activeTitle: null,
  clientId: null,
  stepIdx: 0,
  pickingClientFor: null,
  start: (title, clientId) => set({ activeTitle: title, clientId: clientId ?? null, stepIdx: 0, pickingClientFor: null }),
  askForClient: (title) => set({ pickingClientFor: title, activeTitle: null }),
  pickClient: (clientId) => set((s) => (s.pickingClientFor ? { activeTitle: s.pickingClientFor, clientId, stepIdx: 0, pickingClientFor: null } : s)),
  next: () => set((s) => ({ stepIdx: s.stepIdx + 1 })),
  prev: () => set((s) => ({ stepIdx: Math.max(0, s.stepIdx - 1) })),
  close: () => set({ activeTitle: null, clientId: null, stepIdx: 0, pickingClientFor: null }),
}));
