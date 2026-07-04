// Cents convention used throughout the UI: positive = flat/low (tighten),
// negative = sharp/high (loosen). That's the opposite sign of the textbook
// cents formula, so it's flipped here rather than at every call site.
export function centsOff(freq, target) {
  return 1200 * Math.log2(target / freq);
}

// Drums can't be tuned to guitar-tuner precision — head seating, where the
// stick lands, and room acoustics all move the reading several cents from
// hit to hit, so "in tune" needs real leeway or it's never reachable in
// practice. One constant so every screen agrees on the threshold.
export const IN_TUNE_CENTS = 15;

export function classifyStatus(cents) {
  const abs = Math.abs(cents);
  if (abs <= IN_TUNE_CENTS) return "in-tune";
  if (abs <= 35) return "slight";
  return "off";
}

const EIGHTHS_LABEL = ["0", "1/8", "1/4", "3/8", "1/2", "5/8", "3/4", "7/8", "1"];

// Heuristic: ~60 cents of pitch change per 1/8 turn on a typical single-ply
// batter head. Real turn sensitivity varies by head/shell/tension range, so
// this is a rough estimate until the real audio-to-mechanical model lands.
export function turnEstimate(cents) {
  const abs = Math.abs(cents);
  if (abs <= IN_TUNE_CENTS) return { turns: 0, label: "In tune", direction: null };
  const direction = cents > 0 ? "tighten" : "loosen";
  const eighths = Math.min(8, Math.max(1, Math.round(abs / 60)));
  return { turns: eighths / 8, label: `${EIGHTHS_LABEL[eighths]} turn`, direction };
}
