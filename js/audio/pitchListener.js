import { yinPitch } from "./yin.js";

// Wraps mic capture + a throttled YIN analysis loop. Exposes the underlying
// AnalyserNode too, so screens that need a live FFT (Advanced) can share the
// same audio graph instead of opening a second mic stream.
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

  // opts: { onUpdate(result|null), targetFreq, fftSize, updateIntervalMs }
  async start(opts = {}) {
    const { onUpdate, targetFreq, fftSize = 2048, updateIntervalMs = 150 } = opts;
    this.onUpdate = onUpdate;
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
    if (!this.analyser || !this.onUpdate) return;
    this.analyser.getFloatTimeDomainData(this.buffer);
    const result = yinPitch(this.buffer, this.audioCtx.sampleRate, {
      minFreq: this.minFreq,
      maxFreq: this.maxFreq,
    });
    this.onUpdate(result);
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
