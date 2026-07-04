import { yinPitch } from "./yin.js";

// Onset/hit-detection tuning knobs (hit mode only).
const ONSET_RMS = 0.02; // loud enough to be a strike, not room noise
const ONSET_RISE_FACTOR = 2.5; // sharp jump vs. the previous tick's level
const HIT_REFRACTORY_MS = 350; // min gap before another hit can register
const HIT_CAPTURE_MS = 280; // how long after onset to measure pitch
const HIT_MIN_CLARITY = 0.7;

// Wraps mic capture + a throttled YIN analysis loop. Exposes the underlying
// AnalyserNode too, so screens that need a live FFT (Advanced) can share the
// same audio graph instead of opening a second mic stream.
//
// Two modes:
//  - continuous (onUpdate): raw pitch every tick — used by the Advanced
//    screen, which only needs the analyser + occasional readings.
//  - hit-based (onHit): detects discrete drum strikes via an RMS onset jump
//    and measures pitch only during the initial attack window. A ringing
//    head's pitch drifts noticeably as it decays, so continuous readings
//    swing all over between hits — the initial strike is the reading that
//    matters for tuning. onHit fires once per strike with the median pitch
//    of the capture window, or null if the strike was unreadable.
export class PitchListener {
  constructor() {
    this.audioCtx = null;
    this.analyser = null;
    this.source = null;
    this.stream = null;
    this.timer = null;
    this.buffer = null;
    this.minFreq = 30;
    this.maxFreq = 600;
    this.onUpdate = null;
    this.onHit = null;
    this._lastRms = 0;
    this._lastOnset = 0;
    this._capturing = false;
    this._hitStart = 0;
    this._samples = [];
  }

  get isRunning() {
    return !!this.audioCtx;
  }

  getAnalyser() {
    return this.analyser;
  }

  getSampleRate() {
    return this.audioCtx ? this.audioCtx.sampleRate : null;
  }

  // opts: { onUpdate(result|null), onHit(result|null), targetFreq, fftSize, updateIntervalMs }
  async start(opts = {}) {
    const { onUpdate, onHit, targetFreq, fftSize = 2048 } = opts;
    // Hit mode ticks faster so a ~280ms capture window still collects
    // several readings to take a median over.
    const updateIntervalMs = opts.updateIntervalMs ?? (onHit ? 60 : 150);
    this.onUpdate = onUpdate || null;
    this.onHit = onHit || null;
    this.minFreq = targetFreq ? Math.max(20, targetFreq * 0.5) : 30;
    this.maxFreq = targetFreq ? targetFreq * 2.4 : 600;

    // getUserMedia is only exposed in a secure context (HTTPS or localhost).
    // Serving this over plain HTTP to a phone on the same network — the
    // obvious way to try this on a real device — silently has no
    // mediaDevices object at all, which throws a confusing generic error;
    // catch that case specifically so the message actually says why.
    if (!window.isSecureContext || !navigator.mediaDevices) {
      throw new Error("insecure-context");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });

    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new Ctx();
    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = fftSize;
    this.source.connect(this.analyser);
    this.buffer = new Float32Array(this.analyser.fftSize);

    this.timer = setInterval(() => this._tick(), updateIntervalMs);
  }

  _tick() {
    if (!this.analyser) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    if (this.onHit) {
      this._hitTick();
      return;
    }
    if (!this.onUpdate) return;
    this.onUpdate(this._readPitch());
  }

  _readPitch() {
    return yinPitch(this.buffer, this.audioCtx.sampleRate, {
      minFreq: this.minFreq,
      maxFreq: this.maxFreq,
    });
  }

  _hitTick() {
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    const rms = Math.sqrt(sum / this.buffer.length);
    const now = Date.now();

    if (this._capturing) {
      const result = this._readPitch();
      if (result && result.clarity >= HIT_MIN_CLARITY) this._samples.push(result);
      if (now - this._hitStart >= HIT_CAPTURE_MS) {
        this._capturing = false;
        if (this._samples.length) {
          const freqs = this._samples.map((s) => s.frequency).sort((a, b) => a - b);
          this.onHit({
            frequency: freqs[Math.floor(freqs.length / 2)],
            clarity: Math.max(...this._samples.map((s) => s.clarity)),
          });
        } else {
          this.onHit(null); // strike heard, but no readable pitch in it
        }
        this._samples = [];
      }
    } else if (
      rms > ONSET_RMS &&
      rms > this._lastRms * ONSET_RISE_FACTOR &&
      now - this._lastOnset > HIT_REFRACTORY_MS
    ) {
      // The onset tick itself is the stick-attack transient (mostly noise);
      // open the capture window here but only measure the following ticks.
      this._lastOnset = now;
      this._hitStart = now;
      this._capturing = true;
      this._samples = [];
    }
    this._lastRms = rms;
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.source) this.source.disconnect();
    this.source = null;
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.audioCtx) this.audioCtx.close();
    this.audioCtx = null;
    this.analyser = null;
    this.onUpdate = null;
    this.onHit = null;
    this._capturing = false;
    this._samples = [];
  }
}

export function micErrorMessage(err) {
  if (err && err.message === "insecure-context") {
    return "Microphone access needs a secure connection (HTTPS, or localhost on this device). Open this page over HTTPS to test pitch detection.";
  }
  if (err && err.name === "NotAllowedError") {
    return "Microphone access was denied. Allow mic access in your browser settings to detect pitch.";
  }
  if (err && err.name === "NotFoundError") {
    return "No microphone was found on this device.";
  }
  return "Couldn't access the microphone. Check your browser's mic permissions.";
}
