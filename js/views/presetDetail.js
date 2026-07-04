import { el, qs, qsa } from "../util.js";
import { navigate } from "../main.js";
import { getKit } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";
import { beginKitTuning } from "./tuningShared.js";

export function renderPresetDetail(params) {
  const kit = getKit(params.kitId);
  if (!kit) {
    return el(`<div class="empty-state">Preset not found.</div>`);
  }

  const view = el(`
    <div class="card">
      <div style="font-weight:700; font-size:17px;">${kit.name}</div>
      <div style="font-size:13px; color:var(--text-dim); margin-top:2px;">${kit.tag}</div>
    </div>

    <div class="disclosure-box" style="margin-top:0; margin-bottom:16px;">
      Each piece's target is set relative to the others so the kit descends from
      the highest rack tom down to the floor tom for one uniform sound — tune
      them in order rather than independently.
    </div>

    <div class="section-title">Hear Each Piece</div>
    ${kit.pieces
      .map(
        (p) => `
      <div class="preset-card">
        <div class="preset-card-top">
          <div class="preset-name">${p.label}</div>
          <button class="btn btn-sm btn-secondary preview-piece" data-id="${p.id}">▶ Preview</button>
        </div>
        <div class="preset-freqs">
          <span>Target <b>${p.target} Hz</b></span>
          <span>Lugs <b>${p.lugCount}</b></span>
        </div>
      </div>`
      )
      .join("")}

    <div class="btn-row" style="margin-top:12px;">
      <button class="btn btn-secondary" id="edit-kit-btn">Edit Kit</button>
      <button class="btn btn-primary" id="start-kit-btn">Start Tuning Kit</button>
    </div>
  `);

  qsa(view, ".preview-piece").forEach((btn) => {
    btn.addEventListener("click", () => {
      const piece = kit.pieces.find((p) => p.id === btn.dataset.id);
      playToneForDrumType(piece.drumType, piece.target);
      const original = btn.textContent;
      btn.textContent = "🔊 Playing…";
      setTimeout(() => (btn.textContent = original), 600);
    });
  });

  qs(view, "#edit-kit-btn").addEventListener("click", () => navigate("kit-builder", { mode: "edit", kitId: kit.id }));
  qs(view, "#start-kit-btn").addEventListener("click", () => beginKitTuning(kit));

  return view;
}
