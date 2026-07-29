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

// "Tune further" halves the window twice, then holds: 10 → 5 → 2.5 Hz. The
// floor exists because chasing tighter than a couple of Hz by hand isn't
// realistic — the drum drifts more than that as it settles.
export function toleranceForStep(step) {
  return IN_TUNE_HZ / Math.pow(2, Math.min(step, 2));
}

// Sixteenths, so fine passes can suggest smaller moves than 1/8.
const SIXTEENTHS_LABEL = [
  "0", "1/16", "1/8", "3/16", "1/4", "5/16", "3/8", "7/16",
  "1/2", "9/16", "5/8", "11/16", "3/4", "13/16", "7/8", "15/16", "1",
];

// Heuristic for the all-lugs-at-once method: turning EVERY lug by the same
// amount raises tension across the whole head, so it moves the pitch further
// than the same turn on a single lug would (~100 cents per 1/8 turn, i.e.
// ~50 per 1/16, vs. the ~60-per-1/8 used when this estimated a single lug).
// Still a rough estimate, not a calibrated mechanical model — head ply,
// shell, and how much tension is already on the drum all change the real
// figure, and the response is non-linear (a turn near finger-tight moves
// pitch much more than a turn at high tension). Being iterative covers for
// that: re-measure, turn again.
const CENTS_PER_SIXTEENTH_TURN = 50;

export function turnEstimate(cents) {
  const abs = Math.abs(cents);
  if (abs <= 8) return { turns: 0, label: "Dialed in", direction: null };
  const direction = cents > 0 ? "tighten" : "loosen";
  const sixteenths = Math.min(16, Math.max(1, Math.round(abs / CENTS_PER_SIXTEENTH_TURN)));
  return { turns: sixteenths / 16, label: `${SIXTEENTHS_LABEL[sixteenths]} turn`, direction };
}
