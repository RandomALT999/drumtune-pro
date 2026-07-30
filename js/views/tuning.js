import { el, qs, headerHtml, wireHeader } from "../util.js";
import { mountTuningEngine, pieceLabelFor } from "./tuningShared.js";

export function renderTuning(params) {
  const lugCount = params.lugCount || 6;
  const target = params.target || 122;
  const drumType = params.drumType || "rack-tom";
  const fftSize = drumType === "floor-tom" || drumType === "bass-drum" ? 4096 : 2048;

  const view = el(`
    ${headerHtml({ label: pieceLabelFor(params), state: "ready" })}
    <div class="tune-body" id="tune-body"></div>
  `);

  wireHeader(view);

  const stateEl = qs(view, "#hdr-state");
  mountTuningEngine(qs(view, "#tune-body"), {
    lugCount,
    target,
    fftSize,
    drumType,
    params,
    // The header carries the live round/tolerance readout.
    onStateChange: (s) => {
      if (stateEl) stateEl.textContent = s.everListened ? `round ${s.roundIndex + 1} · ±${s.tolerance} Hz` : "ready";
    },
  });

  return view;
}
