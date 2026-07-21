import { el, qs } from "../util.js";
import { navigate } from "../main.js";
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
    <div class="btn-row" style="margin:10px 0;">
      <button class="btn btn-primary" id="guided-btn">Guided Mode</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="hear-target-btn">▶ Hear Target</button>
      <button class="btn btn-ghost" id="camera-btn">Camera Mode</button>
    </div>
    ${kitNavButtonHtml(params)}
  `);

  mountLiveTuning(qs(view, "#tuning-body"), { lugCount, target, fftSize, styleName: params.styleName });

  qs(view, "#guided-btn").addEventListener("click", () => navigate("guided-tuning", params));
  // Plays the target tone in place instead of navigating to Sound Preview —
  // leaving the screen would throw away the lug-by-lug tuning progress.
  qs(view, "#hear-target-btn").addEventListener("click", () => playToneForDrumType(drumType, target));
  qs(view, "#camera-btn").addEventListener("click", () => navigate("camera", params));
  wireKitNav(view, params);

  return view;
}
