import { el, qs } from "../util.js";
import { navigate } from "../main.js";
import { getKit } from "../data.js";
import { addSavedKit } from "../storage.js";

export function renderKitComplete(params) {
  const kit = getKit(params.kitId);

  const view = el(`
    <div class="empty-state" style="padding-top:24px;">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9"/></svg>
      <div style="font-weight:700; font-size:17px; color:var(--text); margin-bottom:4px;">
        ${kit ? kit.name : "Kit"} Tuning Complete
      </div>
      <div style="max-width:280px; margin:0 auto;">
        Every piece is tuned relative to the others for one uniform, descending
        sound across the kit.
      </div>
    </div>

    <div class="card">
      <div class="field-label" style="margin-bottom:8px;">Save this kit for next time</div>
      <div class="field">
        <input type="text" id="kit-name-input" value="${kit ? kit.name : "My Kit"}" />
      </div>
      <button class="btn btn-primary" id="save-kit-btn">Save Kit</button>
    </div>

    <div class="btn-row" style="margin-top:8px;">
      <button class="btn btn-secondary" id="back-presets-btn">Back to Presets</button>
      <button class="btn btn-primary" id="back-home-btn">Done</button>
    </div>
  `);

  qs(view, "#save-kit-btn").addEventListener("click", () => {
    if (!kit) return;
    const name = qs(view, "#kit-name-input").value.trim() || kit.name;
    addSavedKit({ id: `saved-${Date.now()}`, name, tag: kit.tag, styleId: kit.styleId, pieces: kit.pieces });
    const btn = qs(view, "#save-kit-btn");
    btn.textContent = "Saved ✓";
    btn.disabled = true;
  });

  qs(view, "#back-presets-btn").addEventListener("click", () => navigate("presets", {}, { replace: true }));
  qs(view, "#back-home-btn").addEventListener("click", () => navigate("home", {}, { replace: true }));

  return view;
}
