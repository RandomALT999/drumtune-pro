import { el, qs } from "../util.js";
import { playToneForDrumType } from "../audio/synth.js";
import { kitBannerHtml, kitNavButtonHtml, wireKitNav, mountLiveTuning, tuningTipsHtml } from "./tuningShared.js";

export function renderTuning(params) {
  const lugCount = params.lugCount || 6;
  const target = params.target || 122;
  const drumType = params.drumType || "rack-tom";
  const fftSize = drumType === "floor-tom" || drumType === "bass-drum" ? 4096 : 2048;

  const view = el(`
    ${kitBannerHtml(params)}
    <div id="tuning-body"></div>
    ${tuningTipsHtml()}
    <div class="btn-row" style="margin-top:10px;">
      <button class="btn btn-ghost" id="hear-target-btn">▶ Hear Target</button>
    </div>
    ${kitNavButtonHtml(params)}
  `);

  mountLiveTuning(qs(view, "#tuning-body"), { lugCount, target, fftSize, styleName: params.styleName });

  // Plays the target tone in place instead of navigating to Sound Preview —
  // leaving the screen would throw away the tuning progress.
  qs(view, "#hear-target-btn").addEventListener("click", () => playToneForDrumType(drumType, target));
  wireKitNav(view, params);

  return view;
}
