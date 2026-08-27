import { useRef, useState } from "react";
import { Mic, Square, X, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

const MAX_SECONDS = 180;

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Botão de microfone ao lado do campo de comentário — grava direto do
 * navegador (MediaRecorder), sem app nenhum. Clica pra gravar, clica de
 * novo pra parar, confirma pra enviar. Corta sozinho em 3 minutos. */
export function AudioCommentRecorder({ onSend, sending }: { onSend: (base64: string, durationSeconds: number) => void; sending: boolean }) {
  const [state, setState] = useState<"idle" | "recording" | "recorded">("idle");
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        blobRef.current = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setState("recorded");
        stopStream();
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setState("recording");
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { recorder.stop(); stopTimer(); return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch {
      toast.error("Não consegui acessar o microfone. Verifique a permissão do navegador.");
    }
  }

  function stopRecording() {
    stopTimer();
    recorderRef.current?.stop();
  }

  function cancel() {
    stopTimer();
    stopStream();
    recorderRef.current = null;
    blobRef.current = null;
    setSeconds(0);
    setState("idle");
  }

  async function send() {
    if (!blobRef.current) return;
    const base64 = await blobToBase64(blobRef.current);
    onSend(base64, seconds || 1);
    cancel();
  }

  if (state === "idle") {
    return (
      <button
        type="button"
        onClick={startRecording}
        title="Gravar áudio"
        className="shrink-0 p-2 rounded-md text-foreground/50 hover:text-[var(--lz-accent-ink)] hover:bg-foreground/5 transition"
      >
        <Mic size={16} />
      </button>
    );
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-2 shrink-0 bg-foreground/[0.06] rounded-md px-2 py-1.5">
        <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs tabular-nums text-foreground/70">{formatTime(seconds)}</span>
        <button type="button" onClick={stopRecording} title="Parar" className="text-foreground/60 hover:text-foreground">
          <Square size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0 bg-foreground/[0.06] rounded-md px-2 py-1.5">
      <Mic size={13} className="text-[var(--lz-accent-ink)]" />
      <span className="text-xs tabular-nums text-foreground/70">{formatTime(seconds)}</span>
      <button type="button" onClick={cancel} disabled={sending} title="Cancelar" className="text-foreground/40 hover:text-red-400 disabled:opacity-40">
        <X size={14} />
      </button>
      <button type="button" onClick={send} disabled={sending} title="Enviar" className="text-[var(--lz-accent-ink)] hover:opacity-80 disabled:opacity-40">
        {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
      </button>
    </div>
  );
}
