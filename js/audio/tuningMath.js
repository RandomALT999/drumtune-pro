// Cents-off (a ratio measure) is still handy for the turn-amount heuristic,
// but the in-tune window itself is judged in Hz — see IN_TUNE_HZ.
export function centsOff(freq, target) {
  return 1200 * Math.log2(target / freq);
}

// Hz difference from target: positive = flat/low (tighten), negative =
// sharp/high (loosen).
export function hzOff(freq, target) {
  return target - freq;
}

// In-tune leeway, expressed in Hz rather than cents. Cents scale with pitch,
// so a tight cents tolerance works out to barely ~1 Hz at typical drum
// pitches — unreachable by hand. ±10 Hz is the real-world reachable window
// (on-device finding).
export const IN_TUNE_HZ = 10;
const SLIGHT_HZ = 25; // within this but past IN_TUNE_HZ = yellow, else red

export function classifyStatus(freq, target) {
  const abs = Math.abs(target - freq);
  if (abs <= IN_TUNE_HZ) return "in-tune";
  if (abs <= SLIGHT_HZ) return "slight";
  return "off";
}

const EIGHTHS_LABEL = ["0", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8", "1"];

// Heuristic: ~60 cents of pitch change per 1/8 turn on a typical single-ply
// batter head. Real turn sensitivity varies by head/shell/tension range, so
// this is a rough estimate until the real audio-to-mechanical model lands.
export function turnEstimate(cents) {
  const abs = Math.abs(cents);
  if (abs <= 12) return { turns: 0, label: "Dialed in", direction: null };
  const direction = cents > 0 ? "tighten" : "loosen";
  const eighths = Math.min(8, Math.max(1, Math.round(abs / 60)));
  return { turns: eighths / 8, label: `${EIGHTHS_LABEL[eighths]} turn`, direction };
}
