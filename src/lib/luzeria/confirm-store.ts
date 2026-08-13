import { create } from "zustand";

type ConfirmRequest = {
  kind: "confirm" | "prompt";
  message: string;
  danger?: boolean;
  confirmLabel?: string;
  defaultValue?: string;
  resolve: (value: any) => void;
};

interface ConfirmState {
  request: ConfirmRequest | null;
  requestConfirm: (message: string, opts?: { danger?: boolean; confirmLabel?: string }) => Promise<boolean>;
  requestPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  request: null,
  requestConfirm: (message, opts) =>
    new Promise<boolean>((resolve) => {
      set({ request: { kind: "confirm", message, danger: opts?.danger, confirmLabel: opts?.confirmLabel, resolve } });
    }),
  requestPrompt: (message, defaultValue) =>
    new Promise<string | null>((resolve) => {
      set({ request: { kind: "prompt", message, defaultValue, resolve } });
    }),
}));

/** Drop-in replacements for the native confirm()/prompt() — same imperative
 * shape (call it, await the answer), but rendered as a themed modal instead
 * of the browser's OS dialog. Standalone functions (not hooks) since most
 * callers are plain event handlers, not component bodies. */
export function requestConfirm(message: string, opts?: { danger?: boolean; confirmLabel?: string }) {
  return useConfirmStore.getState().requestConfirm(message, opts);
}
export function requestPrompt(message: string, defaultValue?: string) {
  return useConfirmStore.getState().requestPrompt(message, defaultValue);
}
