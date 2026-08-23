import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, PencilLine } from "lucide-react";
import { setRoteiroClientStatus } from "@/lib/luzeria/feed-share.functions";
import type { PublicRoteiroClientStatus } from "@/lib/luzeria/feed-share.functions";

/** Client-facing approve/ajustar control for a roteiro, on the public
 * preview page — separate from the team's own review (RoteiroControls),
 * injected via RoteirosView's `renderFooter` slot. */
export function ClientRoteiroApproval({
  token,
  docId,
  title,
  current,
  onDone,
}: {
  token: string;
  docId: string;
  title: string;
  current?: PublicRoteiroClientStatus;
  onDone: () => void;
}) {
  const setStatus = useServerFn(setRoteiroClientStatus);
  const [note, setNote] = useState(current?.clientNote ?? "");
  const [asking, setAsking] = useState(false);
  const [saving, setSaving] = useState(false);

  const status = current?.clientStatus ?? "pending";

  async function submit(next: "aprovado" | "ajustar", noteText?: string) {
    setSaving(true);
    try {
      await setStatus({ data: { token, docId, roteiroTitle: title, clientStatus: next, clientNote: noteText } });
      await onDone();
      setAsking(false);
    } finally {
      setSaving(false);
    }
  }

  if (status === "aprovado") {
    return (
      <div className="mt-3 pt-3 border-t border-foreground/6">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "var(--lz-accent-ink)" }}>
          <CheckCircle2 size={14} /> Você aprovou este roteiro
        </div>
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="text-[11px] text-foreground/40 hover:text-foreground/60 transition mt-1.5"
        >
          Mudar de ideia? Pedir ajuste
        </button>
        {asking && (
          <div className="mt-2 rounded-lg p-2.5" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="O que você gostaria de ajustar nesse roteiro?"
              rows={2}
              className="w-full bg-transparent text-[12.5px] text-foreground/80 outline-none resize-y placeholder:text-foreground/30"
            />
            <div className="flex justify-end gap-2 mt-1.5">
              <button type="button" onClick={() => setAsking(false)} className="text-[11px] text-foreground/40 hover:text-foreground/60 px-2 py-1">Cancelar</button>
              <button
                type="button"
                disabled={!note.trim() || saving}
                onClick={() => submit("ajustar", note.trim())}
                className="text-[11px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
                style={{ backgroundColor: "#f87171", color: "#1A0D0D" }}
              >
                {saving ? "Enviando…" : "Enviar"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === "ajustar") {
    return (
      <div className="mt-3 pt-3 border-t border-foreground/6">
        <div className="flex items-start gap-2 text-[12.5px] font-semibold text-red-400">
          <PencilLine size={14} className="mt-0.5 shrink-0" /> Você pediu ajuste neste roteiro
        </div>
        {current?.clientNote && <p className="text-[12px] text-foreground/60 mt-1 ml-[22px]">{current.clientNote}</p>}
        <button
          type="button"
          disabled={saving}
          onClick={() => submit("aprovado")}
          className="text-[11px] font-semibold px-3 py-1.5 rounded-md mt-2 disabled:opacity-40"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {saving ? "Enviando…" : "Na verdade, aprovar"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-foreground/6">
      {!asking ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => submit("aprovado")}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold disabled:opacity-40"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            <CheckCircle2 size={13} /> Aprovar
          </button>
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
            style={{ backgroundColor: "color-mix(in srgb, var(--foreground) 6%, transparent)", color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}
          >
            <PencilLine size={13} /> Sugerir alteração
          </button>
        </div>
      ) : (
        <div className="rounded-lg p-2.5" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="O que você gostaria de ajustar nesse roteiro?"
            rows={2}
            autoFocus
            className="w-full bg-transparent text-[12.5px] text-foreground/80 outline-none resize-y placeholder:text-foreground/30"
          />
          <div className="flex justify-end gap-2 mt-1.5">
            <button type="button" onClick={() => setAsking(false)} className="text-[11px] text-foreground/40 hover:text-foreground/60 px-2 py-1">Cancelar</button>
            <button
              type="button"
              disabled={!note.trim() || saving}
              onClick={() => submit("ajustar", note.trim())}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-md disabled:opacity-40"
              style={{ backgroundColor: "#f87171", color: "#1A0D0D" }}
            >
              {saving ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
