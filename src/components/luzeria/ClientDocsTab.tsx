import { useState } from "react";
import { toast } from "sonner";
import { Copy, Trash2, Pencil, ChevronDown, ChevronRight, FileText, Layers } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { clientDocsQO, roteiroStatusesQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { CLIENT_DOC_TYPE_LABEL, CLIENT_DOC_PROMPT, type ClientDocType } from "@/lib/luzeria/client-doc-templates";
import { parseMarkdownLite } from "@/lib/luzeria/markdown-lite";
import type { ClientDoc } from "@/lib/luzeria/client-docs.functions";
import { RoteirosView, PlanejamentoView } from "./MarkdownLiteView";
import { RoteiroControls } from "./RoteiroControls";

const DOC_TYPES: ClientDocType[] = ["roteiro", "planejamento"];

export function ClientDocsTab({ clientId }: { clientId: string }) {
  const { data: docs = [] } = useQuery(clientDocsQO(clientId));
  const { upsertClientDoc, deleteClientDoc } = useApi();
  const [activeType, setActiveType] = useState<ClientDocType>("roteiro");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function copyPrompt() {
    navigator.clipboard.writeText(CLIENT_DOC_PROMPT[activeType]).then(
      () => toast.success("Modelo copiado! Cole numa IA (ChatGPT, Claude, etc.) junto com o material do cliente."),
      () => toast.error("Não consegui copiar. Tenta selecionar e copiar manualmente."),
    );
  }

  function startEdit(doc: { id: string; type: string; title: string | null; content: string }) {
    setEditingId(doc.id);
    setActiveType(doc.type as ClientDocType);
    setTitle(doc.title ?? "");
    setContent(doc.content);
    setExpandedId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setContent("");
  }

  function save() {
    if (!content.trim()) { toast.error("Cole o texto formatado antes de salvar."); return; }
    upsertClientDoc.mutate(
      { data: { id: editingId ?? undefined, clientId, type: activeType, title: title.trim() || null, content: content.trim() } },
      {
        onSuccess: () => {
          toast.success(editingId ? "Documento atualizado." : "Documento salvo — já aparece pro cliente.");
          cancelEdit();
        },
      },
    );
  }

  async function remove(id: string) {
    if (!(await requestConfirm("Remover este documento? O cliente deixa de ver imediatamente.", { danger: true }))) return;
    deleteClientDoc.mutate({ data: { id } });
  }

  return (
    <div className="max-w-2xl">
      {/* Tutorial */}
      <div className="rounded-xl p-4 mb-5" style={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-white/35 mb-3">Como funciona</div>
        <div className="flex flex-col gap-3">
          {[
            <>Clique em <span className="text-white font-medium">Copiar modelo</span> — copia um roteiro pronto pra IA seguir.</>,
            <>Cole numa IA (ChatGPT, Claude, Gemini…) <span className="text-white font-medium">junto com o material bruto do cliente</span>.</>,
            <>Cole a resposta da IA aqui embaixo e clique em <span className="text-white font-medium">Salvar</span>.</>,
            <>Pronto — o cliente já vê organizado no link de preview dele.</>,
          ].map((text, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div
                className="shrink-0 w-[22px] h-[22px] rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ background: "rgba(var(--lz-brand-rgb),0.15)", color: "rgb(var(--lz-brand-rgb))" }}
              >
                {i + 1}
              </div>
              <div className="text-[13px] text-white/75 leading-relaxed pt-0.5">{text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="rounded-xl p-5 mb-8" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-4">
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeType === t ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.06)",
                color: activeType === t ? "#0D0D0D" : "rgba(255,255,255,0.6)",
              }}
            >
              {CLIENT_DOC_TYPE_LABEL[t].label}
            </button>
          ))}
          <button
            onClick={copyPrompt}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-white/10 text-white/70 hover:text-white hover:border-white/25 transition"
          >
            <Copy size={13} /> Copiar modelo
          </button>
        </div>
        <p className="text-[11px] text-white/35 mb-4">{CLIENT_DOC_TYPE_LABEL[activeType].description}</p>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título opcional (ex: Roteiros de Agosto)"
          className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-2.5"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Cole aqui o texto já formatado que a IA te devolveu…"
          rows={8}
          className="w-full bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2.5 text-[13px] text-white outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y font-mono"
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          {editingId && (
            <button onClick={cancelEdit} className="text-xs text-white/50 hover:text-white px-3 py-2">Cancelar edição</button>
          )}
          <button
            onClick={save}
            disabled={upsertClientDoc.isPending}
            className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50"
          >
            {upsertClientDoc.isPending ? "Salvando…" : editingId ? "Salvar alterações" : "Salvar"}
          </button>
        </div>
      </div>

      {/* Saved docs */}
      {docs.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-lg p-10 text-center text-white/30 text-sm">
          Nada salvo ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <DocRow
              key={doc.id}
              doc={doc}
              clientId={clientId}
              isOpen={expandedId === doc.id}
              onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
              onEdit={() => startEdit(doc)}
              onRemove={() => remove(doc.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DocRow({
  doc, clientId, isOpen, onToggle, onEdit, onRemove,
}: {
  doc: ClientDoc;
  clientId: string;
  isOpen: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const blocks = isOpen ? parseMarkdownLite(doc.content) : [];
  const isRoteiro = doc.type === "roteiro";
  const { data: statuses = [] } = useQuery({ ...roteiroStatusesQO(doc.id), enabled: isOpen && isRoteiro });
  const statusByTitle = new Map(statuses.map((s) => [s.roteiroTitle, s]));

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.02] transition-colors"
      >
        {isRoteiro ? <Layers size={14} className="text-white/40 shrink-0" /> : <FileText size={14} className="text-white/40 shrink-0" />}
        <span className="flex-1 min-w-0 text-sm text-white truncate">{doc.title || "(sem título)"}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/30 shrink-0">
          {CLIENT_DOC_TYPE_LABEL[doc.type].label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded text-white/40 hover:text-[rgb(var(--lz-brand-rgb))] hover:bg-white/5 transition shrink-0">
          <Pencil size={13} />
        </span>
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 rounded text-white/40 hover:text-red-400 hover:bg-white/5 transition shrink-0">
          <Trash2 size={13} />
        </span>
        {isOpen ? <ChevronDown size={14} className="text-white/40 shrink-0" /> : <ChevronRight size={14} className="text-white/40 shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {isRoteiro ? (
            <RoteirosView
              blocks={blocks}
              renderFooter={(g) => (
                <RoteiroControls docId={doc.id} clientId={clientId} title={g.title} status={statusByTitle.get(g.title)} />
              )}
            />
          ) : (
            <PlanejamentoView blocks={blocks} />
          )}
        </div>
      )}
    </div>
  );
}
