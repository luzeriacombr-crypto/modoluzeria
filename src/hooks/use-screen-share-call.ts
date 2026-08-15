import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendCallInviteNotification } from "@/lib/luzeria/screen-share.functions";
import { useCallStore, type CallPeer } from "@/lib/luzeria/call-store";
import { useMe } from "@/lib/luzeria/queries";
import { startRingtone, stopRingtone } from "@/lib/luzeria/ringtone";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const OUTGOING_RING_MS = 45_000;
const INCOMING_RING_MS = 60_000;
const ICE_FAIL_GRACE_MS = 8_000;

/** Sends one broadcast event to a channel, tearing the channel down right
 * after — used for the low-frequency inbox pings (invite/cancel/decline)
 * where we don't want a long-lived subscription just to send one message. */
function sendOnce(topic: string, event: string, payload: unknown) {
  const ch = supabase.channel(topic);
  ch.subscribe((status) => {
    if (status === "SUBSCRIBED") {
      ch.send({ type: "broadcast", event, payload });
      supabase.removeChannel(ch);
    }
  });
}

/** Owns the whole WebRTC + signaling lifecycle for the 1:1 video call
 * feature (camera+mic both ways, plus an in-call screen-share toggle).
 * Mounted exactly once, in App.tsx, so a call survives navigation across
 * the app. Non-serializable objects (RTCPeerConnection, MediaStream,
 * Realtime channels, timers) live in refs here and are never put in the
 * Zustand call-store — only status/callId/peer/canCall/canShareScreen are,
 * so distant components (Sidebar's call button, CallInvitePicker) can
 * read/trigger without prop drilling, mirroring confirm-store.ts's bridge
 * pattern. */
export function useScreenShareCall() {
  const me = useMe().data;
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const peer = useCallStore((s) => s.peer);
  const canCall = useCallStore((s) => s.canCall);
  const canShareScreen = useCallStore((s) => s.canShareScreen);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [remoteSharingScreen, setRemoteSharingScreen] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const sendInviteNotification = useServerFn(sendCallInviteNotification);

  const inboxChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const iceQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const readyReceivedRef = useRef(false);
  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iceFailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (outgoingTimerRef.current) { clearTimeout(outgoingTimerRef.current); outgoingTimerRef.current = null; }
    if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
    if (iceFailTimerRef.current) { clearTimeout(iceFailTimerRef.current); iceFailTimerRef.current = null; }
  }

  function endCall(notifyPeer: boolean) {
    clearTimers();
    if (notifyPeer && sessionChannelRef.current) {
      sessionChannelRef.current.send({ type: "broadcast", event: "hangup", payload: {} });
    }
    pcRef.current?.close();
    pcRef.current = null;
    videoSenderRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }
    iceQueueRef.current = [];
    readyReceivedRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
    setIsSharingScreen(false);
    setRemoteSharingScreen(false);
    setMicOn(true);
    setCamOn(true);
    useCallStore.getState()._setStatus("idle", null, null);
  }

  function attachIceHandling(pc: RTCPeerConnection, sessionCh: ReturnType<typeof supabase.channel>) {
    pc.onicecandidate = (e) => {
      if (e.candidate) sessionCh.send({ type: "broadcast", event: "ice-candidate", payload: { candidate: e.candidate.toJSON() } });
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      if (s === "connected" || s === "completed") {
        if (iceFailTimerRef.current) { clearTimeout(iceFailTimerRef.current); iceFailTimerRef.current = null; }
        useCallStore.getState()._setStatus("active", useCallStore.getState().callId, useCallStore.getState().peer);
      } else if (s === "failed" || s === "disconnected") {
        if (!iceFailTimerRef.current) {
          iceFailTimerRef.current = setTimeout(() => {
            toast.error("Conexão da chamada perdida.");
            endCall(false);
          }, ICE_FAIL_GRACE_MS);
        }
      }
    };
  }

  async function addRemoteIce(candidate: RTCIceCandidateInit) {
    const pc = pcRef.current;
    if (!pc) return;
    if (!pc.remoteDescription) { iceQueueRef.current.push(candidate); return; }
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale/duplicate candidate, ignore */ }
  }
  async function flushIceQueue() {
    const pc = pcRef.current;
    if (!pc) return;
    const queued = iceQueueRef.current;
    iceQueueRef.current = [];
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  }

  /** Grabs camera+mic and wires up a fresh RTCPeerConnection with our own
   * tracks already attached — shared by both the caller (before creating
   * the offer) and the callee (before creating the answer), which is what
   * makes the call two-way media without a second offer/answer round. */
  async function setupLocalMediaAndPeer(sessionCh: ReturnType<typeof supabase.channel>): Promise<RTCPeerConnection | null> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    } catch {
      toast.error("Não consegui acessar câmera/microfone. Verifique as permissões do navegador.");
      endCall(true);
      return null;
    }
    localStreamRef.current = stream;
    setLocalStream(stream);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
    stream.getTracks().forEach((t) => {
      const sender = pc.addTrack(t, stream);
      if (t.kind === "video") videoSenderRef.current = sender;
    });
    attachIceHandling(pc, sessionCh);
    return pc;
  }

  async function beginCall(sessionCh: ReturnType<typeof supabase.channel>) {
    const pc = await setupLocalMediaAndPeer(sessionCh);
    if (!pc) return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sessionCh.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
  }

  async function handleOffer(sdp: RTCSessionDescriptionInit, sessionCh: ReturnType<typeof supabase.channel>) {
    const pc = await setupLocalMediaAndPeer(sessionCh);
    if (!pc) return;
    await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    await flushIceQueue();
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    sessionCh.send({ type: "broadcast", event: "answer", payload: { sdp: answer } });
  }

  function subscribeSessionChannel(orgId: string, cId: string, onReady: () => void) {
    const topic = `call:${orgId}:session:${cId}`;
    const ch = supabase.channel(topic, { config: { presence: { key: me?.id ?? "" } } });
    ch.on("broadcast", { event: "ready" }, () => { if (!readyReceivedRef.current) { readyReceivedRef.current = true; onReady(); } });
    ch.on("broadcast", { event: "offer" }, ({ payload }: any) => { handleOffer(payload.sdp, ch); });
    ch.on("broadcast", { event: "answer" }, async ({ payload }: any) => {
      const pc = pcRef.current;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      await flushIceQueue();
    });
    ch.on("broadcast", { event: "ice-candidate" }, ({ payload }: any) => addRemoteIce(payload.candidate));
    ch.on("broadcast", { event: "screen-share-state" }, ({ payload }: any) => setRemoteSharingScreen(!!payload.sharing));
    ch.on("broadcast", { event: "hangup" }, () => { toast.message("A chamada foi encerrada."); endCall(false); });
    ch.on("presence", { event: "leave" }, () => {
      if (useCallStore.getState().status === "active" || useCallStore.getState().status === "connecting") {
        toast.message("A outra pessoa saiu da chamada.");
        endCall(false);
      }
    });
    ch.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") ch.track({ userId: me?.id ?? "" });
    });
    sessionChannelRef.current = ch;
    return ch;
  }

  function startCall(userId: string, name: string, avatarUrl: string | null) {
    if (!me?.orgId || !useCallStore.getState().canCall || useCallStore.getState().status !== "idle") return;
    const cId = crypto.randomUUID();
    const targetPeer: CallPeer = { userId, name, avatarUrl };
    useCallStore.getState()._setStatus("ringing-outgoing", cId, targetPeer);

    const ch = subscribeSessionChannel(me.orgId, cId, () => {
      if (outgoingTimerRef.current) { clearTimeout(outgoingTimerRef.current); outgoingTimerRef.current = null; }
      useCallStore.getState()._setStatus("connecting", cId, targetPeer);
      beginCall(ch);
    });

    sendOnce(`call-inbox:${me.orgId}:${userId}`, "invite", {
      callId: cId, fromUserId: me.id, fromName: me.name, fromAvatarUrl: me.avatarUrl,
    });
    sendInviteNotification({ data: { toUserId: userId, callId: cId } }).catch(() => { /* fallback push best-effort */ });

    outgoingTimerRef.current = setTimeout(() => {
      const s = useCallStore.getState();
      if (s.status === "ringing-outgoing" && s.callId === cId) {
        sendOnce(`call-inbox:${me.orgId}:${userId}`, "cancel", { callId: cId });
        toast.message("Sem resposta.");
        endCall(false);
      }
    }, OUTGOING_RING_MS);
  }

  function acceptCall() {
    const s = useCallStore.getState();
    if (s.status !== "ringing-incoming" || !s.callId || !s.peer || !me?.orgId || !s.canCall) return;
    if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
    useCallStore.getState()._setStatus("connecting", s.callId, s.peer);
    const ch = subscribeSessionChannel(me.orgId, s.callId, () => { /* callee doesn't wait for 'ready' — it sends it */ });
    ch.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") ch.send({ type: "broadcast", event: "ready", payload: {} });
    });
  }

  function declineCall() {
    const s = useCallStore.getState();
    if (s.status !== "ringing-incoming" || !s.callId || !s.peer || !me?.orgId) return;
    sendOnce(`call-inbox:${me.orgId}:${s.peer.userId}`, "decline", { callId: s.callId });
    if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
    useCallStore.getState()._setStatus("idle", null, null);
  }

  function cancelOutgoing() {
    const s = useCallStore.getState();
    if (s.status !== "ringing-outgoing" || !s.callId || !s.peer || !me?.orgId) return;
    sendOnce(`call-inbox:${me.orgId}:${s.peer.userId}`, "cancel", { callId: s.callId });
    endCall(false);
  }

  function hangup() {
    endCall(true);
  }

  function toggleMic() {
    const t = localStreamRef.current?.getAudioTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setMicOn(t.enabled);
  }

  function toggleCamera() {
    const t = localStreamRef.current?.getVideoTracks()[0];
    if (!t) return;
    t.enabled = !t.enabled;
    setCamOn(t.enabled);
  }

  /** Swaps the outgoing video track between camera and screen via
   * RTCRtpSender.replaceTrack — no renegotiation needed, since the sender
   * (and therefore the SDP) never changes, only the media source feeding it.
   * v1 simplification: screen replaces camera rather than sending both at
   * once (that would need a second track + a real renegotiation round). */
  async function toggleScreenShare() {
    const sender = videoSenderRef.current;
    if (!sender) return;
    if (!isSharingScreen) {
      if (!useCallStore.getState().canShareScreen) return;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } catch {
        // Covers both "user cancelled the native picker" and "blocked by the
        // browser" — can't tell them apart from the exception alone, so this
        // stays a quiet no-op rather than an alarming error toast for what's
        // usually just a cancelled picker.
        return;
      }
      screenStreamRef.current = stream;
      const screenTrack = stream.getVideoTracks()[0];
      await sender.replaceTrack(screenTrack);
      screenTrack.addEventListener("ended", stopScreenShare);
      setIsSharingScreen(true);
      sessionChannelRef.current?.send({ type: "broadcast", event: "screen-share-state", payload: { sharing: true } });
    } else {
      stopScreenShare();
    }
  }

  /** Idempotent — also runs as the native "stop sharing" button's 'ended'
   * listener, which fires even when WE call it ourselves (track.stop()
   * dispatches 'ended' too), so a stray second call must be a safe no-op. */
  function stopScreenShare() {
    if (!screenStreamRef.current) return;
    const sender = videoSenderRef.current;
    const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    sender?.replaceTrack(camTrack).catch(() => {});
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsSharingScreen(false);
    sessionChannelRef.current?.send({ type: "broadcast", event: "screen-share-state", payload: { sharing: false } });
  }

  // Personal inbox — subscribed once per session, carries only the low-frequency
  // ring signals (invite/cancel/decline), never the WebRTC payloads themselves.
  useEffect(() => {
    if (!me?.id || !me.orgId) return;
    const ch = supabase.channel(`call-inbox:${me.orgId}:${me.id}`);
    ch.on("broadcast", { event: "invite" }, ({ payload }: any) => {
      const s = useCallStore.getState();
      if (s.status !== "idle") {
        sendOnce(`call-inbox:${me.orgId}:${payload.fromUserId}`, "decline", { callId: payload.callId });
        return;
      }
      const incomingPeer: CallPeer = { userId: payload.fromUserId, name: payload.fromName, avatarUrl: payload.fromAvatarUrl };
      useCallStore.getState()._setStatus("ringing-incoming", payload.callId, incomingPeer);
      incomingTimerRef.current = setTimeout(() => {
        const now = useCallStore.getState();
        if (now.status === "ringing-incoming" && now.callId === payload.callId) {
          useCallStore.getState()._setStatus("idle", null, null);
        }
      }, INCOMING_RING_MS);
    });
    ch.on("broadcast", { event: "cancel" }, ({ payload }: any) => {
      const s = useCallStore.getState();
      if (s.status === "ringing-incoming" && s.callId === payload.callId) {
        if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
        useCallStore.getState()._setStatus("idle", null, null);
      }
    });
    ch.on("broadcast", { event: "decline" }, ({ payload }: any) => {
      const s = useCallStore.getState();
      if (s.status === "ringing-outgoing" && s.callId === payload.callId) {
        toast.message("Chamada recusada.");
        endCall(false);
      }
    });
    ch.subscribe();
    inboxChannelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
      inboxChannelRef.current = null;
      endCall(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.orgId]);

  // Feature-detect once — capability doesn't change mid-session.
  useEffect(() => {
    useCallStore.getState()._setCanCall(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia);
    useCallStore.getState()._setCanShareScreen(typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia);
  }, []);

  // Rings for as long as (and only while) there's an incoming call waiting
  // for an answer — covers every way out (accept, decline, cancel from the
  // caller, the 60s self-timeout) in one place instead of stopping it
  // separately in each handler.
  useEffect(() => {
    if (status === "ringing-incoming") {
      startRingtone();
      return () => stopRingtone();
    }
  }, [status]);

  // Register this hook's actions so distant components (Sidebar, pickers)
  // can trigger calls without prop drilling.
  useEffect(() => {
    useCallStore.getState()._registerBridge({ startCall, acceptCall, declineCall, cancelOutgoing, hangup });
    return () => useCallStore.getState()._registerBridge(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.orgId, me?.name, me?.avatarUrl]);

  return {
    status, callId, peer, canCall, canShareScreen,
    localStream, remoteStream, isSharingScreen, remoteSharingScreen, micOn, camOn,
    actions: { acceptCall, declineCall, hangup, cancelOutgoing, toggleMic, toggleCamera, toggleScreenShare },
  };
}
