import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { sendCallInviteNotification } from "@/lib/luzeria/screen-share.functions";
import { getTurnCredentials } from "@/lib/luzeria/turn-credentials.functions";
import { useCallStore, type CallPeer } from "@/lib/luzeria/call-store";
import { useMe } from "@/lib/luzeria/queries";
import { startRingtone, stopRingtone } from "@/lib/luzeria/ringtone";

// STUN alone only works when both sides' networks allow direct P2P (UDP hole
// punching) — plenty of home/corporate networks don't; a TURN relay is
// needed as a fallback path. Used as a last-resort default if fetching
// short-lived credentials from getTurnCredentials() fails.
const STUN_ONLY_FALLBACK: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];
const OUTGOING_RING_MS = 45_000;
const INCOMING_RING_MS = 60_000;
const ICE_FAIL_GRACE_MS = 8_000;
const CONNECTING_TIMEOUT_MS = 20_000;

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

/** Owns the whole WebRTC + signaling lifecycle for the video call feature —
 * camera+mic both ways with every other participant, plus an in-call
 * screen-share toggle. Supports both 1:1 and group calls: every participant
 * connects directly to every other one (a full mesh), which keeps things
 * simple and needs no media server, at the cost of not scaling much past a
 * handful of simultaneous people (each participant uploads their own video
 * once per peer). Mounted exactly once, in App.tsx, so a call survives
 * navigation across the app. Non-serializable objects (RTCPeerConnection,
 * MediaStream, Realtime channels, timers) live in refs here, keyed by peer
 * userId — only status/callId/peers/canCall/canShareScreen live in the
 * Zustand call-store, so distant components (Sidebar's call button,
 * CallInvitePicker) can read/trigger without prop drilling, mirroring
 * confirm-store.ts's bridge pattern. */
export function useScreenShareCall() {
  const me = useMe().data;
  const status = useCallStore((s) => s.status);
  const callId = useCallStore((s) => s.callId);
  const peers = useCallStore((s) => s.peers);
  const canCall = useCallStore((s) => s.canCall);
  const canShareScreen = useCallStore((s) => s.canShareScreen);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  // Keyed by the OTHER participant's userId — one entry per peer whose media
  // has actually arrived (as opposed to `peers`, which is who's invited).
  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [remoteSharingScreen, setRemoteSharingScreen] = useState<Record<string, boolean>>({});
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const sendInviteNotification = useServerFn(sendCallInviteNotification);
  const fetchTurnCredentials = useServerFn(getTurnCredentials);

  const inboxChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceServersPromiseRef = useRef<Promise<RTCIceServer[]> | null>(null);
  const sessionChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Whatever's currently feeding every peer connection's video track — the
  // camera track normally, the screen track while sharing. New peer
  // connections (someone joining mid-call) attach this, not always the raw
  // camera, so latecomers see a screen-share already in progress.
  const currentVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const pcMapRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const videoSenderMapRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const iceQueueMapRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const iceFailTimerMapRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const knownPresenceIdsRef = useRef<Set<string>>(new Set());

  const outgoingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearTimers() {
    if (outgoingTimerRef.current) { clearTimeout(outgoingTimerRef.current); outgoingTimerRef.current = null; }
    if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
    if (connectingTimerRef.current) { clearTimeout(connectingTimerRef.current); connectingTimerRef.current = null; }
    iceFailTimerMapRef.current.forEach((t) => clearTimeout(t));
    iceFailTimerMapRef.current.clear();
  }

  /** Tears down just one peer's connection + media — used both when that one
   * person leaves an otherwise-ongoing group call, and (for every remaining
   * peer) when the whole call ends. */
  function teardownPeer(peerId: string) {
    pcMapRef.current.get(peerId)?.close();
    pcMapRef.current.delete(peerId);
    videoSenderMapRef.current.delete(peerId);
    iceQueueMapRef.current.delete(peerId);
    const t = iceFailTimerMapRef.current.get(peerId);
    if (t) { clearTimeout(t); iceFailTimerMapRef.current.delete(peerId); }
    setRemoteStreams((prev) => { if (!(peerId in prev)) return prev; const next = { ...prev }; delete next[peerId]; return next; });
    setRemoteSharingScreen((prev) => { if (!(peerId in prev)) return prev; const next = { ...prev }; delete next[peerId]; return next; });
  }

  function endCall(notifyPeers: boolean) {
    clearTimers();
    if (notifyPeers && sessionChannelRef.current) {
      sessionChannelRef.current.send({ type: "broadcast", event: "hangup", payload: { from: me?.id } });
    }
    for (const peerId of [...pcMapRef.current.keys()]) teardownPeer(peerId);
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    currentVideoTrackRef.current = null;
    if (sessionChannelRef.current) {
      supabase.removeChannel(sessionChannelRef.current);
      sessionChannelRef.current = null;
    }
    knownPresenceIdsRef.current = new Set();
    setLocalStream(null);
    setRemoteStreams({});
    setRemoteSharingScreen({});
    setIsSharingScreen(false);
    setMicOn(true);
    setCamOn(true);
    useCallStore.getState()._setStatus("idle", null, []);
  }

  function attachIceHandling(peerId: string, pc: RTCPeerConnection, sessionCh: ReturnType<typeof supabase.channel>) {
    let sawRelayCandidate = false;
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        if (e.candidate.type === "relay") sawRelayCandidate = true;
        // eslint-disable-next-line no-console
        console.debug("[call]", peerId, "local ICE candidate", e.candidate.type, e.candidate.protocol, e.candidate.address);
        sessionCh.send({ type: "broadcast", event: "ice-candidate", payload: { from: me?.id, to: peerId, candidate: e.candidate.toJSON() } });
      }
    };
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete" && !sawRelayCandidate) {
        // eslint-disable-next-line no-console
        console.warn("[call]", peerId, "no TURN/relay candidate was gathered — the free TURN relay may be unreachable, this leg may fail on restrictive networks");
      }
    };
    pc.oniceconnectionstatechange = () => {
      const s = pc.iceConnectionState;
      // eslint-disable-next-line no-console
      console.debug("[call]", peerId, "iceConnectionState ->", s);
      if (s === "connected" || s === "completed") {
        const t = iceFailTimerMapRef.current.get(peerId);
        if (t) { clearTimeout(t); iceFailTimerMapRef.current.delete(peerId); }
        if (connectingTimerRef.current) { clearTimeout(connectingTimerRef.current); connectingTimerRef.current = null; }
        useCallStore.getState()._setStatus("active", useCallStore.getState().callId, useCallStore.getState().peers);
      } else if (s === "failed" || s === "disconnected") {
        if (!iceFailTimerMapRef.current.has(peerId)) {
          iceFailTimerMapRef.current.set(peerId, setTimeout(() => {
            iceFailTimerMapRef.current.delete(peerId);
            teardownPeer(peerId);
            // Only end the whole call if that was the last leg standing.
            if (pcMapRef.current.size === 0) {
              toast.error("Conexão da chamada perdida.");
              endCall(false);
            }
          }, ICE_FAIL_GRACE_MS));
        }
      }
    };
  }

  async function addRemoteIce(peerId: string, candidate: RTCIceCandidateInit) {
    const pc = pcMapRef.current.get(peerId);
    if (!pc) return;
    if (!pc.remoteDescription) {
      const q = iceQueueMapRef.current.get(peerId) ?? [];
      q.push(candidate);
      iceQueueMapRef.current.set(peerId, q);
      return;
    }
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch { /* stale/duplicate candidate, ignore */ }
  }
  async function flushIceQueue(peerId: string) {
    const pc = pcMapRef.current.get(peerId);
    if (!pc) return;
    const queued = iceQueueMapRef.current.get(peerId) ?? [];
    iceQueueMapRef.current.set(peerId, []);
    for (const c of queued) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ }
    }
  }

  function getIceServers(): Promise<RTCIceServer[]> {
    if (!iceServersPromiseRef.current) {
      iceServersPromiseRef.current = fetchTurnCredentials()
        .then((servers) => (servers.length > 0 ? servers : STUN_ONLY_FALLBACK))
        .catch(() => STUN_ONLY_FALLBACK);
    }
    return iceServersPromiseRef.current;
  }

  /** Grabs camera+mic once per call (shared across every peer connection) if
   * not already grabbed, and wires up a fresh RTCPeerConnection to one
   * specific peer with our current tracks (camera or screen, whichever is
   * live) already attached. Shared by both directions — the side that ends
   * up creating the offer and the side answering it, decided per-pair by
   * `shouldOffer()` below. */
  async function setupPeerConnection(peerId: string, sessionCh: ReturnType<typeof supabase.channel>): Promise<RTCPeerConnection | null> {
    if (!localStreamRef.current) {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch {
        toast.error("Não consegui acessar câmera/microfone. Verifique as permissões do navegador.");
        endCall(true);
        return null;
      }
      localStreamRef.current = stream;
      currentVideoTrackRef.current = stream.getVideoTracks()[0] ?? null;
      setLocalStream(stream);
    }

    const iceServers = await getIceServers();
    const pc = new RTCPeerConnection({ iceServers });
    pcMapRef.current.set(peerId, pc);
    pc.ontrack = (e) => {
      const stream = e.streams[0] ?? null;
      // eslint-disable-next-line no-console
      console.debug("[call]", peerId, "ontrack", { kind: e.track.kind, streamId: stream?.id });
      if (stream) setRemoteStreams((prev) => ({ ...prev, [peerId]: stream }));
    };
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) pc.addTrack(audioTrack, localStreamRef.current);
    const videoTrack = currentVideoTrackRef.current ?? localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      const sender = pc.addTrack(videoTrack, localStreamRef.current);
      videoSenderMapRef.current.set(peerId, sender);
    }
    attachIceHandling(peerId, pc, sessionCh);
    return pc;
  }

  async function offerTo(peerId: string, sessionCh: ReturnType<typeof supabase.channel>) {
    try {
      const pc = await setupPeerConnection(peerId, sessionCh);
      if (!pc) return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      sessionCh.send({ type: "broadcast", event: "offer", payload: { from: me?.id, to: peerId, sdp: offer } });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[call] offerTo failed", peerId, err);
    }
  }

  async function handleOffer(fromId: string, sdp: RTCSessionDescriptionInit, sessionCh: ReturnType<typeof supabase.channel>) {
    try {
      let pc = pcMapRef.current.get(fromId);
      if (!pc) pc = (await setupPeerConnection(fromId, sessionCh)) ?? undefined;
      if (!pc) return;
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      await flushIceQueue(fromId);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sessionCh.send({ type: "broadcast", event: "answer", payload: { from: me?.id, to: fromId, sdp: answer } });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[call] handleOffer failed", fromId, err);
    }
  }

  /** Deterministic tie-break so exactly one side of each pair sends the
   * offer — both sides compute this independently and always agree, no
   * extra coordination round needed. */
  function shouldOffer(otherId: string): boolean {
    return (me?.id ?? "") < otherId;
  }

  function subscribeSessionChannel(orgId: string, cId: string) {
    const topic = `call:${orgId}:session:${cId}`;
    const ch = supabase.channel(topic, { config: { presence: { key: me?.id ?? "" } } });
    ch.on("broadcast", { event: "offer" }, ({ payload }: any) => {
      if (payload.to !== me?.id) return;
      handleOffer(payload.from, payload.sdp, ch);
    });
    ch.on("broadcast", { event: "answer" }, async ({ payload }: any) => {
      if (payload.to !== me?.id) return;
      const pc = pcMapRef.current.get(payload.from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        await flushIceQueue(payload.from);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("[call] applying answer failed", payload.from, err);
      }
    });
    ch.on("broadcast", { event: "ice-candidate" }, ({ payload }: any) => {
      if (payload.to !== me?.id) return;
      addRemoteIce(payload.from, payload.candidate);
    });
    ch.on("broadcast", { event: "screen-share-state" }, ({ payload }: any) => {
      setRemoteSharingScreen((prev) => ({ ...prev, [payload.from]: !!payload.sharing }));
    });
    ch.on("broadcast", { event: "hangup" }, ({ payload }: any) => {
      const leavingId = payload?.from;
      if (leavingId) {
        toast.message(`${useCallStore.getState().peers.find((p) => p.userId === leavingId)?.name ?? "Alguém"} saiu da chamada.`);
        teardownPeer(leavingId);
      }
      if (pcMapRef.current.size === 0) endCall(false);
    });
    // Presence sync is the peer-discovery signal — fires for everyone
    // already in the topic whenever anyone joins or leaves, with the full
    // current roster, which is enough to drive the mesh with no separate
    // "I'm ready" handshake (works the same whether it's the 2nd or the
    // 10th person joining).
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const nowIds = new Set(Object.keys(state).filter((id) => id !== me?.id));
      for (const id of nowIds) {
        if (!knownPresenceIdsRef.current.has(id)) {
          if (outgoingTimerRef.current) { clearTimeout(outgoingTimerRef.current); outgoingTimerRef.current = null; }
          useCallStore.getState()._setStatus(
            useCallStore.getState().status === "ringing-outgoing" ? "connecting" : useCallStore.getState().status,
            cId, useCallStore.getState().peers,
          );
          if (shouldOffer(id)) offerTo(id, ch);
        }
      }
      for (const id of knownPresenceIdsRef.current) {
        if (!nowIds.has(id) && pcMapRef.current.has(id)) teardownPeer(id);
      }
      knownPresenceIdsRef.current = nowIds;
      if (nowIds.size === 0 && useCallStore.getState().status !== "ringing-outgoing" && useCallStore.getState().status !== "ringing-incoming") {
        // Everyone else has left.
        endCall(false);
      }
    });
    ch.subscribe((subStatus) => {
      if (subStatus === "SUBSCRIBED") ch.track({ userId: me?.id ?? "" });
    });
    sessionChannelRef.current = ch;
    return ch;
  }

  function startCall(invitees: CallPeer[]) {
    if (!me?.orgId || invitees.length === 0 || !useCallStore.getState().canCall || useCallStore.getState().status !== "idle") return;
    const cId = crypto.randomUUID();
    useCallStore.getState()._setStatus("ringing-outgoing", cId, invitees);
    getIceServers(); // kick off early so it's ready by the time offerTo() needs it

    subscribeSessionChannel(me.orgId, cId);

    for (const invitee of invitees) {
      sendOnce(`call-inbox:${me.orgId}:${invitee.userId}`, "invite", {
        callId: cId, fromUserId: me.id, fromName: me.name, fromAvatarUrl: me.avatarUrl,
        // Every invitee needs the full guest list (minus themselves) to know
        // who else is expected, for the incoming-call modal's copy.
        peers: [{ userId: me.id, name: me.name, avatarUrl: me.avatarUrl }, ...invitees].filter((p) => p.userId !== invitee.userId),
      });
      sendInviteNotification({ data: { toUserId: invitee.userId, callId: cId } }).catch(() => { /* fallback push best-effort */ });
    }

    outgoingTimerRef.current = setTimeout(() => {
      const s = useCallStore.getState();
      if (s.status === "ringing-outgoing" && s.callId === cId) {
        for (const invitee of invitees) sendOnce(`call-inbox:${me.orgId}:${invitee.userId}`, "cancel", { callId: cId });
        toast.message("Sem resposta.");
        endCall(false);
      }
    }, OUTGOING_RING_MS);
  }

  function acceptCall() {
    const s = useCallStore.getState();
    if (s.status !== "ringing-incoming" || !s.callId || s.peers.length === 0 || !me?.orgId || !s.canCall) return;
    if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
    useCallStore.getState()._setStatus("connecting", s.callId, s.peers);
    subscribeSessionChannel(me.orgId, s.callId);
  }

  function declineCall() {
    const s = useCallStore.getState();
    if (s.status !== "ringing-incoming" || !s.callId || s.peers.length === 0 || !me?.orgId) return;
    // Whoever called (first in the invite's peer list) gets told; the rest
    // just never see us join the session — same effect for them.
    const caller = s.peers[0];
    if (caller) sendOnce(`call-inbox:${me.orgId}:${caller.userId}`, "decline", { callId: s.callId, fromUserId: me.id });
    if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
    useCallStore.getState()._setStatus("idle", null, []);
  }

  function cancelOutgoing() {
    const s = useCallStore.getState();
    if (s.status !== "ringing-outgoing" || !s.callId || !me?.orgId) return;
    for (const p of s.peers) sendOnce(`call-inbox:${me.orgId}:${p.userId}`, "cancel", { callId: s.callId });
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

  /** Swaps the outgoing video track (camera <-> screen) on EVERY peer
   * connection at once via RTCRtpSender.replaceTrack — no renegotiation
   * needed on any of them, since the senders (and therefore each SDP) never
   * change, only the media source feeding them. v1 simplification: screen
   * replaces camera rather than sending both at once. */
  async function toggleScreenShare() {
    if (videoSenderMapRef.current.size === 0 && !localStreamRef.current) return;
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
      currentVideoTrackRef.current = screenTrack;
      await Promise.all([...videoSenderMapRef.current.values()].map((s) => s.replaceTrack(screenTrack).catch(() => {})));
      screenTrack.addEventListener("ended", stopScreenShare);
      setIsSharingScreen(true);
      sessionChannelRef.current?.send({ type: "broadcast", event: "screen-share-state", payload: { from: me?.id, sharing: true } });
    } else {
      stopScreenShare();
    }
  }

  /** Idempotent — also runs as the native "stop sharing" button's 'ended'
   * listener, which fires even when WE call it ourselves (track.stop()
   * dispatches 'ended' too), so a stray second call must be a safe no-op. */
  function stopScreenShare() {
    if (!screenStreamRef.current) return;
    const camTrack = localStreamRef.current?.getVideoTracks()[0] ?? null;
    currentVideoTrackRef.current = camTrack;
    Promise.all([...videoSenderMapRef.current.values()].map((s) => s.replaceTrack(camTrack).catch(() => {})));
    screenStreamRef.current.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    setIsSharingScreen(false);
    sessionChannelRef.current?.send({ type: "broadcast", event: "screen-share-state", payload: { from: me?.id, sharing: false } });
  }

  // Personal inbox — subscribed once per session, carries only the low-frequency
  // ring signals (invite/cancel/decline), never the WebRTC payloads themselves.
  useEffect(() => {
    if (!me?.id || !me.orgId) return;
    const ch = supabase.channel(`call-inbox:${me.orgId}:${me.id}`);
    ch.on("broadcast", { event: "invite" }, ({ payload }: any) => {
      const s = useCallStore.getState();
      if (s.status !== "idle") {
        sendOnce(`call-inbox:${me.orgId}:${payload.fromUserId}`, "decline", { callId: payload.callId, fromUserId: me.id });
        return;
      }
      const invitePeers: CallPeer[] = (payload.peers ?? [{ userId: payload.fromUserId, name: payload.fromName, avatarUrl: payload.fromAvatarUrl }]);
      useCallStore.getState()._setStatus("ringing-incoming", payload.callId, invitePeers);
      getIceServers(); // kick off early so it's ready by the time acceptCall() needs it
      incomingTimerRef.current = setTimeout(() => {
        const now = useCallStore.getState();
        if (now.status === "ringing-incoming" && now.callId === payload.callId) {
          useCallStore.getState()._setStatus("idle", null, []);
        }
      }, INCOMING_RING_MS);
    });
    ch.on("broadcast", { event: "cancel" }, ({ payload }: any) => {
      const s = useCallStore.getState();
      if (s.status === "ringing-incoming" && s.callId === payload.callId) {
        if (incomingTimerRef.current) { clearTimeout(incomingTimerRef.current); incomingTimerRef.current = null; }
        useCallStore.getState()._setStatus("idle", null, []);
      }
    });
    ch.on("broadcast", { event: "decline" }, ({ payload }: any) => {
      const s = useCallStore.getState();
      // A single decline doesn't end a group call that others already
      // joined — only matters while we're still waiting and nobody's in yet.
      if (s.status === "ringing-outgoing" && s.callId === payload.callId && pcMapRef.current.size === 0) {
        const remaining = s.peers.filter((p) => p.userId !== payload.fromUserId);
        if (remaining.length === 0) {
          toast.message("Chamada recusada.");
          endCall(false);
        } else {
          useCallStore.getState()._setStatus("ringing-outgoing", s.callId, remaining);
        }
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

  // If nobody's connection ever reaches "connected" at all, it can sit in
  // "connecting" indefinitely with no feedback. Give up after a while
  // instead of hanging forever.
  useEffect(() => {
    if (status === "connecting") {
      connectingTimerRef.current = setTimeout(() => {
        if (useCallStore.getState().status === "connecting") {
          toast.error("Não foi possível conectar a chamada. Verifique sua internet e tente de novo.");
          endCall(true);
        }
      }, CONNECTING_TIMEOUT_MS);
      return () => { if (connectingTimerRef.current) { clearTimeout(connectingTimerRef.current); connectingTimerRef.current = null; } };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
    status, callId, peers, canCall, canShareScreen,
    localStream, remoteStreams, isSharingScreen, remoteSharingScreen, micOn, camOn,
    actions: { acceptCall, declineCall, hangup, cancelOutgoing, toggleMic, toggleCamera, toggleScreenShare },
  };
}
