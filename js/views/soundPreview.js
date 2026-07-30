import { el, qsa, headerHtml, wireHeader, escapeHtml, PLAY_ICON } from "../util.js";
import { navigate } from "../main.js";
import { soundPresets, targetFrequencyFor } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";

// The "Sound" row's picker. Reached from Drum Setup and from Kit Builder
// (where one style applies to the whole kit); picking a row returns to the
// caller with the choice merged into its params.
export function renderSoundPreview(params = {}) {
  const drumType = params.drumType || "rack-tom";
  const size = params.size || 12;
  const returnTo = params.returnTo || "drum-setup";

  const view = el(
    `
    ${headerHtml({ label: params.forKit ? "sound · whole kit" : "sound style" })}
    <div style="flex:none">
      <div class="screen-title-lg">Pick a sound.</div>
      <div class="blurb" style="margin-top:9px">Each style shifts the target pitch. Tap ▶ to hear it before you commit.</div>
    </div>
    <div class="rows" style="margin-top:18px">
      ${soundPresets
        .map((s) => {
          const hz = targetFrequencyFor(drumType, size, s.id);
          const on = s.id === params.styleId;
          return `
          <div class="row" data-id="${s.id}" role="button" tabindex="0">
            <span class="row-title" style="${on ? "color:var(--accent)" : ""}">${escapeHtml(s.name)}</span>
            <span class="meta">${escapeHtml(s.tag)}</span>
            <span class="meta" style="color:var(--head)">${hz} Hz</span>
            <button class="icon-circle sm preview" data-preview="${s.id}" aria-label="Preview ${escapeHtml(s.name)}">${PLAY_ICON}</button>
          </div>`;
        })
        .join("")}
    </div>
    <div class="spacer"></div>
  `,
    { scrolls: true }
  );

  wireHeader(view);

  qsa(view, ".row").forEach((row) =>
    row.addEventListener("click", (e) => {
      if (e.target.closest(".preview")) return;
      navigate(returnTo, { ...params, styleId: row.dataset.id }, { replace: true });
    })
  );

  qsa(view, ".preview").forEach((b) =>
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      playToneForDrumType(drumType, targetFrequencyFor(drumType, size, b.dataset.preview));
    })
  );

  return view;
}
