import type { ReactNode } from "react";
import { create } from "zustand";

type ConfirmRequest = {
  kind: "confirm" | "prompt";
  message: ReactNode;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
  defaultValue?: string;
  resolve: (value: any) => void;
};

interface ConfirmState {
  request: ConfirmRequest | null;
  requestConfirm: (message: ReactNode, opts?: { danger?: boolean; confirmLabel?: string; cancelLabel?: string }) => Promise<boolean>;
  requestPrompt: (message: ReactNode, defaultValue?: string) => Promise<string | null>;
}

export const useConfirmStore = create<ConfirmState>((set) => ({
  request: null,
  requestConfirm: (message, opts) =>
    new Promise<boolean>((resolve) => {
      set({ request: { kind: "confirm", message, danger: opts?.danger, confirmLabel: opts?.confirmLabel, cancelLabel: opts?.cancelLabel, resolve } });
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
export function requestConfirm(message: ReactNode, opts?: { danger?: boolean; confirmLabel?: string; cancelLabel?: string }) {
  return useConfirmStore.getState().requestConfirm(message, opts);
}
export function requestPrompt(message: ReactNode, defaultValue?: string) {
  return useConfirmStore.getState().requestPrompt(message, defaultValue);
}
