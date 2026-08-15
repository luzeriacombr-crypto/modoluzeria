// Synthesized ringtone (Web Audio API, no audio file) for an incoming call —
// a classic two-beep "ring ring" pattern, repeating every 2s while ringing.
let audioCtx: AudioContext | null = null;
let ringInterval: ReturnType<typeof setInterval> | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return audioCtx;
}

function beep(ctx: AudioContext, freq: number, startTime: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
  gain.gain.setValueAtTime(0.25, startTime + duration - 0.03);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playRingCycle() {
  const ctx = getCtx();
  if (ctx.state === "suspended") ctx.resume().catch(() => { /* blocked until a user gesture happens somewhere on the page — nothing to do about it */ });
  const now = ctx.currentTime;
  beep(ctx, 950, now, 0.35);
  beep(ctx, 950, now + 0.45, 0.35);
}

export function startRingtone() {
  if (ringInterval) return; // already ringing
  playRingCycle();
  ringInterval = setInterval(playRingCycle, 2000);
}

export function stopRingtone() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
}
