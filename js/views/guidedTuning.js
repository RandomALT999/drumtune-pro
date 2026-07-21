import { el, qs } from "../util.js";
import { mountLiveTuning, tuningTipsHtml } from "./tuningShared.js";

// Guided Tuning is the same round-based center-hit flow as the regular
// tuning screens, with the instructions read aloud each round so you can
// keep your hands on the drum key and your eyes off the phone. The shared
// component owns the actual flow so all three screens stay identical.
export function renderGuidedTuning(params) {
  const lugCount = params.lugCount || 8;
  const target = params.target || 122;
  const fftSize = params.drumType === "floor-tom" || params.drumType === "bass-drum" ? 4096 : 2048;

  const view = el(`
    <div class="card">
      <div style="font-weight:700; font-size:14px;">🔊 Guided Mode</div>
      <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">
        Same steps as the tuning screen, read aloud each round.
      </div>
    </div>

    <div id="tuning-body"></div>
    ${tuningTipsHtml()}

    <div class="card" style="display:flex; align-items:center; justify-content:space-between; margin-top:10px;">
      <div>
        <div class="field-label" style="margin-bottom:2px;">Voice prompts</div>
        <div style="font-size:13px; color:var(--text-dim);">Read each round's instruction aloud</div>
      </div>
      <div class="chip active" id="voice-toggle">On</div>
    </div>
  `);

  const session = mountLiveTuning(qs(view, "#tuning-body"), {
    lugCount,
    target,
    fftSize,
    styleName: params.styleName,
    voice: true,
  });

  let voiceOn = true;
  qs(view, "#voice-toggle").addEventListener("click", (e) => {
    voiceOn = !voiceOn;
    session.setVoice(voiceOn);
    e.currentTarget.classList.toggle("active", voiceOn);
    e.currentTarget.textContent = voiceOn ? "On" : "Off";
    if (voiceOn) session.speakCurrent();
  });

  return view;
}
