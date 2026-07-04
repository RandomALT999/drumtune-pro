// Spectral-peak pitch detection (Goertzel scan), used for drum hits instead
// of YIN. Drum overtones are inharmonic — the head's second mode sits near
// 1.6x the fundamental, not an integer multiple — so no autocorrelation lag
// ever lines the partials up and YIN-family detectors flip between modes
// and spurious compromise dips (observed on-device as readings jumping
// between two values ~60 Hz apart). In the frequency domain those same
// partials are just two separate peaks: scan magnitudes across the search
// range, pick the peak nearest the target, then fine-scan it for
// cents-level precision.
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

  // Local maxima that are at least a real feature, not scan noise.
  const PEAK_FLOOR = 0.2;
  const peaks = [];
  for (let i = 1; i < mags.length - 1; i++) {
    if (mags[i] >= mags[i - 1] && mags[i] >= mags[i + 1] && mags[i] / maxMag >= PEAK_FLOOR) {
      peaks.push({ freq: lo + i, mag: mags[i] / maxMag });
      while (i + 1 < mags.length - 1 && mags[i + 1] === mags[i]) i++;
    }
  }
  if (peaks.length === 0) return null;

  // Strongest peak wins, discounted by distance from the target (0.5 per
  // octave) so a louder overtone can't outvote the fundamental the user is
  // actually tuning against. Without a target, loudest peak wins.
  let best = null;
  for (const p of peaks) {
    const score = targetFreq ? p.mag - 0.5 * Math.abs(Math.log2(p.freq / targetFreq)) : p.mag;
    if (!best || score > best.score) best = { ...p, score };
  }

  // Drum-mode pair check: a drumhead's fundamental and first overtone come
  // as a pair roughly 1.5–1.8x apart. If the winner has a credible peak at
  // ~1/1.6 of its own frequency, the winner IS the overtone — take the
  // lower peak instead. This beats any amount of score tuning, because rim
  // strikes routinely make the overtone the louder of the two.
  const partner = peaks
    .filter((p) => {
      const ratio = p.freq / best.freq;
      return ratio >= 0.55 && ratio <= 0.72 && p.mag >= 0.35;
    })
    .sort((a, b) => b.mag - a.mag)[0];
  if (partner) best = { ...partner, score: best.score };

  // Fine scan around the winner for cents-level precision.
  let bestFreq = best.freq;
  let bestMag = best.mag * maxMag;
  for (let f = best.freq - 1.5; f <= best.freq + 1.5; f += 0.05) {
    const m = magAt(f);
    if (m > bestMag) {
      bestMag = m;
      bestFreq = f;
    }
  }

  return { frequency: bestFreq, clarity: best.mag };
}
