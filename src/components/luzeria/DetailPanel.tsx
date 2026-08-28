import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { X, Send, ExternalLink, Plus, Check, ChevronDown, ChevronLeft, ChevronRight, Calendar, AlertOctagon, ListChecks, Star, RotateCcw, Trash2, Upload, Loader2, ImagePlus, Image as ImageIcon, Instagram, Clock, Pencil, Expand, Download, CheckSquare, Square } from "lucide-react";
import { clientsQO, monthQO, monthKeysQO, profilesQO, useApi, useMe, appSettingsQO, driveThumbnailQO, itemFilesQO, campaignsQO } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { useUI } from "@/lib/luzeria/ui-store";
import { getInstagramConnectionStatus } from "@/lib/luzeria/instagram.functions";
import { getDriveVideoToken } from "@/lib/luzeria/drive.functions";
import { downloadDriveFile, downloadDriveFilesAsZip } from "@/lib/luzeria/drive-download";
import { FileActionsMenu } from "./FileActionsMenu";
import { STATUS_META, statusLabel, statusOptionsFor, REEL_TYPES, REEL_TYPE_LABEL, POST_FORMATS, POST_FORMAT_LABEL, CONTENT_TYPE_LABEL, isActivityType, ACTIVITY_DATE_LABEL, ACTIVITY_QUANTITY_LABEL, hasSetorPermission, type Profile, type ContentItem, type ReelType, type PostFormat, type Status } from "@/lib/luzeria/types";
import { Avatar } from "./Avatar";
import { STATUS_ICONS } from "./icons";
import { MentionInput, renderMentions } from "./MentionInput";
import { AudioCommentRecorder } from "./AudioCommentRecorder";
import { ItemTimeline } from "./ItemTimeline";
import { QualityModal } from "./QualityModal";
import { FilesSection } from "./FilesSection";
import { BriefingUploads } from "./BriefingUploads";
import { CarouselLightbox } from "./CarouselLightbox";
import { ReelCoverEditor } from "./ReelCoverEditor";
import { useItemFileUpload } from "@/lib/luzeria/use-item-file-upload";

function findItem(month: any, id: string): ContentItem | undefined {
  return (
    month?.posts.find((i: any) => i.id === id) ??
    month?.reels.find((i: any) => i.id === id) ??
    month?.stories?.find((i: any) => i.id === id) ??
    month?.outros?.find((i: any) => i.id === id) ??
    month?.gravacoes?.find((i: any) => i.id === id) ??
    month?.roteiros?.find((i: any) => i.id === id) ??
    month?.sistemas?.find((i: any) => i.id === id)
  );
}

/** Splits text on URLs (http(s):// or www.) and renders the matches as clickable links.
 * Textareas can't have inline clickable links while editable, so this only runs in
 * the read-only (not-currently-editing) view of a field. */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
function renderLinkedText(text: string): React.ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part.startsWith("http") ? part : `https://${part}`}
        target="_blank" rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="text-[var(--lz-accent-ink)] underline underline-offset-2 hover:brightness-110">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/** ISO timestamp -> value for <input type="datetime-local">, in the browser's local time. */
function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toScheduledLocalParts(iso: string | null | undefined) {
  const value = toDatetimeLocalValue(iso);
  if (!value) return { date: "", time: "" };
  const [date, time] = value.split("T");
  return { date: date ?? "", time: time ?? "" };
}

function scheduledPartsToIso(date: string, time: string): string | null {
  if (!date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const safeTime = /^\d{2}:\d{2}$/.test(time) ? time : "09:00";
  const d = new Date(`${date}T${safeTime}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeExternalUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).href;
  } catch {
    try {
      return new URL(`https://${trimmed}`).href;
    } catch {
      return null;
    }
  }
}

function extractDriveFileId(url: string): string | null {
  if (!url) return null;
  const patterns = [
    /\/d\/([A-Za-z0-9_-]{10,})/,
    /[?&]id=([A-Za-z0-9_-]{10,})/,
    /\/folders\/([A-Za-z0-9_-]{10,})/,
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return m[1];
  }
  return null;
}

/** Small square thumbnail used for carrossel tiles — same thumbnail source as
 * FilesSection's FileThumb, just sized for a row of tiles instead of a list.
 * Clicking opens the in-app carousel viewer (CarouselLightbox) instead of
 * jumping to Google Drive. */
function CarouselThumb({
  file, onClick, canEdit, selectMode, selected, onToggleSelect, onRemoveAppOnly, onRemoveEverywhere,
  draggable, dragging, onReorderDragStart, onReorderDragOver, onReorderDrop, onReorderDragEnd,
}: {
  file: { id: string; driveFileId: string; name: string; webViewUrl: string };
  onClick: () => void;
  canEdit: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onRemoveAppOnly: () => void;
  onRemoveEverywhere: () => void;
  draggable: boolean;
  dragging: boolean;
  onReorderDragStart: () => void;
  onReorderDragOver: (e: React.DragEvent) => void;
  onReorderDrop: (e: React.DragEvent) => void;
  onReorderDragEnd: () => void;
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
    <div
      className={`group relative w-16 h-16 shrink-0 ${dragging ? "opacity-40" : ""}`}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        onReorderDragStart();
      }}
      onDragOver={(e) => { if (draggable) onReorderDragOver(e); }}
      onDrop={(e) => { if (draggable) onReorderDrop(e); }}
      onDragEnd={onReorderDragEnd}
      title={draggable ? "Arraste para reordenar" : undefined}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); selectMode ? onToggleSelect() : onClick(); }}
        title={file.name}
        className={`w-16 h-16 shrink-0 rounded-md overflow-hidden bg-card border flex items-center justify-center transition-colors ${
          selectMode && selected ? "border-[rgb(var(--lz-brand-rgb))]" : "border-foreground/8"} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`}
      >
        {url ? (
          <img src={url} alt={file.name} className="w-full h-full object-cover pointer-events-none" loading="lazy" draggable={false} />
        ) : isLoading ? (
          <Loader2 size={12} className="animate-spin text-foreground/30" />
        ) : (
          <ImageIcon size={14} className="text-foreground/20" />
        )}
      </button>
      {selectMode ? (
        <div
          className="absolute top-0.5 left-0.5 rounded p-0.5 pointer-events-none"
          style={{ backgroundColor: selected ? "rgb(var(--lz-brand-rgb))" : "rgba(0,0,0,0.6)" }}
        >
          {selected ? <CheckSquare size={11} className="text-black" /> : <Square size={11} className="text-foreground" />}
        </div>
      ) : (
        <FileActionsMenu
          canEdit={canEdit}
          downloading={downloading}
          onDownload={handleDownload}
          onRemoveAppOnly={onRemoveAppOnly}
          onRemoveEverywhere={onRemoveEverywhere}
        />
      )}
    </div>
  );
}

function MediaPreview({
  itemId, coverUrl, postFormat, itemType, canEdit,
}: {
  itemId: string; coverUrl: string | null; postFormat: PostFormat | null | undefined; itemType: string; canEdit: boolean;
}) {
  const { data: files = [], isLoading: filesLoading } = useQuery(itemFilesQO(itemId));
  const { upload, busy, error, missingClientId } = useItemFileUpload(itemId, "media");
  const { detachItemFile, deleteItemFileAndDrive, reorderItemFiles } = useApi();
  const fetchDriveToken = useServerFn(getDriveVideoToken);
  const fileRef = useRef<HTMLInputElement>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadingFirst, setDownloadingFirst] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const isCarrossel = itemType === "post" && postFormat === "carrossel";

  // Local optimistic slide order, kept in sync with FilesSection's list via
  // the shared item-files query/mutation — reordering here or there updates
  // the same `sort_order` column, so both views stay in sync.
  const [order, setOrder] = useState<string[]>([]);
  const serverOrderKey = useMemo(() => files.map((f) => f.id).join("|"), [files]);
  useEffect(() => { setOrder(files.map((f) => f.id)); }, [serverOrderKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const filesById = useMemo(() => new Map(files.map((f) => [f.id, f] as const)), [files]);
  const orderedFiles = useMemo(
    () => order.map((id) => filesById.get(id)).filter(Boolean) as typeof files,
    [order, filesById],
  );
  const reorderDragId = useRef<string | null>(null);
  const [reorderDragging, setReorderDragging] = useState<string | null>(null);

  function persistOrder(next: string[]) {
    setOrder(next);
    reorderItemFiles.mutate({ data: { itemId, orderedIds: next } });
  }
  function handleThumbReorderDrop(targetId: string) {
    const sourceId = reorderDragId.current;
    if (!sourceId || sourceId === targetId) return;
    const next = order.slice();
    const from = next.indexOf(sourceId);
    const to = next.indexOf(targetId);
    if (from < 0 || to < 0) return;
    next.splice(from, 1);
    next.splice(to, 0, sourceId);
    persistOrder(next);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!canEdit) return;
    if (reorderDragId.current) return; // internal slide-reorder drag, not a file upload
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (dropped.length === 0) { toast.error("Solte uma imagem ou vídeo."); return; }
    upload(dropped);
  }
  function handleDragOver(e: React.DragEvent) {
    if (!canEdit) return;
    e.preventDefault();
    if (!dragOver) setDragOver(true);
  }
  function handleDragLeave(e: React.DragEvent) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOver(false);
  }
  const dropZoneProps = canEdit ? { onDragOver: handleDragOver, onDragLeave: handleDragLeave, onDrop: handleDrop } : {};
  const dropZoneStyle = dragOver
    ? { outline: "2px dashed rgb(var(--lz-brand-rgb))", outlineOffset: "3px", borderRadius: "10px" }
    : undefined;

  async function handleDownloadAllFiles() {
    setDownloadingAll(true);
    try {
      if (files.length === 1) {
        await downloadDriveFile(fetchDriveToken, files[0].driveFileId, files[0].name);
      } else {
        await downloadDriveFilesAsZip(fetchDriveToken, files, "arquivos.zip");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar imagens.");
    } finally {
      setDownloadingAll(false);
    }
  }
  const isEstatico = itemType === "post" && postFormat === "estatico";
  const first = files[0];
  const fileId = first?.driveFileId ?? null;
  const { data: thumbData, isLoading: thumbLoading } = useQuery(driveThumbnailQO(fileId, !!fileId && !coverUrl && !isCarrossel));
  const thumb = coverUrl ?? thumbData?.dataUrl ?? null;
  const href = first ? normalizeExternalUrl(first.webViewUrl) : null;

  useEffect(() => { if (error) toast.error(error); }, [error]);
  useEffect(() => {
    if (missingClientId) toast.error("Configure a pasta de entregas no Perfil do Cliente antes de fazer upload.");
  }, [missingClientId]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = "";
    upload(selected);
  }

  const inputEl = canEdit ? (
    <input ref={fileRef} type="file" multiple hidden onChange={onPick} accept="image/*,video/*" />
  ) : null;

  if (isCarrossel) {
    async function handleDownloadSelected() {
      const chosen = files.filter((f) => selectedIds.has(f.id));
      if (!chosen.length) return;
      setDownloadingAll(true);
      try {
        if (chosen.length === 1) {
          await downloadDriveFile(fetchDriveToken, chosen[0].driveFileId, chosen[0].name);
        } else {
          await downloadDriveFilesAsZip(fetchDriveToken, chosen, "arquivos.zip");
        }
      } catch (e: any) {
        toast.error(e?.message ?? "Erro ao baixar imagens.");
      } finally {
        setDownloadingAll(false);
      }
    }
    function toggleSelected(id: string) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
      });
    }
    return (
      <div {...dropZoneProps} style={dropZoneStyle}>
        {files.length > 1 && (
          <div className="flex items-center gap-2 mb-1.5">
            {selectMode ? (
              <>
                <button
                  type="button"
                  onClick={handleDownloadSelected}
                  disabled={downloadingAll || selectedIds.size === 0}
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-foreground/70 hover:text-foreground transition disabled:opacity-40"
                >
                  {downloadingAll ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  Baixar selecionadas ({selectedIds.size})
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectMode(false); setSelectedIds(new Set()); }}
                  className="text-[10.5px] text-foreground/40 hover:text-foreground transition"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleDownloadAllFiles}
                  disabled={downloadingAll}
                  className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-foreground/70 hover:text-foreground transition disabled:opacity-40"
                >
                  {downloadingAll ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
                  Baixar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectMode(true)}
                  className="text-[10.5px] text-foreground/40 hover:text-foreground transition"
                >
                  Selecionar
                </button>
              </>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          {orderedFiles.map((f, i) => (
            <CarouselThumb
              key={f.id}
              file={f}
              canEdit={canEdit}
              selectMode={selectMode}
              selected={selectedIds.has(f.id)}
              onToggleSelect={() => toggleSelected(f.id)}
              onClick={() => setLightboxIndex(i)}
              onRemoveAppOnly={() => detachItemFile.mutate({ data: { id: f.id } })}
              onRemoveEverywhere={async () => {
                if (await requestConfirm(`Remover "${f.name}" do Modo Criador e mover pra lixeira do Google Drive?`, { danger: true })) {
                  deleteItemFileAndDrive.mutate({ data: { id: f.id } });
                }
              }}
              draggable={canEdit && !selectMode}
              dragging={reorderDragging === f.id}
              onReorderDragStart={() => {
                reorderDragId.current = f.id;
                setReorderDragging(f.id);
              }}
              onReorderDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "move"; }}
              onReorderDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleThumbReorderDrop(f.id);
              }}
              onReorderDragEnd={() => {
                reorderDragId.current = null;
                setReorderDragging(null);
              }}
            />
          ))}
          {canEdit && !selectMode && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="w-16 h-16 shrink-0 rounded-md border border-dashed border-foreground/15 bg-card hover:border-[rgb(var(--lz-brand-rgb))] flex items-center justify-center transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={14} className="animate-spin text-foreground/40" /> : <Plus size={16} className="text-foreground/40" />}
            </button>
          )}
          {inputEl}
        </div>
        {lightboxIndex !== null && (
          <CarouselLightbox files={orderedFiles} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
        )}
      </div>
    );
  }

  if (!filesLoading && !first && !coverUrl) {
    return (
      <div {...dropZoneProps} style={dropZoneStyle} className="inline-block">
        <button
          type="button"
          onClick={() => canEdit && fileRef.current?.click()}
          disabled={busy || !canEdit}
          className="group w-24 h-24 rounded-[10px] border border-dashed border-foreground/15 bg-card hover:border-[rgb(var(--lz-brand-rgb))] hover:bg-[#171717] transition-colors flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:cursor-default"
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin text-foreground/40" />
          ) : dragOver ? (
            <Upload size={16} className="text-[var(--lz-accent-ink)]" />
          ) : (
            <Upload size={16} className="text-foreground/30 group-hover:text-[var(--lz-accent-ink)] transition-colors" />
          )}
        </button>
        {inputEl}
      </div>
    );
  }

  const opensLightbox = isEstatico && files.length > 0;
  const thumbContent = (
    <>
      {thumb ? (
        <img src={thumb} alt={first?.name ?? "Preview"} className="w-full h-full object-cover" loading="lazy" />
      ) : thumbLoading || filesLoading ? (
        <div className="w-full h-full flex items-center justify-center">
          <Loader2 size={14} className="animate-spin text-foreground/30" />
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-foreground/40">
          {opensLightbox ? <Expand size={16} /> : <ExternalLink size={16} />}
        </div>
      )}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/55 transition-colors flex items-center justify-center">
        {opensLightbox ? (
          <Expand size={18} className="text-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        ) : (
          <ExternalLink size={18} className="text-foreground opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
        )}
      </div>
    </>
  );

  async function handleDownloadFirst() {
    if (!first) return;
    setDownloadingFirst(true);
    try {
      await downloadDriveFile(fetchDriveToken, first.driveFileId, first.name);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao baixar arquivo.");
    } finally {
      setDownloadingFirst(false);
    }
  }

  return (
    <div {...dropZoneProps} style={dropZoneStyle} className="inline-block">
      {files.length > 1 && (
        <div className="flex items-center gap-2 mb-1.5">
          <button
            type="button"
            onClick={handleDownloadAllFiles}
            disabled={downloadingAll}
            className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-foreground/70 hover:text-foreground transition disabled:opacity-40"
          >
            {downloadingAll ? <Loader2 size={11} className="animate-spin" /> : <Download size={11} />}
            Baixar todas
          </button>
        </div>
      )}
      <div className="group relative w-24 h-24">
        {opensLightbox ? (
          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="block w-24 h-24 rounded-[10px] overflow-hidden bg-card border border-foreground/8"
            title={first?.name}
          >
            {thumbContent}
          </button>
        ) : (
          <a
            href={href ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => { if (!href) e.preventDefault(); }}
            className="block w-24 h-24 rounded-[10px] overflow-hidden bg-card border border-foreground/8"
            title={first?.name}
          >
            {thumbContent}
          </a>
        )}
        {first && (
          <FileActionsMenu
            canEdit={canEdit}
            downloading={downloadingFirst}
            onDownload={handleDownloadFirst}
            onRemoveAppOnly={() => detachItemFile.mutate({ data: { id: first.id } })}
            onRemoveEverywhere={async () => {
              if (await requestConfirm(`Remover "${first.name}" do Modo Criador e mover pra lixeira do Google Drive?`, { danger: true })) {
                deleteItemFileAndDrive.mutate({ data: { id: first.id } });
              }
            }}
          />
        )}
        {dragOver && canEdit && (
          <div className="absolute inset-0 rounded-[10px] bg-black/60 flex items-center justify-center pointer-events-none">
            <Upload size={18} className="text-[var(--lz-accent-ink)]" />
          </div>
        )}
      </div>
      {inputEl}
      {opensLightbox && lightboxIndex !== null && (
        <CarouselLightbox files={files} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} />
      )}
    </div>
  );
}

export function DetailPanel() {
  const { selectedItemId, itemNavList, openItem, selectedClientId, selectedMonthKey, flash } = useUI();
  const { data: profiles = [] } = useQuery(profilesQO());
  const { data: clients = [] } = useQuery(clientsQO());
  const client = clients.find((c) => c.id === selectedClientId);
  const isAvulso = client?.category === "Avulsos";
  // Avulso não tem seletor de mês (só existe um mês de verdade pra ele) —
  // o selectedMonthKey global é o mês "atual" do calendário, que não bate
  // com o mês real do avulso assim que o mês vira. Sem isso, o item existe
  // mas a busca por ele num mês vazio nunca encontra nada e o clique não
  // abre o painel — mesma causa raiz do bug já corrigido em ClientView.
  const { data: monthKeys = [] } = useQuery({ ...monthKeysQO(selectedClientId ?? ""), enabled: !!selectedClientId && isAvulso });
  const effectiveMonthKey = isAvulso && monthKeys.length > 0 ? monthKeys[0] : selectedMonthKey;
  const { data: month } = useQuery({ ...monthQO(selectedClientId ?? "", effectiveMonthKey), enabled: !!selectedClientId && !!selectedItemId });
  const me = useMe().data;
  const { setItemStatus, updateItem, setItemEditor, setItemReelType, setItemPostFormat, addAssignee, removeAssignee, addCommentWithMentions, addAudioComment, updateComment, rateItem, publishToInstagram, setInstagramAutoPublish, setItemCampaign } = useApi();
  const { data: appSettings } = useQuery(appSettingsQO());
  const { data: campaigns = [] } = useQuery({ ...campaignsQO(selectedClientId ?? ""), enabled: !!selectedClientId });

  const item = useMemo(() => (selectedItemId && month ? findItem(month, selectedItemId) : undefined), [month, selectedItemId]);
  const navIndex = itemNavList && selectedItemId ? itemNavList.indexOf(selectedItemId) : -1;
  const prevItemId = navIndex > 0 ? itemNavList![navIndex - 1] : null;
  const nextItemId = navIndex >= 0 && itemNavList && navIndex < itemNavList.length - 1 ? itemNavList[navIndex + 1] : null;
  const isAdmin = me?.role === "master" || me?.role === "setor";
  const canApproveFinalize = hasSetorPermission(me, "approve_finalize");
  const canPublishInstagram = hasSetorPermission(me, "instagram_publish");

  const getInstagramStatus = useServerFn(getInstagramConnectionStatus);
  const instagramStatus = useQuery({
    queryKey: ["instagram-connection-status", selectedClientId],
    queryFn: () => getInstagramStatus({ data: { clientId: selectedClientId! } }),
    enabled: !!selectedClientId,
  });
  const clientInstagramConnected = !!instagramStatus.data?.connected;

  useEffect(() => {
    if (!selectedItemId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { openItem(null); return; }
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (typing) return;
      if (e.key === "ArrowLeft" && prevItemId) openItem(prevItemId, itemNavList);
      else if (e.key === "ArrowRight" && nextItemId) openItem(nextItemId, itemNavList);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [selectedItemId, openItem, prevItemId, nextItemId, itemNavList]);

  const [title, setTitle] = useState("");
  const [copy, setCopy] = useState("");
  const [caption, setCaption] = useState("");
  const [editingCopy, setEditingCopy] = useState(false);
  const copyTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = copyTextareaRef.current;
    if (!editingCopy || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editingCopy, copy]);
  const [editingCaption, setEditingCaption] = useState(false);
  const captionTextareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = captionTextareaRef.current;
    if (!editingCaption || !el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [editingCaption, caption]);
  const [location, setLocation] = useState("");
  const [quantity, setQuantity] = useState("");
  const [comment, setComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [qualityFor, setQualityFor] = useState<Status | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [blockedReason, setBlockedReason] = useState("");
  const [assignOpen, setAssignOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [newCheck, setNewCheck] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const { updateChecklist } = useApi();

  useEffect(() => {
    if (item) {
      setTitle(item.title); setCopy(item.copy);
      setLocation(item.location ?? "");
      setQuantity(typeof item.activityQuantity === "number" ? String(item.activityQuantity) : "");
      setCaption(item.caption ?? "");
      setDueDate(item.dueDate ?? "");
      const scheduled = toScheduledLocalParts(item.scheduledAt);
      setScheduledDate(scheduled.date);
      setScheduledTime(scheduled.time);
      setBlockedReason(item.blockedReason ?? "");
    }
  }, [item?.id]); // eslint-disable-line

  useEffect(() => {
    if (!item) return;
    setDueDate(item.dueDate ?? "");
    const scheduled = toScheduledLocalParts(item.scheduledAt);
    setScheduledDate(scheduled.date);
    setScheduledTime(scheduled.time);
  }, [item?.id, item?.dueDate, item?.scheduledAt]);

  useEffect(() => {
    if (!statusOpen) return;
    const h = (e: MouseEvent) => { if (!statusRef.current?.contains(e.target as Node)) setStatusOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [statusOpen]);

  if (!selectedItemId) return null;
  if (!item) return null;

  const assignees = item.assigneeIds.map((id) => profiles.find((p) => p.id === id)).filter(Boolean) as Profile[];
  const editor = item.editorId ? profiles.find((p) => p.id === item.editorId) : null;
  const canSetEditor = isAdmin || !!me?.membersCanSetEditorFormat;
  const canEditFiles = isAdmin || (me ? item.assigneeIds.includes(me.id) : false);
  const activeProfiles = profiles.filter((p) => p.active);
  const isActivity = isActivityType(item.type);
  const isOverdue =
    !isActivity && !!item.dueDate && item.status !== "PRONTO_PARA_PUBLICAR" && item.status !== "FINALIZADO" &&
    new Date(item.dueDate + "T23:59:59").getTime() < Date.now();

  const checklist = item.checklist ?? [];
  const checklistDone = checklist.filter((c) => c.done).length;
  const reworkCount = item.reworkCount ?? 0;

  const itemId = item.id;
  const stableItem = item;
  function saveChecklist(next: typeof checklist) {
    updateChecklist.mutate({ data: { itemId, checklist: next } });
  }

  function saveScheduledAt(nextDate = scheduledDate, nextTime = scheduledTime) {
    const current = toScheduledLocalParts(stableItem.scheduledAt);
    const normalizedTime = nextDate ? (nextTime || current.time || "09:00") : "";
    if (nextDate && !nextTime) setScheduledTime(normalizedTime);

    if (nextDate === current.date && normalizedTime === current.time) return;

    const nextIso = scheduledPartsToIso(nextDate, normalizedTime);
    updateItem.mutate({ data: { id: stableItem.id, patch: { scheduled_at: nextIso } } }, {
      onError: (e: any) => {
        toast.error(e?.message ?? "Erro ao salvar data de publicação.");
        setScheduledDate(current.date);
        setScheduledTime(current.time);
      },
    });
  }

  const showQuality = item.status === "PRONTO_PARA_PUBLICAR" || item.qualityRating != null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-6 bg-black/75 backdrop-blur-[8px] lz-overlay-in"
      onMouseDown={(e) => { if (e.target === e.currentTarget) openItem(null); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full md:w-[760px] md:max-w-full bg-card border border-foreground/8 shadow-2xl flex flex-col overflow-hidden
          max-h-[92vh] md:max-h-[90vh]
          rounded-t-2xl md:rounded-2xl
          lz-sheet-in md:lz-modal-in"
      >
        {/* Mobile handle */}
        <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-foreground/20" />
        </div>

        {/* Header */}
        <div className="px-5 md:px-6 pt-4 md:pt-5 pb-4 border-b border-foreground/8 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">
                <span className="text-[var(--lz-accent-ink)]">
                  {CONTENT_TYPE_LABEL[item.type] ?? "Item"} {String(item.idx).padStart(2, "0")}
                </span>
                {client && <span className="ml-1.5">· {client.name}</span>}
                {reworkCount > 0 && (
                  <span
                    className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded align-middle"
                    style={{ backgroundColor: "rgba(255,140,66,0.15)", color: "#FF8C42" }}
                  >
                    <RotateCcw size={10} /> Retrabalho ×{reworkCount}
                  </span>
                )}
              </div>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => { if (title.trim() && title !== item.title) updateItem.mutate({ data: { id: item.id, patch: { title: title.trim() } } }); }}
                placeholder="Clique para inserir um título"
                className="mt-1.5 w-full bg-transparent text-[22px] font-bold text-foreground outline-none placeholder:text-foreground/30 placeholder:italic placeholder:font-normal border-b border-transparent focus:border-[rgb(var(--lz-brand-rgb))] transition-colors pb-0.5"
              />
            </div>
            {itemNavList && (
              <div className="shrink-0 flex items-center gap-1">
                <button
                  onClick={() => prevItemId && openItem(prevItemId, itemNavList)}
                  disabled={!prevItemId}
                  aria-label="Item anterior"
                  title="Item anterior"
                  className="text-foreground/50 hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-foreground/50"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => nextItemId && openItem(nextItemId, itemNavList)}
                  disabled={!nextItemId}
                  aria-label="Próximo item"
                  title="Próximo item"
                  className="text-foreground/50 hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-foreground/50"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
            <button
              onClick={() => openItem(null)}
              aria-label="Fechar"
              className="shrink-0 text-foreground/50 hover:text-foreground p-1.5 rounded-md hover:bg-foreground/5 transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body — two columns on desktop, stacked on mobile */}
        <div className="flex-1 min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[55fr_45fr]">
          {/* LEFT COLUMN */}
          <div className="md:overflow-y-auto md:border-r md:border-foreground/6">
            {/* Drive preview */}
            <ModalSection label="Mídia">
              <MediaPreview
                itemId={item.id}
                coverUrl={item.coverUrl ?? null}
                postFormat={item.postFormat}
                itemType={item.type}
                canEdit={canEditFiles}
              />
              {(item.type === "reel" || item.type === "story") && canEditFiles && (
                <button
                  type="button"
                  onClick={() => setCoverOpen(true)}
                  className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-foreground/80 hover:text-[#0D0D0D] bg-foreground/[0.04] hover:bg-[rgb(var(--lz-brand-rgb))] border border-foreground/10 hover:border-[rgb(var(--lz-brand-rgb))] transition-colors"
                >
                  <ImagePlus size={14} />
                  {item.coverPath ? "Trocar capa do Reel" : "Definir capa do Reel"}
                </button>
              )}
            </ModalSection>

            {/* Briefing (era Copy) — vira "Observações" pra atividades, que não têm briefing de conteúdo */}
            <ModalSection label={isActivity ? "Observações" : "Briefing"}>
              {editingCopy ? (
                <textarea
                  ref={copyTextareaRef}
                  autoFocus
                  value={copy}
                  onChange={(e) => setCopy(e.target.value)}
                  onBlur={() => {
                    setEditingCopy(false);
                    if (copy !== item.copy) updateItem.mutate({ data: { id: item.id, patch: { copy } } });
                  }}
                  placeholder={isActivity ? "Observações sobre essa atividade..." : "Descreva o briefing do conteúdo..."}
                  className="w-full min-h-[110px] bg-card border border-transparent rounded-lg px-3 py-2.5 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30 resize-none overflow-hidden transition-colors"
                />
              ) : (
                <div
                  onClick={() => setEditingCopy(true)}
                  className="w-full min-h-[110px] bg-card border border-transparent rounded-lg px-3 py-2.5 text-sm text-foreground whitespace-pre-wrap break-words cursor-text hover:border-foreground/10 transition-colors"
                >
                  {copy ? renderLinkedText(copy) : (
                    <span className="text-foreground/30">{isActivity ? "Observações sobre essa atividade..." : "Descreva o briefing do conteúdo..."}</span>
                  )}
                </div>
              )}
              {!isActivity && (
                <BriefingUploads itemId={item.id} clientId={selectedClientId} canEdit={canEditFiles} />
              )}
            </ModalSection>

            {/* Legenda — só faz sentido pra post/reel, que são publicados no Instagram */}
            {!isActivity && (
              <ModalSection label="Legenda">
                {editingCaption ? (
                  <div className="relative">
                    <textarea
                      ref={captionTextareaRef}
                      autoFocus
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      onBlur={() => {
                        setEditingCaption(false);
                        if (caption !== (item.caption ?? "")) updateItem.mutate({ data: { id: item.id, patch: { caption } } });
                      }}
                      placeholder="Digite a legenda que será publicada..."
                      className="w-full min-h-[110px] bg-card border border-transparent rounded-lg px-3 py-2.5 pb-6 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30 resize-none transition-colors"
                    />
                    <div className="absolute bottom-2 right-3 text-[10px] text-foreground/40 pointer-events-none">
                      {caption.length} caracteres
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingCaption(true)}
                    className="w-full min-h-[110px] bg-card border border-transparent rounded-lg px-3 py-2.5 text-sm text-foreground whitespace-pre-wrap break-words cursor-text hover:border-foreground/10 transition-colors"
                  >
                    {caption ? renderLinkedText(caption) : (
                      <span className="text-foreground/30">Digite a legenda que será publicada...</span>
                    )}
                  </div>
                )}
              </ModalSection>
            )}

            {/* Comentários + Timeline */}
            <ModalSection label="Comentários" last>
              <div className="space-y-2.5 mb-3">
                {item.comments.length === 0 && <p className="text-xs text-foreground/40">Sem comentários ainda.</p>}
                {item.comments.map((c) => {
                  const author = profiles.find((p) => p.id === c.authorId);
                  if (c.system) return (
                    <div key={c.id} className="rounded-md px-3 py-2 text-[11px] italic"
                      style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.06)", borderLeft: "2px solid rgb(var(--lz-brand-rgb))", color: "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
                      <span>{c.text}</span>
                      <span className="text-foreground/40 ml-2 not-italic">{relTime(c.createdAt)}</span>
                    </div>
                  );
                  const isOwn = c.authorId === me?.id;
                  const isEditing = editingCommentId === c.id;
                  return (
                    <div key={c.id} className="flex gap-2.5 group">
                      <Avatar profile={author ?? undefined} size={26} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-foreground">{author?.name ?? "Alguém"}</span>
                          <span className="text-[10px] text-foreground/40">{relTime(c.createdAt)}</span>
                          {c.editedAt && <span className="text-[10px] text-foreground/30 italic">(editado)</span>}
                          {isOwn && !isEditing && !c.audioUrl && (
                            <button
                              onClick={() => { setEditingCommentId(c.id); setEditCommentText(c.text); }}
                              className="text-foreground/30 hover:text-foreground opacity-0 group-hover:opacity-100 transition"
                              title="Editar comentário"
                            >
                              <Pencil size={11} />
                            </button>
                          )}
                        </div>
                        {c.audioUrl ? (
                          <audio controls preload="none" src={c.audioUrl} className="mt-1 h-9 max-w-[260px]" />
                        ) : isEditing ? (
                          <div className="mt-1">
                            <textarea
                              value={editCommentText}
                              onChange={(e) => setEditCommentText(e.target.value)}
                              onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                                  e.preventDefault();
                                  if (editCommentText.trim()) {
                                    updateComment.mutate({ data: { commentId: c.id, text: editCommentText.trim() } });
                                    setEditingCommentId(null);
                                  }
                                } else if (e.key === "Escape") {
                                  setEditingCommentId(null);
                                }
                              }}
                              rows={2}
                              autoFocus
                              className="w-full text-xs bg-foreground/[0.06] border border-foreground/15 rounded-md px-2 py-1.5 text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
                            />
                            <div className="flex gap-2 mt-1">
                              <button
                                disabled={!editCommentText.trim()}
                                onClick={() => {
                                  updateComment.mutate({ data: { commentId: c.id, text: editCommentText.trim() } });
                                  setEditingCommentId(null);
                                }}
                                className="text-[10px] font-bold text-[var(--lz-accent-ink)] disabled:opacity-40 hover:underline"
                              >
                                Salvar
                              </button>
                              <button
                                onClick={() => setEditingCommentId(null)}
                                className="text-[10px] font-bold text-foreground/50 hover:text-foreground hover:underline"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-foreground/80 whitespace-pre-wrap mt-0.5">{renderMentions(c.text)}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <MentionInput value={comment}
                    onChange={(v, ids) => { setComment(v); setCommentMentions(ids); }}
                    onSubmit={() => {
                      if (!comment.trim()) return;
                      addCommentWithMentions.mutate({ data: { itemId: item.id, text: comment.trim(), mentionedUserIds: commentMentions } });
                      setComment(""); setCommentMentions([]);
                    }}
                    placeholder="Novo comentário... use @ para mencionar"
                    rows={2} />
                  <div className="text-[10px] text-foreground/30 mt-1">Enter envia · Shift+Enter quebra linha · @ menciona</div>
                </div>
                <AudioCommentRecorder
                  sending={addAudioComment.isPending}
                  onSend={(base64, durationSeconds, mimeType) => {
                    addAudioComment.mutate({ data: { itemId: item.id, audioBase64: base64, durationSeconds, mimeType, mentionedUserIds: commentMentions } });
                  }}
                />
                <button disabled={!comment.trim()}
                  onClick={() => {
                    addCommentWithMentions.mutate({ data: { itemId: item.id, text: comment.trim(), mentionedUserIds: commentMentions } });
                    setComment(""); setCommentMentions([]);
                  }}
                  className="px-3 py-2 rounded-md text-sm font-bold disabled:opacity-30 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
                  <Send size={14} />
                </button>
              </div>
              <div className="mt-5">
                <ItemTimeline itemId={item.id} />
              </div>
            </ModalSection>
          </div>

          {/* RIGHT COLUMN */}
          <div className="md:overflow-y-auto">
            {/* Status */}
            <ModalSection label="Status">
              <div className="relative" ref={statusRef}>
                <button
                  onClick={() => setStatusOpen((o) => !o)}
                  className="w-full flex items-center justify-between gap-3 rounded-md px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all"
                  style={{
                    backgroundColor: STATUS_META[item.status].bg,
                    color: STATUS_META[item.status].color,
                    border: `1px solid ${STATUS_META[item.status].color}`,
                  }}>
                  <span className="flex items-center gap-3">
                    {(() => {
                      const I = STATUS_ICONS[item.status];
                      return <I size={16} />;
                    })()}
                    {statusLabel(item.status, isAvulso)}
                  </span>
                  <ChevronDown size={16} className={`transition-transform ${statusOpen ? "rotate-180" : ""}`} />
                </button>
                {statusOpen && (
                  <div className="absolute z-50 left-0 right-0 mt-1 rounded-md bg-card border border-foreground/10 shadow-xl py-1 max-h-[60vh] overflow-y-auto">
                    {statusOptionsFor(item.type)
                      .filter((s) => (s === "PRONTO_PARA_PUBLICAR" || s === "FINALIZADO" ? canApproveFinalize : true))
                      .map((s) => {
                      const m = STATUS_META[s]; const I = STATUS_ICONS[s];
                      const active = item.status === s;
                      return (
                        <button key={s}
                          onClick={() => {
                            if (s === "PRONTO_PARA_PUBLICAR" && appSettings?.requireRatingOnFinalize &&
                                item.status !== "PRONTO_PARA_PUBLICAR" && item.qualityRating == null) {
                              setQualityFor("PRONTO_PARA_PUBLICAR");
                              setStatusOpen(false);
                              return;
                            }
                            setItemStatus.mutate({ data: { id: item.id, status: s } });
                            setStatusOpen(false);
                            flash(item.id);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold uppercase tracking-wide transition-all"
                          style={{
                            backgroundColor: active ? m.bg : "transparent",
                            color: active ? m.color : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                          }}>
                          <I size={16} /> {statusLabel(s, isAvulso)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </ModalSection>

            {/* Campanha — só aparece quando o cliente já tem alguma criada,
             * já que a maioria dos clientes nunca vai usar isso. */}
            {isAdmin && campaigns.length > 0 && (
              <ModalSection label="Campanha">
                <select
                  value={item.campaignId ?? ""}
                  onChange={(e) => {
                    const campaignId = e.target.value || null;
                    setItemCampaign.mutate({ data: { itemId: item.id, campaignId, campaignInternal: campaignId ? (item.campaignInternal ?? false) : false } });
                  }}
                  className="w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
                >
                  <option value="">Nenhuma</option>
                  {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {item.campaignId && (
                  <label className="flex items-center gap-2 text-xs text-foreground/60 mt-2">
                    <input type="checkbox" checked={item.campaignInternal ?? false}
                      onChange={(e) => setItemCampaign.mutate({ data: { itemId: item.id, campaignId: item.campaignId!, campaignInternal: e.target.checked } })} />
                    Interno — não aparece em Posts/Reels/Preview de Feed
                  </label>
                )}
              </ModalSection>
            )}

        {/* Responsáveis */}
        <ModalSection label="Responsáveis">
          <div className="flex items-center gap-2 flex-wrap">
            {assignees.map((p) => (
              <div key={p.id} className="flex items-center gap-1.5 bg-foreground/5 rounded-full pl-1 pr-2 py-1">
                <Avatar profile={p} size={22} />
                <span className="text-xs text-foreground/80">{p.name}</span>
                <button onClick={() => removeAssignee.mutate({ data: { itemId: item.id, userId: p.id } })}
                  className="text-foreground/40 hover:text-red-400 ml-0.5"><X size={12} /></button>
              </div>
            ))}
            <div className="relative">
              <button onClick={() => setAssignOpen((o) => !o)}
                className="h-8 w-8 rounded-full border border-dashed border-foreground/20 text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:border-[rgb(var(--lz-brand-rgb))] flex items-center justify-center transition-colors">
                <Plus size={14} />
              </button>
              {assignOpen && (
                <div className="absolute z-[60] mt-1 left-0 min-w-[200px] rounded-md bg-card border border-foreground/10 shadow-xl py-1 max-h-72 overflow-y-auto">
                  {profiles.map((p) => {
                    const has = item.assigneeIds.includes(p.id);
                    return (
                      <button key={p.id}
                        onClick={() => {
                          if (has) removeAssignee.mutate({ data: { itemId: item.id, userId: p.id } });
                          else addAssignee.mutate({ data: { itemId: item.id, userId: p.id } });
                          setAssignOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-foreground/5 disabled:opacity-30 disabled:cursor-not-allowed text-left">
                        <Avatar profile={p} size={22} />
                        <span className="text-foreground/80 flex-1">{p.name}</span>
                        {has && <Check size={13} className="text-[var(--lz-accent-ink)]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ModalSection>

        {/* Editor (Posts, Reels e Stories) */}
        {(item.type === "post" || item.type === "reel" || item.type === "story") && (
          <ModalSection label="Editor">
            <div className="relative">
              <button
                disabled={!canSetEditor}
                onClick={() => setEditorOpen((o) => !o)}
                className="w-full flex items-center justify-between gap-2 rounded-md bg-card border border-foreground/8 px-3 py-2.5 text-sm text-foreground hover:border-[rgb(var(--lz-brand-rgb))] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {editor ? (
                    <>
                      <Avatar profile={editor} size={22} />
                      <span className="truncate">{editor.name}</span>
                    </>
                  ) : (
                    <span className="text-foreground/40">Selecionar editor…</span>
                  )}
                </span>
                <ChevronDown size={14} className="text-foreground/40 shrink-0" />
              </button>
              {editorOpen && (
                <div className="absolute z-[60] mt-1 left-0 right-0 rounded-md bg-card border border-foreground/10 shadow-xl py-1 max-h-72 overflow-y-auto">
                  {editor && (
                    <button
                      onClick={() => {
                        setItemEditor.mutate({ data: { itemId: item.id, editorId: null } });
                        setEditorOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-foreground/5 text-left text-red-400"
                    >
                      <X size={13} /> Remover editor
                    </button>
                  )}
                  {activeProfiles.map((p) => {
                    const sel = item.editorId === p.id;
                    return (
                      <button key={p.id}
                        onClick={() => {
                          setItemEditor.mutate({ data: { itemId: item.id, editorId: p.id } });
                          setEditorOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-foreground/5 text-left"
                      >
                        <Avatar profile={p} size={22} />
                        <span className="text-foreground/80 flex-1">{p.name}</span>
                        {sel && <Check size={13} className="text-[var(--lz-accent-ink)]" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {!canSetEditor && (
              <p className="text-[10px] text-foreground/40 mt-1.5">Apenas administradores podem definir o editor.</p>
            )}
          </ModalSection>
        )}

        {/* Tipo de vídeo (Reels) */}
        {item.type === "reel" && (
          <ModalSection label="Tipo de vídeo">
            <div className="flex items-center gap-2 flex-wrap">
              {REEL_TYPES.map((rt) => {
                const active = item.reelType === rt;
                return (
                  <button key={rt}
                    disabled={!canSetEditor}
                    onClick={() => setItemReelType.mutate({
                      data: { itemId: item.id, reelType: active ? null : rt },
                    })}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-[1.05] hover:brightness-110 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                      color: active ? "#0D0D0D" : "#FFFFFF",
                      fontWeight: active ? 700 : 500,
                      border: active ? "1px solid rgb(var(--lz-brand-rgb))" : "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = "rgba(var(--lz-brand-light-rgb),0.15)";
                        e.currentTarget.style.borderColor = "rgba(var(--lz-brand-light-rgb),0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
                        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
                      }
                    }}>
                    {REEL_TYPE_LABEL[rt as ReelType]}
                  </button>
                );
              })}
            </div>
            {!canSetEditor && (
              <p className="text-[10px] text-foreground/40 mt-1.5">Apenas administradores podem definir o formato.</p>
            )}
          </ModalSection>
        )}

        {/* Formato do post (Posts) */}
        {item.type === "post" && !(me?.disabledFeatures ?? []).includes("formats") && (
          <ModalSection label="Formato">
            <div className="flex items-center gap-2 flex-wrap">
              {POST_FORMATS.map((pf) => {
                const active = item.postFormat === pf;
                return (
                  <button key={pf}
                    disabled={!canSetEditor}
                    onClick={() => setItemPostFormat.mutate({
                      data: { itemId: item.id, postFormat: active ? null : pf },
                    })}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 hover:scale-[1.05] hover:brightness-110 disabled:opacity-40 disabled:hover:scale-100 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: active ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 8%, transparent)",
                      color: active ? "#0D0D0D" : "#FFFFFF",
                      fontWeight: active ? 700 : 500,
                      border: active ? "1px solid rgb(var(--lz-brand-rgb))" : "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)",
                    }}
                    onMouseEnter={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = "rgba(var(--lz-brand-light-rgb),0.15)";
                        e.currentTarget.style.borderColor = "rgba(var(--lz-brand-light-rgb),0.4)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!active) {
                        e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
                        e.currentTarget.style.borderColor = "color-mix(in srgb, var(--foreground) 8%, transparent)";
                      }
                    }}>
                    {POST_FORMAT_LABEL[pf as PostFormat]}
                  </button>
                );
              })}
            </div>
            {!canSetEditor && (
              <p className="text-[10px] text-foreground/40 mt-1.5">Apenas administradores podem definir o formato.</p>
            )}
          </ModalSection>
        )}

        {/* Publicar no Instagram (Posts, admin com permissão, só quando pronto pra publicar) */}
        {item.type === "post" && canPublishInstagram && item.status === "PRONTO_PARA_PUBLICAR" && (
          <ModalSection label="Publicar">
            {clientInstagramConnected ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={async () => {
                      if (!(await requestConfirm('Publicar esse post no Instagram do cliente agora? Isso é uma ação real e pública.'))) return;
                      publishToInstagram.mutate({ data: { itemId: item.id } }, {
                        onSuccess: () => toast.success("Publicado no Instagram!"),
                        onError: (e: any) => toast.error(e?.message ?? "Falha ao publicar no Instagram"),
                      });
                    }}
                    disabled={publishToInstagram.isPending}
                    className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
                  >
                    {publishToInstagram.isPending ? <Loader2 size={14} className="animate-spin" /> : <Instagram size={14} />}
                    Publicar no Instagram agora
                  </button>
                  {item.igAutoPublish ? (
                    <button
                      onClick={() => {
                        setInstagramAutoPublish.mutate({ data: { itemId: item.id, enabled: false } }, {
                          onSuccess: () => toast.success("Publicação programada cancelada."),
                          onError: (e: any) => toast.error(e?.message ?? "Falha ao cancelar programação"),
                        });
                      }}
                      disabled={setInstagramAutoPublish.isPending}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold border border-foreground/8 text-foreground/70 hover:text-foreground disabled:opacity-50"
                    >
                      <Clock size={14} />
                      Cancelar programação
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setInstagramAutoPublish.mutate({ data: { itemId: item.id, enabled: true } }, {
                          onSuccess: () => toast.success("Publicação programada!"),
                          onError: (e: any) => toast.error(e?.message ?? "Defina data e horário de publicação futuros antes de programar."),
                        });
                      }}
                      disabled={setInstagramAutoPublish.isPending || !item.scheduledAt}
                      title={!item.scheduledAt ? "Defina uma data e horário em Data de publicação primeiro" : undefined}
                      className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold border border-foreground/8 text-foreground/70 hover:text-foreground disabled:opacity-50"
                    >
                      <Clock size={14} />
                      Programar publicação
                    </button>
                  )}
                </div>
                {item.igAutoPublish && item.scheduledAt && (
                  <p className="text-[11px] mt-2" style={{ color: "var(--lz-accent-ink)" }}>
                    Programado pra publicar sozinho em {new Date(item.scheduledAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.
                  </p>
                )}
                <p className="text-[11px] text-foreground/40 mt-2">
                  Publica direto na conta do cliente e marca o item como Finalizado. "Programar" usa a data e horário
                  definidos em "Data de publicação" abaixo.
                </p>
              </>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button disabled
                  title="Esse cliente ainda não conectou o Instagram — conecte na Ficha do Cliente"
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold opacity-40 cursor-not-allowed border border-foreground/8 text-foreground/60">
                  <Instagram size={14} />
                  Publicar no Instagram agora
                </button>
                <button disabled
                  title="Esse cliente ainda não conectou o Instagram — conecte na Ficha do Cliente"
                  className="inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-bold opacity-40 cursor-not-allowed border border-foreground/8 text-foreground/60">
                  <Clock size={14} />
                  Programar publicação
                </button>
              </div>
            )}
          </ModalSection>
        )}

        {/* Prazo — pra atividades vira a data em que a atividade aconteceu/acontece, não um deadline */}
        <ModalSection label={isActivity ? (ACTIVITY_DATE_LABEL[item.type] ?? "Data") : (isAvulso ? "Prazo de entrega" : "Prazo")}>
          <div className="flex items-center gap-2">
            <Calendar size={15} style={{ color: isOverdue ? "#FF6B6B" : "var(--lz-accent-ink)" }} />
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              onBlur={() => {
                const v = dueDate || null;
                const prev = item.dueDate ?? null;
                if (v !== prev)
                  updateItem.mutate({ data: { id: item.id, patch: { due_date: v } } }, {
                    onError: (e: any) => { toast.error(e?.message ?? "Erro ao salvar data."); setDueDate(prev ?? ""); },
                  });
              }}
              className="flex-1 bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]"
            />
            {dueDate && (
              <button
                type="button"
                onClick={() => {
                  const prev = item.dueDate ?? null;
                  setDueDate("");
                  updateItem.mutate({ data: { id: item.id, patch: { due_date: null } } }, {
                    onError: (e: any) => { toast.error(e?.message ?? "Erro ao salvar data."); setDueDate(prev ?? ""); },
                  });
                }}
                className="text-[11px] text-foreground/40 hover:text-foreground px-2 py-1 rounded hover:bg-foreground/5"
              >Limpar</button>
            )}
          </div>
          {isOverdue && (
            <p className="mt-1.5 text-[10px] font-semibold" style={{ color: "#FF6B6B" }}>Prazo vencido.</p>
          )}
          {item.startedAt && (
            <p className="text-[10px] text-foreground/40 mt-1.5">
              Iniciado em {new Date(item.startedAt).toLocaleDateString("pt-BR")}
              {item.finishedAt && ` · ${isAvulso ? "Entregue" : "Publicado"} em ${new Date(item.finishedAt).toLocaleDateString("pt-BR")}`}
            </p>
          )}
        </ModalSection>

        {/* Data de publicação — só existe pra post/reel de clientes não-avulsos, que de fato são publicados */}
        {!isActivity && !isAvulso && (
          <ModalSection label="Data de publicação">
            <div className="flex items-center gap-2">
              <Calendar size={15} style={{ color: "var(--lz-accent-ink)" }} />
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                onBlur={(e) => saveScheduledAt(e.currentTarget.value, scheduledTime)}
                className="min-w-0 flex-1 bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]"
              />
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                onBlur={(e) => saveScheduledAt(scheduledDate, e.currentTarget.value)}
                disabled={!scheduledDate}
                className="flex-1 bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))]"
              />
              {scheduledDate && (
                <button
                  type="button"
                  onClick={() => {
                    const prev = toScheduledLocalParts(item.scheduledAt);
                    setScheduledDate("");
                    setScheduledTime("");
                    updateItem.mutate({ data: { id: item.id, patch: { scheduled_at: null } } }, {
                      onError: (e: any) => {
                        toast.error(e?.message ?? "Erro ao salvar data de publicação.");
                        setScheduledDate(prev.date);
                        setScheduledTime(prev.time);
                      },
                    });
                  }}
                  className="text-[11px] text-foreground/40 hover:text-foreground px-2 py-1 rounded hover:bg-foreground/5"
                >Limpar</button>
              )}
            </div>
            <p className="text-[10px] text-foreground/40 mt-1.5">Data e hora reais de publicação no Instagram. É isso que o cliente vê no preview — o Prazo acima é só interno.</p>
          </ModalSection>
        )}

        {/* Local — só faz sentido pra gravação */}
        {item.type === "gravacao" && (
          <ModalSection label="Local">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              onBlur={() => { if (location !== (item.location ?? "")) updateItem.mutate({ data: { id: item.id, patch: { activity_location: location || null } } }); }}
              placeholder="Ex: Clínica, estúdio, externo…"
              className="w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30"
            />
          </ModalSection>
        )}

        {/* Quantidade — pra gravação/roteiro/outros; Sistema não usa contagem */}
        {isActivity && ACTIVITY_QUANTITY_LABEL[item.type] && (
          <ModalSection label={ACTIVITY_QUANTITY_LABEL[item.type]!}>
            <input
              type="number" min={0} step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onBlur={() => {
                const n = quantity.trim() ? Number(quantity) : null;
                const prev = item.activityQuantity ?? null;
                if (n !== prev && !Number.isNaN(n as any))
                  updateItem.mutate({ data: { id: item.id, patch: { activity_quantity: n } } });
              }}
              placeholder="0"
              className="w-full bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] focus:ring-1 focus:ring-[rgb(var(--lz-brand-rgb))] placeholder:text-foreground/30"
            />
          </ModalSection>
        )}

        {item.status === "TRAVADO" && (
          <ModalSection label="Motivo do travamento">
            <div className="flex items-start gap-2">
              <AlertOctagon size={16} className="mt-2.5" style={{ color: "#FF6B6B" }} />
              <textarea
                value={blockedReason}
                onChange={(e) => setBlockedReason(e.target.value)}
                onBlur={() => {
                  const v = blockedReason.trim();
                  if (v !== (item.blockedReason ?? ""))
                    updateItem.mutate({ data: { id: item.id, patch: { blocked_reason: v || null } } });
                }}
                rows={2}
                placeholder="Ex.: aguardando aprovação do cliente, falta de material…"
                className="flex-1 bg-card border border-foreground/8 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[#FF6B6B] focus:ring-1 focus:ring-[#FF6B6B] placeholder:text-foreground/30 resize-none"
              />
            </div>
          </ModalSection>
        )}

        {/* Checklist */}
        <ModalSection label={`Checklist${checklist.length ? ` · ${checklistDone}/${checklist.length}` : ""}`}>
          <div className="space-y-1.5">
            {checklist.map((c, idx) => (
              <div key={c.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => {
                    const next = checklist.map((x) => x.id === c.id ? { ...x, done: !x.done } : x);
                    saveChecklist(next);
                  }}
                  className="h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors"
                  style={{
                    borderColor: c.done ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 25%, transparent)",
                    backgroundColor: c.done ? "rgb(var(--lz-brand-rgb))" : "transparent",
                  }}
                >
                  {c.done && <Check size={10} color="#0D0D0D" strokeWidth={3} />}
                </button>
                <input
                  value={c.text}
                  onChange={(e) => {
                    const next = checklist.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x);
                    saveChecklist(next);
                  }}
                  className={`flex-1 bg-transparent text-sm outline-none ${c.done ? "line-through text-foreground/40" : "text-foreground/90"}`}
                />
                <button
                  onClick={() => saveChecklist(checklist.filter((x) => x.id !== c.id))}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 mt-1">
              <ListChecks size={13} className="text-foreground/30 shrink-0" />
              <input
                value={newCheck}
                onChange={(e) => setNewCheck(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCheck.trim()) {
                    const id = (typeof crypto !== "undefined" && (crypto as any).randomUUID)
                      ? (crypto as any).randomUUID()
                      : Math.random().toString(36).slice(2);
                    saveChecklist([...checklist, { id, text: newCheck.trim(), done: false }]);
                    setNewCheck("");
                  }
                }}
                placeholder="Adicionar subtarefa e dar Enter…"
                className="flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-foreground/30 border-b border-foreground/6 focus:border-[rgb(var(--lz-brand-rgb))] py-1"
              />
            </div>
          </div>
        </ModalSection>

        {/* Quality */}
        {showQuality && (
          <ModalSection label="QUALIDADE DA ARTE">
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => {
                const filled = (item.qualityRating ?? 0) >= n;
                return (
                  <button
                    key={n}
                    disabled={!isAdmin}
                    onClick={() => rateItem.mutate({ data: { itemId: item.id, rating: item.qualityRating === n ? null : n } })}
                    className="p-0.5 disabled:cursor-not-allowed transition-transform hover:scale-110 disabled:hover:scale-100"
                  >
                    <Star size={20} fill={filled ? "var(--lz-accent-ink)" : "transparent"} color={filled ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 30%, transparent)"} />
                  </button>
                );
              })}
              {item.qualityRating != null && (
                <span className="ml-2 text-xs font-bold text-[var(--lz-accent-ink)]">{item.qualityRating}/5</span>
              )}
            </div>
            {!isAdmin && (
              <p className="text-[10px] text-foreground/40 mt-1.5">Apenas administradores avaliam a qualidade.</p>
            )}
          </ModalSection>
        )}

        {/* Files */}
        <ModalSection label="Arquivos" last>
          <div id="lz-files-section">
            <FilesSection itemId={item.id} canEdit={canEditFiles} clientId={selectedClientId} />
          </div>
        </ModalSection>
          </div>
        </div>
      </div>

      <QualityModal
        open={qualityFor !== null}
        onClose={() => setQualityFor(null)}
        itemTitle={item.title}
        onConfirm={(rating) => {
          rateItem.mutate({ data: { itemId: item.id, rating } }, {
            onSuccess: () => {
              setItemStatus.mutate({ data: { id: item.id, status: qualityFor! } });
              flash(item.id);
              setQualityFor(null);
            },
          });
        }}
      />

      {coverOpen && (
        <ReelCoverEditor
          itemId={item.id}
          currentCoverUrl={item.coverUrl ?? null}
          onClose={() => setCoverOpen(false)}
        />
      )}
    </div>
  );
}

function ModalSection({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={`px-5 md:px-6 py-4 ${last ? "" : "border-b border-foreground/6"}`}>
      <div className="text-[10px] uppercase font-bold tracking-wider mb-2.5" style={{ color: "var(--lz-accent-ink)" }}>{label}</div>
      {children}
    </div>
  );
}

function relTime(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `há ${Math.floor(diff / 86400)}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}