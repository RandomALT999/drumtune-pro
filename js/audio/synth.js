// Synthesizes short percussive tones for preview playback. There are no
// licensed drum recordings bundled with this project, so previews render
// struck-membrane approximations instead — a distinct one per drum type so
// snare and bass drum don't just sound like re-pitched toms.
let sharedCtx = null;

function getCtx() {
  if (!sharedCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    sharedCtx = new Ctx();
  }
  if (sharedCtx.state === "suspended") sharedCtx.resume();
  return sharedCtx;
}

function noiseBurst(ctx, now, { duration, filterType, filterFreq, gain, q }) {
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.value = filterFreq;
  if (q != null) filter.Q.value = q;

  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(gain, now);
  gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

  source.connect(filter).connect(gainNode).connect(ctx.destination);
  source.start(now);
  source.stop(now + duration);
}

// Toms (rack + floor): pitched sine body with a quick downward glide, like a
// real head right after impact, plus a bright noise burst for the stick attack.
function playTomTone(freq, { duration, brightness }) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 1.5, now);
  osc.frequency.exponentialRampToValueAtTime(freq, now + 0.05);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.9, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + duration);

  noiseBurst(ctx, now, {
    duration: 0.03,
    filterType: "highpass",
    filterFreq: 800 + brightness * 2000,
    gain: 0.4,
  });
}

export function playRackTomTone(freq) {
  playTomTone(freq, { duration: 0.45, brightness: 0.6 });
}

export function playFloorTomTone(freq) {
  playTomTone(freq, { duration: 0.75, brightness: 0.3 });
}

// Bass drum: a much faster pitch drop for the "thwack", a soft low-passed
// beater thump instead of a bright stick attack, and a short punchy decay —
// distinct from a tom, not just a lower-pitched one.
export function playBassDrumTone(freq) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 3, now);
  osc.frequency.exponentialRampToValueAtTime(freq, now + 0.07);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(1, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.35);

  noiseBurst(ctx, now, {
    duration: 0.05,
    filterType: "lowpass",
    filterFreq: 300,
    gain: 0.5,
  });
}

// Snare: mostly noise (the wires), with only a very brief, minimally-pitched
// "pop" for the head — no tom-like sustained tonal body underneath.
export function playSnareTone(freq) {
  const ctx = getCtx();
  const now = ctx.currentTime;

  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq * 1.15, now);
  osc.frequency.exponentialRampToValueAtTime(freq, now + 0.02);

  const oscGain = ctx.createGain();
  oscGain.gain.setValueAtTime(0.5, now);
  oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

  osc.connect(oscGain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.12);

  noiseBurst(ctx, now, { duration: 0.18, filterType: "bandpass", filterFreq: 2800, q: 0.6, gain: 0.5 });
  noiseBurst(ctx, now, { duration: 0.05, filterType: "highpass", filterFreq: 4000, gain: 0.35 });
}

export function playToneForDrumType(drumType, freq) {
  if (drumType === "floor-tom") return playFloorTomTone(freq);
  if (drumType === "bass-drum") return playBassDrumTone(freq);
  if (drumType === "snare") return playSnareTone(freq);
  return playRackTomTone(freq);
}
