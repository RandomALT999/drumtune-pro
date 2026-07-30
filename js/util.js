// Builds a single DOM element (with a "view" wrapper) from an HTML string.
// `scrolls: true` for list screens; focus screens (tuning) manage their own
// internal scrolling so the button row stays pinned.
export function el(html, { scrolls = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = scrolls ? "view scrolls" : "view";
  wrap.innerHTML = html.trim();
  return wrap;
}

export function qs(root, sel) {
  return root.querySelector(sel);
}

export function qsa(root, sel) {
  return Array.from(root.querySelectorAll(sel));
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const CHEVRON = `<svg class="chev" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>`;
export const PLAY_ICON = `<svg width="14" height="14" viewBox="0 0 12 12"><path d="M2 1l8 5-8 5z"/></svg>`;

// Per-view header: back chevron + uppercase context label on the left, live
// state or a single text action on the right. Replaces the old global
// centred title bar.
export function headerHtml({ label = "", state = "", action = "" } = {}) {
  return `
    <div class="hdr">
      <div class="hdr-left">
        <button class="hdr-back" id="hdr-back" aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="#6a6e7a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="hdr-label">${escapeHtml(label)}</span>
      </div>
      ${action ? `<button class="hdr-action" id="hdr-action">${escapeHtml(action)}</button>` : ""}
      ${!action && state ? `<span class="hdr-state" id="hdr-state">${escapeHtml(state)}</span>` : ""}
    </div>`;
}

// Wires the header's back chevron. Pass an onAction for the right-hand action.
export function wireHeader(view, { onBack, onAction } = {}) {
  const back = qs(view, "#hdr-back");
  if (back) back.addEventListener("click", onBack || (() => window.history.back()));
  const action = qs(view, "#hdr-action");
  if (action && onAction) action.addEventListener("click", onAction);
}
