import { createPortal } from "react-dom";
import { PhoneCall, PhoneOff } from "lucide-react";
import { Avatar } from "./Avatar";
import type { useScreenShareCall } from "@/hooks/use-screen-share-call";

/** Global "incoming call" modal — mounted once in App.tsx, above the Sidebar
 * and MobileNav, so it interrupts wherever the person currently is in the
 * app (or on any device, since accepting is just receiving a video stream). */
export function IncomingCallModal({ call }: { call: ReturnType<typeof useScreenShareCall> }) {
  if (call.status !== "ringing-incoming" || call.peers.length === 0) return null;
  const { actions } = call;
  const caller = call.peers[0];
  const othersCount = call.peers.length - 1;

  return createPortal(
    <div className="lz-overlay z-[400] flex items-center justify-center p-4">
      <div className="bg-[#1C1C1C] rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl lz-modal-in p-6 text-center">
        <div
          className="mx-auto mb-4 h-16 w-16 rounded-full flex items-center justify-center animate-pulse"
          style={{ backgroundColor: "rgba(var(--lz-brand-light-rgb),0.15)" }}
        >
          <Avatar name={caller.name} avatarUrl={caller.avatarUrl} size={56} />
        </div>
        <p className="text-white font-bold text-base">{caller.name}</p>
        <p className="text-white/50 text-xs mt-1">
          {othersCount === 0
            ? "quer iniciar uma vídeo chamada com você"
            : `te chamou pra uma chamada em grupo, com mais ${othersCount} pessoa${othersCount === 1 ? "" : "s"}`}
        </p>
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={actions.declineCall}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 text-sm font-semibold transition-colors"
          >
            <PhoneOff size={15} /> Recusar
          </button>
          <button
            onClick={actions.acceptCall}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "rgb(var(--lz-brand-rgb))", color: "#0D0D0D" }}
          >
            <PhoneCall size={15} /> Aceitar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
