import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Upload, Film, Image as ImageIcon, CheckCircle2, Loader2, ShieldCheck, RotateCcw, X, Clock, AlertTriangle } from "lucide-react";
import {
  getPublicUploadInfo, listPublicUploadFiles, startPublicUpload, uploadPublicChunk, finalizePublicUpload,
} from "@/lib/luzeria/drive.functions";

// Página pública (sem login) pro freelancer enviar imagens e vídeos direto
// pro Drive da agência, no post/reel que a agência escolheu. Cada pessoa vê
// só o que ela mesma mandou (filtro pelo nome informado).
export const Route = createFileRoute("/enviar/$token")({
  component: PublicUploadPage,
  head: () => ({
    meta: [
      { title: "Enviar materiais" },
      { name: "robots", content: "noindex" },
      { name: "description", content: "Envie imagens e vídeos para a agência." },
    ],
  }),
});

// 2,5MB crus ≈ 3,4MB em base64: abaixo do teto de 4,5MB do corpo de requisição
// da Vercel e múltiplo de 256KB (exigência do upload resumível do Google).
const CHUNK_SIZE = 2.5 * 1024 * 1024;
const MAX_ATTEMPTS = 4;
const CONCURRENCY = 2;
const NAME_KEY = "lz_upload_name";

const EXT_MIME: Record<string, string> = {
  mp4: "video/mp4", mov: "video/quicktime", m4v: "video/x-m4v", webm: "video/webm", avi: "video/x-msvideo", mkv: "video/x-matroska",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", heic: "image/heic", heif: "image/heif",
};
function mimeOf(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_MIME[ext] ?? "";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const STEP = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += STEP) binary += String.fromCharCode(...bytes.subarray(i, i + STEP));
  return btoa(binary);
}

function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1).replace(".", ",")} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(n >= 100 * 1024 ** 2 ? 0 : 1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}
function fmtEta(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "calculando…";
  if (seconds < 60) return "menos de 1 min";
  const m = Math.round(seconds / 60);
  if (m < 60) return `~${m} min`;
  const h = Math.floor(m / 60);
  return `~${h} h ${String(m % 60).padStart(2, "0")} min`;
}

type QItem = { id: string; file: File; mime: string; status: "fila" | "enviando" | "concluido" | "erro"; sent: number; error?: string };

function PublicUploadPage() {
  const { token } = Route.useParams();
  const qc = useQueryClient();
  const getInfo = useServerFn(getPublicUploadInfo);
  const listFiles = useServerFn(listPublicUploadFiles);
  const start = useServerFn(startPublicUpload);
  const sendChunk = useServerFn(uploadPublicChunk);
  const finalize = useServerFn(finalizePublicUpload);

  const info = useQuery({ queryKey: ["public-upload-info", token], queryFn: () => getInfo({ data: { token } }), retry: false });

  const [uploaderName, setUploaderName] = useState("");
  useEffect(() => { try { setUploaderName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* sem storage */ } }, []);
  const nameOk = uploaderName.trim().length >= 2;
  function onName(v: string) { setUploaderName(v); try { localStorage.setItem(NAME_KEY, v); } catch { /* ignore */ } }

  const sent = useQuery({
    queryKey: ["public-upload-files", token, uploaderName.trim()],
    queryFn: () => listFiles({ data: { token, uploaderName: uploaderName.trim() } }),
    enabled: nameOk,
    retry: false,
  });

  const [queue, setQueue] = useState<QItem[]>([]);
  const [rejected, setRejected] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const started = useRef<Set<string>>(new Set());
  const samples = useRef<{ t: number; bytes: number }[]>([]);
  const totalSentRef = useRef(0);
  const [, setTick] = useState(0);

  const patch = useCallback((id: string, p: Partial<QItem>) => setQueue((q) => q.map((it) => (it.id === id ? { ...it, ...p } : it))), []);

  const maxFileBytes = info.data?.maxFileBytes ?? 3 * 1024 ** 3;

  function addFiles(list: FileList | File[]) {
    const bad: string[] = [];
    const ok: QItem[] = [];
    for (const file of Array.from(list)) {
      const mime = mimeOf(file);
      if (!/^(image|video)\//i.test(mime)) { bad.push(`${file.name}: só imagens e vídeos`); continue; }
      if (file.size > maxFileBytes) { bad.push(`${file.name}: passa de ${fmtBytes(maxFileBytes)}`); continue; }
      if (file.size === 0) { bad.push(`${file.name}: arquivo vazio`); continue; }
      ok.push({ id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`, file, mime, status: "fila", sent: 0 });
    }
    setRejected(bad);
    if (ok.length) setQueue((q) => [...q, ...ok]);
  }

  // Abre uma sessão por vez: a primeira do nome cria a pasta "Itens enviados por …" no Drive, e as
  // outras só podem começar depois, senão duas criariam a mesma pasta.
  const startLock = useRef<Promise<unknown>>(Promise.resolve());
  function startSerial(payload: Parameters<typeof start>[0]) {
    const run = startLock.current.catch(() => undefined).then(() => start(payload));
    startLock.current = run;
    return run;
  }

  async function uploadOne(item: QItem) {
    try {
      const { uploadUrl, sig } = await startSerial({ data: { token, uploaderName: uploaderName.trim(), name: item.file.name, mimeType: item.mime, size: item.file.size } });
      const total = item.file.size;
      let offset = 0;
      let doneMeta: { id: string } | null = null;
      while (offset < total) {
        const end = Math.min(offset + CHUNK_SIZE, total);
        const base64 = arrayBufferToBase64(await item.file.slice(offset, end).arrayBuffer());
        let result: { done: boolean; meta?: { id: string } } | null = null;
        let lastErr: unknown;
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          try {
            result = await sendChunk({ data: { token, uploadUrl, sig, chunkBase64: base64, rangeStart: offset, rangeEnd: end - 1, totalSize: total, mimeType: item.mime } });
            break;
          } catch (e) {
            lastErr = e;
            if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, 1200 * attempt));
          }
        }
        if (!result) throw lastErr instanceof Error ? lastErr : new Error("Falha de conexão no envio.");
        totalSentRef.current += end - offset;
        samples.current.push({ t: Date.now(), bytes: totalSentRef.current });
        patch(item.id, { sent: end });
        if (result.done) { doneMeta = result.meta ?? null; break; }
        offset = end;
      }
      if (!doneMeta) throw new Error("O envio terminou sem confirmação do Drive.");
      await finalize({ data: { token, uploaderName: uploaderName.trim(), driveFileId: doneMeta.id } });
      patch(item.id, { status: "concluido", sent: total });
      qc.invalidateQueries({ queryKey: ["public-upload-files", token] });
    } catch (e: any) {
      patch(item.id, { status: "erro", error: e?.message ?? "Falha no envio." });
    }
  }

  // Fila: mantém até CONCURRENCY arquivos enviando ao mesmo tempo.
  useEffect(() => {
    const active = queue.filter((i) => i.status === "enviando").length;
    let slots = CONCURRENCY - active;
    if (slots <= 0 || !nameOk) return;
    for (const item of queue) {
      if (slots <= 0) break;
      if (item.status === "fila" && !started.current.has(item.id)) {
        started.current.add(item.id);
        slots--;
        patch(item.id, { status: "enviando" });
        void uploadOne(item);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, nameOk]);

  const busy = queue.some((i) => i.status === "enviando" || i.status === "fila");

  // Atualiza velocidade/ETA a cada segundo e avisa antes de fechar a aba no meio do envio.
  useEffect(() => {
    if (!busy) return;
    const iv = setInterval(() => setTick((t) => t + 1), 1000);
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => { clearInterval(iv); window.removeEventListener("beforeunload", warn); };
  }, [busy]);

  const stats = useMemo(() => {
    const live = queue.filter((i) => i.status !== "erro");
    const total = live.reduce((n, i) => n + i.file.size, 0);
    const done = live.reduce((n, i) => n + (i.status === "concluido" ? i.file.size : i.sent), 0);
    const cutoff = Date.now() - 15000;
    const recent = samples.current.filter((s) => s.t >= cutoff);
    let speed = 0;
    if (recent.length >= 2) {
      const a = recent[0], b = recent[recent.length - 1];
      if (b.t > a.t) speed = (b.bytes - a.bytes) / ((b.t - a.t) / 1000);
    }
    return {
      total, done, pct: total ? Math.min(100, Math.round((done / total) * 100)) : 0, speed,
      eta: speed > 0 ? (total - done) / speed : NaN,
      files: queue.filter((i) => i.status === "concluido").length, count: queue.length,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue, busy, Date.now() >> 10]);

  if (info.isLoading) return <Shell><div className="text-white/60 text-sm">Carregando…</div></Shell>;
  if (!info.data) {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">Link inválido</div>
          <div className="text-white/50 text-sm">Este link não existe. Peça um novo à agência.</div>
        </div>
      </Shell>
    );
  }
  const { status, orgName, orgLogoUrl, clientName, itemLabel, expiresAt } = info.data;
  if (status !== "ativo") {
    return (
      <Shell>
        <div className="text-center">
          <div className="text-white text-2xl font-bold mb-2">{status === "expirado" ? "Link expirado" : "Link cancelado"}</div>
          <div className="text-white/50 text-sm">Peça um novo link à {orgName}.</div>
        </div>
      </Shell>
    );
  }

  const card = { background: "#1C1C1C", border: "1px solid rgba(255,255,255,0.08)" } as const;
  const until = new Date(expiresAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "#0D0D0D" }}>
      <div className="max-w-2xl mx-auto">
        {orgLogoUrl && <img src={orgLogoUrl} alt={orgName} className="h-9 w-auto object-contain mb-6" />}
        <h1 className="text-white text-2xl font-bold mb-1">Enviar materiais</h1>
        <p className="text-white/45 text-sm mb-1">
          Para <b className="text-white/80">{orgName}</b>{clientName ? <> · {clientName}</> : null}
        </p>
        <p className="text-white/35 text-xs mb-3">{itemLabel}</p>
        <div className="inline-flex items-center gap-1.5 text-[11px] text-white/40 mb-6">
          <ShieldCheck size={13} style={{ color: "#6FCF97" }} />
          <span>Sem login: os arquivos vão direto pro Drive da agência. Link válido até {until}.</span>
        </div>

        <div className="rounded-xl p-5 mb-4" style={card}>
          <label className="block text-[11px] uppercase font-bold tracking-wider text-white/40 mb-1.5" htmlFor="uploader">Seu nome</label>
          <input
            id="uploader" value={uploaderName} onChange={(e) => onName(e.target.value)} maxLength={60}
            placeholder="Como a agência vai te identificar"
            className="w-full rounded-md px-3 py-2.5 text-sm text-white outline-none"
            style={{ background: "#0D0D0D", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); if (nameOk) addFiles(e.dataTransfer.files); }}
          className="rounded-xl p-8 text-center mb-4 transition-colors"
          style={{ ...card, borderStyle: "dashed", borderColor: dragging ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.18)", opacity: nameOk ? 1 : 0.55 }}
        >
          <Upload size={26} className="mx-auto mb-3" style={{ color: "rgb(var(--lz-brand-rgb))" }} />
          <div className="text-white font-semibold text-sm mb-1">Arraste as imagens e os vídeos até aqui</div>
          <div className="text-white/40 text-xs mb-4">ou selecione do computador · até {fmtBytes(maxFileBytes)} por arquivo</div>
          <button
            type="button" disabled={!nameOk} onClick={() => fileRef.current?.click()}
            className="px-4 py-2.5 rounded-md text-sm font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
            style={{ background: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            Escolher arquivos
          </button>
          {!nameOk && <div className="text-white/40 text-[11px] mt-3">Digite seu nome acima para liberar o envio.</div>}
          <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
        </div>

        {rejected.length > 0 && (
          <div className="rounded-md px-3 py-2 mb-4 text-[12px] leading-relaxed flex gap-2" style={{ background: "rgba(255,107,107,0.08)", border: "1px solid rgba(255,107,107,0.25)", color: "rgba(255,255,255,0.75)" }}>
            <AlertTriangle size={14} className="shrink-0 mt-0.5" style={{ color: "#FF6B6B" }} />
            <div>{rejected.map((r) => <div key={r}>{r}</div>)}</div>
          </div>
        )}

        {queue.length > 0 && (
          <div className="rounded-xl p-5 mb-4" style={card}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-white font-semibold text-sm inline-flex items-center gap-2">
                {busy ? <Loader2 size={14} className="animate-spin" style={{ color: "rgb(var(--lz-brand-rgb))" }} /> : <CheckCircle2 size={14} style={{ color: "#6FCF97" }} />}
                {busy ? `Enviando ${stats.files} de ${stats.count} arquivos` : `${stats.files} de ${stats.count} arquivos enviados`}
              </div>
              <div className="text-white/50 text-xs tabular-nums">{stats.pct}%</div>
            </div>
            <div className="h-2 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.08)" }}>
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${stats.pct}%`, background: "rgb(var(--lz-brand-rgb))" }} />
            </div>
            <div className="flex items-center justify-between text-[11px] text-white/40 tabular-nums flex-wrap gap-1">
              <span>{fmtBytes(stats.done)} de {fmtBytes(stats.total)}</span>
              {busy && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={11} /> {fmtEta(stats.eta)}{stats.speed > 0 ? ` · ${fmtBytes(stats.speed)}/s` : ""}
                </span>
              )}
            </div>
            {busy && <div className="text-[11px] text-white/35 mt-2">Não feche esta página até terminar.</div>}

            <ul className="mt-4 space-y-2">
              {queue.map((it) => {
                const pct = it.status === "concluido" ? 100 : Math.round((it.sent / it.file.size) * 100);
                const Icon = it.mime.startsWith("video/") ? Film : ImageIcon;
                return (
                  <li key={it.id} className="rounded-lg px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex items-center gap-2.5">
                      <Icon size={15} className="text-white/35 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-white text-[13px] truncate">{it.file.name}</div>
                        <div className="text-[10.5px] text-white/35 tabular-nums">{fmtBytes(it.file.size)}</div>
                      </div>
                      {it.status === "concluido" && <CheckCircle2 size={16} style={{ color: "#6FCF97" }} />}
                      {it.status === "enviando" && <span className="text-[11px] text-white/55 tabular-nums">{pct}%</span>}
                      {it.status === "fila" && <span className="text-[11px] text-white/35">na fila</span>}
                      {it.status === "erro" && (
                        <button type="button" onClick={() => { started.current.delete(it.id); patch(it.id, { status: "fila", sent: 0, error: undefined }); }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-white/70 hover:text-white">
                          <RotateCcw size={12} /> Tentar de novo
                        </button>
                      )}
                      {(it.status === "fila" || it.status === "erro") && (
                        <button type="button" aria-label="Remover" onClick={() => setQueue((q) => q.filter((x) => x.id !== it.id))} className="text-white/30 hover:text-white/70"><X size={14} /></button>
                      )}
                    </div>
                    {(it.status === "enviando" || it.status === "concluido") && (
                      <div className="h-1 rounded-full overflow-hidden mt-2" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: it.status === "concluido" ? "#6FCF97" : "rgb(var(--lz-brand-rgb))" }} />
                      </div>
                    )}
                    {it.status === "erro" && <div className="text-[11px] mt-1.5" style={{ color: "#FF8A8A" }}>{it.error}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {nameOk && (sent.data?.length ?? 0) > 0 && (
          <div className="rounded-xl p-5" style={card}>
            <div className="text-[11px] uppercase font-bold tracking-wider text-white/40 mb-3">Seus arquivos já enviados ({sent.data!.length})</div>
            <ul className="space-y-1.5">
              {sent.data!.map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-[13px] text-white/80">
                  <CheckCircle2 size={14} style={{ color: "#6FCF97" }} className="shrink-0" />
                  <span className="truncate flex-1">{f.name}</span>
                  {f.sizeBytes ? <span className="text-[11px] text-white/35 tabular-nums">{fmtBytes(f.sizeBytes)}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center px-6" style={{ background: "#0D0D0D" }}>
      <div className="max-w-md w-full">{children}</div>
    </div>
  );
}
