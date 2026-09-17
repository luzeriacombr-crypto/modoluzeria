import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Trash2, Pencil, ChevronDown, ChevronRight, FileText, Layers, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { clientDocsQO, roteiroStatusesQO, useApi } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { CLIENT_DOC_TYPE_LABEL, CLIENT_DOC_PROMPT, type ClientDocType } from "@/lib/luzeria/client-doc-templates";
import { parseMarkdownLite } from "@/lib/luzeria/markdown-lite";
import { formatClientDocWithAI, type ClientDoc } from "@/lib/luzeria/client-docs.functions";
import { RoteirosView, PlanejamentoView } from "./MarkdownLiteView";
import { RoteiroControls } from "./RoteiroControls";
import { AIPlanningPreview } from "./AIPlanningPreview";
import { MonthPickerList } from "./MonthPickerList";

const DOC_TYPES: ClientDocType[] = ["roteiro", "planejamento"];

export function ClientDocsTab({ clientId, aiPlanningEnabled }: { clientId: string; aiPlanningEnabled?: boolean }) {
  const { data: docs = [] } = useQuery(clientDocsQO(clientId));
  const { upsertClientDoc, deleteClientDoc } = useApi();
  const formatWithAI = useServerFn(formatClientDocWithAI);
  const [showAiPlanning, setShowAiPlanning] = useState(false);
  const [activeType, setActiveType] = useState<ClientDocType>("roteiro");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);
  const [rawMaterial, setRawMaterial] = useState("");
  const [formatting, setFormatting] = useState(false);

  function copyPrompt() {
    navigator.clipboard.writeText(CLIENT_DOC_PROMPT[activeType]).then(
      () => toast.success("Modelo copiado! Cole numa IA (ChatGPT, Claude, etc.) junto com o material do cliente."),
      () => toast.error("Não consegui copiar. Tenta selecionar e copiar manualmente."),
    );
  }

  async function generateWithAI() {
    if (!rawMaterial.trim()) { toast.error("Cole o material bruto antes."); return; }
    setFormatting(true);
    try {
      const { content: formatted } = await formatWithAI({ data: { type: activeType, rawMaterial: rawMaterial.trim() } });
      setContent(formatted);
      setShowRaw(false);
      setRawMaterial("");
      toast.success("Formatado! Revise e clique em Salvar.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao formatar com IA.");
    } finally {
      setFormatting(false);
    }
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
      {aiPlanningEnabled && (
        <button
          onClick={() => setShowAiPlanning(true)}
          className="w-full mb-5 flex items-center gap-2.5 rounded-xl p-4 text-left transition hover:opacity-90"
          style={{ background: "rgba(var(--lz-brand-rgb),0.1)", border: "1px solid rgba(var(--lz-brand-rgb),0.25)" }}
        >
          <Sparkles size={16} className="shrink-0" style={{ color: "var(--lz-accent-ink)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">Gerar prévia de planejamento com IA</div>
            <div className="text-[11px] text-foreground/45">Lê o histórico, arquivos de marca e concorrentes — em teste, só nesse cliente.</div>
          </div>
        </button>
      )}
      {/* Tutorial */}
      <div className="rounded-xl p-4 mb-5" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-foreground/35 mb-3">Como funciona</div>
        <div className="flex flex-col gap-3">
          {[
            <>Clique em <span className="text-foreground font-medium">Formatar com IA</span> e cole o material bruto do cliente — a gente já formata pra você (ou use <span className="text-foreground font-medium">Copiar modelo</span> pra formatar numa IA sua).</>,
            <>Revise o texto formatado — ajuste o que quiser.</>,
            <>Clique em <span className="text-foreground font-medium">Salvar</span>.</>,
            <>Pronto — o cliente já vê organizado no link de preview dele.</>,
          ].map((text, i) => (
            <div key={i} className="flex gap-3 items-start">
              <div
                className="shrink-0 w-[22px] h-[22px] rounded-full text-[11px] font-bold flex items-center justify-center"
                style={{ background: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}
              >
                {i + 1}
              </div>
              <div className="text-[13px] text-foreground/75 leading-relaxed pt-0.5">{text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div className="rounded-xl p-5 mb-8" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
        <div className="flex items-center gap-2 mb-4">
          {DOC_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setActiveType(t)}
              className="rounded-full px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-colors"
              style={{
                backgroundColor: activeType === t ? "rgb(var(--lz-brand-rgb))" : "color-mix(in srgb, var(--foreground) 6%, transparent)",
                color: activeType === t ? "#0D0D0D" : "color-mix(in srgb, var(--foreground) 60%, transparent)",
              }}
            >
              {CLIENT_DOC_TYPE_LABEL[t].label}
            </button>
          ))}
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition"
            style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}
          >
            <Sparkles size={13} /> Formatar com IA
          </button>
          <button
            onClick={copyPrompt}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition"
          >
            <Copy size={13} /> Copiar modelo
          </button>
        </div>
        <p className="text-[11px] text-foreground/35 mb-4">{CLIENT_DOC_TYPE_LABEL[activeType].description}</p>

        {showRaw && (
          <div className="mb-4 rounded-lg p-3" style={{ background: "rgba(var(--lz-brand-rgb),0.06)", border: "1px solid rgba(var(--lz-brand-rgb),0.2)" }}>
            <textarea
              value={rawMaterial}
              onChange={(e) => setRawMaterial(e.target.value)}
              placeholder="Cole aqui o material bruto do cliente — transcrição, rascunho, notas soltas, qualquer formato."
              rows={6}
              className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y mb-2"
            />
            <div className="flex justify-end">
              <button
                onClick={generateWithAI}
                disabled={formatting}
                className="lz-btn-primary text-xs px-4 py-2 rounded-md disabled:opacity-50"
              >
                {formatting ? "Formatando…" : "Gerar com IA"}
              </button>
            </div>
          </div>
        )}

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título opcional (ex: Roteiros de Agosto)"
          className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] mb-2.5"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Cole aqui o texto já formatado que a IA te devolveu…"
          rows={8}
          className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2.5 text-[13px] text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-y font-mono"
        />
        <div className="flex items-center justify-end gap-2 mt-3">
          {editingId && (
            <button onClick={cancelEdit} className="text-xs text-foreground/50 hover:text-foreground px-3 py-2">Cancelar edição</button>
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
        <div className="border border-dashed border-foreground/10 rounded-lg p-10 text-center text-foreground/30 text-sm">
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

      {showAiPlanning && <AIPlanningPreview clientId={clientId} onClose={() => setShowAiPlanning(false)} />}
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
  const { createRoteirosFromPlan } = useApi();
  const [pickingMonth, setPickingMonth] = useState(false);

  function approveToRoteiros(targetMonthKey: string) {
    if (!doc.planItems?.length) return;
    createRoteirosFromPlan.mutate(
      { data: { clientId, targetMonthKey, items: doc.planItems } },
      { onSuccess: () => { toast.success("Roteiros criados! Aprovar cada um já cria a publicação."); setPickingMonth(false); } },
    );
  }

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02] transition-colors"
      >
        {isRoteiro ? <Layers size={14} className="text-foreground/40 shrink-0" /> : <FileText size={14} className="text-foreground/40 shrink-0" />}
        <span className="flex-1 min-w-0 text-sm text-foreground truncate">{doc.title || "(sem título)"}</span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-foreground/30 shrink-0">
          {CLIENT_DOC_TYPE_LABEL[doc.type].label}
        </span>
        <span onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1.5 rounded text-foreground/40 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition shrink-0">
          <Pencil size={13} />
        </span>
        <span onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition shrink-0">
          <Trash2 size={13} />
        </span>
        {isOpen ? <ChevronDown size={14} className="text-foreground/40 shrink-0" /> : <ChevronRight size={14} className="text-foreground/40 shrink-0" />}
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-1">
          {isRoteiro ? (
            <RoteirosView
              blocks={blocks}
              renderFooter={(g) => (
                <RoteiroControls docId={doc.id} clientId={clientId} title={g.title} status={statusByTitle.get(g.title)} targetMonthKey={doc.targetMonthKey} />
              )}
            />
          ) : (
            <>
              <PlanejamentoView blocks={blocks} />
              {doc.planItems && doc.planItems.length > 0 && (
                <div className="mt-4 pt-4 border-t border-foreground/6">
                  {pickingMonth ? (
                    <div>
                      <p className="text-xs text-foreground/50 mb-2.5">Pra qual mês são essas publicações?</p>
                      <MonthPickerList clientId={clientId} onSelect={approveToRoteiros} pending={createRoteirosFromPlan.isPending} />
                      <button onClick={() => setPickingMonth(false)} className="text-xs text-foreground/50 hover:text-foreground px-1 py-2">
                        {createRoteirosFromPlan.isPending ? "Gerando roteiros…" : "Cancelar"}
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setPickingMonth(true)} className="lz-btn-primary text-xs px-4 py-2.5 rounded-md">
                      Aprovar e enviar pros Roteiros
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
