import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Video } from "lucide-react";
import { useCallStore } from "@/lib/luzeria/call-store";
import { CallInvitePicker } from "./CallInvitePicker";

/** Extraído do cabeçalho (App.tsx) pra poder renderizar tanto lá quanto
 * dentro do menu em grade (NavGridLauncher) — mesma lógica de sempre
 * (`getBoundingClientRect` do próprio botão pra ancorar o picker via
 * portal), só que agora o botão pode estar em lugares diferentes na
 * árvore sem quebrar o posicionamento. */
export function VideoCallButton({ className }: { className?: string }) {
  const canCall = useCallStore((s) => s.canCall);
  const callStatus = useCallStore((s) => s.status);
  const [callPickerOpen, setCallPickerOpen] = useState(false);
  const [callAnchor, setCallAnchor] = useState<DOMRect | null>(null);
  const callBtnRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="relative">
      <button
        ref={callBtnRef}
        onClick={() => {
          const rect = callBtnRef.current?.getBoundingClientRect();
          if (rect) { setCallAnchor(rect); setCallPickerOpen(true); }
        }}
        disabled={!canCall || callStatus !== "idle"}
        title={!canCall ? "Câmera indisponível neste navegador" : callStatus !== "idle" ? "Você já está em uma chamada" : "Vídeo chamada"}
        className={className ?? "flex items-center justify-center h-8 w-8 rounded-md text-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"}
      >
        <Video size={18} />
      </button>
      {callPickerOpen && callAnchor && createPortal(
        <CallInvitePicker anchorRect={callAnchor} onClose={() => setCallPickerOpen(false)} />,
        document.body,
      )}
    </div>
  );
}
