// YIN pitch detection (de Cheveigné & Kawahara, 2002), implemented directly in
// vanilla JS — no Pitchy.js dependency, so the app has no runtime package to
// fetch and keeps working fully offline once added to the home screen.
//
// Steps: difference function -> cumulative mean normalized difference (CMND)
// -> absolute threshold search -> parabolic interpolation for sub-sample tau.
export function yinPitch(buffer, sampleRate, { threshold = 0.15, minFreq = 30, maxFreq = 600 } = {}) {
  const n = buffer.length;
  const tauMax = Math.min(Math.floor(n / 2), Math.ceil(sampleRate / minFreq));
  const tauMin = Math.max(1, Math.floor(sampleRate / maxFreq));
  if (tauMax <= tauMin + 1) return null;

  const diff = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    const limit = n - tau;
    for (let i = 0; i < limit; i++) {
      const delta = buffer[i] - buffer[i + tau];
      sum += delta * delta;
    }
    diff[tau] = sum;
  }

  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let runningSum = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    runningSum += diff[tau];
    cmnd[tau] = runningSum === 0 ? 1 : (diff[tau] * tau) / runningSum;
  }

  let tauEstimate = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 <= tauMax && cmnd[tau + 1] < cmnd[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }
  if (tauEstimate === -1) return null;

  // Parabolic interpolation around tauEstimate for sub-sample accuracy.
  const x0 = tauEstimate > 1 ? tauEstimate - 1 : tauEstimate;
  const x2 = tauEstimate + 1 <= tauMax ? tauEstimate + 1 : tauEstimate;
  let betterTau = tauEstimate;
  if (x0 !== tauEstimate && x2 !== tauEstimate) {
    const s0 = cmnd[x0],
      s1 = cmnd[tauEstimate],
      s2 = cmnd[x2];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) betterTau = tauEstimate + (s2 - s0) / denom;
  }

  const frequency = sampleRate / betterTau;
  const clarity = Math.max(0, 1 - cmnd[tauEstimate]);
  return { frequency, clarity };
}
