import { loadSavedKits } from "./storage.js";

// Static mock data for UI-only scaffold. No audio/pitch-detection logic here yet —
// screens render against these fixtures until the real engine is wired in.

export const drumTypes = [
  { id: "rack-tom", label: "Rack Tom", lugs: 6, sizes: [10, 12, 13, 14] },
  { id: "floor-tom", label: "Floor Tom", lugs: 8, sizes: [14, 16, 18] },
  { id: "snare", label: "Snare", lugs: 8, sizes: [13, 14] },
  { id: "bass-drum", label: "Bass Drum", lugs: 10, sizes: [18, 20, 22, 24] },
];

export const soundPresets = [
  { id: "warm", name: "Warm", tag: "Low overtones, dampened", batter: 92, resonant: 98 },
  { id: "balanced", name: "Balanced", tag: "Even batter/reso ratio", batter: 110, resonant: 112 },
  { id: "punchy", name: "Punchy", tag: "Tight attack", batter: 128, resonant: 118 },
  { id: "resonant", name: "Resonant", tag: "Open, ringing sustain", batter: 100, resonant: 104 },
  { id: "jazz", name: "Jazz", tag: "Low tension, dark tone", batter: 88, resonant: 90 },
  { id: "rock", name: "Rock", tag: "Medium-high, focused", batter: 118, resonant: 122 },
  { id: "metal", name: "Metal", tag: "High tension, fast attack", batter: 140, resonant: 136 },
];

// Base target frequency (Hz) per drum type at a "Balanced" style, indexed by
// the nearest known size. A chosen sound style then scales that base up or
// down (see STYLE_MULTIPLIER) so the same style reads as one consistent
// character across every piece in a kit, while bigger drums still land lower
// than smaller ones — this replaces the old hand-picked per-kit numbers.
const BASE_FREQ_TABLE = {
  "rack-tom": { 10: 132, 12: 116, 13: 108, 14: 100 },
  "floor-tom": { 14: 92, 16: 82, 18: 74 },
  "bass-drum": { 18: 58, 20: 52, 22: 47, 24: 42 },
  snare: { 13: 182, 14: 172 },
};

const STYLE_MULTIPLIER = {
  warm: 0.82,
  balanced: 1.0,
  punchy: 1.12,
  resonant: 0.92,
  jazz: 0.8,
  rock: 1.08,
  metal: 1.22,
};

export function targetFrequencyFor(drumType, size, styleId = "balanced") {
  const table = BASE_FREQ_TABLE[drumType] || BASE_FREQ_TABLE["rack-tom"];
  const sizes = Object.keys(table)
    .map(Number)
    .sort((a, b) => a - b);
  const nearestSize = sizes.reduce((best, s) => (Math.abs(s - size) < Math.abs(best - size) ? s : best), sizes[0]);
  const mult = STYLE_MULTIPLIER[styleId] ?? 1;
  return Math.round(table[nearestSize] * mult);
}

function piece(id, drumType, size, lugCount, styleId) {
  const typeLabel = drumTypes.find((d) => d.id === drumType)?.label || drumType;
  return {
    id,
    label: `${size}" ${typeLabel}`,
    drumType,
    size,
    lugCount,
    target: targetFrequencyFor(drumType, size, styleId),
  };
}

// Genre kit presets. Each kit shares one sound style across all its pieces;
// target frequencies are derived per piece from size + that style (via
// targetFrequencyFor) so the kit descends from the highest rack tom down to
// the floor tom for one uniform, related sound rather than independent numbers.
export const genrePresets = [
  {
    id: "rock",
    name: "Rock Kit",
    tag: "Punchy, focused attack",
    styleId: "rock",
    pieces: [
      piece("rack1", "rack-tom", 12, 6, "rock"),
      piece("rack2", "rack-tom", 13, 6, "rock"),
      piece("floor1", "floor-tom", 16, 8, "rock"),
      piece("snare1", "snare", 14, 8, "rock"),
    ],
  },
  {
    id: "jazz",
    name: "Jazz Kit",
    tag: "Low tension, dark tone",
    styleId: "jazz",
    pieces: [
      piece("rack1", "rack-tom", 12, 6, "jazz"),
      piece("floor1", "floor-tom", 14, 8, "jazz"),
      piece("snare1", "snare", 13, 8, "jazz"),
    ],
  },
  {
    id: "metal",
    name: "Metal Kit",
    tag: "High tension, fast attack",
    styleId: "metal",
    pieces: [
      piece("rack1", "rack-tom", 10, 6, "metal"),
      piece("rack2", "rack-tom", 12, 6, "metal"),
      piece("floor1", "floor-tom", 16, 8, "metal"),
      piece("floor2", "floor-tom", 18, 8, "metal"),
      piece("snare1", "snare", 14, 8, "metal"),
    ],
  },
  {
    id: "fusion",
    name: "Fusion Kit",
    tag: "Bright, articulate",
    styleId: "punchy",
    pieces: [
      piece("rack1", "rack-tom", 10, 6, "punchy"),
      piece("rack2", "rack-tom", 12, 6, "punchy"),
      piece("floor1", "floor-tom", 14, 8, "punchy"),
      piece("snare1", "snare", 13, 8, "punchy"),
    ],
  },
  {
    id: "funk",
    name: "Funk Kit",
    tag: "Tight, dry pocket",
    styleId: "punchy",
    pieces: [
      piece("rack1", "rack-tom", 12, 6, "punchy"),
      piece("floor1", "floor-tom", 14, 8, "punchy"),
      piece("snare1", "snare", 14, 8, "punchy"),
    ],
  },
  {
    id: "gospel",
    name: "Gospel Kit",
    tag: "Warm, singing sustain",
    styleId: "resonant",
    pieces: [
      piece("rack1", "rack-tom", 12, 6, "resonant"),
      piece("rack2", "rack-tom", 13, 6, "resonant"),
      piece("floor1", "floor-tom", 16, 8, "resonant"),
      piece("snare1", "snare", 13, 8, "resonant"),
    ],
  },
];

// In-memory registry for kits built via the Kit Builder screen ("Tune All
// Drums" or "Edit Kit") that are actively being tuned but not saved yet.
// Cleared on reload — once the user opts to save, it's persisted for real via
// storage.js instead.
const sessionKits = new Map();

export function registerSessionKit(kit) {
  sessionKits.set(kit.id, kit);
  return kit;
}

export function getKit(kitId) {
  const builtIn = genrePresets.find((k) => k.id === kitId);
  if (builtIn) return builtIn;
  if (sessionKits.has(kitId)) return sessionKits.get(kitId);
  const userKits = loadSavedKits() || [];
  return userKits.find((k) => k.id === kitId);
}

export function kitPieceSummary(kit) {
  return kit.pieces.map((p) => p.label).join(" · ");
}

// Standard cross-pattern ("star") tuning order: opposite-ish lugs alternate
// so tension is pulled evenly across the head instead of working around it.
export function generateCrossOrder(count) {
  const half = Math.floor(count / 2);
  const order = [];
  for (let i = 1; i <= half; i++) {
    order.push(i, i + half);
  }
  if (count % 2 !== 0) order.push(count);
  return order;
}
