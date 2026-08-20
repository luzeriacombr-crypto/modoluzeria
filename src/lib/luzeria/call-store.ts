import { create } from "zustand";

export type CallStatus =
  | "idle"
  | "ringing-outgoing"
  | "ringing-incoming"
  | "connecting"
  | "active";

export type CallPeer = { userId: string; name: string; avatarUrl: string | null };

type CallBridge = {
  startCall: (invitees: CallPeer[]) => void;
  acceptCall: () => void;
  declineCall: () => void;
  cancelOutgoing: () => void;
  hangup: () => void;
};

interface CallState {
  status: CallStatus;
  callId: string | null;
  /** Everyone else expected/invited to the call — for a 1:1 call this is a
   * single-item array, same shape as before; a group call just has more
   * than one. Who has actually joined the shared media session is tracked
   * separately (as `remoteStreams` keys) by useScreenShareCall(). */
  peers: CallPeer[];
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
  _setStatus: (status: CallStatus, callId?: string | null, peers?: CallPeer[]) => void;
  _setCanCall: (v: boolean) => void;
  _setCanShareScreen: (v: boolean) => void;
  _registerBridge: (bridge: CallBridge | null) => void;
}

export const useCallStore = create<CallState>((set) => ({
  status: "idle",
  callId: null,
  peers: [],
  canCall: false,
  canShareScreen: false,
  _bridge: null,
  _setStatus: (status, callId = null, peers = []) => set({ status, callId, peers }),
  _setCanCall: (v) => set({ canCall: v }),
  _setCanShareScreen: (v) => set({ canShareScreen: v }),
  _registerBridge: (bridge) => set({ _bridge: bridge }),
}));

/** Only meaningful while idle — starts a new outgoing call, to one person or
 * several at once. No-op (silently ignored by the hook) if a call is
 * already in progress. */
export function startScreenShareCall(invitees: CallPeer[]) {
  useCallStore.getState()._bridge?.startCall(invitees);
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
