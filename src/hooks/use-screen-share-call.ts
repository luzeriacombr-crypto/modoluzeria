import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendCallInviteNotification } from "@/lib/luzeria/screen-share.functions";
import { useCallStore, type CallPeer } from "@/lib/luzeria/call-store";
import { useMe } from "@/lib/luzeria/queries";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const OUTGOING_RING_MS = 45_000;
const INCOMING_RING_MS = 60_000;
const ICE_FAIL_GRACE_MS = 8_000;

type Role = "sharer" | "viewer" | null;

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

/** Owns the whole WebRTC + signaling lifecycle for the 1:1 screen-share call
 * feature. Mounted exactly once, in App.tsx, so a call survives navigation
 * across the app. Non-serializable objects (RTCPeerConnection, MediaStream,
 * Realtime channels, timers) live in refs here and are never put in the
 * Zustand call-store — only status/callId/peer/canShare are, so distant
 * components (Sidebar's call button, CallInvitePicker) can read/trigger
 * without prop drilling, mirroring confirm-store.ts's bridge pattern. */
export function useScreenShareCall() {
  const me = useMe().data;
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const peer = useCallStore((s) => s.peer);
  const canShare = useCallStore((s) => s.canShare);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [role, setRole] = useState<Role>(null);

  const sendInviteNotification = useServerFn(sendCallInviteNotification);

  const inboxChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
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
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }
    iceQueueRef.current = [];
    readyReceivedRef.current = false;
    setRemoteStream(null);
    setRole(null);
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

  async function beginSharing(sessionCh: ReturnType<typeof supabase.channel>) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    } catch {
      toast.message("Compartilhamento cancelado.");
      endCall(true);
      return;
    }
    localStreamRef.current = stream;
    setRole("sharer");
    stream.getVideoTracks()[0]?.addEventListener("ended", () => endCall(true));

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    attachIceHandling(pc, sessionCh);

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sessionCh.send({ type: "broadcast", event: "offer", payload: { sdp: offer } });
  }

  async function handleOffer(sdp: RTCSessionDescriptionInit, sessionCh: ReturnType<typeof supabase.channel>) {
    setRole("viewer");
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcRef.current = pc;
    pc.ontrack = (e) => setRemoteStream(e.streams[0] ?? null);
    attachIceHandling(pc, sessionCh);

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
    if (!me?.orgId || useCallStore.getState().status !== "idle") return;
    const cId = crypto.randomUUID();
    const targetPeer: CallPeer = { userId, name, avatarUrl };
    useCallStore.getState()._setStatus("ringing-outgoing", cId, targetPeer);

    const ch = subscribeSessionChannel(me.orgId, cId, () => {
      if (outgoingTimerRef.current) { clearTimeout(outgoingTimerRef.current); outgoingTimerRef.current = null; }
      useCallStore.getState()._setStatus("connecting", cId, targetPeer);
      beginSharing(ch);
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
    if (s.status !== "ringing-incoming" || !s.callId || !s.peer || !me?.orgId) return;
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
    const can = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;
    useCallStore.getState()._setCanShare(can);
  }, []);

  // Register this hook's actions so distant components (Sidebar, pickers)
  // can trigger calls without prop drilling.
  useEffect(() => {
    useCallStore.getState()._registerBridge({ startCall, acceptCall, declineCall, cancelOutgoing, hangup });
    return () => useCallStore.getState()._registerBridge(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, me?.orgId, me?.name, me?.avatarUrl]);

  return { status, callId, peer, canShare, remoteStream, role, actions: { acceptCall, declineCall, hangup, cancelOutgoing } };
}
