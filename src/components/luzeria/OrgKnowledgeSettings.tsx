import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, StickyNote, Trash2, Upload, Loader2 } from "lucide-react";
import { orgKnowledgeQO, useApi, useMe } from "@/lib/luzeria/queries";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import { supabase } from "@/integrations/supabase/client";

const ACCEPT = ".pdf,.md,.txt,.doc,.docx";
const MAX_SIZE = 20 * 1024 * 1024;

export function OrgKnowledgeSettings() {
  const me = useMe().data;
  const { data: entries = [] } = useQuery(orgKnowledgeQO());
  const { saveOrgKnowledgeText, saveOrgKnowledgeFile, deleteOrgKnowledge } = useApi();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function saveText() {
    if (!content.trim()) { toast.error("Escreva o texto antes de salvar."); return; }
    saveOrgKnowledgeText.mutate(
      { data: { title: title.trim() || undefined, content: content.trim() } },
      { onSuccess: () => { toast.success("Nota salva."); setTitle(""); setContent(""); } },
    );
  }

  async function handleFile(file: File) {
    if (!me?.orgId) return;
    if (file.size > MAX_SIZE) { toast.error("Arquivo maior que 20MB."); return; }
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${me.orgId}/${Date.now()}-${safeName}`;
      const { error } = await supabase.storage.from("org-knowledge").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (error) throw error;
      await saveOrgKnowledgeFile.mutateAsync({
        data: { storagePath: path, fileName: file.name, mimeType: file.type || "application/octet-stream" },
      });
      toast.success("Arquivo salvo.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    if (!(await requestConfirm("Remover esse item da base de conhecimento?", { danger: true }))) return;
    deleteOrgKnowledge.mutate({ data: { id } });
  }

  const inp = "w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]";

  return (
    <div className="max-w-2xl">
      <div className="rounded-xl p-4 mb-6 text-[13px] text-foreground/70 leading-relaxed" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 8%, transparent)" }}>
        Texto ou arquivos que ensinam a IA como a sua agência costuma criar conteúdo — guias de voz, padrões, exemplos.
        Isso entra automaticamente na prévia de planejamento gerada por IA, pra qualquer cliente que tiver essa feature liberada.
        PDF, Markdown e texto são lidos de verdade pela IA; .doc/.docx ficam guardados aqui mas ainda não são lidos.
      </div>

      <div className="rounded-xl p-5 mb-6" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
        <div className="text-[11px] font-bold uppercase tracking-wide text-foreground/35 mb-3">Adicionar texto</div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título opcional" className={inp + " mb-2.5"} />
        <textarea
          value={content} onChange={(e) => setContent(e.target.value)}
          placeholder="Ex: nossa agência sempre escreve legendas curtas, com pergunta no final..."
          rows={5} className={inp + " resize-y"}
        />
        <div className="flex items-center justify-between mt-3">
          <div>
            <input ref={fileInputRef} type="file" accept={ACCEPT} className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md border border-foreground/10 text-foreground/70 hover:text-foreground hover:border-foreground/25 transition disabled:opacity-50"
            >
              {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
              {uploading ? "Enviando…" : "Anexar arquivo"}
            </button>
          </div>
          <button onClick={saveText} disabled={saveOrgKnowledgeText.isPending} className="lz-btn-primary text-xs px-5 py-2.5 rounded-md disabled:opacity-50">
            {saveOrgKnowledgeText.isPending ? "Salvando…" : "Salvar nota"}
          </button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="border border-dashed border-foreground/10 rounded-lg p-10 text-center text-foreground/30 text-sm">
          Nada salvo ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-lg px-4 py-3" style={{ background: "var(--card)", border: "1px solid color-mix(in srgb, var(--foreground) 6%, transparent)" }}>
              {e.kind === "file" ? <FileText size={14} className="text-foreground/40 shrink-0" /> : <StickyNote size={14} className="text-foreground/40 shrink-0" />}
              <span className="flex-1 min-w-0 text-sm text-foreground truncate">{e.title || e.fileName || "(sem título)"}</span>
              <span className="text-[10px] text-foreground/30 shrink-0">{new Date(e.createdAt).toLocaleDateString("pt-BR")}</span>
              <button onClick={() => remove(e.id)} className="p-1.5 rounded text-foreground/40 hover:text-red-400 hover:bg-foreground/5 transition shrink-0">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
