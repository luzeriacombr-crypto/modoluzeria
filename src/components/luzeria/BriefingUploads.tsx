import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Upload, Loader2, Image as ImageIcon, Download } from "lucide-react";
import { itemFilesQO, driveThumbnailQO, useApi } from "@/lib/luzeria/queries";
import { getDriveVideoToken } from "@/lib/luzeria/drive.functions";
import { downloadDriveFile, downloadDriveFiles } from "@/lib/luzeria/drive-download";
import { useItemFileUpload } from "@/lib/luzeria/use-item-file-upload";
import { useUI } from "@/lib/luzeria/ui-store";
import { FileActionsMenu } from "./FileActionsMenu";
import { CarouselLightbox } from "./CarouselLightbox";

function BriefingThumb({ file, onOpen, onRemoveAppOnly, onRemoveEverywhere, canEdit }: {
  file: { id: string; driveFileId: string; name: string; webViewUrl: string };
  onOpen: () => void;
  onRemoveAppOnly: () => void;
  onRemoveEverywhere: () => void;
  canEdit: boolean;
}) {
  const { data, isLoading } = useQuery(driveThumbnailQO(file.driveFileId, true));
  const url = data?.dataUrl ?? null;
  const fetchDriveToken = useServerFn(getDriveVideoToken);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadDriveFile(fetchDriveToken, file.driveFileId, file.name);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar arquivo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="group relative w-16 h-16 shrink-0 rounded-md overflow-hidden bg-[#141414] border border-white/[0.08] flex items-center justify-center">
      <button type="button" onClick={onOpen} title={file.name} className="absolute inset-0">
        {url ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
        ) : isLoading ? (
          <div className="w-full h-full flex items-center justify-center"><Loader2 size={12} className="animate-spin text-white/30" /></div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-white/20" /></div>
        )}
      </button>
      <FileActionsMenu
        canEdit={canEdit}
        downloading={downloading}
        onDownload={handleDownload}
        onRemoveAppOnly={onRemoveAppOnly}
        onRemoveEverywhere={onRemoveEverywhere}
      />
    </div>
  );
}

export function BriefingUploads({ itemId, clientId, canEdit }: { itemId: string; clientId?: string | null; canEdit: boolean }) {
  const { data: files = [] } = useQuery(itemFilesQO(itemId, "briefing"));
  const { detachItemFile, deleteItemFileAndDrive } = useApi();
  const { openFicha } = useUI();
  const { upload, busy, error, missingClientId } = useItemFileUpload(itemId, "briefing");
  const fileRef = useRef<HTMLInputElement>(null);
  const fetchDriveToken = useServerFn(getDriveVideoToken);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => { if (error) toast.error(error); }, [error]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    upload(selected);
  }

  async function handleDownloadAll() {
    setDownloadingAll(true);
    try {
      await downloadDriveFiles(fetchDriveToken, files);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar imagens.");
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Imagens de referência</span>
        <div className="flex items-center gap-2">
          {files.length > 1 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition disabled:opacity-50"
            >
              {downloadingAll ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              Baixar todas
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold border border-white/15 text-white/70 hover:text-white hover:border-white/30 transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              Fazer upload para briefing
            </button>
          )}
          {canEdit && <input ref={fileRef} type="file" multiple hidden onChange={onPick} accept="image/*" />}
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <BriefingThumb
              key={f.id}
              file={f}
              canEdit={canEdit}
              onOpen={() => setLightboxIndex(i)}
              onRemoveAppOnly={() => detachItemFile.mutate({ data: { id: f.id } })}
              onRemoveEverywhere={() => {
                if (confirm(`Remover "${f.name}" do Modo Criador e mover pra lixeira do Google Drive?`)) {
                  deleteItemFileAndDrive.mutate({ data: { id: f.id } });
                }
              }}
            />
          ))}
        </div>
      )}

      {lightboxIndex !== null && (
        <CarouselLightbox files={files} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}

      {missingClientId && (
        <div className="mt-2 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded px-2.5 py-2 flex items-start gap-2">
          <span className="leading-relaxed flex-1">
            ⚠ Configure a pasta de entregas no Perfil do Cliente antes de fazer upload.
          </span>
          <button
            type="button"
            onClick={() => openFicha(clientId ?? missingClientId)}
            className="shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            Abrir perfil
          </button>
        </div>
      )}
    </div>
  );
}
