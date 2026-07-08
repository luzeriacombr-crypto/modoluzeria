import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink, Upload, Link2, Trash2, Loader2, FileText, Image as ImageIcon,
  Film, FolderOpen, Plus, Check, GripVertical, ChevronUp, ChevronDown,
} from "lucide-react";
import { itemFilesQO, driveThumbnailQO, useApi, useMe } from "@/lib/luzeria/queries";
import { useUI } from "@/lib/luzeria/ui-store";

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

function isThumbnailable(mime?: string | null) {
  const m = mime ?? "";
  return m.startsWith("image/") || m.startsWith("video/") || m === "application/pdf"
    || m.startsWith("application/vnd.google-apps.");
}

function FileThumb({ fileId, mime, name }: { fileId: string; mime?: string | null; name: string }) {
  const enabled = isThumbnailable(mime);
  const { data, isLoading } = useQuery(driveThumbnailQO(fileId, enabled));
  const url = data?.dataUrl ?? null;
  return (
    <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-[#0D0D0D] border border-white/[0.08] flex items-center justify-center">
      {url ? (
        <img src={url} alt={name} className="w-full h-full object-cover" loading="lazy" />
      ) : isLoading && enabled ? (
        <Loader2 size={12} className="animate-spin text-white/30" />
      ) : (
        <MimeIcon mime={mime} />
      )}
    </div>
  );
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

export function FilesSection({ itemId, canEdit, clientId }: { itemId: string; canEdit: boolean; clientId?: string | null }) {
  const { data: files = [], isLoading } = useQuery(itemFilesQO(itemId));
  const { attachDriveFile, uploadDriveFile, detachItemFile, reorderItemFiles } = useApi();
  const me = useMe().data;
  const { openFicha } = useUI();

  const [showLink, setShowLink] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [missingClientId, setMissingClientId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Local optimistic order (array of file ids). Synced from server data.
  const [order, setOrder] = useState<string[]>([]);
  const serverOrderKey = useMemo(() => files.map((f) => f.id).join("|"), [files]);
  useEffect(() => {
    setOrder(files.map((f) => f.id));
  }, [serverOrderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const filesById = useMemo(
    () => new Map(files.map((f) => [f.id, f] as const)),
    [files],
  );
  const orderedFiles = useMemo(
    () => order.map((id) => filesById.get(id)).filter(Boolean) as typeof files,
    [order, filesById],
  );

  const dragId = useRef<string | null>(null);

  function persistOrder(next: string[]) {
    setOrder(next);
    reorderItemFiles.mutate({ data: { itemId, orderedIds: next } });
  }

  function moveBy(id: string, delta: number) {
    const idx = order.indexOf(id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= order.length) return;
    const next = order.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    persistOrder(next);
  }

  function onDrop(targetId: string) {
    const sourceId = dragId.current;
    dragId.current = null;
    if (!sourceId || sourceId === targetId) return;
    const next = order.slice();
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    persistOrder(next);
  }

  function parseDriveError(msg: string | undefined): { kind: "missing"; clientId: string } | { kind: "other"; msg: string } {
    const m = /^\[DELIVERIES_FOLDER_MISSING:([0-9a-f-]{36})\]\s*(.*)$/i.exec(msg ?? "");
    if (m) return { kind: "missing", clientId: m[1] };
    return { kind: "other", msg: msg ?? "Falha na operação." };
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setMissingClientId(null);
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selected.length === 0) return;

    const tooBig = selected.filter((f) => f.size > MAX_UPLOAD_BYTES);
    const toUpload = selected.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (tooBig.length > 0) {
      setError(
        tooBig.length === selected.length
          ? `Arquivo${tooBig.length > 1 ? "s" : ""} grande${tooBig.length > 1 ? "s" : ""} demais (máx. 25 MB). Faça upload direto no Drive e cole o link.`
          : `${tooBig.length} arquivo(s) ignorado(s) por serem grandes demais (máx. 25 MB): ${tooBig.map((f) => f.name).join(", ")}`,
      );
    }
    if (toUpload.length === 0) return;

    setUploadProgress({ done: 0, total: toUpload.length });
    const failed: string[] = [];
    for (const file of toUpload) {
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
        setUploadProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
      } catch (err: any) {
        const p = parseDriveError(err?.message);
        if (p.kind === "missing") {
          setMissingClientId(p.clientId);
          break;
        }
        failed.push(file.name);
      }
    }
    setUploadProgress(null);
    if (failed.length > 0) {
      setError(`Falha ao enviar: ${failed.join(", ")}`);
    }
  }

  async function onAttachLink() {
    setError(null);
    setMissingClientId(null);
    const v = linkValue.trim();
    if (!v) return;
    try {
      await attachDriveFile.mutateAsync({ data: { itemId, fileIdOrUrl: v } });
      setLinkValue("");
      setShowLink(false);
    } catch (err: any) {
      const p = parseDriveError(err?.message);
      if (p.kind === "missing") setMissingClientId(p.clientId);
      else setError(p.msg);
    }
  }

  const busy = uploadProgress !== null || uploadDriveFile.isPending || attachDriveFile.isPending;

  return (
    <div>
      {/* List */}
      <div className="space-y-1.5">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-white/40 px-1">
            <Loader2 size={12} className="animate-spin" /> carregando...
          </div>
        )}
        {!isLoading && orderedFiles.length === 0 && (
          <p className="text-[11px] text-white/40 px-1">Nenhum arquivo anexado.</p>
        )}
        {orderedFiles.map((f, i) => (
          <div
            key={f.id}
            draggable={canEdit}
            onDragStart={(e) => {
              if (!canEdit) return;
              dragId.current = f.id;
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => { if (canEdit) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
            onDrop={(e) => { if (canEdit) { e.preventDefault(); onDrop(f.id); } }}
            className="group flex items-center gap-2 rounded-md bg-[#1C1C1C] border border-white/[0.08] px-2 py-2 hover:border-white/20 transition-colors"
          >
            {canEdit && (
              <div className="flex flex-col items-center shrink-0 -ml-0.5">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveBy(f.id, -1); }}
                  disabled={i === 0 || reorderItemFiles.isPending}
                  className="text-white/30 hover:text-[#C8D44E] disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                  title="Mover para cima"
                >
                  <ChevronUp size={12} />
                </button>
                <span
                  className="cursor-grab active:cursor-grabbing text-white/30 hover:text-white/60 leading-none"
                  title="Arrastar para reordenar"
                >
                  <GripVertical size={12} />
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); moveBy(f.id, 1); }}
                  disabled={i === orderedFiles.length - 1 || reorderItemFiles.isPending}
                  className="text-white/30 hover:text-[#C8D44E] disabled:opacity-20 disabled:cursor-not-allowed leading-none"
                  title="Mover para baixo"
                >
                  <ChevronDown size={12} />
                </button>
              </div>
            )}
            <FileThumb fileId={f.driveFileId} mime={f.mimeType} name={f.name} />
            <a
              href={f.webViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              referrerPolicy="no-referrer"
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 inline-flex items-center gap-1.5 text-[13px] font-medium text-white hover:text-[#C8D44E] truncate"
              title={f.name}
            >
              {i === 0 && (
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                  style={{ background: "rgba(200,212,78,0.15)", color: "#C8D44E" }}
                  title="Aparece na prévia de Mídia"
                >
                  Capa
                </span>
              )}
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
              {busy ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Upload size={12} />
              )}
              {uploadProgress ? `Enviando ${uploadProgress.done}/${uploadProgress.total}...` : "Enviar arquivo"}
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
              multiple
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

          {missingClientId && (
            <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded px-2.5 py-2 flex items-start gap-2">
              <span className="leading-relaxed flex-1">
                ⚠ Configure a pasta de entregas no Perfil do Cliente antes de fazer upload.
              </span>
              <button
                type="button"
                onClick={() => openFicha(clientId ?? missingClientId)}
                className="shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: "#C8D44E", color: "#0D0D0D" }}
              >
                Abrir perfil
              </button>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-white/40 mt-2 leading-relaxed">
        Arquivos ficam armazenados no Google Drive da agência. Você pode selecionar vários de uma vez;
        upload direto até 25 MB por arquivo — para arquivos maiores, faça upload no Drive e cole o link aqui.
      </p>
    </div>
  );
}