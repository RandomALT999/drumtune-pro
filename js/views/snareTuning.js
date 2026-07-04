import { el, qs } from "../util.js";
import { navigate } from "../main.js";
import { generateLugs } from "../data.js";
import { kitBannerHtml, kitNavButtonHtml, wireKitNav, mountLiveTuning } from "./tuningShared.js";

export function renderSnareTuning(params) {
  const lugs = generateLugs(params.lugCount || 8);
  const target = params.target || 200;

  const view = el(`
    ${kitBannerHtml(params)}
    <div id="tuning-body"></div>
    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn btn-primary" id="guided-btn">Guided Mode</button>
    </div>

    <div class="section-title">Wire Balance <span class="badge-soon">Mock diagnostic</span></div>
    <div class="card">
      <div class="meter-row">
        <div class="meter-row-label"><span>Buzz</span><span>Low</span></div>
        <div class="meter"><div class="meter-fill" style="width:22%; background:var(--green);"></div></div>
      </div>
      <div class="meter-row">
        <div class="meter-row-label"><span>Choke</span><span>Moderate</span></div>
        <div class="meter"><div class="meter-fill" style="width:54%; background:var(--yellow);"></div></div>
      </div>
      <div class="meter-row" style="margin-bottom:0;">
        <div class="meter-row-label"><span>Looseness</span><span>High</span></div>
        <div class="meter"><div class="meter-fill" style="width:78%; background:var(--red);"></div></div>
      </div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:10px;">
        Real buzz/choke detection needs dissonance analysis across both heads at once —
        a harder DSP problem than single-lug pitch tracking, so this stays illustrative for now.
      </div>
    </div>

    <div class="section-title">Batter vs. Resonant</div>
    <div class="card">
      <div class="preset-freqs" style="margin-bottom:10px;">
        <span>Batter <b>${target.toFixed(0)} Hz</b></span>
        <span>Resonant <b>${(target * 1.66).toFixed(0)} Hz</b></span>
      </div>
      <div class="meter-row-label"><span>Ratio</span><span>1 : 1.66</span></div>
      <div class="meter"><div class="meter-fill" style="width:66%; background:var(--accent-2);"></div></div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:8px;">
        Typical snare ratio range is 1:1.4 – 1:1.8 for a balanced crack.
      </div>
    </div>

    <div class="btn-row" style="margin-top:4px;">
      <button class="btn btn-ghost" id="preview-btn">Sound Preview</button>
      <button class="btn btn-ghost" id="camera-btn">Camera Mode</button>
    </div>
    ${kitNavButtonHtml(params)}
  `);

  mountLiveTuning(qs(view, "#tuning-body"), { lugs, target, fftSize: 2048, styleName: params.styleName });

  qs(view, "#guided-btn").addEventListener("click", () => navigate("guided-tuning", params));
  qs(view, "#preview-btn").addEventListener("click", () => navigate("sound-preview", params));
  qs(view, "#camera-btn").addEventListener("click", () => navigate("camera", params));
  wireKitNav(view, params);

  return view;
}
