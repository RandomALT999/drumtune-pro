// Spectral-peak pitch detection (Goertzel scan), used for drum hits instead
// of YIN. Drum overtones are inharmonic — the head's first overtone sits
// near 1.6x the fundamental — so autocorrelation detectors flip between the
// two. In the frequency domain they're just separate peaks.
//
// The pitch a drummer tunes is the FUNDAMENTAL, which is the drum's lowest
// mode. Overtones are above it. But where you strike changes which is
// louder — a center hit favours the fundamental, an edge/rim hit favours an
// overtone — so magnitude-based picking flips as the strike moves (the exact
// symptom seen on-device for snare/floor tom). Two things fix it:
//   1. The search range is kept fairly narrow around the target, so at
//      normal tuning distances the ~1.6x overtone falls outside it entirely.
//   2. Among the peaks that ARE found, take the LOWEST one that's a real
//      feature — not the loudest. The fundamental can legitimately be
//      quieter than its overtone, but it's always lower in frequency.
// Together these report the fundamental regardless of strike position.
export function spectralPitch(buffer, sampleRate, { minFreq, maxFreq, targetFreq = null } = {}) {
  const n = buffer.length;

  // Hann window keeps neighbouring partials from smearing into each other.
  const windowed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    windowed[i] = buffer[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));
  }

  function magAt(freq) {
    // Goertzel: magnitude of one DFT bin at an arbitrary frequency.
    const w = (2 * Math.PI * freq) / sampleRate;
    const coeff = 2 * Math.cos(w);
    let s1 = 0,
      s2 = 0;
    for (let i = 0; i < n; i++) {
      const s0 = windowed[i] + coeff * s1 - s2;
      s2 = s1;
      s1 = s0;
    }
    return Math.sqrt(Math.max(0, s1 * s1 + s2 * s2 - coeff * s1 * s2));
  }

  // Coarse scan at 1 Hz steps.
  const lo = Math.max(20, Math.floor(minFreq));
  const hi = Math.ceil(maxFreq);
  if (hi <= lo + 2) return null;
  const mags = [];
  for (let f = lo; f <= hi; f++) mags.push(magAt(f));

  let maxMag = 0;
  for (const m of mags) if (m > maxMag) maxMag = m;
  if (maxMag <= 0) return null;

  // Local maxima that are at least a real feature, not scan noise. The floor
  // is low because a fundamental excited by an edge strike can be much
  // quieter than the overtone, and we still need to see it.
  const PEAK_FLOOR = 0.12;
  const peaks = [];
  for (let i = 1; i < mags.length - 1; i++) {
    if (mags[i] >= mags[i - 1] && mags[i] >= mags[i + 1] && mags[i] / maxMag >= PEAK_FLOOR) {
      peaks.push({ freq: lo + i, mag: mags[i] / maxMag });
      while (i + 1 < mags.length - 1 && mags[i + 1] === mags[i]) i++;
    }
  }
  if (peaks.length === 0) return null;

  // Take the LOWEST peak that's still a genuine feature (a reasonable
  // fraction of the strongest peak). Since we only analyze a loud
  // post-strike window, the drum's own partials dominate any background,
  // and its lowest partial is the fundamental — the pitch being tuned.
  // Magnitude is deliberately NOT the selector: that's what let a louder
  // overtone win on rim strikes. Without a target (not used in practice —
  // hit mode always passes one) the loudest peak is the sane fallback.
  const SIGNIFICANT = 0.15;
  let best;
  if (targetFreq) {
    const strong = peaks.filter((p) => p.mag >= SIGNIFICANT);
    const pool = strong.length ? strong : peaks;
    best = pool.reduce((lowest, p) => (p.freq < lowest.freq ? p : lowest), pool[0]);
  } else {
    best = peaks.reduce((loudest, p) => (p.mag > loudest.mag ? p : loudest), peaks[0]);
  }

  // Fine scan around the winner for cents-level precision.
  let bestFreq = best.freq;
  let bestMag = magAt(best.freq);
  for (let f = best.freq - 1.5; f <= best.freq + 1.5; f += 0.05) {
    const m = magAt(f);
    if (m > bestMag) {
      bestMag = m;
      bestFreq = f;
    }
  }

  return { frequency: bestFreq, clarity: best.mag };
}
