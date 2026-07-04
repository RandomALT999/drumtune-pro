// Simple local-maxima peak-picker over an AnalyserNode's frequency-domain
// data, used to surface the fundamental + a few harmonics on the Advanced
// Frequency Analysis screen. Not a substitute for proper spectral peak
// interpolation, but good enough to show a live, real overtone series.
export function readFrequencyData(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return data;
}

export function findOvertones(analyser, sampleRate, count = 4) {
  const data = readFrequencyData(analyser);
  const binHz = sampleRate / analyser.fftSize;
  const peaks = [];
  for (let i = 2; i < data.length - 2; i++) {
    const v = data[i];
    if (v > 40 && v >= data[i - 1] && v >= data[i + 1] && v > data[i - 2] && v > data[i + 2]) {
      peaks.push({ freq: i * binHz, amp: v });
    }
  }
  peaks.sort((a, b) => b.amp - a.amp);
  const top = peaks.slice(0, count).sort((a, b) => a.freq - b.freq);
  const maxAmp = top.length ? top.reduce((m, p) => Math.max(m, p.amp), 0) : 1;
  return top.map((p) => ({ freq: p.freq, ampPct: Math.round((p.amp / maxAmp) * 100) }));
}
