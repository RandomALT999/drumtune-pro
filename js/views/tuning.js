import { el, qs } from "../util.js";
import { navigate } from "../main.js";
import { generateLugs } from "../data.js";
import { kitBannerHtml, kitNavButtonHtml, wireKitNav, mountLiveTuning } from "./tuningShared.js";

export function renderTuning(params) {
  const lugs = generateLugs(params.lugCount || 6);
  const target = params.target || 122;
  const fftSize = params.drumType === "floor-tom" || params.drumType === "bass-drum" ? 4096 : 2048;

  const view = el(`
    ${kitBannerHtml(params)}
    <div id="tuning-body"></div>
    <div class="btn-row" style="margin-bottom:10px;">
      <button class="btn btn-primary" id="guided-btn">Guided Mode</button>
    </div>
    <div class="btn-row">
      <button class="btn btn-ghost" id="preview-btn">Sound Preview</button>
      <button class="btn btn-ghost" id="camera-btn">Camera Mode</button>
    </div>
    ${kitNavButtonHtml(params)}
  `);

  mountLiveTuning(qs(view, "#tuning-body"), { lugs, target, fftSize, styleName: params.styleName });

  qs(view, "#guided-btn").addEventListener("click", () => navigate("guided-tuning", params));
  qs(view, "#preview-btn").addEventListener("click", () => navigate("sound-preview", params));
  qs(view, "#camera-btn").addEventListener("click", () => navigate("camera", params));
  wireKitNav(view, params);

  return view;
}
