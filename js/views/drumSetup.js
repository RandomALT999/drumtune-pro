import { el, qs, qsa, headerHtml, wireHeader, escapeHtml, CHEVRON, PLAY_ICON } from "../util.js";
import { navigate } from "../main.js";
import { drumTypes, soundPresets, targetFrequencyFor } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";

const LUG_CHOICES = [4, 6, 8, 10, 12];

function typeLabel(id) {
  return drumTypes.find((d) => d.id === id)?.label || "Custom";
}

export function renderDrumSetup(params) {
  const isCustom = params.drum === "custom" || params.mode === "custom";
  const meta = drumTypes.find((d) => d.id === params.drum) || drumTypes[0];

  let drumType = isCustom ? "rack-tom" : meta.id;
  let size = params.size || meta.sizes[0];
  let lugCount = params.lugCount || meta.lugs;
  let styleId = params.styleId || "balanced";
  let manual = isCustom;
  let manualHz = params.target || targetFrequencyFor(drumType, size, styleId);
  let refPitch = 440;
  // Which group was touched last — its label turns accent.
  let touched = "";

  const sizes = drumTypes.find((d) => d.id === drumType)?.sizes || meta.sizes;

  const view = el(`
    ${headerHtml({ label: "step 1 of 2" })}
    <div class="setup-body">
      <div class="screen-title-lg" style="flex:none;margin-bottom:6px">What are we<br>tuning?</div>
      <div class="blurb" style="flex:none;margin-bottom:20px">Size and lug count set the target pitch. Count the tension rods around one head.</div>

      <div style="flex:none;display:flex;flex-direction:column">
        <button class="field-row field" id="drum-row">
          <span class="field-label" data-group="drum">Drum</span>
          <span class="field-value" id="drum-value">${escapeHtml(isCustom ? "Custom" : typeLabel(drumType))}</span>
          ${CHEVRON}
        </button>

        <div class="field">
          <div class="field-head">
            <span class="field-label" data-group="diameter">Diameter</span>
            <span class="field-value" id="dia-value" data-group="diameter"></span>
          </div>
          <div class="seg" id="dia-seg"></div>
        </div>

        <div class="field">
          <div class="field-head">
            <span class="field-label" data-group="lugs">Lugs</span>
            <span class="field-value" id="lug-value" data-group="lugs"></span>
          </div>
          <div class="seg lugs" id="lug-seg"></div>
        </div>

        <div id="sound-slot"></div>
      </div>

      <div style="flex:1;min-height:8px"></div>

      <div class="target-foot">
        <div>
          <div class="field-label">Target</div>
          <div class="target-val"><span class="target-num" id="target-num">—</span><span class="target-unit">Hz</span></div>
        </div>
        <button class="icon-circle" id="preview-btn" aria-label="Preview target tone">${PLAY_ICON}</button>
      </div>
      <div class="footer-actions">
        <button class="pill white" id="start-btn">Start listening</button>
      </div>
    </div>
  `);

  wireHeader(view);

  function currentTarget() {
    return manual ? Number(manualHz) || targetFrequencyFor(drumType, size, "balanced") : targetFrequencyFor(drumType, size, styleId);
  }

  function paintTouched() {
    qsa(view, "[data-group]").forEach((n) => n.classList.toggle("touched", n.dataset.group === touched));
  }

  function renderSeg() {
    qs(view, "#dia-seg").innerHTML = sizes
      .map((s) => `<button data-size="${s}" class="${s === size ? "on" : ""}">${s}</button>`)
      .join("");
    qs(view, "#lug-seg").innerHTML = LUG_CHOICES.map(
      (n) => `<button data-lug="${n}" class="${n === lugCount ? "on" : ""}">${n}</button>`
    ).join("");
    qs(view, "#dia-value").textContent = `${size} inches`;
    qs(view, "#lug-value").textContent = lugCount;

    qsa(view, "#dia-seg button").forEach((b) =>
      b.addEventListener("click", () => {
        size = Number(b.dataset.size);
        touched = "diameter";
        renderSeg();
        renderSound();
        paintTarget();
      })
    );
    qsa(view, "#lug-seg button").forEach((b) =>
      b.addEventListener("click", () => {
        lugCount = Number(b.dataset.lug);
        touched = "lugs";
        renderSeg();
        paintTarget();
      })
    );
    paintTouched();
  }

  // Custom Hz replaces the Sound row in place, per the handoff.
  function renderSound() {
    const slot = qs(view, "#sound-slot");
    if (manual) {
      slot.innerHTML = `
        <div class="field last">
          <div class="field-head">
            <span class="field-label" data-group="sound">Your target</span>
            <span class="field-value">Custom Hz</span>
          </div>
          <div class="chips" style="margin-top:12px">
            <button class="chip ${refPitch === 440 ? "on" : ""}" data-ref="440">A440</button>
            <button class="chip ${refPitch === 442 ? "on" : ""}" data-ref="442">A442</button>
          </div>
          <div style="margin-top:10px">
            <input class="hz-input" id="hz-input" inputmode="decimal" value="${escapeHtml(String(manualHz))}" aria-label="Target frequency in Hz" />
          </div>
        </div>`;
      qsa(slot, "[data-ref]").forEach((b) =>
        b.addEventListener("click", () => {
          refPitch = Number(b.dataset.ref);
          touched = "sound";
          renderSound();
          paintTarget();
        })
      );
      qs(slot, "#hz-input").addEventListener("input", (e) => {
        manualHz = e.target.value;
        paintTarget();
      });
    } else {
      const style = soundPresets.find((s) => s.id === styleId) || soundPresets[0];
      slot.innerHTML = `
        <button class="field-row field last" id="sound-row">
          <span class="field-label" data-group="sound">Sound</span>
          <span class="field-value">${escapeHtml(style.name)}</span>
          ${CHEVRON}
        </button>`;
      qs(slot, "#sound-row").addEventListener("click", () =>
        navigate("sound-preview", { drumType, size, lugCount, styleId, returnTo: "drum-setup", drum: params.drum })
      );
    }
    paintTouched();
  }

  function paintTarget() {
    qs(view, "#target-num").textContent = currentTarget().toFixed(1);
  }

  // The Drum row's picker is Home's own list — go back rather than inventing
  // a second picker screen.
  qs(view, "#drum-row").addEventListener("click", () => navigate("home"));

  qs(view, "#preview-btn").addEventListener("click", () => playToneForDrumType(drumType, currentTarget()));

  qs(view, "#start-btn").addEventListener("click", () => {
    const target = currentTarget();
    const style = soundPresets.find((s) => s.id === styleId);
    navigate(drumType === "snare" ? "snare-tuning" : "tuning", {
      drumType,
      size,
      lugCount,
      target,
      styleName: manual ? undefined : style?.name,
      refPitch: manual ? refPitch : undefined,
    });
  });

  renderSeg();
  renderSound();
  paintTarget();

  return view;
}
