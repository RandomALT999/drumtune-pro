import { el, qsa } from "../util.js";
import { navigate } from "../main.js";
import { genrePresets, kitPieceSummary } from "../data.js";

export function renderPresets() {
  const view = el(`
    <div class="section-title">Genre Libraries</div>
    <div class="genre-list">
      ${genrePresets
        .map(
          (g) => `
        <button class="tap-card" data-id="${g.id}">
          <div class="emoji-badge">🎼</div>
          <div class="tap-card-body">
            <div class="tap-card-title">${g.name}</div>
            <div class="tap-card-sub">${kitPieceSummary(g)}</div>
          </div>
          <div class="chevron">›</div>
        </button>`
        )
        .join("")}
    </div>
  `);

  qsa(view, "[data-id]").forEach((btn) => {
    btn.addEventListener("click", () => navigate("preset-detail", { kitId: btn.dataset.id }));
  });

  return view;
}
