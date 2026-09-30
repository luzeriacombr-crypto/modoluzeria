// Luzeria — edita a base de conhecimento modelo (Método Luzeria). O que
// mudar aqui vale na hora pra todas as Houses (a IA delas lê direto
// daqui). As Houses só veem os títulos, nunca o texto.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2 } from "lucide-react";
import { toastFriendlyError } from "@/lib/luzeria/friendly-error";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import {
  listKnowledgeTemplate, saveKnowledgeTemplateDoc, deleteKnowledgeTemplateDoc, moveKnowledgeTemplateDoc,
  type KnowledgeTemplateDoc,
} from "@/lib/luzeria/knowledge-template.functions";

const KEY = ["knowledge-template"];

export function KnowledgeTemplateAdmin() {
  const listFn = useServerFn(listKnowledgeTemplate);
  const moveFn = useServerFn(moveKnowledgeTemplateDoc);
  const qc = useQueryClient();
  const { data: docs = [], isLoading } = useQuery({ queryKey: KEY, queryFn: () => listFn() });
  const [selected, setSelected] = useState<string | "new" | null>(null);
  const current = docs.find((d) => d.id === selected) ?? null;

  useEffect(() => { if (!selected && docs.length) setSelected(docs[0].id); }, [docs, selected]);
  const move = useMutation({
    mutationFn: (v: { id: string; dir: "up" | "down" }) => moveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });

  return (
    <div className="px-4 sm:px-6 md:px-10 py-6 md:py-10 max-w-6xl mx-auto pb-28">
      <div className="text-[11px] uppercase font-bold tracking-wider text-foreground/40">Luzeria · Houses</div>
      <h1 className="text-[28px] md:text-[32px] font-bold text-foreground tracking-tight mt-0.5">Base de conhecimento modelo</h1>
      <p className="text-sm text-foreground/55 mt-1 max-w-2xl">
        O Método Luzeria que a IA usa em todas as Houses (planejamento, roteiros e ideias de stories). Mudou aqui, vale na hora pra todas.
        <span className="inline-flex items-center gap-1 ml-1"><Lock size={12} /> As Houses só veem os títulos, nunca o texto.</span>
      </p>

      {isLoading ? <div className="mt-8 text-sm text-foreground/40">Carregando…</div> : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
          <nav className="bg-card rounded-2xl p-2 border border-foreground/[0.06]">
            {docs.map((d, i) => (
              <div key={d.id} className="group flex items-center gap-1">
                <button onClick={() => setSelected(d.id)}
                  className="flex-1 min-w-0 text-left px-3 py-2.5 rounded-lg text-sm transition"
                  style={{ backgroundColor: selected === d.id ? "rgba(var(--lz-brand-rgb),0.12)" : undefined, color: selected === d.id ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 70%, transparent)" }}>
                  <span className="block truncate">{d.title}</span>
                </button>
                <div className="hidden group-hover:flex">
                  {i > 0 && <button onClick={() => move.mutate({ id: d.id, dir: "up" })} className="p-1.5 rounded text-foreground/40 hover:text-foreground"><ArrowUp size={12} /></button>}
                  {i < docs.length - 1 && <button onClick={() => move.mutate({ id: d.id, dir: "down" })} className="p-1.5 rounded text-foreground/40 hover:text-foreground"><ArrowDown size={12} /></button>}
                </div>
              </div>
            ))}
            <button onClick={() => setSelected("new")} className="w-full flex items-center gap-2 px-3 py-2.5 mt-1 rounded-lg text-sm font-semibold text-foreground/50 hover:text-foreground hover:bg-foreground/[0.04]">
              <Plus size={14} /> Novo documento
            </button>
          </nav>
          {selected === "new" ? (
            <DocEditor key="new" doc={null} onSaved={(id) => setSelected(id)} onDeleted={() => setSelected(null)} />
          ) : current ? (
            <DocEditor key={current.id} doc={current} onSaved={(id) => setSelected(id)} onDeleted={() => setSelected(null)} />
          ) : (
            <div className="bg-card rounded-2xl p-10 text-center text-sm text-foreground/45 border border-foreground/[0.06]">Escolha um documento.</div>
          )}
        </div>
      )}
    </div>
  );
}

function DocEditor({ doc, onSaved, onDeleted }: { doc: KnowledgeTemplateDoc | null; onSaved: (id: string) => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveKnowledgeTemplateDoc);
  const deleteFn = useServerFn(deleteKnowledgeTemplateDoc);
  const [title, setTitle] = useState(doc?.title ?? " · desenvolvido por Luzeria");
  const [text, setText] = useState(doc?.textContent ?? "");
  const dirty = title !== (doc?.title ?? " · desenvolvido por Luzeria") || text !== (doc?.textContent ?? "");
  const save = useMutation({
    mutationFn: () => saveFn({ data: { id: doc?.id, title: title.trim(), textContent: text } }),
    onSuccess: (r) => { qc.invalidateQueries({ queryKey: KEY }); toast.success("Salvo. Já vale pra todas as Houses."); onSaved(r.id); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui salvar"),
  });
  const remove = useMutation({
    mutationFn: () => deleteFn({ data: { id: doc!.id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: KEY }); onDeleted(); },
    onError: (e: any) => toastFriendlyError(e, "Não consegui apagar"),
  });

  return (
    <div className="bg-card rounded-2xl p-5 sm:p-6 border border-foreground/[0.06] space-y-4">
      <label className="block">
        <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1.5">Título (aparece pras Houses)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="lz-input w-full" />
      </label>
      <label className="block">
        <span className="block text-[10px] uppercase font-bold tracking-wider text-foreground/45 mb-1.5">Conteúdo (só a IA lê)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={24} maxLength={60000}
          className="w-full bg-background border border-foreground/10 rounded-xl px-4 py-3 text-[13.5px] leading-relaxed text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] font-mono resize-y" />
        <span className="block text-[11px] text-foreground/40 mt-1 text-right tabular-nums">{text.length.toLocaleString("pt-BR")} caracteres</span>
      </label>
      <div className="flex items-center gap-2">
        <button onClick={() => save.mutate()} disabled={!dirty || !title.trim() || !text.trim() || save.isPending}
          className="px-5 py-2.5 rounded-md text-sm font-bold disabled:opacity-40" style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
          {save.isPending ? "Salvando…" : "Salvar"}
        </button>
        <span className="flex-1" />
        {doc && (
          <button onClick={async () => { if (await requestConfirm(`Apagar "${doc.title}"? As Houses deixam de usar esse material na hora.`, { danger: true })) remove.mutate(); }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-semibold text-red-400 hover:bg-red-500/10"><Trash2 size={13} /> Apagar</button>
        )}
      </div>
    </div>
  );
}
