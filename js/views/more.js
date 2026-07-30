import { el, qs, CHEVRON } from "../util.js";
import { navigate } from "../main.js";

const STEPS = [
  "Pick the drum, its size, and how many lugs it has.",
  "Choose a sound style, or type your own target in Hz.",
  "Strike the centre of the head once, firmly, and let it ring.",
  "Turn every lug by the amount shown, following the numbers on the diagram.",
  "Strike again. Repeat until the window closes to ±2.5 Hz.",
];

// The More tab. Absorbs the old About screen, which is why the Maine App
// Challenge disclosure lives here — it's required to be in-app.
export function renderMore() {
  const view = el(
    `
    <div class="screen-title" style="flex:none">DrumTune Pro</div>
    <div class="blurb" style="flex:none;margin-top:9px;line-height:1.55">Listens to your drum, works out how far each head is from the pitch you want, and tells you how much to turn the key. Built for toms and snares.</div>

    <div class="eyebrow" style="flex:none;margin-top:24px">How to use it</div>
    <div style="flex:none;margin-top:4px;display:flex;flex-direction:column">
      ${STEPS.map((s, i) => `<div class="numbered-row"><span class="n">${i + 1}</span><span class="t">${s}</span></div>`).join("")}
    </div>

    <div style="flex:none;margin-top:22px;display:flex;flex-direction:column">
      <button class="row row-sm" id="to-analyze" style="align-items:center;border-top:1px solid var(--surface-2)">
        <span class="row-title">Frequency analysis</span>
        ${CHEVRON}
      </button>
      <div class="row row-sm" style="align-items:center">
        <span class="row-title">Reference pitch</span>
        <span class="meta">A440</span>
      </div>
      <div class="row row-sm" style="align-items:center">
        <span class="row-title">Walkthrough video</span>
        <span class="meta">Pending</span>
      </div>
    </div>

    <div class="card" style="flex:none;margin-top:22px">
      <div class="eyebrow">Maine App Challenge</div>
      <div class="blurb" style="margin-top:9px;font-size:12.5px;line-height:1.55">Parts of this app were built with the help of AI tools. The tuning method, the pitch targets, and the design decisions are the author's own.</div>
    </div>
    <div class="spacer"></div>
  `,
    { scrolls: true }
  );

  qs(view, "#to-analyze").addEventListener("click", () => navigate("advanced"));
  return view;
}
