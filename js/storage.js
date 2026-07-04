// LocalStorage-backed saved-kit persistence. Returns null when nothing has
// been saved yet (or storage is unavailable, e.g. private browsing) so the
// caller can decide what to show (an empty state).
const KEY = "drumtune.savedKits";

export function loadSavedKits() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const kits = JSON.parse(raw);
    // Migration: earlier builds shipped placeholder "seed-*" kits and could
    // persist them alongside real saves. They've been removed from the app,
    // so scrub any stored copies too.
    const filtered = kits.filter((k) => !String(k.id).startsWith("seed-"));
    if (filtered.length !== kits.length) saveSavedKits(filtered);
    return filtered;
  } catch (e) {
    return null;
  }
}

export function saveSavedKits(kits) {
  try {
    localStorage.setItem(KEY, JSON.stringify(kits));
  } catch (e) {
    /* storage unavailable — kits just won't persist across reloads */
  }
}

export function addSavedKit(kit) {
  const next = [kit, ...(loadSavedKits() || [])];
  saveSavedKits(next);
  return next;
}

// Replaces the existing entry with the same id in place (used when editing
// an already-saved kit, so re-saving updates it instead of creating a
// duplicate the user has to clean up); adds it as new if no id matches.
export function upsertSavedKit(kit) {
  const kits = loadSavedKits() || [];
  const idx = kits.findIndex((k) => k.id === kit.id);
  const next = idx >= 0 ? [...kits.slice(0, idx), kit, ...kits.slice(idx + 1)] : [kit, ...kits];
  saveSavedKits(next);
  return next;
}
