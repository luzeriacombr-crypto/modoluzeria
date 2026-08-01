import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FolderTree, Loader2, RefreshCw, Save, HardDrive, ExternalLink } from "lucide-react";
import {
  getDriveConfig,
  setDriveRootFolder,
  reorganizeAllDriveFiles,
  getDriveConnectionStatus,
  getDriveConnectUrl,
} from "@/lib/luzeria/drive.functions";

export function DriveSettingsTab() {
  const getCfg = useServerFn(getDriveConfig);
  const setRoot = useServerFn(setDriveRootFolder);
  const reorganize = useServerFn(reorganizeAllDriveFiles);
  const getConnStatus = useServerFn(getDriveConnectionStatus);
  const getConnectUrl = useServerFn(getDriveConnectUrl);

  const connStatus = useQuery({
    queryKey: ["drive-connection-status"],
    queryFn: () => getConnStatus(),
  });
  const [connecting, setConnecting] = useState(false);

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

  const cfg = useQuery({
    queryKey: ["drive-config"],
    queryFn: () => getCfg(),
  });

  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] =
    useState<{ moved: number; skipped: number; errors: string[] } | null>(null);

  const current = cfg.data?.rootFolderId ?? "";

  async function save() {
    const value = input.trim();
    if (!value) return;
    setSaving(true);
    try {
      const r: any = await setRoot({ data: { folderIdOrUrl: value } });
      toast.success(`Pasta raiz definida: ${r.name}`);
      setInput("");
      cfg.refetch();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar pasta raiz");
    } finally {
      setSaving(false);
    }
  }

  async function runReorganize() {
    if (!confirm("Reorganizar TODOS os arquivos do Drive para a estrutura Entregas - <Cliente> / <Mês>? Pode levar alguns minutos.")) return;
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

  return (
    <div className="space-y-6">
      <section className="bg-[#1C1C1C] rounded-lg p-6 border border-white/[0.06]">
        <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-wider font-bold mb-3">
          <HardDrive size={12} /> Conta do Google Drive
        </div>
        <p className="text-xs text-white/50 mb-4 leading-relaxed">
          Cada agência conecta a própria conta do Google Drive. Os arquivos dessa agência
          ficam só nessa conta — nenhuma outra agência tem acesso a ela.
        </p>
        {connStatus.isLoading ? (
          <div className="text-white/40 text-sm">Verificando…</div>
        ) : status?.connected ? (
          <div className="flex items-center justify-between">
            <div className="text-sm text-[rgb(var(--lz-brand-rgb))] font-medium">
              ✓ Conectado{status.driveEmail ? ` — ${status.driveEmail}` : ""}
            </div>
            <button onClick={connectDrive} disabled={connecting}
              className="text-[11px] text-white/50 hover:text-white transition disabled:opacity-50">
              Trocar de conta
            </button>
          </div>
        ) : (
          <button onClick={connectDrive} disabled={connecting}
            className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50">
            {connecting ? <Loader2 size={14} className="animate-spin" /> : <ExternalLink size={14} />}
            Conectar Google Drive
          </button>
        )}
      </section>

      <section className="bg-[#1C1C1C] rounded-lg p-6 border border-white/[0.06]">
        <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-wider font-bold mb-3">
          <FolderTree size={12} /> Pasta raiz dos clientes
        </div>
        <p className="text-xs text-white/50 mb-4 leading-relaxed">
          Defina a pasta do Google Drive que contém uma subpasta por cliente.
          A estrutura <span className="text-white">Entregas - &lt;Cliente&gt; / &lt;Mês&gt;</span> será criada automaticamente.
        </p>
        <div className="text-[11px] text-white/40 mb-2">
          Atual: <span className="text-white/70 font-mono">{current || "—"}</span>
        </div>
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="ID ou link da pasta no Drive"
            className="lz-input-dark flex-1 bg-[#0D0D0D] border border-white/10 rounded-md px-3 py-2 text-sm text-white placeholder:text-white/30"
          />
          <button
            onClick={save}
            disabled={saving || !input.trim()}
            className="lz-btn-primary text-xs px-4 py-2 rounded-md inline-flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar
          </button>
        </div>
      </section>

      <section className="bg-[#1C1C1C] rounded-lg p-6 border border-white/[0.06]">
        <div className="flex items-center gap-2 text-white/60 text-[11px] uppercase tracking-wider font-bold mb-3">
          <RefreshCw size={12} /> Reorganizar arquivos existentes
        </div>
        <p className="text-xs text-white/50 mb-4 leading-relaxed">
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
          <div className="mt-5 text-xs text-white/70 space-y-1">
            <div>Movidos: <span className="text-[rgb(var(--lz-brand-rgb))] font-semibold">{report.moved}</span></div>
            <div>Ignorados: <span className="text-white/50">{report.skipped}</span></div>
            {report.errors.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-red-400">
                  {report.errors.length} erro(s)
                </summary>
                <ul className="mt-2 space-y-1 text-[11px] font-mono text-white/50">
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