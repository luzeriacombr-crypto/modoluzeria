import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, PhoneOff, Loader2, Maximize2, Minimize2, Eye, EyeOff } from "lucide-react";
import { Avatar } from "./Avatar";
import type { useScreenShareCall } from "@/hooks/use-screen-share-call";
import type { CallPeer } from "@/lib/luzeria/call-store";

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

/** One tile in the call grid — either a connected peer's video (or their
 * avatar while it's still connecting) or, via `RemoteTile`'s caller, a
 * still-ringing invitee with no stream yet at all. */
function RemoteTile({ peer, stream, sharingScreen }: { peer: CallPeer; stream: MediaStream | null; sharingScreen: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) el.play().catch(() => {});
  }, [stream]);

  return (
    <div className="relative bg-black rounded-md overflow-hidden">
      <video ref={videoRef} autoPlay playsInline className={`w-full h-full object-cover ${stream ? "" : "hidden"}`} />
      {!stream && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#1C1C1C]">
          <Avatar name={peer.name} avatarUrl={peer.avatarUrl} size={40} />
          <Loader2 size={14} className="text-white/40 animate-spin" />
        </div>
      )}
      {stream && sharingScreen && (
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-black/60 text-white">
          <ScreenShare size={10} /> compartilhando
        </div>
      )}
      <div className="absolute bottom-1.5 left-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-black/55 text-white truncate max-w-[85%]">
        {peer.name}
      </div>
    </div>
  );
}

/** Global floating panel for an outgoing/connecting/active video call —
 * mounted once in App.tsx alongside IncomingCallModal, so a call survives
 * page navigation. Works for both 1:1 and group calls: each other
 * participant gets their own tile in a grid (a full WebRTC mesh — see
 * use-screen-share-call.ts — so "remote" here really means "every other
 * peer", not just one). Screen sharing is an in-call toggle that swaps the
 * outgoing video track sent to everyone (no self-preview of the screen
 * itself, just a badge, to keep v1 simple). */
export function ActiveCallOverlay({ call }: { call: ReturnType<typeof useScreenShareCall> }) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hideOwnCamera, setHideOwnCamera] = useState(false);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(document.fullscreenElement === panelRef.current);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      panelRef.current?.requestFullscreen().catch(() => {});
    }
  }

  useEffect(() => {
    const el = localVideoRef.current;
    if (!el) return;
    el.srcObject = call.localStream;
    if (call.localStream) el.play().catch((e) => console.error("[call] local video play() failed", e));
  }, [call.localStream]);

  const visible = call.status === "ringing-outgoing" || call.status === "connecting" || call.status === "active";
  if (!visible || call.peers.length === 0) return null;

  const isActive = call.status === "active";
  const isGroup = call.peers.length > 1;
  // Grid columns scale with how many tiles we actually need to show.
  const cols = call.peers.length <= 1 ? 1 : call.peers.length <= 2 ? 2 : call.peers.length <= 4 ? 2 : 3;

  return createPortal(
    <div
      ref={panelRef}
      className={isFullscreen ? "fixed inset-0 z-[350] bg-[#1C1C1C] flex flex-col" : "fixed bottom-4 right-4 z-[350]"}
      style={isFullscreen ? undefined : { width: `min(${isGroup ? 460 : 340}px, calc(100vw - 2rem))` }}
    >
      <div
        className={
          isFullscreen
            ? "flex flex-col h-full w-full"
            : "bg-[#1C1C1C] rounded-xl border border-white/10 shadow-2xl overflow-hidden lz-modal-in"
        }
      >
        <div className={isFullscreen ? "relative flex-1 min-h-0 bg-black p-1.5" : "relative aspect-video bg-black p-1"}>
          <div className="w-full h-full grid gap-1" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {call.peers.map((p) => (
              <RemoteTile key={p.userId} peer={p} stream={call.remoteStreams[p.userId] ?? null} sharingScreen={!!call.remoteSharingScreen[p.userId]} />
            ))}
          </div>
          {!isActive && (
            <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/55 text-[11px] text-white/70">
              <Loader2 size={11} className="animate-spin" /> {statusLabel(call.status)}
            </div>
          )}
          <div
            className={`absolute bottom-2 right-2 h-16 w-24 rounded-md overflow-hidden bg-[#0D0D0D] border border-white/20 ${
              isActive && !hideOwnCamera ? "" : "hidden"
            }`}
          >
            <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${call.camOn ? "" : "hidden"}`} style={{ transform: "scaleX(-1)" }} />
            {!call.camOn && (
              <div className="w-full h-full flex items-center justify-center">
                <Avatar name="Você" size={20} />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
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
              <CallButton
                onClick={() => setHideOwnCamera((v) => !v)}
                active={hideOwnCamera}
                title={hideOwnCamera ? "Mostrar minha câmera" : "Esconder minha câmera"}
              >
                {hideOwnCamera ? <EyeOff size={15} /> : <Eye size={15} />}
              </CallButton>
              <CallButton onClick={toggleFullscreen} title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}>
                {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </CallButton>
            </div>
          ) : (
            <span className="text-xs text-white/60 truncate">
              {isGroup ? `${call.peers.length} pessoas` : call.peers[0]?.name}
            </span>
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
