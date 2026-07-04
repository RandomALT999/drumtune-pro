import { el, qs, qsa } from "../util.js";
import { navigate } from "../main.js";
import { savedKits as seedKits, kitPieceSummary } from "../data.js";
import { loadSavedKits, saveSavedKits } from "../storage.js";

function currentList() {
  const stored = loadSavedKits();
  return stored === null ? seedKits : stored;
}

function listHtml(list) {
  if (list.length === 0) return `<div class="empty-state">No saved kits yet.</div>`;
  return list
    .map(
      (k) => `
    <div class="tap-card kit-row" data-id="${k.id}">
      <div class="emoji-badge">🥁</div>
      <div class="tap-card-body">
        <div class="tap-card-title">${k.name}</div>
        <div class="tap-card-sub">${k.tag ? k.tag + " · " : ""}${kitPieceSummary(k)}</div>
      </div>
      <button class="btn btn-sm btn-secondary remove-kit" data-id="${k.id}" aria-label="Remove kit">✕</button>
    </div>`
    )
    .join("");
}

export function renderKits() {
  const view = el(`
    <div class="section-title">Saved Drum Kits</div>
    <div id="kit-list">${listHtml(currentList())}</div>
    <button class="btn btn-secondary" id="new-kit-btn" style="margin-top:8px;">+ New Kit</button>
  `);

  function wireList() {
    qsa(view, ".kit-row").forEach((row) => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".remove-kit")) return;
        navigate("preset-detail", { kitId: row.dataset.id });
      });
    });
    qsa(view, ".remove-kit").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const remaining = currentList().filter((k) => k.id !== btn.dataset.id);
        saveSavedKits(remaining);
        qs(view, "#kit-list").innerHTML = listHtml(remaining);
        wireList();
      });
    });
  }

  wireList();
  qs(view, "#new-kit-btn").addEventListener("click", () => navigate("kit-builder", { mode: "new" }));

  return view;
}
