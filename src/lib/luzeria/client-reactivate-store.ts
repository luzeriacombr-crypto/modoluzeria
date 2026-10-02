import { create } from "zustand";

interface ClientReactivateState {
  pending: { id: string; name: string } | null;
  prompt: (id: string, name: string) => void;
  close: () => void;
}

/** Acionado quando uma mutação de servidor recusa agir num cliente
 * arquivado/"Ex-clientes" (erro "CLIENT_ARCHIVED::..." — ver
 * require-active.ts -> assertClientActive e queries.ts -> fail()). */
export const useClientReactivate = create<ClientReactivateState>((set) => ({
  pending: null,
  prompt: (id, name) => set({ pending: { id, name } }),
  close: () => set({ pending: null }),
}));
