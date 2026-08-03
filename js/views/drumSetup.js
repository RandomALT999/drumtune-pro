import { el, qs, qsa, headerHtml, wireHeader, escapeHtml, CHEVRON, PLAY_ICON } from "../util.js";
import { navigate } from "../main.js";
import { drumTypes, soundPresets, targetFrequencyFor } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";

const LUG_CHOICES = [4, 6, 8, 10, 12];

function typeMeta(id) {
  return drumTypes.find((d) => d.id === id) || drumTypes[0];
}

export function renderDrumSetup(params) {
  // "Custom" from Home means custom Hz — but you still pick a real drum and
  // size, since those drive the diagram, the FFT window and the fallback target.
  const startedCustom = params.drum === "custom" || params.mode === "custom";
  const meta = typeMeta(startedCustom ? params.drumType || "rack-tom" : params.drum);

  let drumType = meta.id;
  let size = params.size || meta.sizes[0];
  let lugCount = params.lugCount || meta.lugs;
  let styleId = params.styleId || "balanced";
  let manual = params.manual !== undefined ? params.manual : startedCustom;
  let manualHz = params.target || targetFrequencyFor(drumType, size, styleId);
  let refPitch = params.refPitch || 440;
  let openField = null; // "drum" | null — which row is expanded
  let touched = "";

  const view = el(
    `
    ${headerHtml({ label: "step 1 of 2" })}
    <div class="setup-body">
      <div class="screen-title-lg" style="flex:none;margin-bottom:6px">What are we<br>tuning?</div>
      <div class="blurb" style="flex:none;margin-bottom:20px">Size and lug count set the target pitch. Count the tension rods around one head.</div>

      <div style="flex:none;display:flex;flex-direction:column" id="fields"></div>

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
  `,
    { scrolls: false }
  );

  wireHeader(view);

  function currentTarget() {
    return manual ? Number(manualHz) || targetFrequencyFor(drumType, size, "balanced") : targetFrequencyFor(drumType, size, styleId);
  }

  function fieldsHtml() {
    const m = typeMeta(drumType);
    const style = soundPresets.find((s) => s.id === styleId) || soundPresets[0];
    return `
      <div class="field">
        <button class="field-row" id="drum-row">
          <span class="field-label ${touched === "drum" ? "touched" : ""}">Drum</span>
          <span class="field-value ${touched === "drum" ? "touched" : ""}">${escapeHtml(m.label)}</span>
          <svg class="chev piece-chev${openField === "drum" ? " open" : ""}" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
        </button>
        ${
          openField === "drum"
            ? `<div class="piece-editor" style="padding-top:12px">
                 <div class="chips">
                   ${drumTypes
                     .map((d) => `<button class="chip ${d.id === drumType ? "on" : ""}" data-type="${d.id}">${escapeHtml(d.label)}</button>`)
                     .join("")}
                 </div>
               </div>`
            : ""
        }
      </div>

      <div class="field">
        <div class="field-head">
          <span class="field-label ${touched === "diameter" ? "touched" : ""}">Diameter</span>
          <span class="field-value ${touched === "diameter" ? "touched" : ""}">${size} inches</span>
        </div>
        <div class="seg" id="dia-seg">
          ${m.sizes.map((s) => `<button data-size="${s}" class="${s === size ? "on" : ""}">${s}</button>`).join("")}
        </div>
      </div>

      <div class="field">
        <div class="field-head">
          <span class="field-label ${touched === "lugs" ? "touched" : ""}">Lugs</span>
          <span class="field-value ${touched === "lugs" ? "touched" : ""}">${lugCount}</span>
        </div>
        <div class="seg lugs" id="lug-seg">
          ${LUG_CHOICES.map((n) => `<button data-lug="${n}" class="${n === lugCount ? "on" : ""}">${n}</button>`).join("")}
        </div>
      </div>

      <div class="field last">
        <div class="field-head">
          <span class="field-label ${touched === "sound" ? "touched" : ""}">Sound</span>
          <div class="seg-toggle">
            <button data-mode="style" class="${manual ? "" : "on"}">Style</button>
            <button data-mode="manual" class="${manual ? "on" : ""}">Custom Hz</button>
          </div>
        </div>
        ${
          manual
            ? `<div style="margin-top:12px">
                 <div class="chips">
                   <button class="chip ${refPitch === 440 ? "on" : ""}" data-ref="440">A440</button>
                   <button class="chip ${refPitch === 442 ? "on" : ""}" data-ref="442">A442</button>
                 </div>
                 <input class="hz-input" id="hz-input" inputmode="decimal" value="${escapeHtml(String(manualHz))}"
                   aria-label="Target frequency in Hz" style="margin-top:10px" />
               </div>`
            : `<button class="field-row" id="sound-row" style="margin-top:12px">
                 <span class="field-value" style="flex:1;text-align:left">${escapeHtml(style.name)}</span>
                 <span class="meta">${escapeHtml(style.tag)}</span>
                 ${CHEVRON}
               </button>`
        }
      </div>`;
  }

  function paint() {
    qs(view, "#fields").innerHTML = fieldsHtml();
    qs(view, "#target-num").textContent = currentTarget().toFixed(1);
    wireFields();
  }

  function wireFields() {
    qs(view, "#drum-row").addEventListener("click", () => {
      openField = openField === "drum" ? null : "drum";
      paint();
    });

    qsa(view, "[data-type]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const next = typeMeta(b.dataset.type);
        drumType = next.id;
        // Keep the current size if the new drum has it, else fall back.
        if (!next.sizes.includes(size)) size = next.sizes[0];
        lugCount = next.lugs;
        touched = "drum";
        openField = null;
        paint();
      })
    );

    qsa(view, "#dia-seg button").forEach((b) =>
      b.addEventListener("click", () => {
        size = Number(b.dataset.size);
        touched = "diameter";
        paint();
      })
    );

    qsa(view, "#lug-seg button").forEach((b) =>
      b.addEventListener("click", () => {
        lugCount = Number(b.dataset.lug);
        touched = "lugs";
        paint();
      })
    );

    qsa(view, "[data-mode]").forEach((b) =>
      b.addEventListener("click", () => {
        manual = b.dataset.mode === "manual";
        if (manual) manualHz = Number(manualHz) || targetFrequencyFor(drumType, size, styleId);
        touched = "sound";
        paint();
      })
    );

    qsa(view, "[data-ref]").forEach((b) =>
      b.addEventListener("click", () => {
        refPitch = Number(b.dataset.ref);
        touched = "sound";
        paint();
      })
    );

    const hz = qs(view, "#hz-input");
    if (hz)
      hz.addEventListener("input", (e) => {
        manualHz = e.target.value;
        qs(view, "#target-num").textContent = currentTarget().toFixed(1);
      });

    const soundRow = qs(view, "#sound-row");
    if (soundRow)
      soundRow.addEventListener("click", () =>
        navigate("sound-preview", {
          ...params,
          drumType,
          size,
          lugCount,
          styleId,
          manual,
          returnTo: "drum-setup",
        })
      );
  }

  qs(view, "#preview-btn").addEventListener("click", () => playToneForDrumType(drumType, currentTarget()));

  qs(view, "#start-btn").addEventListener("click", () => {
    const style = soundPresets.find((s) => s.id === styleId);
    navigate(drumType === "snare" ? "snare-tuning" : "tuning", {
      drumType,
      size,
      lugCount,
      target: currentTarget(),
      styleName: manual ? undefined : style?.name,
      refPitch: manual ? refPitch : undefined,
    });
  });

  paint();
  return view;
}
