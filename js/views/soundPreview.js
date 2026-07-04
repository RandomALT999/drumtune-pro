import { el, qsa } from "../util.js";
import { soundPresets, targetFrequencyFor } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";

export function renderSoundPreview(params = {}) {
  const drumType = params.drumType || "rack-tom";

  const view = el(`
    <div class="section-title">Style Presets</div>
    ${soundPresets
      .map((p) => {
        const freq = params.size ? targetFrequencyFor(drumType, params.size, p.id) : p.batter;
        return `
      <div class="preset-card" data-id="${p.id}">
        <div class="preset-card-top">
          <div class="preset-name">${p.name}</div>
          <button class="btn btn-sm btn-secondary preview-play" data-id="${p.id}">▶ Preview</button>
        </div>
        <div class="preset-tag">${p.tag}</div>
        <div class="preset-freqs" style="margin-top:8px;">
          <span>Target <b>${freq} Hz</b></span>
        </div>
      </div>`;
      })
      .join("")}
  `);

  qsa(view, ".preview-play").forEach((btn) => {
    btn.addEventListener("click", () => {
      const preset = soundPresets.find((p) => p.id === btn.dataset.id);
      const freq = params.size ? targetFrequencyFor(drumType, params.size, preset.id) : preset.batter;
      playToneForDrumType(drumType, freq);
      const original = btn.textContent;
      btn.textContent = "🔊 Playing…";
      setTimeout(() => (btn.textContent = original), 600);
    });
  });

  return view;
}
