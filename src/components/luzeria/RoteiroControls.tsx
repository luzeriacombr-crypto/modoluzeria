import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, PencilLine, Video, Send } from "lucide-react";
import { useApi } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";
import { formatMonth } from "@/lib/luzeria/utils";
import type { RoteiroStatus } from "@/lib/luzeria/client-docs.functions";

const chipBase = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors";

/** Per-roteiro workflow controls, injected via RoteirosView's `renderFooter`
 * slot — admin-only, never rendered on the public client page. */
export function RoteiroControls({
  docId,
  clientId,
  title,
  status,
}: {
  docId: string;
  clientId: string;
  title: string;
  status?: RoteiroStatus;
}) {
  const { upsertRoteiroStatus, addContentItem } = useApi();
  const { selectedMonthKey, openItem, flash } = useUI();
  const [noteDraft, setNoteDraft] = useState(status?.adjustNote ?? "");

  const current = status?.status ?? "pending";
  const gravado = status?.gravado ?? false;
  const contentItemId = status?.contentItemId ?? null;
  const showNote = current === "ajustar";

  function setApprovalStatus(next: "aprovado" | "ajustar") {
    upsertRoteiroStatus.mutate({
      data: {
        docId, roteiroTitle: title, status: next,
        adjustNote: next === "aprovado" ? null : (status?.adjustNote ?? null),
      },
    });
    if (next === "ajustar") setNoteDraft(status?.adjustNote ?? "");
  }

  function saveNote() {
    if (noteDraft.trim() === (status?.adjustNote ?? "").trim()) return;
    upsertRoteiroStatus.mutate({ data: { docId, roteiroTitle: title, adjustNote: noteDraft.trim() || null } });
  }

  function toggleGravado() {
    upsertRoteiroStatus.mutate({ data: { docId, roteiroTitle: title, gravado: !gravado } });
  }

  function sendToReels() {
    const cleanTitle = title.replace(/^Roteiro\s*\d+\s*:\s*/i, "").trim() || title;
    addContentItem.mutate(
      { data: { clientId, key: selectedMonthKey, type: "reel", title: cleanTitle } },
      {
        onSuccess: (res: any) => {
          upsertRoteiroStatus.mutate({ data: { docId, roteiroTitle: title, contentItemId: res.id } });
          toast.success(`Enviado pro Reels de ${formatMonth(selectedMonthKey)}.`);
        },
        onError: () => toast.error("Não consegui enviar pro Reels. Tenta de novo."),
      },
    );
  }

  const clientStatus = status?.clientStatus ?? "pending";

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06]">
      {clientStatus !== "pending" && (
        <div
          className="mb-2.5 flex items-start gap-2 rounded-lg px-2.5 py-2"
          style={{
            background: clientStatus === "aprovado" ? "rgba(var(--lz-brand-light-rgb),0.08)" : "rgba(248,113,113,0.08)",
            border: `1px solid ${clientStatus === "aprovado" ? "rgba(var(--lz-brand-light-rgb),0.2)" : "rgba(248,113,113,0.2)"}`,
          }}
        >
          {clientStatus === "aprovado"
            ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" style={{ color: "rgb(var(--lz-brand-rgb))" }} />
            : <PencilLine size={13} className="mt-0.5 shrink-0 text-red-400" />}
          <div className="text-[11.5px] leading-relaxed" style={{ color: clientStatus === "aprovado" ? "rgb(var(--lz-brand-rgb))" : "#f87171" }}>
            <span className="font-semibold">{clientStatus === "aprovado" ? "Cliente aprovou" : "Cliente pediu ajuste"}</span>
            {status?.clientNote && <span className="text-white/70"> — {status.clientNote}</span>}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setApprovalStatus("aprovado")}
          className={chipBase}
          style={{
            backgroundColor: current === "aprovado" ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.05)",
            color: current === "aprovado" ? "#0D0D0D" : "rgba(255,255,255,0.6)",
          }}
        >
          <CheckCircle2 size={12} /> Aprovado
        </button>
        <button
          type="button"
          onClick={() => setApprovalStatus("ajustar")}
          className={chipBase}
          style={{
            backgroundColor: current === "ajustar" ? "rgba(248,113,113,0.18)" : "rgba(255,255,255,0.05)",
            color: current === "ajustar" ? "#f87171" : "rgba(255,255,255,0.6)",
          }}
        >
          <PencilLine size={12} /> Ajustar
        </button>
        <button type="button" onClick={toggleGravado} className={chipBase}
          style={{
            backgroundColor: gravado ? "rgba(var(--lz-brand-light-rgb),0.18)" : "rgba(255,255,255,0.05)",
            color: gravado ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.6)",
          }}
        >
          <Video size={12} /> {gravado ? "Gravado" : "Marcar gravado"}
        </button>
        {contentItemId ? (
          <button
            type="button"
            onClick={() => { openItem(contentItemId); flash(contentItemId); }}
            className={chipBase}
            style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.18)", color: "rgb(var(--lz-brand-rgb))" }}
          >
            <CheckCircle2 size={12} /> Enviado pro Reels — abrir
          </button>
        ) : (
          <button
            type="button"
            onClick={sendToReels}
            disabled={addContentItem.isPending}
            className={`${chipBase} disabled:opacity-50`}
            style={{ backgroundColor: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)" }}
          >
            <Send size={12} /> Enviar pro Reels ({formatMonth(selectedMonthKey)})
          </button>
        )}
      </div>
      {showNote && (
        <div className="mt-2 rounded-lg p-2.5" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.18)" }}>
          <textarea
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={saveNote}
            placeholder="O que precisa ajustar nesse roteiro?"
            rows={2}
            className="w-full bg-transparent text-[12.5px] text-white/80 outline-none resize-y placeholder:text-white/30"
          />
        </div>
      )}
    </div>
  );
}
