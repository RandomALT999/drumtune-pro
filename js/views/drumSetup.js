import { el, qs, qsa } from "../util.js";
import { navigate } from "../main.js";
import { drumTypes, soundPresets, targetFrequencyFor } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";

const shapeIcons = {
  "rack-tom": `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="14" rx="18" ry="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 14v14c0 3.3 8 6 18 6s18-2.7 18-6V14" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  "floor-tom": `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="10" rx="17" ry="5.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 10v20c0 3 7.6 5.5 17 5.5s17-2.5 17-5.5V10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 35l-3 8M36 35l3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  snare: `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="16" rx="18" ry="6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M6 16v8c0 3.3 8 6 18 6s18-2.7 18-6v-8" fill="none" stroke="currentColor" stroke-width="2"/><line x1="8" y1="30" x2="12" y2="38" stroke="currentColor" stroke-width="2"/><line x1="40" y1="30" x2="36" y2="38" stroke="currentColor" stroke-width="2"/></svg>`,
  "bass-drum": `<svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="19" ry="19" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="24" cy="24" r="6" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
};

export function renderDrumSetup(params) {
  const initialId = ["rack-tom", "floor-tom", "snare", "bass-drum"].includes(params.drum) ? params.drum : "rack-tom";

  const view = el(`
    <div class="section-title">Drum Type</div>
    <div class="drum-shape-grid" id="type-grid">
      ${drumTypes
        .map(
          (d) => `
        <button class="drum-shape ${d.id === initialId ? "active" : ""}" data-id="${d.id}">
          ${shapeIcons[d.id]}
          <span>${d.label}</span>
        </button>`
        )
        .join("")}
    </div>

    <div class="section-title">Diameter</div>
    <div class="chip-row" id="size-row"></div>

    <div class="section-title">Number of Lugs</div>
    <div class="stepper">
      <button type="button" id="lug-minus">−</button>
      <div class="stepper-value" id="lug-value">6</div>
      <button type="button" id="lug-plus">+</button>
    </div>

    <div class="section-title">Target</div>
    <div class="chip-row" id="mode-row" style="margin-bottom:14px;">
      <div class="chip" data-mode="style">Sound Style</div>
      <div class="chip" data-mode="manual">Custom Hz</div>
    </div>
    <div id="target-body"></div>

    <div style="margin-top:28px;">
      <button class="btn btn-primary" id="continue-btn">Continue to Tuning</button>
    </div>
  `);

  let selectedType = drumTypes.find((d) => d.id === initialId) || drumTypes[0];
  let selectedSize = selectedType.sizes[0];
  let lugCount = selectedType.lugs;
  let selectedPreset = soundPresets.find((p) => p.id === "balanced");
  let selectedRefPitch = 440;
  let targetMode = params.mode === "custom" ? "manual" : "style";

  const sizeRow = qs(view, "#size-row");
  const lugValue = qs(view, "#lug-value");
  const targetBody = qs(view, "#target-body");
  const modeRow = qs(view, "#mode-row");

  function renderModeRow() {
    qsa(modeRow, ".chip").forEach((c) => c.classList.toggle("active", c.dataset.mode === targetMode));
  }

  function renderSizes() {
    sizeRow.innerHTML = selectedType.sizes
      .map((s) => `<div class="chip ${s === selectedSize ? "active" : ""}" data-size="${s}">${s}"</div>`)
      .join("");
    qsa(sizeRow, ".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        selectedSize = Number(chip.dataset.size);
        qsa(sizeRow, ".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        renderTargetBody();
      });
    });
  }

  function renderTargetBody() {
    if (targetMode === "manual") {
      const fallback = targetFrequencyFor(selectedType.id, selectedSize, "balanced");
      targetBody.innerHTML = `
        <div class="chip-row" id="ref-pitch-row">
          <div class="chip active" data-ref="440">A440</div>
          <div class="chip" data-ref="442">A442</div>
        </div>
        <div class="field" style="margin-top:14px;">
          <label class="field-label">Target Frequency (Hz)</label>
          <div class="btn-row">
            <input type="text" id="custom-target" inputmode="numeric" placeholder="e.g. ${fallback}" />
            <button class="btn btn-sm btn-secondary" id="preview-custom-hz" type="button" style="flex:0 0 auto;">▶ Preview</button>
          </div>
        </div>
      `;
      qsa(targetBody, "#ref-pitch-row .chip").forEach((chip) => {
        chip.addEventListener("click", () => {
          qsa(targetBody, "#ref-pitch-row .chip").forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          selectedRefPitch = Number(chip.dataset.ref);
        });
      });
      qs(targetBody, "#preview-custom-hz").addEventListener("click", () => {
        const hz = Number(qs(targetBody, "#custom-target").value) || fallback;
        playToneForDrumType(selectedType.id, hz);
      });
      return;
    }

    targetBody.innerHTML = `
      <div class="genre-list" id="style-list">
        ${soundPresets
          .map((p) => {
            const freq = targetFrequencyFor(selectedType.id, selectedSize, p.id);
            return `
          <div class="tap-card style-pick ${p.id === selectedPreset.id ? "selected" : ""}" data-id="${p.id}" role="button" tabindex="0">
            <div class="emoji-badge">🎚️</div>
            <div class="tap-card-body">
              <div class="tap-card-title">${p.name}</div>
              <div class="tap-card-sub">${p.tag} · ≈ ${freq} Hz</div>
            </div>
            <button class="btn btn-sm btn-secondary preview-style" data-id="${p.id}" type="button">▶</button>
          </div>`;
          })
          .join("")}
      </div>
    `;

    qsa(targetBody, ".style-pick").forEach((row) => {
      row.addEventListener("click", () => {
        selectedPreset = soundPresets.find((p) => p.id === row.dataset.id);
        qsa(targetBody, ".style-pick").forEach((r) => r.classList.remove("selected"));
        row.classList.add("selected");
      });
    });
    qsa(targetBody, ".preview-style").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const freq = targetFrequencyFor(selectedType.id, selectedSize, btn.dataset.id);
        playToneForDrumType(selectedType.id, freq);
        const original = btn.textContent;
        btn.textContent = "🔊";
        setTimeout(() => (btn.textContent = original), 600);
      });
    });
  }

  qsa(view, ".drum-shape").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedType = drumTypes.find((d) => d.id === btn.dataset.id);
      selectedSize = selectedType.sizes[0];
      lugCount = selectedType.lugs;
      lugValue.textContent = lugCount;
      qsa(view, ".drum-shape").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderSizes();
      renderTargetBody();
    });
  });

  qsa(modeRow, ".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      targetMode = chip.dataset.mode;
      renderModeRow();
      renderTargetBody();
    });
  });

  qs(view, "#lug-minus").addEventListener("click", () => {
    lugCount = Math.max(4, lugCount - 1);
    lugValue.textContent = lugCount;
  });
  qs(view, "#lug-plus").addEventListener("click", () => {
    lugCount = Math.min(12, lugCount + 1);
    lugValue.textContent = lugCount;
  });

  qs(view, "#continue-btn").addEventListener("click", () => {
    const isManual = targetMode === "manual";
    const target = isManual
      ? Number(qs(targetBody, "#custom-target")?.value) || targetFrequencyFor(selectedType.id, selectedSize, "balanced")
      : targetFrequencyFor(selectedType.id, selectedSize, selectedPreset.id);
    const outParams = {
      drumType: selectedType.id,
      size: selectedSize,
      lugCount,
      target,
      styleName: isManual ? undefined : selectedPreset.name,
      refPitch: isManual ? selectedRefPitch : undefined,
    };
    navigate(selectedType.id === "snare" ? "snare-tuning" : "tuning", outParams);
  });

  renderModeRow();
  renderSizes();
  renderTargetBody();
  lugValue.textContent = lugCount;

  return view;
}
