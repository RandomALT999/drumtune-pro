import { el, qs, headerHtml, wireHeader } from "../util.js";
import { mountTuningEngine, pieceLabelFor, hasNextPiece, goToNextPiece } from "./tuningShared.js";

// Snare gets the same tuning engine, plus the wire cards it always needs in
// view. The wire card is a LABELLED MOCK — real buzz/choke detection needs
// dissonance analysis across both heads at once, which isn't built.
export function renderSnareTuning(params) {
  const lugCount = params.lugCount || 8;
  const target = params.target || 200;

  const view = el(
    `
    ${headerHtml({ label: "snare · wires", state: "ready" })}
    <div class="tune-body" id="tune-body" style="overflow:visible;padding-bottom:0"></div>

    <div style="flex:none;padding:0 var(--pad-x)">
      <div class="card" style="margin-top:14px">
        <div class="card-title-row">
          <span class="eyebrow">Wire balance</span>
          <span class="tag-pill">Illustrative</span>
        </div>
        <div style="margin-top:6px">
          <div class="meter-row">
            <span class="meter-label">Buzz</span>
            <span class="meter-track"><span class="meter-fill bar-rise" style="width:22%;background:var(--green)"></span></span>
            <span class="meter-verdict" style="color:var(--green)">Low</span>
          </div>
          <div class="meter-row">
            <span class="meter-label">Choke</span>
            <span class="meter-track"><span class="meter-fill bar-rise" style="width:54%;background:var(--yellow);animation-delay:60ms"></span></span>
            <span class="meter-verdict" style="color:var(--yellow)">Moderate</span>
          </div>
          <div class="meter-row">
            <span class="meter-label">Looseness</span>
            <span class="meter-track"><span class="meter-fill bar-rise" style="width:78%;background:var(--red);animation-delay:120ms"></span></span>
            <span class="meter-verdict" style="color:var(--red)">High</span>
          </div>
        </div>
        <div class="blurb" style="margin-top:8px;font-size:12.5px">Shown to explain what to listen for. These aren't measured — real wire analysis needs both heads at once.</div>
      </div>

      <div class="card" style="margin-top:12px">
        <div class="eyebrow">Batter vs resonant</div>
        <div style="font:700 30px 'Space Grotesk',sans-serif;letter-spacing:-.03em;margin-top:8px">1 : 1.66</div>
        <div style="display:flex;flex-direction:column;gap:7px;margin-top:12px">
          <span class="meter-track"><span class="meter-fill bar-rise" style="width:60%;background:var(--blue)"></span></span>
          <span class="meter-track"><span class="meter-fill bar-rise" style="width:100%;background:var(--blue);animation-delay:60ms"></span></span>
        </div>
        <div class="meta" style="margin-top:9px">typical range 1 : 1.4 – 1.8</div>
      </div>
    </div>

    <div class="footer-actions" style="padding:16px var(--pad-x)">
      <button class="pill green" id="finish-snare">${hasNextPiece(params) ? "Next drum" : "Finish snare"}</button>
    </div>
  `,
    { scrolls: true }
  );

  wireHeader(view);

  const stateEl = qs(view, "#hdr-state");
  const engine = mountTuningEngine(qs(view, "#tune-body"), {
    lugCount,
    target,
    fftSize: 2048,
    drumType: "snare",
    params,
    onStateChange: (s) => {
      if (stateEl) stateEl.textContent = s.everListened ? `round ${s.roundIndex + 1} · ±${s.tolerance} Hz` : "ready";
    },
  });

  qs(view, "#finish-snare").addEventListener("click", () => {
    engine.stop();
    goToNextPiece(params);
  });

  return view;
}
