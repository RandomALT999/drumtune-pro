import { el, qs, qsa, escapeHtml, CHEVRON } from "../util.js";
import { navigate } from "../main.js";
import { genrePresets, kitPieceSummary } from "../data.js";
import { loadSavedKits, saveSavedKits } from "../storage.js";

// Absorbs the old Presets tab: your saved kits first, then the genre presets
// as a starting point.
export function renderKits() {
  const view = el(
    `
    <div style="flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div class="screen-title">Kits</div>
      <button class="chip" id="new-kit" style="margin-top:2px"><span class="plus" style="color:var(--accent);font-size:15px;line-height:1">+</span>New</button>
    </div>

    <div class="eyebrow" style="flex:none;margin-top:24px">Yours</div>
    <div id="yours" style="flex:none;margin-top:3px"></div>

    <div class="eyebrow" style="flex:none;margin-top:26px">Start from a genre</div>
    <div class="rows" style="flex:none;margin-top:3px">
      ${genrePresets
        .map(
          (g) => `
        <button class="row row-sm" data-kit="${g.id}">
          <span class="row-title">${escapeHtml(g.name.replace(" Kit", ""))}</span>
          <span class="meta">${escapeHtml(g.tag)}</span>
          ${CHEVRON}
        </button>`
        )
        .join("")}
    </div>
    <div class="spacer"></div>
  `,
    { scrolls: true }
  );

  function paintYours() {
    const kits = loadSavedKits() || [];
    const host = qs(view, "#yours");
    if (kits.length === 0) {
      host.innerHTML = `
        <div class="empty-note" style="padding:4px 0 14px">Nothing saved yet. Tune a kit and save it, or start one from scratch.</div>
        <div class="chips"><button class="chip dashed" id="build-empty"><span class="plus">+</span>Build a kit</button></div>`;
      qs(host, "#build-empty").addEventListener("click", () => navigate("kit-builder", { mode: "new" }));
      return;
    }
    host.innerHTML = `<div class="rows">${kits
      .map((k) => {
        const tuned = typeof k.tunedCount === "number" ? k.tunedCount : 0;
        return `
        <div class="row row-sm" data-open="${escapeHtml(k.id)}" role="button" tabindex="0">
          <span class="row-title">${escapeHtml(k.name)}</span>
          <span class="meta" style="color:var(--accent)">${tuned} of ${k.pieces.length}</span>
          <button class="x-btn" data-remove="${escapeHtml(k.id)}" aria-label="Remove ${escapeHtml(k.name)}">✕</button>
        </div>
        <div class="meta" data-sub style="padding:0 0 14px;margin-top:-10px">${escapeHtml(kitPieceSummary(k))}</div>`;
      })
      .join("")}</div>`;

    qsa(host, "[data-open]").forEach((row) =>
      row.addEventListener("click", (e) => {
        if (e.target.closest("[data-remove]")) return;
        navigate("preset-detail", { kitId: row.dataset.open });
      })
    );
    qsa(host, "[data-remove]").forEach((btn) =>
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        saveSavedKits((loadSavedKits() || []).filter((k) => k.id !== btn.dataset.remove));
        paintYours();
      })
    );
  }

  qs(view, "#new-kit").addEventListener("click", () => navigate("kit-builder", { mode: "new" }));
  qsa(view, "[data-kit]").forEach((btn) =>
    btn.addEventListener("click", () => navigate("preset-detail", { kitId: btn.dataset.kit }))
  );

  paintYours();
  return view;
}
