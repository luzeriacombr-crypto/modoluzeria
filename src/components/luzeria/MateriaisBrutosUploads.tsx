import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { Upload, Loader2, Image as ImageIcon, Film, Play, Download } from "lucide-react";
import { itemFilesQO, driveThumbnailQO, useApi } from "@/lib/luzeria/queries";
import { getDriveVideoToken } from "@/lib/luzeria/drive.functions";
import { downloadDriveFile, downloadDriveFilesAsZip } from "@/lib/luzeria/drive-download";
import { useItemFileUpload } from "@/lib/luzeria/use-item-file-upload";
import { useUI } from "@/lib/luzeria/ui-store";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { FileActionsMenu } from "./FileActionsMenu";
import { CarouselLightbox } from "./CarouselLightbox";

function RawMaterialThumb({ file, onOpen, onRemoveAppOnly, onRemoveEverywhere, canEdit }: {
  file: { id: string; driveFileId: string; name: string; webViewUrl: string; mimeType?: string | null };
  onOpen: () => void;
  onRemoveAppOnly: () => void;
  onRemoveEverywhere: () => void;
  canEdit: boolean;
}) {
  const { data, isLoading } = useQuery(driveThumbnailQO(file.driveFileId, true));
  const url = data?.dataUrl ?? null;
  const isVideo = (file.mimeType ?? "").startsWith("video/");
  const fetchDriveToken = useServerFn(getDriveVideoToken);
  const [downloading, setDownloading] = useState(false);

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadDriveFile(fetchDriveToken, file.driveFileId, file.name);
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao baixar arquivo.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="group relative w-16 h-16 shrink-0 rounded-md overflow-hidden bg-card border border-foreground/8 flex items-center justify-center">
      <button type="button" onClick={onOpen} title={file.name} className="absolute inset-0">
        {url ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
        ) : isLoading ? (
          <div className="w-full h-full flex items-center justify-center"><Loader2 size={12} className="animate-spin text-foreground/30" /></div>
        ) : isVideo ? (
          <div className="w-full h-full flex items-center justify-center"><Film size={14} className="text-foreground/20" /></div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-foreground/20" /></div>
        )}
        {url && isVideo && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: "rgba(0,0,0,0.15)" }}>
            <div className="h-5 w-5 rounded-full flex items-center justify-center" style={{ background: "rgba(0,0,0,0.55)" }}>
              <Play size={9} className="text-white fill-white ml-px" />
            </div>
          </div>
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

/** Pasta própria no Drive ("Materiais Brutos", irmã de "Imagens de
 * Briefing") pra imagem/vídeo cru que o editor baixa, edita fora do app e
 * depois sobe o resultado final como mídia de verdade do item — mesmo
 * padrão de BriefingUploads, mas aceitando vídeo também. */
export function MateriaisBrutosUploads({ itemId, clientId, canEdit }: { itemId: string; clientId?: string | null; canEdit: boolean }) {
  const { data: files = [] } = useQuery(itemFilesQO(itemId, "raw"));
  const { detachItemFile, deleteItemFileAndDrive } = useApi();
  const { openFicha } = useUI();
  const { upload, busy, error, missingClientId } = useItemFileUpload(itemId, "raw");
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
      await downloadDriveFilesAsZip(fetchDriveToken, files, "materiais-brutos.zip");
    } catch (e: any) {
      toastFriendlyError(e, "Erro ao baixar materiais.");
    } finally {
      setDownloadingAll(false);
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-foreground/6">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-foreground/50 uppercase tracking-wider">Materiais brutos</span>
        <div className="flex items-center gap-2">
          {files.length > 1 && (
            <button
              type="button"
              onClick={handleDownloadAll}
              disabled={downloadingAll}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold border border-foreground/15 text-foreground/70 hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
            >
              {downloadingAll ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
              Baixar todos
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold border border-foreground/15 text-foreground/70 hover:text-foreground hover:border-foreground/30 transition disabled:opacity-50"
            >
              {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
              Fazer upload de material bruto
            </button>
          )}
          {canEdit && <input ref={fileRef} type="file" multiple hidden onChange={onPick} accept="image/*,video/*" />}
        </div>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <RawMaterialThumb
              key={f.id}
              file={f}
              canEdit={canEdit}
              onOpen={() => setLightboxIndex(i)}
              onRemoveAppOnly={() => detachItemFile.mutate({ data: { id: f.id } })}
              onRemoveEverywhere={async () => {
                if (await requestConfirm(`Remover "${f.name}" do Modo Criador e mover pra lixeira do Google Drive?`, { danger: true })) {
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
