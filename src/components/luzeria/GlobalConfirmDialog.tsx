import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { useConfirmStore } from "@/lib/luzeria/confirm-store";

/** Single global instance replacing every native confirm()/prompt() in the
 * app — mount once (in App.tsx) and every requestConfirm()/requestPrompt()
 * call anywhere renders through this same themed modal. */
export function GlobalConfirmDialog() {
  const request = useConfirmStore((s) => s.request);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (request?.kind === "prompt") setValue(request.defaultValue ?? "");
  }, [request]);

  if (!request) return null;
  const { kind, message, danger, confirmLabel, resolve } = request;

  function close(result: boolean | string | null) {
    resolve(result);
    useConfirmStore.setState({ request: null });
  }

  return createPortal(
    <div className="lz-overlay z-[300] flex items-center justify-center p-4" onClick={() => close(kind === "prompt" ? null : false)}>
      <div
        className="bg-[#1C1C1C] rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl lz-modal-in p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
            style={danger
              ? { backgroundColor: "rgba(229,72,77,0.15)", color: "#E5484D" }
              : { backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}
          >
            {danger ? <AlertTriangle size={17} /> : <HelpCircle size={17} />}
          </div>
          <p className="text-sm text-white/85 leading-relaxed pt-1.5">{message}</p>
        </div>

        {kind === "prompt" && (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") close(value.trim() || null);
              if (e.key === "Escape") close(null);
            }}
            className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] mb-4"
          />
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => close(kind === "prompt" ? null : false)}
            className="px-3.5 py-2 text-sm text-white/60 hover:text-white transition-colors"
          >
            Cancelar
          </button>
          <button
            autoFocus={kind === "confirm"}
            onClick={() => close(kind === "prompt" ? (value.trim() || null) : true)}
            className="px-4 py-2 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
            style={danger
              ? { backgroundColor: "#E5484D", color: "#FFFFFF" }
              : { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {confirmLabel ?? (kind === "prompt" ? "Salvar" : danger ? "Excluir" : "Confirmar")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
