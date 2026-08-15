import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { PhoneOff, ScreenShare, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import type { useScreenShareCall } from "@/hooks/use-screen-share-call";

function statusLabel(status: string, role: "sharer" | "viewer" | null) {
  if (status === "ringing-outgoing") return "Chamando…";
  if (status === "connecting") return "Conectando…";
  if (status === "active" && role === "sharer") return "Compartilhando sua tela";
  return "Em chamada";
}

/** Global floating panel for an outgoing/connecting/active call — mounted
 * once in App.tsx alongside IncomingCallModal, so a call survives page
 * navigation. The viewer side renders the live <video>; the sharer side
 * only shows a status line (no self-preview in v1). */
export function ActiveCallOverlay({ call }: { call: ReturnType<typeof useScreenShareCall> }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  const visible = call.status === "ringing-outgoing" || call.status === "connecting" || call.status === "active";
  if (!visible || !call.peer) return null;

  const isViewerActive = call.status === "active" && call.role === "viewer";
  const isConnecting = call.status !== "active";

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[350] w-[min(360px,calc(100vw-2rem))]">
      <div className="bg-[#1C1C1C] rounded-xl border border-white/10 shadow-2xl overflow-hidden lz-modal-in">
        {isViewerActive ? (
          <video ref={videoRef} autoPlay playsInline className="w-full aspect-video bg-black object-contain" />
        ) : (
          <div className="flex items-center gap-3 px-4 pt-4">
            <Avatar name={call.peer.name} avatarUrl={call.peer.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{call.peer.name}</div>
              <div className="text-[11px] text-white/50">{statusLabel(call.status, call.role)}</div>
            </div>
            {isConnecting && <Loader2 size={16} className="text-white/40 animate-spin shrink-0" />}
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-white/60 min-w-0">
            <ScreenShare size={13} className="shrink-0" />
            <span className="truncate">{isViewerActive ? call.peer.name : statusLabel(call.status, call.role)}</span>
          </div>
          <button
            onClick={call.status === "ringing-outgoing" ? call.actions.cancelOutgoing : call.actions.hangup}
            className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors shrink-0"
          >
            <PhoneOff size={12} /> {call.status === "ringing-outgoing" ? "Cancelar" : "Encerrar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
