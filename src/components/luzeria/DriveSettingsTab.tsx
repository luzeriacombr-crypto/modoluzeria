import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Loader2, RefreshCw, HardDrive, ExternalLink, Video,
  Folder, ChevronRight, Check, X, ArrowLeft, Sparkles,
} from "lucide-react";
import { requestConfirm } from "@/lib/luzeria/confirm-store";
import {
  getDriveConfig,
  setDriveRootFolder,
  reorganizeAllDriveFiles,
  getDriveConnectionStatus,
  getDriveConnectUrl,
  listDriveFolderChildren,
  getClientFolderMatches,
  applyClientFolderMatches,
} from "@/lib/luzeria/drive.functions";

type WizardStep = 1 | 2 | 3;

function StepDot({ step, label, state, onClick }: {
  step: number; label: string; state: "done" | "active" | "todo"; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 group" disabled={state === "todo"}>
      <span
        className="h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 transition"
        style={state === "done"
          ? { backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }
          : state === "active"
            ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.18)", color: "var(--lz-accent-ink)", border: "2px solid rgb(var(--lz-brand-rgb))" }
            : { border: "2px solid color-mix(in srgb, var(--foreground) 12%, transparent)", color: "color-mix(in srgb, var(--foreground) 30%, transparent)" }}
      >
        {state === "done" ? <Check size={13} /> : step}
      </span>
      <span
        className={`text-[11px] font-semibold whitespace-nowrap ${state === "todo" ? "cursor-default" : "cursor-pointer group-hover:underline"}`}
        style={{ color: state === "todo" ? "color-mix(in srgb, var(--foreground) 35%, transparent)" : state === "active" ? "var(--foreground)" : "color-mix(in srgb, var(--foreground) 55%, transparent)" }}
      >
        {label}
      </span>
    </button>
  );
}

/** Navegador de pastas do Drive — navega clicando, com breadcrumb, pra
 * escolher a pasta raiz sem precisar colar ID/link. */
function DriveFolderPicker({ onPicked }: { onPicked: (id: string, name: string) => void }) {
  const listChildren = useServerFn(listDriveFolderChildren);
  const [stack, setStack] = useState<{ id: string; name: string }[]>([{ id: "root", name: "Meu Drive" }]);
  const current = stack[stack.length - 1];
  const { data: children, isLoading } = useQuery({
    queryKey: ["drive-folder-children", current.id],
    queryFn: () => listChildren({ data: { folderId: current.id === "root" ? undefined : current.id } }),
  });

  return (
    <div className="border border-foreground/10 rounded-md overflow-hidden">
      <div className="flex items-center gap-1 px-3 py-2 bg-foreground/[0.03] text-[11px] flex-wrap">
        {stack.map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={11} className="text-foreground/25" />}
            <button
              onClick={() => setStack(stack.slice(0, i + 1))}
              className={i === stack.length - 1 ? "text-foreground font-semibold" : "text-foreground/50 hover:text-foreground"}
            >
              {s.name}
            </button>
          </span>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-6 text-center"><Loader2 size={16} className="animate-spin mx-auto text-foreground/30" /></div>
        ) : !children?.length ? (
          <div className="px-3 py-6 text-center text-[11px] text-foreground/35">Nenhuma subpasta aqui.</div>
        ) : (
          children.map((f: any) => (
            <button
              key={f.id}
              onClick={() => setStack([...stack, { id: f.id, name: f.name }])}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground/80 hover:bg-foreground/5 text-left border-t border-foreground/5"
            >
              <Folder size={13} className="text-foreground/35 shrink-0" />
              <span className="truncate flex-1">{f.name}</span>
              <ChevronRight size={12} className="text-foreground/25 shrink-0" />
            </button>
          ))
        )}
      </div>
      <div className="px-3 py-2.5 border-t border-foreground/10 flex items-center justify-between gap-2 bg-foreground/[0.02]">
        <span className="text-[10.5px] text-foreground/40 truncate">Selecionar: <span className="text-foreground/70">{current.name}</span></span>
        <button
          onClick={() => onPicked(current.id, current.name)}
          className="lz-btn-primary text-[11px] px-3 py-1.5 rounded-md inline-flex items-center gap-1.5 shrink-0"
        >
          <Check size={12} /> Selecionar esta pasta
        </button>
      </div>
    </div>
  );
}

export function DriveSettingsTab() {
  const qc = useQueryClient();
  const getConnStatus = useServerFn(getDriveConnectionStatus);
  const getConnectUrl = useServerFn(getDriveConnectUrl);
  const getCfg = useServerFn(getDriveConfig);
  const setRoot = useServerFn(setDriveRootFolder);
  const getMatches = useServerFn(getClientFolderMatches);
  const applyMatches = useServerFn(applyClientFolderMatches);
  const reorganize = useServerFn(reorganizeAllDriveFiles);

  const connStatus = useQuery({ queryKey: ["drive-connection-status"], queryFn: () => getConnStatus() });
  const cfg = useQuery({ queryKey: ["drive-config"], queryFn: () => getCfg() });
  const [connecting, setConnecting] = useState(false);

  const step1Done = !!connStatus.data?.connected;
  const step2Done = !!cfg.data?.isConfigured;

  const [manualStep, setManualStep] = useState<WizardStep | null>(null);
  const activeStep: WizardStep = manualStep ?? (!step1Done ? 1 : !step2Done ? 2 : 3);

  async function connectDrive() {
    setConnecting(true);
    try {
      const r: any = await getConnectUrl({ data: { redirectOrigin: window.location.origin } });
      window.location.href = r.url;
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao iniciar conexão com o Drive");
      setConnecting(false);
    }
  }

  const [pasteInput, setPasteInput] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [savingRoot, setSavingRoot] = useState(false);

  async function saveRoot(idOrUrl: string) {
    if (!idOrUrl.trim()) return;
    setSavingRoot(true);
    try {
      await setRoot({ data: { folderIdOrUrl: idOrUrl.trim() } });
      toast.success("Pasta raiz definida.");
      setPasteInput("");
      qc.invalidateQueries({ queryKey: ["drive-config"] });
      qc.invalidateQueries({ queryKey: ["setup-checklist"] });
      setManualStep(3);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar pasta raiz");
    } finally {
      setSavingRoot(false);
    }
  }

  // Passo 3: sugestões de match + edição manual por linha.
  const matchesQuery = useQuery({
    queryKey: ["drive-client-matches"],
    queryFn: () => getMatches(),
    enabled: activeStep === 3,
  });
  const [decisions, setDecisions] = useState<Record<string, { accept: boolean; folderId: string | null }>>({});
  const [applying, setApplying] = useState(false);

  function decisionFor(clientId: string, match: { id: string; name: string } | null) {
    return decisions[clientId] ?? { accept: !!match, folderId: match?.id ?? null };
  }

  async function confirmMatches() {
    const suggestions = matchesQuery.data?.suggestions ?? [];
    if (suggestions.length === 0) return;
    setApplying(true);
    try {
      const assignments = suggestions.map((s: any) => {
        const d = decisionFor(s.clientId, s.match);
        return { clientId: s.clientId, folderId: d.accept ? d.folderId : null };
      });
      const r: any = await applyMatches({ data: { assignments } });
      toast.success(`${r.applied} cliente${r.applied === 1 ? "" : "s"} vinculado${r.applied === 1 ? "" : "s"}.`);
      if (r.errors?.length) toast.error(`${r.errors.length} com problema — veja o detalhe abaixo.`);
      setDecisions({});
      qc.invalidateQueries({ queryKey: ["drive-client-matches"] });
      qc.invalidateQueries({ queryKey: ["setup-checklist"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao vincular clientes");
    } finally {
      setApplying(false);
    }
  }

  const [running, setRunning] = useState(false);
  const [report, setReport] = useState<{ moved: number; skipped: number; errors: string[] } | null>(null);
  async function runReorganize() {
    if (!(await requestConfirm("Reorganizar TODOS os arquivos do Drive para a estrutura Entregas - <Cliente> / <Mês>? Pode levar alguns minutos."))) return;
    setRunning(true);
    setReport(null);
    try {
      const r: any = await reorganize();
      setReport({ moved: r.moved, skipped: r.skipped, errors: r.errors ?? [] });
      toast.success(`Movidos ${r.moved} arquivo(s).`);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na reorganização");
    } finally {
      setRunning(false);
    }
  }

  const status = connStatus.data;
  const suggestions = matchesQuery.data?.suggestions ?? [];

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-lg p-6 border border-foreground/6">
        <div className="flex items-center gap-2 text-foreground/60 text-[11px] uppercase tracking-wider font-bold mb-4">
          <HardDrive size={12} /> Assistente de configuração
        </div>

        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <StepDot step={1} label="Conectar conta" state={step1Done ? "done" : activeStep === 1 ? "active" : "todo"} onClick={() => setManualStep(1)} />
          <div className="h-px w-6 bg-foreground/10 shrink-0" />
          <StepDot step={2} label="Pasta raiz" state={step2Done ? "done" : activeStep === 2 ? "active" : "todo"} onClick={() => step1Done && setManualStep(2)} />
          <div className="h-px w-6 bg-foreground/10 shrink-0" />
          <StepDot step={3} label="Vincular clientes" state={activeStep === 3 && step1Done && step2Done ? "active" : "todo"} onClick={() => step1Done && step2Done && setManualStep(3)} />
        </div>

        {activeStep === 1 && (
          <div>
            <p className="text-xs text-foreground/50 mb-2 leading-relaxed">
              Cada agência conecta a própria conta do Google Drive. Os arquivos dessa agência
              ficam só nessa conta — nenhuma outra agência tem acesso a ela.
            </p>
            <a
              href="https://youtu.be/UhX1xvRlMSM?si=in2xsAV4x2xDNxOw"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 mb-4 text-xs font-semibold rounded-full transition-opacity hover:opacity-80"
              style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)", color: "var(--lz-accent-ink)" }}
            >
              <Video size={13} /> Precisa de ajuda? Assista o tutorial!
            </a>
            {connStatus.isLoading ? (
              <div className="text-foreground/40 text-sm">Verificando…</div>
            ) : status?.connected ? (
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="text-sm text-[var(--lz-accent-ink)] font-medium">
                  ✓ Conectado{status.driveEmail ? ` — ${status.driveEmail}` : ""}
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={connectDrive} disabled={connecting}
                    className="text-[11px] text-foreground/50 hover:text-foreground transition disabled:opacity-50">
                    Trocar de conta
                  </button>
                  <button onClick={() => setManualStep(2)}
                    className="lz-btn-primary text-xs px-4 py-2 rounded-md">
                    Continuar →
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={connectDrive} disabled={connecting}
                className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50">
                {connecting ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
                Conectar Google Drive
              </button>
            )}
          </div>
        )}

        {activeStep === 2 && (
          <div>
            <p className="text-xs text-foreground/50 mb-4 leading-relaxed">
              Escolha a pasta do Drive que contém (ou vai conter) uma subpasta pra cada cliente. A
              estrutura <span className="text-foreground">Entregas - &lt;Cliente&gt; / &lt;Mês&gt;</span> é
              criada automaticamente dentro dela.
            </p>

            {step2Done && (
              <div className="flex items-center gap-2 mb-3 text-xs" style={{ color: "var(--lz-accent-ink)" }}>
                <Check size={14} /> Pasta atual: <span className="text-foreground font-medium">{cfg.data?.rootFolderName ?? cfg.data?.rootFolderId}</span>
              </div>
            )}

            <DriveFolderPicker onPicked={(id, name) => saveRoot(id)} />

            <button onClick={() => setShowPaste((v) => !v)} className="text-[11px] text-foreground/40 hover:text-foreground/70 mt-3 underline">
              {showPaste ? "Esconder" : "Prefiro colar o ID ou link da pasta"}
            </button>
            {showPaste && (
              <div className="flex gap-2 mt-2">
                <input
                  value={pasteInput}
                  onChange={(e) => setPasteInput(e.target.value)}
                  placeholder="ID ou link da pasta no Drive"
                  className="lz-input-dark flex-1 bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground placeholder:text-foreground/30"
                />
                <button
                  onClick={() => saveRoot(pasteInput)}
                  disabled={savingRoot || !pasteInput.trim()}
                  className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {savingRoot ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Salvar
                </button>
              </div>
            )}

            {step1Done && (
              <button onClick={() => setManualStep(1)} className="text-[11px] text-foreground/40 hover:text-foreground/70 mt-4 inline-flex items-center gap-1">
                <ArrowLeft size={11} /> Voltar
              </button>
            )}
          </div>
        )}

        {activeStep === 3 && (
          <div>
            <p className="text-xs text-foreground/50 mb-4 leading-relaxed">
              Comparamos o nome de cada cliente com as pastas que já existem dentro da pasta raiz.
              Confira se bateu certo — o que não tiver pasta ainda, a gente cria do zero.
            </p>

            {matchesQuery.isLoading ? (
              <div className="py-8 text-center"><Loader2 size={18} className="animate-spin mx-auto text-foreground/30" /></div>
            ) : suggestions.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-foreground/50 py-4">
                <Check size={15} style={{ color: "var(--lz-accent-ink)" }} />
                {matchesQuery.data?.total
                  ? `Todos os ${matchesQuery.data.total} clientes já estão vinculados.`
                  : "Nenhum cliente ativo ainda — adicione clientes pra vincular pastas."}
              </div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {suggestions.map((s: any) => {
                    const d = decisionFor(s.clientId, s.match);
                    return (
                      <div key={s.clientId} className="flex items-center gap-3 px-3 py-2.5 rounded-md bg-foreground/[0.03]">
                        <span className="text-xs font-semibold text-foreground w-32 truncate shrink-0">{s.clientName}</span>
                        <ChevronRight size={12} className="text-foreground/25 shrink-0" />
                        {s.match ? (
                          <span className="text-xs text-foreground/60 flex-1 truncate">
                            <Folder size={11} className="inline -mt-0.5 mr-1 text-foreground/35" />
                            {s.match.name}
                          </span>
                        ) : (
                          <span className="text-xs text-foreground/35 flex-1 italic">nenhuma pasta parecida — vamos criar nova</span>
                        )}
                        <button
                          onClick={() => setDecisions({ ...decisions, [s.clientId]: { ...d, accept: !d.accept } })}
                          className="text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full shrink-0 flex items-center gap-1"
                          style={d.accept
                            ? { backgroundColor: "rgba(var(--lz-brand-rgb),0.15)", color: "var(--lz-accent-ink)" }
                            : { backgroundColor: "color-mix(in srgb, var(--foreground) 8%, transparent)", color: "color-mix(in srgb, var(--foreground) 45%, transparent)" }}
                        >
                          {d.accept ? <Check size={11} /> : <X size={11} />}
                          {s.match ? (d.accept ? "Usar essa" : "Ignorar — criar nova") : (d.accept ? "Criar nova" : "Ignorar")}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={confirmMatches}
                  disabled={applying}
                  className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50"
                >
                  {applying ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Confirmar e vincular
                </button>
              </>
            )}

            <button onClick={() => setManualStep(2)} className="text-[11px] text-foreground/40 hover:text-foreground/70 mt-4 inline-flex items-center gap-1">
              <ArrowLeft size={11} /> Voltar
            </button>
          </div>
        )}
      </section>

      <section className="bg-card rounded-lg p-6 border border-foreground/6">
        <div className="flex items-center gap-2 text-foreground/60 text-[11px] uppercase tracking-wider font-bold mb-3">
          <RefreshCw size={12} /> Reorganizar arquivos existentes
        </div>
        <p className="text-xs text-foreground/50 mb-4 leading-relaxed">
          Move todos os arquivos já anexados a tarefas para a estrutura organizada por cliente e mês.
          Novos uploads e novos anexos já caem direto no lugar certo.
        </p>
        <button
          onClick={runReorganize}
          disabled={running}
          className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50"
        >
          {running ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Reorganizar agora
        </button>

        {report && (
          <div className="mt-5 text-xs text-foreground/70 space-y-1">
            <div>Movidos: <span className="text-[var(--lz-accent-ink)] font-semibold">{report.moved}</span></div>
            <div>Ignorados: <span className="text-foreground/50">{report.skipped}</span></div>
            {report.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-400">
                  {report.errors.length} erro(s)
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] font-mono text-foreground/50">
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
