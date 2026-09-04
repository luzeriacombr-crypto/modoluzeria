import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Copy, Trash2, ExternalLink, Image as ImageIcon, Lock, Unlock, ChevronDown, ChevronRight, Star } from "lucide-react";
import { photoSelectionsQO, photoSelectionDetailQO, selectionDriveImagesQO, driveThumbnailQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

type PhotoOrder = "nome" | "horario";
const ORDER_LABEL: Record<PhotoOrder, string> = { nome: "Nome", horario: "Horário" };

const PUBLIC_BASE = import.meta.env.VITE_APP_URL ?? "https://www.modocriador.com.br";

/** Cliente cola o link de uma pasta do Drive, o app vira um site público
 * onde ele escolhe as fotos, e a agência copia o código pro Lightroom —
 * mesmo padrão de link público por token do preview de feed. Usado tanto
 * na página de detalhe de um cliente de fotografia (área independente
 * "Seleção de Fotos") quanto reaproveitável em qualquer outro lugar que
 * precise gerenciar seleções de um `photoClientId`. */
export function PhotoSelectionsPanel({ photoClientId }: { photoClientId: string }) {
  const { data: selections = [], isLoading } = useQuery(photoSelectionsQO(photoClientId));
  const { createPhotoSelection, deletePhotoSelection, setPhotoSelectionStatus, setPhotoSelectionCover, setPhotoSelectionOrder } = useApi();
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickingCoverFor, setPickingCoverFor] = useState<string | null>(null);

  async function handleDelete(id: string) {
    if (!(await requestConfirm("Remover essa seleção de fotos? O link público deixa de funcionar.", { danger: true }))) return;
    deletePhotoSelection.mutate({ data: { id } }, {
      onSuccess: () => { if (openId === id) setOpenId(null); },
    });
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="text-sm text-foreground/50">
          Gere um link pra o cliente escolher fotos direto de uma pasta do Google Drive.
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide px-3 py-2 rounded-md text-black shrink-0"
          style={{ backgroundColor: "rgb(var(--lz-brand-rgb))" }}
        >
          <Plus size={14} /> Nova seleção
        </button>
      </div>

      {isLoading ? (
        <div className="text-foreground/40 text-sm py-10 text-center">Carregando…</div>
      ) : selections.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-10 text-center text-foreground/30 text-sm">
          Nenhuma seleção criada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {selections.map((s) => (
            <SelectionRow
              key={s.id}
              selection={s}
              isOpen={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
              onDelete={() => handleDelete(s.id)}
              onToggleStatus={() => setPhotoSelectionStatus.mutate({
                data: { id: s.id, status: s.status === "aberta" ? "encerrada" : "aberta" },
              }, {
                onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
              })}
              togglingStatus={setPhotoSelectionStatus.isPending}
              onChangeOrder={(photoOrder) => setPhotoSelectionOrder.mutate({ data: { id: s.id, photoOrder } }, {
                onError: (e: any) => toast.error(e?.message ?? "Erro ao atualizar."),
              })}
              onPickCover={() => setPickingCoverFor(s.id)}
            />
          ))}
        </div>
      )}

      {showNew && (
        <NewSelectionModal
          onClose={() => setShowNew(false)}
          saving={createPhotoSelection.isPending}
          onCreate={(vals) => {
            createPhotoSelection.mutate({ data: { photoClientId, ...vals } }, {
              onSuccess: () => { setShowNew(false); toast.success("Seleção criada — copie o link pro cliente."); },
              onError: (e: any) => toast.error(e?.message ?? "Erro ao criar seleção."),
            });
          }}
        />
      )}

      {pickingCoverFor && (
        <CoverPickerModal
          selectionId={pickingCoverFor}
          onClose={() => setPickingCoverFor(null)}
          onPick={(driveFileId) => {
            setPhotoSelectionCover.mutate({ data: { id: pickingCoverFor, driveFileId } }, {
              onSuccess: () => { toast.success("Capa atualizada."); setPickingCoverFor(null); },
              onError: (e: any) => toast.error(e?.message ?? "Erro ao definir capa."),
            });
          }}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: "aberta" | "encerrada" }) {
  const isClosed = status === "encerrada";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
      style={{
        background: isClosed ? "rgba(148,163,184,0.15)" : "rgba(34,197,94,0.15)",
        color: isClosed ? "rgb(148,163,184)" : "rgb(34,197,94)",
      }}
    >
      {isClosed ? <Lock size={10} /> : <Unlock size={10} />}
      {isClosed ? "Encerrada" : "Aberta"}
    </span>
  );
}

function formatDeadline(dateOnly: string) {
  return new Date(`${dateOnly}T00:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function stripExtension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.slice(0, idx) : name;
}

function SelectionRow({ selection, isOpen, onToggle, onDelete, onToggleStatus, togglingStatus, onChangeOrder, onPickCover }: {
  selection: { id: string; title: string; status: "aberta" | "encerrada"; token: string; deadline: string | null; submissionCount: number };
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onToggleStatus: () => void;
  togglingStatus: boolean;
  onChangeOrder: (order: PhotoOrder) => void;
  onPickCover: () => void;
}) {
  const { data: detail } = useQuery({ ...photoSelectionDetailQO(selection.id), enabled: isOpen });
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${PUBLIC_BASE}/selecao/${selection.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors">
        <ImageIcon size={14} className="text-foreground/40 shrink-0" />
        <span className="flex-1 min-w-0 text-sm text-foreground truncate">{selection.title}</span>
        <StatusPill status={selection.status} />
        <span className="text-[11px] text-foreground/35 shrink-0">
          {selection.submissionCount} resposta{selection.submissionCount === 1 ? "" : "s"}
        </span>
        <span onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition shrink-0">
          <Trash2 size={13} />
        </span>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={copyLink}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition">
              <Copy size={12} /> {copied ? "Copiado!" : "Copiar link pro cliente"}
            </button>
            <a href={`${PUBLIC_BASE}/selecao/${selection.token}`} target="_blank" rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition">
              <ExternalLink size={12} /> Abrir
            </a>
            <button onClick={onToggleStatus} disabled={togglingStatus}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition disabled:opacity-50 ml-auto">
              {selection.status === "aberta" ? <Lock size={12} /> : <Unlock size={12} />}
              {selection.status === "aberta" ? "Encerrar seleção" : "Reabrir seleção"}
            </button>
            {selection.deadline && (
              <span className="text-[11px] text-foreground/40 w-full">Prazo: {formatDeadline(selection.deadline)}</span>
            )}
          </div>

          {detail && (
            <div className="flex items-center gap-4 flex-wrap pb-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/35">Ordenar por</span>
                {(["nome", "horario"] as PhotoOrder[]).map((o) => (
                  <button
                    key={o}
                    onClick={() => onChangeOrder(o)}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border transition"
                    style={{
                      borderColor: detail.photoOrder === o ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 12%, transparent)",
                      color: detail.photoOrder === o ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                    }}
                  >
                    {ORDER_LABEL[o]}
                  </button>
                ))}
              </div>
              <button onClick={onPickCover}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition">
                <Star size={12} /> {detail.coverDriveFileId ? "Trocar capa" : "Escolher capa"}
              </button>
            </div>
          )}

          {!detail ? (
            <div className="text-foreground/30 text-xs py-4 text-center">Carregando…</div>
          ) : detail.submissions.length === 0 ? (
            <div className="text-foreground/30 text-xs py-4 text-center border border-dashed border-foreground/10 rounded-lg">
              Aguardando respostas.
            </div>
          ) : (
            <div className="space-y-2">
              {detail.submissions.map((sub) => (
                <SubmissionRow key={sub.id} submission={sub} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SubmissionRow({ submission }: {
  submission: { id: string; respondentName: string; finalizedAt: string; choices: Array<{ driveFileId: string; fileName: string }> };
}) {
  const [expanded, setExpanded] = useState(false);

  function copyLightroomCode() {
    const code = submission.choices.map((c) => `${stripExtension(c.fileName)}.`).join(", ");
    navigator.clipboard.writeText(code).then(
      () => toast.success("Código do Lightroom copiado."),
      () => toast.error("Não consegui copiar. Tenta selecionar manualmente."),
    );
  }

  return (
    <div className="rounded-md" style={{ background: "var(--background)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
      <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        {expanded ? <ChevronDown size={13} className="text-foreground/30 shrink-0" /> : <ChevronRight size={13} className="text-foreground/30 shrink-0" />}
        <span className="flex-1 min-w-0 text-sm font-semibold text-foreground truncate">{submission.respondentName}</span>
        <span className="text-[11px] text-foreground/35 shrink-0">
          {submission.choices.length} foto{submission.choices.length === 1 ? "" : "s"} · {formatDateTime(submission.finalizedAt)}
        </span>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0.5">
          <div className="flex justify-end mb-2">
            <button onClick={copyLightroomCode}
              className="lz-btn-primary text-[11px] px-3 py-1.5 rounded-md inline-flex items-center gap-1.5">
              <Copy size={12} /> Copiar código Lightroom
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {submission.choices.map((c) => (
              <ChoiceThumb key={c.driveFileId} fileId={c.driveFileId} fileName={c.fileName} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function ChoiceThumb({ fileId, fileName }: { fileId: string; fileName: string }) {
  const { data } = useQuery(driveThumbnailQO(fileId));
  return (
    <div className="relative aspect-square rounded-md overflow-hidden" style={{ background: "var(--background)" }} title={fileName}>
      {data?.dataUrl ? (
        <img src={data.dataUrl} alt={fileName} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full grid place-items-center">
          <ImageIcon size={16} className="text-foreground/20" />
        </div>
      )}
    </div>
  );
}

function NewSelectionModal({ onClose, onCreate, saving }: {
  onClose: () => void;
  onCreate: (vals: { title: string; driveFolderLink: string; deadline?: string | null; photoOrder: PhotoOrder }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [deadline, setDeadline] = useState("");
  const [photoOrder, setPhotoOrder] = useState<PhotoOrder>("nome");

  function submit() {
    if (!title.trim()) { toast.error("Dá um título pra essa seleção."); return; }
    if (!link.trim()) { toast.error("Cola o link da pasta do Drive."); return; }
    onCreate({ title: title.trim(), driveFolderLink: link.trim(), deadline: deadline || null, photoOrder });
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 grid place-items-center p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl p-5" style={{ background: "var(--card)" }} onClick={(e) => e.stopPropagation()}>
        <div className="text-base font-bold text-foreground mb-4">Nova seleção de fotos</div>

        <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">Título</label>
        <input
          value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Ensaio de setembro"
          className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-3"
        />

        <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">Link da pasta do Google Drive</label>
        <input
          value={link} onChange={(e) => setLink(e.target.value)}
          placeholder="Cole o link de compartilhamento da pasta"
          className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-3"
        />

        <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">Prazo (opcional)</label>
        <input
          type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
          className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-4"
        />

        <label className="block text-[11px] font-bold uppercase tracking-wide text-foreground/40 mb-1.5">Ordenar fotos por</label>
        <div className="flex items-center gap-1.5 mb-4">
          {(["nome", "horario"] as PhotoOrder[]).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setPhotoOrder(o)}
              className="flex-1 text-xs font-semibold px-3 py-2 rounded-md border transition"
              style={{
                borderColor: photoOrder === o ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 12%, transparent)",
                color: photoOrder === o ? "var(--lz-accent-ink)" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
              }}
            >
              {ORDER_LABEL[o]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar</button>
          <button onClick={submit} disabled={saving} className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50">
            {saving ? "Criando…" : "Criar seleção"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Miniaturas cruas do Drive (sem marca d'água) — tela interna, só o admin
 * vê, mesmo padrão já usado em searchDriveFiles/candidatos de pasta. */
function CoverPickerModal({ selectionId, onClose, onPick }: {
  selectionId: string;
  onClose: () => void;
  onPick: (driveFileId: string) => void;
}) {
  const { data: images = [], isLoading } = useQuery(selectionDriveImagesQO(selectionId));

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[80vh] rounded-xl p-5 flex flex-col"
        style={{ background: "var(--card)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div className="text-base font-bold text-foreground">Escolher foto de capa</div>
          <button onClick={onClose} className="text-xs text-foreground/50 hover:text-foreground px-2 py-1">Fechar</button>
        </div>
        <div className="overflow-y-auto">
          {isLoading ? (
            <div className="text-foreground/40 text-sm py-10 text-center">Carregando fotos…</div>
          ) : images.length === 0 ? (
            <div className="text-foreground/30 text-sm py-10 text-center">Nenhuma foto encontrada nessa pasta.</div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
              {images.map((img) => (
                <button
                  key={img.id}
                  onClick={() => onPick(img.id)}
                  className="relative aspect-square rounded-md overflow-hidden hover:ring-2 transition"
                  style={{ background: "var(--background)" }}
                  title={img.name}
                >
                  {img.thumbnailUrl ? (
                    <img src={img.thumbnailUrl} alt={img.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full grid place-items-center">
                      <ImageIcon size={16} className="text-foreground/20" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
