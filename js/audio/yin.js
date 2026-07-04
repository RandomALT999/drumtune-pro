// YIN pitch detection (de Cheveigné & Kawahara, 2002), implemented directly in
// vanilla JS — no Pitchy.js dependency, so the app has no runtime package to
// fetch and keeps working fully offline once added to the home screen.
//
// Steps: difference function -> cumulative mean normalized difference (CMND)
// -> candidate dip collection -> target-biased scoring -> parabolic
// interpolation for sub-sample tau.
//
// Why candidate scoring instead of the textbook "first dip below threshold":
// a drum struck near the rim rings at two pitches at once — the fundamental
// and the head's next vibration mode at roughly 1.6x it. Whichever one the
// first-dip rule happened to land on flipped hit to hit (observed on-device
// as readings jumping between two values ~60 Hz apart). Collecting every
// plausible dip and scoring by depth minus distance-from-target locks onto
// the mode the user is actually tuning against, consistently.
export function yinPitch(buffer, sampleRate, { minFreq = 30, maxFreq = 600, targetFreq = null } = {}) {
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

  // Every local minimum below this ceiling is a plausible period candidate.
  const CANDIDATE_CEILING = 0.35;
  const candidates = [];
  for (let tau = Math.max(tauMin, 2); tau < tauMax; tau++) {
    if (cmnd[tau] < CANDIDATE_CEILING && cmnd[tau] <= cmnd[tau - 1] && cmnd[tau] <= cmnd[tau + 1]) {
      candidates.push(tau);
      // Skip forward past this dip's plateau so it isn't counted twice.
      while (tau + 1 < tauMax && cmnd[tau + 1] === cmnd[tau]) tau++;
    }
  }
  if (candidates.length === 0) return null;

  // Parabolic interpolation around tau for sub-sample accuracy.
  function refine(tau) {
    const x0 = tau > 1 ? tau - 1 : tau;
    const x2 = tau + 1 <= tauMax ? tau + 1 : tau;
    if (x0 === tau || x2 === tau) return tau;
    const s0 = cmnd[x0],
      s1 = cmnd[tau],
      s2 = cmnd[x2];
    const denom = 2 * (2 * s1 - s2 - s0);
    return denom === 0 ? tau : tau + (s2 - s0) / denom;
  }

  let best = null;
  for (const tau of candidates) {
    const frequency = sampleRate / refine(tau);
    const clarity = Math.max(0, 1 - cmnd[tau]);
    // Dip depth, penalized by how far the candidate sits from the target
    // (0.6 per octave). A clean overtone dip a half-octave off loses to a
    // decent fundamental dip near the target; without a target the deepest
    // dip simply wins.
    const score = targetFreq ? clarity - 0.6 * Math.abs(Math.log2(frequency / targetFreq)) : clarity;
    if (!best || score > best.score) best = { frequency, clarity, score };
  }

  return { frequency: best.frequency, clarity: best.clarity };
}
