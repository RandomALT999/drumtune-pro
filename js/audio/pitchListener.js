import { yinPitch } from "./yin.js";
import { spectralPitch } from "./spectralPeak.js";

// Onset/hit-detection tuning knobs (hit mode only).
const ONSET_RMS = 0.02; // loud enough to be a strike, not room noise
const ONSET_RISE_FACTOR = 2.5; // sharp jump vs. the previous tick's level
const HIT_REFRACTORY_MS = 350; // min gap before another hit can register
const HIT_CAPTURE_MS = 350; // measure this long after onset, then analyze
const HIT_TICK_MS = 50; // faster ticks in hit mode for onset resolution
// Hit mode analyzes one long window per strike, so the analyser buffer is
// forced up to this size (~171 ms at 48 kHz) — long enough to resolve a
// drum's fundamental and its ~1.6x overtone as separate spectral peaks.
const HIT_FFT_SIZE = 8192;

// Wraps mic capture + a throttled analysis loop. Exposes the underlying
// AnalyserNode too, so screens that need a live FFT (Advanced) can share the
// same audio graph instead of opening a second mic stream.
//
// Two modes:
//  - continuous (onUpdate): YIN pitch every tick — used by the Advanced
//    screen, which only needs the analyser + occasional readings.
//  - hit-based (onHit): detects discrete drum strikes via an RMS onset jump,
//    then measures pitch once per strike with spectral peak detection
//    (spectralPeak.js) on a long window taken at the end of the capture
//    period. Spectral peaks handle drums' inharmonic overtones where
//    autocorrelation methods flip between modes; measuring per-strike avoids
//    the pitch drift of the decaying ring. onHit fires once per strike, or
//    with null if the strike had no readable pitch.
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
    this.targetFreq = null;
    this.onUpdate = null;
    this.onHit = null;
    this._lastRms = 0;
    this._lastOnset = 0;
    this._capturing = false;
    this._hitStart = 0;
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
    const updateIntervalMs = opts.updateIntervalMs ?? (onHit ? HIT_TICK_MS : 150);
    this.onUpdate = onUpdate || null;
    this.onHit = onHit || null;
    this.targetFreq = targetFreq || null;
    // Kept narrow around the target on purpose: a drum's first overtone sits
    // near ~1.6x its fundamental, so capping the range at 1.5x the target
    // keeps that overtone out of the scan entirely at normal tuning
    // distances, which (with lowest-peak selection in spectralPeak.js) is
    // what stops the fundamental/overtone flip on snare and floor tom.
    this.minFreq = targetFreq ? Math.max(20, targetFreq * 0.55) : 30;
    this.maxFreq = targetFreq ? targetFreq * 1.5 : 600;

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
    this.analyser.fftSize = this.onHit ? Math.max(fftSize, HIT_FFT_SIZE) : fftSize;
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
    this.onUpdate(
      yinPitch(this.buffer, this.audioCtx.sampleRate, {
        minFreq: this.minFreq,
        maxFreq: this.maxFreq,
        targetFreq: this.targetFreq,
      })
    );
  }

  _hitTick() {
    let sum = 0;
    for (let i = 0; i < this.buffer.length; i++) sum += this.buffer[i] * this.buffer[i];
    const rms = Math.sqrt(sum / this.buffer.length);
    const now = Date.now();

    if (this._capturing) {
      if (now - this._hitStart >= HIT_CAPTURE_MS) {
        this._capturing = false;
        // The analyser buffer is a rolling window of the last ~171 ms, so at
        // this point it holds the strike's early decay — past the noisy
        // stick attack, before the ring has drifted. One analysis per hit.
        this.onHit(
          spectralPitch(this.buffer, this.audioCtx.sampleRate, {
            minFreq: this.minFreq,
            maxFreq: this.maxFreq,
            targetFreq: this.targetFreq,
          })
        );
      }
    } else if (
      rms > ONSET_RMS &&
      rms > this._lastRms * ONSET_RISE_FACTOR &&
      now - this._lastOnset > HIT_REFRACTORY_MS
    ) {
      this._lastOnset = now;
      this._hitStart = now;
      this._capturing = true;
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
