import { createPortal } from "react-dom";
import { useEffect, useRef } from "react";
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";
import type { useScreenShareCall } from "@/hooks/use-screen-share-call";

function statusLabel(status: string) {
  if (status === "ringing-outgoing") return "Chamando…";
  if (status === "connecting") return "Conectando…";
  return "Em chamada";
}

function CallButton({ onClick, active, danger, disabled, title, children }: {
  onClick: () => void; active?: boolean; danger?: boolean; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-9 w-9 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        backgroundColor: danger ? "#E5484D" : active ? "rgb(var(--lz-brand-rgb))" : "rgba(255,255,255,0.08)",
        color: danger ? "#FFFFFF" : active ? "#0D0D0D" : "rgba(255,255,255,0.8)",
      }}
    >
      {children}
    </button>
  );
}

/** Global floating panel for an outgoing/connecting/active video call —
 * mounted once in App.tsx alongside IncomingCallModal, so a call survives
 * page navigation. Camera flows both ways once active; screen sharing is an
 * in-call toggle that swaps the outgoing video track (see
 * use-screen-share-call.ts's toggleScreenShare — no self-preview of the
 * screen itself, just a badge, to keep v1 simple). */
export function ActiveCallOverlay({ call }: { call: ReturnType<typeof useScreenShareCall> }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current) localVideoRef.current.srcObject = call.localStream;
  }, [call.localStream]);
  useEffect(() => {
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = call.remoteStream;
  }, [call.remoteStream]);

  const visible = call.status === "ringing-outgoing" || call.status === "connecting" || call.status === "active";
  if (!visible || !call.peer) return null;

  const isActive = call.status === "active";

  return createPortal(
    <div className="fixed bottom-4 right-4 z-[350] w-[min(340px,calc(100vw-2rem))]">
      <div className="bg-[#1C1C1C] rounded-xl border border-white/10 shadow-2xl overflow-hidden lz-modal-in">
        {isActive ? (
          <div className="relative aspect-video bg-black">
            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
            {call.remoteSharingScreen && (
              <div className="absolute top-2 left-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-black/60 text-white">
                <ScreenShare size={11} /> {call.peer.name} compartilhando
              </div>
            )}
            <div className="absolute bottom-2 right-2 h-16 w-24 rounded-md overflow-hidden bg-[#0D0D0D] border border-white/20">
              {call.camOn ? (
                <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Avatar name="Você" size={20} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 px-4 pt-4 pb-2">
            <Avatar name={call.peer.name} avatarUrl={call.peer.avatarUrl} size={36} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-white truncate">{call.peer.name}</div>
              <div className="text-[11px] text-white/50">{statusLabel(call.status)}</div>
            </div>
            <Loader2 size={16} className="text-white/40 animate-spin shrink-0" />
          </div>
        )}

        <div className="flex items-center justify-between px-3 py-2.5">
          {isActive ? (
            <div className="flex items-center gap-1.5">
              <CallButton onClick={call.actions.toggleMic} active={call.micOn} title={call.micOn ? "Mudo" : "Ativar áudio"}>
                {call.micOn ? <Mic size={15} /> : <MicOff size={15} />}
              </CallButton>
              <CallButton onClick={call.actions.toggleCamera} active={call.camOn} title={call.camOn ? "Desligar câmera" : "Ligar câmera"}>
                {call.camOn ? <Video size={15} /> : <VideoOff size={15} />}
              </CallButton>
              <CallButton
                onClick={call.actions.toggleScreenShare}
                active={call.isSharingScreen}
                disabled={!call.canShareScreen}
                title={!call.canShareScreen ? "Disponível apenas no computador" : call.isSharingScreen ? "Parar de compartilhar tela" : "Compartilhar tela"}
              >
                {call.isSharingScreen ? <ScreenShareOff size={15} /> : <ScreenShare size={15} />}
              </CallButton>
            </div>
          ) : (
            <span className="text-xs text-white/60 truncate">{call.peer.name}</span>
          )}
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
