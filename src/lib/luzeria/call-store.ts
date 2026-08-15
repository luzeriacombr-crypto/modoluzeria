import { create } from "zustand";

export type CallStatus =
  | "idle"
  | "ringing-outgoing"
  | "ringing-incoming"
  | "connecting"
  | "active";

export type CallPeer = { userId: string; name: string; avatarUrl: string | null };

type CallBridge = {
  startCall: (userId: string, name: string, avatarUrl: string | null) => void;
  acceptCall: () => void;
  declineCall: () => void;
  cancelOutgoing: () => void;
  hangup: () => void;
};

interface CallState {
  status: CallStatus;
  callId: string | null;
  peer: CallPeer | null;
  /** getUserMedia-based — gates starting/accepting a call at all. True on
   * virtually any modern browser, mobile included. */
  canCall: boolean;
  /** getDisplayMedia-based — gates only the in-call "compartilhar tela"
   * toggle. False on mobile browsers, which don't expose screen capture. */
  canShareScreen: boolean;
  /** Filled in by useScreenShareCall() (the only component that ever calls
   * it — mounted once in App.tsx). Lets distant components (Sidebar's call
   * button, CallInvitePicker) trigger real WebRTC actions without prop
   * drilling, same shape as confirm-store.ts's requestConfirm() bridge. */
  _bridge: CallBridge | null;
  _setStatus: (status: CallStatus, callId?: string | null, peer?: CallPeer | null) => void;
  _setCanCall: (v: boolean) => void;
  _setCanShareScreen: (v: boolean) => void;
  _registerBridge: (bridge: CallBridge | null) => void;
}

export const useCallStore = create<CallState>((set) => ({
  status: "idle",
  callId: null,
  peer: null,
  canCall: false,
  canShareScreen: false,
  _bridge: null,
  _setStatus: (status, callId = null, peer = null) => set({ status, callId, peer }),
  _setCanCall: (v) => set({ canCall: v }),
  _setCanShareScreen: (v) => set({ canShareScreen: v }),
  _registerBridge: (bridge) => set({ _bridge: bridge }),
}));

/** Only meaningful while idle — starts a new outgoing call. No-op (silently
 * ignored by the hook) if a call is already in progress. */
export function startScreenShareCall(userId: string, name: string, avatarUrl: string | null) {
  useCallStore.getState()._bridge?.startCall(userId, name, avatarUrl);
}
export function acceptIncomingCall() {
  useCallStore.getState()._bridge?.acceptCall();
}
export function declineIncomingCall() {
  useCallStore.getState()._bridge?.declineCall();
}
export function cancelOutgoingCall() {
  useCallStore.getState()._bridge?.cancelOutgoing();
}
export function hangupCall() {
  useCallStore.getState()._bridge?.hangup();
}
