import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Upload, Loader2, FileText, Image as ImageIcon, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { formatMonth } from "@/lib/luzeria/utils";
import type { FinanceAttachment } from "@/lib/luzeria/finance-attachments.functions";
import { Modal } from "./Modals";

const BUCKET = "finance-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,image/heif";

export type AttachmentTarget = { entryId: string; clientId?: never } | { clientId: string; entryId?: never };

function formatSize(bytes: number | null) {
  if (bytes == null) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/** Clipe que abre os comprovantes de um lançamento/mensalidade no mês — mostra
 * quantos já tem anexados. */
export function AttachmentsButton({ count, onClick, disabled, disabledTitle }: { count: number; onClick: () => void; disabled?: boolean; disabledTitle?: string }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      title={disabled ? disabledTitle : count > 0 ? `${count} comprovante${count === 1 ? "" : "s"}` : "Anexar comprovante"}
      className={`inline-flex items-center gap-0.5 p-1 rounded transition ${disabled ? "text-foreground/15 cursor-default" : count > 0 ? "text-[var(--lz-accent-ink)] hover:bg-foreground/5" : "text-foreground/30 hover:text-foreground hover:bg-foreground/5"}`}
    >
      <Paperclip size={13} />
      {count > 0 && <span className="text-[10px] font-bold">{count}</span>}
    </button>
  );
}

/** Lista, abre, anexa e apaga comprovantes (PDF ou foto, até 10 MB). O
 * arquivo sobe direto pro bucket privado da agência; o registro é gravado no
 * servidor depois (saveFinanceAttachment). */
export function AttachmentsModal({ title, monthKey, target, attachments, onClose }: {
  title: string; monthKey: string; target: AttachmentTarget; attachments: FinanceAttachment[]; onClose: () => void;
}) {
  const api = useApi();
  const me = useMe().data;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File) {
    if (!me?.orgId) return;
    if (file.size > MAX_BYTES) { toast.error("Arquivo maior que 10 MB."); return; }
    if (!ACCEPT.split(",").includes(file.type)) { toast.error("Envie um PDF ou uma foto (JPG, PNG, WEBP ou HEIC)."); return; }
    setUploading(true);
    // Erro no envio do arquivo avisa aqui; erro ao gravar o registro já é
    // avisado pelo onError da mutation (queries.ts).
    let stage: "upload" | "save" = "upload";
    try {
      const safeName = file.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${me.orgId}/${crypto.randomUUID()}-${safeName}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      stage = "save";
      await api.saveFinanceAttachment.mutateAsync({
        data: { ...target, monthKey, storagePath: path, fileName: file.name.slice(0, 200), mimeType: file.type, sizeBytes: file.size },
      });
      toast.success("Comprovante anexado.");
    } catch (e: any) {
      if (stage === "upload") toast.error(e?.message ?? "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function open(att: FinanceAttachment) {
    // Abre a aba antes do await — senão o navegador bloqueia como pop-up.
    const win = window.open("", "_blank");
    try {
      const { url } = await api.getFinanceAttachmentUrl.mutateAsync({ data: { id: att.id } });
      if (win) win.location.href = url; else window.location.href = url;
    } catch {
      win?.close();
    }
  }

  async function remove(att: FinanceAttachment) {
    if (!(await requestConfirm(`Apagar o comprovante "${att.fileName}"?`, { danger: true }))) return;
    api.removeFinanceAttachment.mutate({ data: { id: att.id } });
  }

  return (
    <Modal open onClose={onClose} title="Comprovantes">
      <p className="text-sm text-foreground/60 mb-3">
        <span className="font-semibold text-foreground">{title}</span> · {formatMonth(monthKey)}
      </p>

      {attachments.length === 0 ? (
        <div className="text-[12px] text-foreground/40 py-6 text-center rounded-lg border border-dashed border-foreground/12 mb-3">
          Nenhum comprovante anexado ainda.
        </div>
      ) : (
        <div className="space-y-1.5 mb-3">
          {attachments.map((a) => (
            <div key={a.id} className="flex items-center gap-2.5 px-2.5 py-2 rounded-md" style={{ background: "color-mix(in srgb, var(--foreground) 3%, transparent)" }}>
              {a.mimeType === "application/pdf"
                ? <FileText size={16} className="text-foreground/45 shrink-0" />
                : <ImageIcon size={16} className="text-foreground/45 shrink-0" />}
              <button onClick={() => open(a)} className="flex-1 min-w-0 text-left group">
                <div className="text-[13px] text-foreground truncate group-hover:underline underline-offset-2">{a.fileName}</div>
                <div className="text-[10.5px] text-foreground/40">
                  {new Date(a.createdAt).toLocaleDateString("pt-BR")}{a.sizeBytes != null ? ` · ${formatSize(a.sizeBytes)}` : ""}
                </div>
              </button>
              <button onClick={() => open(a)} title="Abrir" className="text-foreground/35 hover:text-foreground p-1"><ExternalLink size={13} /></button>
              <button onClick={() => remove(a)} title="Apagar" className="text-foreground/35 hover:text-red-400 p-1"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}

      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10.5px] text-foreground/35">PDF ou foto, até 10 MB</span>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-bold transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
        >
          {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {uploading ? "Enviando…" : "Anexar comprovante"}
        </button>
      </div>
    </Modal>
  );
}
