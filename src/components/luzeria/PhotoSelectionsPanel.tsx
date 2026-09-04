import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Copy, Trash2, ExternalLink, Image as ImageIcon, Check, Clock } from "lucide-react";
import { photoSelectionsQO, photoSelectionDetailQO, driveThumbnailQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";

const PUBLIC_BASE = import.meta.env.VITE_APP_URL ?? "https://www.modocriador.com.br";

/** Cliente cola o link de uma pasta do Drive, o app vira um site público
 * onde ele escolhe as fotos, e a agência copia o código pro Lightroom —
 * mesmo padrão de link público por token do preview de feed. Usado tanto
 * na página de detalhe de um cliente de fotografia (área independente
 * "Seleção de Fotos") quanto reaproveitável em qualquer outro lugar que
 * precise gerenciar seleções de um `photoClientId`. */
export function PhotoSelectionsPanel({ photoClientId }: { photoClientId: string }) {
  const { data: selections = [], isLoading } = useQuery(photoSelectionsQO(photoClientId));
  const { createPhotoSelection, deletePhotoSelection } = useApi();
  const [showNew, setShowNew] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

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
    </div>
  );
}

function StatusPill({ status }: { status: "aberta" | "finalizada" }) {
  const isDone = status === "finalizada";
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0"
      style={{
        background: isDone ? "rgba(34,197,94,0.15)" : "rgba(234,179,8,0.15)",
        color: isDone ? "rgb(34,197,94)" : "rgb(234,179,8)",
      }}
    >
      {isDone ? <Check size={10} /> : <Clock size={10} />}
      {isDone ? "Finalizada" : "Aguardando"}
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

function SelectionRow({ selection, isOpen, onToggle, onDelete }: {
  selection: { id: string; title: string; status: "aberta" | "finalizada"; token: string; deadline: string | null; choiceCount: number };
  isOpen: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { data: detail } = useQuery({ ...photoSelectionDetailQO(selection.id), enabled: isOpen });
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${PUBLIC_BASE}/selecao/${selection.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function copyLightroomCode() {
    if (!detail?.choices.length) return;
    const code = detail.choices.map((c) => `${stripExtension(c.fileName)}.`).join(", ");
    navigator.clipboard.writeText(code).then(
      () => toast.success("Código do Lightroom copiado."),
      () => toast.error("Não consegui copiar. Tenta selecionar manualmente."),
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors">
        <ImageIcon size={14} className="text-foreground/40 shrink-0" />
        <span className="flex-1 min-w-0 text-sm text-foreground truncate">{selection.title}</span>
        <StatusPill status={selection.status} />
        <span className="text-[11px] text-foreground/35 shrink-0">
          {selection.choiceCount} foto{selection.choiceCount === 1 ? "" : "s"}
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
            {selection.deadline && (
              <span className="text-[11px] text-foreground/40">Prazo: {formatDeadline(selection.deadline)}</span>
            )}
          </div>

          {!detail ? (
            <div className="text-foreground/30 text-xs py-4 text-center">Carregando…</div>
          ) : detail.choices.length === 0 ? (
            <div className="text-foreground/30 text-xs py-4 text-center border border-dashed border-foreground/10 rounded-lg">
              Aguardando o cliente escolher as fotos.
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-wide text-foreground/35">
                  {detail.choices.length} foto{detail.choices.length === 1 ? "" : "s"} escolhida{detail.choices.length === 1 ? "" : "s"}
                </span>
                <button onClick={copyLightroomCode}
                  className="lz-btn-primary text-[11px] px-3 py-1.5 rounded-md inline-flex items-center gap-1.5">
                  <Copy size={12} /> Copiar código Lightroom
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {detail.choices.map((c) => (
                  <ChoiceThumb key={c.driveFileId} fileId={c.driveFileId} fileName={c.fileName} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
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
  onCreate: (vals: { title: string; driveFolderLink: string; deadline?: string | null }) => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [deadline, setDeadline] = useState("");

  function submit() {
    if (!title.trim()) { toast.error("Dá um título pra essa seleção."); return; }
    if (!link.trim()) { toast.error("Cola o link da pasta do Drive."); return; }
    onCreate({ title: title.trim(), driveFolderLink: link.trim(), deadline: deadline || null });
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
