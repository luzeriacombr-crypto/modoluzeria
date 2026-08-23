import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CircleHelp, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "./Modals";
import { reportBug } from "@/lib/luzeria/bug-reports.functions";

const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = ["image/png", "image/jpeg", "image/webp"];

export function HelpButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const submitReport = useServerFn(reportBug);

  function pickFile(f: File) {
    if (f.size > MAX_SIZE) { toast.error("Print maior que 5MB."); return; }
    if (!ACCEPT.includes(f.type)) { toast.error("Use JPG, PNG ou WEBP."); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function close() {
    setOpen(false);
    setMessage("");
    setWhatsapp("");
    setFile(null);
    setPreview(null);
  }

  async function fileToBase64(f: File): Promise<string> {
    const buf = await f.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buf);
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function submit() {
    if (!message.trim()) return;
    setSending(true);
    try {
      const screenshotBase64 = file ? await fileToBase64(file) : undefined;
      await submitReport({
        data: {
          message: message.trim(),
          pageUrl: window.location.href,
          whatsapp: whatsapp.trim() || undefined,
          screenshotBase64,
          screenshotContentType: file?.type,
        },
      });
      toast.success("Reportado! Obrigado, vamos verificar.");
      close();
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível enviar o reporte.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Ajuda / Reportar erro"
        className="flex items-center justify-center h-8 w-8 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
      >
        <CircleHelp size={18} />
      </button>

      <Modal open={open} onClose={close} title="Reportar um problema">
        <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">
          O que aconteceu?
        </label>
        <textarea
          autoFocus
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Descreva o que você esperava e o que aconteceu…"
          className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))] resize-none"
        />

        <div className="mt-4">
          <label className="block text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">
            Seu WhatsApp (opcional)
          </label>
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Pra gente te chamar se precisar de mais detalhes"
            className="w-full bg-background border border-foreground/10 rounded-md px-3 py-2 text-sm text-foreground outline-none focus:border-[rgb(var(--lz-brand-rgb))]"
          />
        </div>

        <div className="mt-4">
          <div className="text-[10px] uppercase font-semibold tracking-wider text-foreground/40 mb-1.5">
            Print (opcional)
          </div>
          <input
            ref={inputRef} type="file" accept={ACCEPT.join(",")} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) pickFile(f); }}
          />
          {preview ? (
            <div className="relative inline-block">
              <img src={preview} alt="Print anexado" className="max-h-32 rounded-md border border-foreground/10" />
              <button
                onClick={() => { setFile(null); setPreview(null); }}
                className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-black/80 text-foreground flex items-center justify-center"
              ><X size={11} /></button>
            </div>
          ) : (
            <button
              onClick={() => inputRef.current?.click()}
              className="w-full flex items-center justify-center gap-1.5 border border-dashed border-foreground/15 rounded-md py-3 text-xs text-foreground/50 hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Paperclip size={13} /> Anexar print
            </button>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 mt-5">
          <button onClick={close} className="px-3 py-2 text-sm text-foreground/60 hover:text-foreground">Cancelar</button>
          <button
            disabled={!message.trim() || sending}
            onClick={submit}
            className="px-4 py-2 rounded-md text-sm font-bold disabled:opacity-50 transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            {sending ? "Enviando…" : "Enviar"}
          </button>
        </div>
      </Modal>
    </>
  );
}
