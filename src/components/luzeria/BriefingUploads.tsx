import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, Image as ImageIcon } from "lucide-react";
import { itemFilesQO, driveThumbnailQO, useApi } from "@/lib/luzeria/queries";
import { useItemFileUpload } from "@/lib/luzeria/use-item-file-upload";
import { useUI } from "@/lib/luzeria/ui-store";

function BriefingThumb({ file, onRemove, canEdit }: {
  file: { id: string; driveFileId: string; name: string; webViewUrl: string };
  onRemove: () => void;
  canEdit: boolean;
}) {
  const { data, isLoading } = useQuery(driveThumbnailQO(file.driveFileId, true));
  const url = data?.dataUrl ?? null;
  return (
    <div className="group relative w-16 h-16 shrink-0 rounded-md overflow-hidden bg-[#141414] border border-white/[0.08] flex items-center justify-center">
      <a href={file.webViewUrl} target="_blank" rel="noopener noreferrer" title={file.name} className="absolute inset-0">
        {url ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover" loading="lazy" />
        ) : isLoading ? (
          <div className="w-full h-full flex items-center justify-center"><Loader2 size={12} className="animate-spin text-white/30" /></div>
        ) : (
          <div className="w-full h-full flex items-center justify-center"><ImageIcon size={14} className="text-white/20" /></div>
        )}
      </a>
      {canEdit && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRemove(); }}
          title="Remover"
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-red-500/80 text-white rounded p-0.5"
        >
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

export function BriefingUploads({ itemId, clientId, canEdit }: { itemId: string; clientId?: string | null; canEdit: boolean }) {
  const { data: files = [] } = useQuery(itemFilesQO(itemId, "briefing"));
  const { detachItemFile } = useApi();
  const { openFicha } = useUI();
  const { upload, busy, error, missingClientId } = useItemFileUpload(itemId, "briefing");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (error) toast.error(error); }, [error]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    upload(selected);
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/[0.06]">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-semibold text-white/50 uppercase tracking-wider">Imagens de referência</span>
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

      {files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {files.map((f) => (
            <BriefingThumb
              key={f.id}
              file={f}
              canEdit={canEdit}
              onRemove={() => detachItemFile.mutate({ data: { id: f.id } })}
            />
          ))}
        </div>
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
