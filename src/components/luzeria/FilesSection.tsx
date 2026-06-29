import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink, Upload, Link2, Trash2, Loader2, FileText, Image as ImageIcon,
  Film, FolderOpen, Plus, Check,
} from "lucide-react";
import { itemFilesQO, useApi, useMe } from "@/lib/luzeria/queries";

function formatSize(n: number | null | undefined) {
  if (!n || n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function MimeIcon({ mime }: { mime?: string | null }) {
  const m = mime ?? "";
  if (m.startsWith("image/")) return <ImageIcon size={16} style={{ color: "#C8D44E" }} />;
  if (m.startsWith("video/")) return <Film size={16} style={{ color: "#C8D44E" }} />;
  if (m.includes("folder")) return <FolderOpen size={16} style={{ color: "#C8D44E" }} />;
  return <FileText size={16} style={{ color: "#C8D44E" }} />;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export function FilesSection({ itemId, canEdit }: { itemId: string; canEdit: boolean }) {
  const { data: files = [], isLoading } = useQuery(itemFilesQO(itemId));
  const { attachDriveFile, uploadDriveFile, detachItemFile } = useApi();
  const me = useMe().data;

  const [showLink, setShowLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(`Arquivo grande demais (máx. 25 MB). Faça upload direto no Drive e cole o link.`);
      return;
    }
    try {
      const base64 = await fileToBase64(file);
      await uploadDriveFile.mutateAsync({
        data: {
          itemId,
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          base64,
        },
      });
    } catch (err: any) {
      setError(err?.message ?? "Falha no upload.");
    }
  }

  async function onAttachLink() {
    setError(null);
    const v = linkValue.trim();
    if (!v) return;
    try {
      await attachDriveFile.mutateAsync({ data: { itemId, fileIdOrUrl: v } });
      setLinkValue("");
      setShowLink(false);
    } catch (err: any) {
      setError(err?.message ?? "Não foi possível vincular o link.");
    }
  }

  const busy = uploadDriveFile.isPending || attachDriveFile.isPending;

  return (
    <div>
      {/* List */}
      <div className="space-y-1.5">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-white/40 px-1">
            <Loader2 size={12} className="animate-spin" /> carregando...
          </div>
        )}
        {!isLoading && files.length === 0 && (
          <p className="text-[11px] text-white/40 px-1">Nenhum arquivo anexado.</p>
        )}
        {files.map((f) => (
          <div
            key={f.id}
            className="group flex items-center gap-2.5 rounded-md bg-[#1C1C1C] border border-white/[0.08] px-2.5 py-2 hover:border-white/20 transition-colors"
          >
            <MimeIcon mime={f.mimeType} />
            <a
              href={f.webViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-white hover:text-[#C8D44E] truncate"
              title={f.name}
            >
              <span className="truncate">{f.name}</span>
              <ExternalLink size={11} className="shrink-0 opacity-50" />
            </a>
            {f.sizeBytes ? (
              <span className="text-[10px] text-white/30 shrink-0">{formatSize(f.sizeBytes)}</span>
            ) : null}
            {canEdit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Remover "${f.name}" do item? O arquivo permanece no Drive.`)) {
                    detachItemFile.mutate({ data: { id: f.id } });
                  }
                }}
                title="Desvincular"
                className="opacity-0 group-hover:opacity-100 transition-opacity text-white/40 hover:text-red-400 p-1 rounded hover:bg-white/5"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="mt-2.5 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold bg-[#C8D44E] text-[#0D0D0D] hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {uploadDriveFile.isPending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              Enviar arquivo
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowLink((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-semibold border border-white/15 text-white/80 hover:text-white hover:border-white/30 transition disabled:opacity-50"
            >
              <Link2 size={12} /> Colar link do Drive
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              onChange={onUpload}
            />
          </div>

          {showLink && (
            <div className="flex items-center gap-2">
              <input
                value={linkValue}
                onChange={(e) => setLinkValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onAttachLink();
                  if (e.key === "Escape") { setShowLink(false); setLinkValue(""); }
                }}
                autoFocus
                placeholder="Cole o link ou ID do arquivo/pasta..."
                className="flex-1 bg-[#252525] border border-white/[0.08] rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[#C8D44E] focus:ring-1 focus:ring-[#C8D44E] placeholder:text-white/30 transition-colors"
              />
              <button
                type="button"
                disabled={!linkValue.trim() || attachDriveFile.isPending}
                onClick={onAttachLink}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[11px] font-semibold bg-[#C8D44E] text-[#0D0D0D] hover:brightness-110 disabled:opacity-50 transition"
              >
                {attachDriveFile.isPending ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                Vincular
              </button>
            </div>
          )}

          {error && (
            <p className="text-[11px] text-red-300 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5">
              {error}
            </p>
          )}
        </div>
      )}

      <p className="text-[10px] text-white/40 mt-2 leading-relaxed">
        Arquivos ficam armazenados no Google Drive da agência. Upload direto até 25 MB
        — para arquivos maiores, faça upload no Drive e cole o link aqui.
      </p>
    </div>
  );
}