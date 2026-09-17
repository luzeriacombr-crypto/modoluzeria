import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FileText, Image as ImageIcon, Link2, PenLine, X, Upload, Loader2, CheckCircle2 } from "lucide-react";
import { extractClientsFromFiles, confirmImportedClients, type ExtractedClient } from "@/lib/luzeria/import-ai.functions";
import { ImportClientsStep } from "./ImportClientsStep";

type Source = "file" | "shot" | "api" | "manual" | null;
type ReviewRow = ExtractedClient & { selected: boolean };

const ACCEPT = ".csv,.xlsx,.xls,.pdf,image/png,image/jpeg,image/webp";
const MAX_FILES = 10;
const MAX_FILE_MB = 15;

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Wizard de "traga seus clientes de onde já estão" — mostrado no primeiro
 * acesso e pra quem ainda tem poucos clientes cadastrados. Reúne as 4
 * formas de trazer dado: arquivo/print lido por IA (novo), conexão direta
 * com Trello/ClickUp/Notion (ImportClientsStep já existente, reaproveitado
 * sem mudança), ou cadastro manual (só sai do wizard). */
export function SmartImportStep({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [source, setSource] = useState<Source>(null);
  const [phase, setPhase] = useState<"pick" | "upload" | "processing" | "review" | "done">("pick");
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [result, setResult] = useState<{ imported: number; overLimit: boolean; graceUntil: string | null } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const extract = useServerFn(extractClientsFromFiles);
  const confirm = useServerFn(confirmImportedClients);
  const qc = useQueryClient();

  function pickSource(s: Source) {
    setSource(s);
    if (s === "manual") { onSkip(); return; }
    if (s === "api") { setPhase("upload"); return; } // reuses ImportClientsStep's own flow
    setPhase("upload");
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list).filter((f) => f.size <= MAX_FILE_MB * 1024 * 1024);
    if (incoming.length < list.length) toast.error(`Alguns arquivos passam de ${MAX_FILE_MB}MB e não entraram.`);
    setFiles((prev) => [...prev, ...incoming].slice(0, MAX_FILES));
  }

  async function runExtraction() {
    if (files.length === 0) { toast.error("Manda pelo menos um arquivo."); return; }
    setPhase("processing");
    try {
      const payload = await Promise.all(files.map(async (f) => ({
        name: f.name,
        mimeType: f.type || "application/octet-stream",
        base64: await fileToBase64(f),
      })));
      const res = await extract({ data: { files: payload } });
      if (res.clients.length === 0) {
        toast.error("Não consegui identificar nenhum cliente nesses arquivos.");
        setPhase("upload");
        return;
      }
      setRows(res.clients.map((c) => ({ ...c, selected: true })));
      setPhase("review");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao ler os arquivos.");
      setPhase("upload");
    }
  }

  function updateRow(i: number, patch: Partial<ReviewRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function runImport() {
    const selected = rows.filter((r) => r.selected && r.name.trim());
    if (selected.length === 0) { toast.error("Seleciona pelo menos um cliente."); return; }
    try {
      const res = await confirm({
        data: {
          clients: selected.map((r) => ({
            name: r.name.trim(),
            category: r.category?.trim() || undefined,
            niche: r.niche?.trim() || undefined,
            notes: r.notes?.trim() || undefined,
            postsPerWeek: r.postsPerWeek,
            reelsPerWeek: r.reelsPerWeek,
            whatsapp: r.whatsapp?.trim() || undefined,
          })),
        },
      });
      setResult(res);
      setPhase("done");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["setup-checklist"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao importar.");
    }
  }

  const selectedCount = rows.filter((r) => r.selected).length;

  return (
    <div>
      {phase === "pick" && (
        <div className="grid grid-cols-2 gap-2.5">
          <SourceCard icon={<FileText size={18} />} title="Arquivo" desc="Planilha, CSV, PDF ou export de qualquer sistema." onClick={() => pickSource("file")} />
          <SourceCard icon={<ImageIcon size={18} />} title="Prints de tela" desc="Foto da lista de clientes de onde você organiza hoje." onClick={() => pickSource("shot")} />
          <SourceCard icon={<Link2 size={18} />} title="Trello / ClickUp / Notion" desc="Conecta direto com um token." onClick={() => pickSource("api")} />
          <SourceCard icon={<PenLine size={18} />} title="Vou cadastrar na mão" desc="Sem importar nada, começa direto." onClick={() => pickSource("manual")} />
        </div>
      )}

      {phase === "upload" && source === "api" && (
        <ImportClientsStep onDone={onDone} onSkip={() => { setSource(null); setPhase("pick"); }} />
      )}

      {phase === "upload" && (source === "file" || source === "shot") && (
        <div>
          <div
            className="border border-dashed border-foreground/20 rounded-xl p-8 text-center cursor-pointer hover:border-[rgb(var(--lz-brand-rgb))]/50 hover:bg-[rgba(var(--lz-brand-rgb),0.04)] transition"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
          >
            <div className="h-11 w-11 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.12)", color: "var(--lz-accent-ink)" }}>
              <Upload size={20} />
            </div>
            <p className="text-sm font-semibold text-foreground">Arraste os arquivos aqui</p>
            <p className="text-xs text-foreground/50 mt-1">ou toque pra escolher do seu aparelho</p>
            <input ref={inputRef} type="file" multiple accept={ACCEPT} className="hidden"
              onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          </div>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2.5 bg-foreground/[0.04] border border-foreground/8 rounded-lg px-3 py-2 text-xs">
                  <FileText size={14} className="text-[var(--lz-accent-ink)] shrink-0" />
                  <span className="flex-1 font-medium truncate">{f.name}</span>
                  <span className="text-foreground/40">{(f.size / 1024).toFixed(0)}KB</span>
                  <button onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} className="text-foreground/40 hover:text-red-400">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <button onClick={() => { setSource(null); setPhase("pick"); setFiles([]); }} className="text-xs text-foreground/50 hover:text-foreground">← Voltar</button>
            <button onClick={runExtraction} disabled={files.length === 0}
              className="text-sm font-bold px-5 py-2.5 rounded-md disabled:opacity-40"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              Ler arquivos
            </button>
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="text-center py-10">
          <Loader2 size={38} className="animate-spin mx-auto mb-4 text-[var(--lz-accent-ink)]" />
          <p className="text-sm font-semibold text-foreground">Lendo seus arquivos…</p>
          <p className="text-xs text-foreground/50 mt-1">Isso leva só alguns segundos.</p>
        </div>
      )}

      {phase === "review" && (
        <div>
          <div className="flex items-start gap-2.5 bg-[rgba(var(--lz-brand-rgb),0.08)] border border-[rgba(var(--lz-brand-rgb),0.25)] rounded-lg px-3 py-2.5 mb-4 text-xs text-foreground/70 leading-relaxed">
            ⚠️ <span><b className="text-foreground">A leitura por IA pode errar.</b> Confere nome, categoria e o resto de cada linha antes de importar — desmarca o que não quiser trazer.</span>
          </div>
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-foreground/40">
                  <th className="pb-2"></th><th className="pb-2">Cliente</th><th className="pb-2">Categoria</th><th className="pb-2">Notas</th><th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t border-foreground/8">
                    <td className="py-2 pr-2">
                      <input type="checkbox" checked={r.selected} onChange={(e) => updateRow(i, { selected: e.target.checked })}
                        className="accent-[rgb(var(--lz-brand-rgb))]" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={r.name} onChange={(e) => updateRow(i, { name: e.target.value })}
                        className="w-full bg-transparent border border-transparent hover:border-foreground/10 focus:border-[rgb(var(--lz-brand-rgb))] focus:bg-foreground/5 rounded px-1.5 py-1 outline-none font-semibold text-foreground" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={r.category ?? ""} onChange={(e) => updateRow(i, { category: e.target.value })}
                        className="w-full bg-transparent border border-transparent hover:border-foreground/10 focus:border-[rgb(var(--lz-brand-rgb))] focus:bg-foreground/5 rounded px-1.5 py-1 outline-none" />
                    </td>
                    <td className="py-2 pr-2">
                      <input value={r.notes ?? ""} onChange={(e) => updateRow(i, { notes: e.target.value })}
                        className="w-full bg-transparent border border-transparent hover:border-foreground/10 focus:border-[rgb(var(--lz-brand-rgb))] focus:bg-foreground/5 rounded px-1.5 py-1 outline-none text-foreground/60" />
                    </td>
                    <td className="py-2">
                      <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap ${r.confidence === "low" ? "text-amber-400 bg-amber-400/15" : "text-[var(--lz-accent-ink)] bg-[rgba(var(--lz-brand-rgb),0.15)]"}`}>
                        {r.confidence === "low" ? "conferir" : "ok"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-foreground/35 mt-3">{rows.length} detectados · {selectedCount} selecionados pra importar</p>
          <div className="flex items-center justify-between mt-6">
            <button onClick={() => { setPhase("upload"); setRows([]); }} className="text-xs text-foreground/50 hover:text-foreground">← Voltar</button>
            <button onClick={runImport} disabled={selectedCount === 0}
              className="text-sm font-bold px-5 py-2.5 rounded-md disabled:opacity-40"
              style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
              Importar {selectedCount} cliente{selectedCount === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      )}

      {phase === "done" && result && (
        <div className="text-center py-6">
          <div className="h-14 w-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }}>
            <CheckCircle2 size={26} />
          </div>
          <p className="text-base font-bold text-foreground">{result.imported} cliente{result.imported === 1 ? "" : "s"} importado{result.imported === 1 ? "" : "s"}</p>
          {result.overLimit && result.graceUntil && (
            <p className="text-xs text-amber-400 mt-2 max-w-xs mx-auto leading-relaxed">
              Isso passa do limite do seu plano atual — trouxemos todo mundo mesmo assim. Você tem até{" "}
              <b>{new Date(result.graceUntil).toLocaleDateString("pt-BR")}</b> pra fazer upgrade.
            </p>
          )}
          <button onClick={onDone} className="mt-6 text-sm font-bold px-6 py-2.5 rounded-md"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}>
            Ir pro painel
          </button>
        </div>
      )}
    </div>
  );
}

function SourceCard({ icon, title, desc, onClick }: { icon: React.ReactNode; title: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="flex flex-col items-start gap-2 text-left bg-foreground/[0.03] hover:bg-[rgba(var(--lz-brand-rgb),0.06)] border border-foreground/8 hover:border-[rgba(var(--lz-brand-rgb),0.4)] rounded-xl p-3.5 transition">
      <div className="h-8 w-8 rounded-md flex items-center justify-center" style={{ backgroundColor: "rgba(var(--lz-brand-rgb),0.14)", color: "var(--lz-accent-ink)" }}>
        {icon}
      </div>
      <div className="text-[13px] font-bold text-foreground">{title}</div>
      <div className="text-[11px] text-foreground/50 leading-snug">{desc}</div>
    </button>
  );
}
