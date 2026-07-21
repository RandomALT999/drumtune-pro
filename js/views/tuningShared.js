import { qs } from "../util.js";
import { navigate, registerCleanup } from "../main.js";
import { getKit, generateCrossOrder } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { centsOff, hzOff, turnEstimate, IN_TUNE_HZ } from "../audio/tuningMath.js";

// Maps each lug id -> its step number in the cross/star tightening order.
// The diagram labels lugs by STEP, not by physical id, so the numbers
// themselves tell you what order to turn them in.
export function starSteps(lugCount) {
  const steps = new Map();
  generateCrossOrder(lugCount).forEach((lugId, i) => steps.set(lugId, i + 1));
  return steps;
}

// All lugs are shown in the same state because the method turns them all by
// the same amount every round — there's no single "active" lug any more.
// The strike target sits at the CENTER of the head: a center hit excites the
// fundamental cleanly, where an edge hit near a lug excites an overtone
// louder than the fundamental and makes readings flip.
export function buildLugMapSvg(lugCount, { inTune = false } = {}) {
  const cx = 130,
    cy = 130,
    shellR = 108,
    dotR = 15;
  const steps = starSteps(lugCount);

  let dots = "";
  for (let i = 0; i < lugCount; i++) {
    const angle = (i / lugCount) * 2 * Math.PI - Math.PI / 2;
    const x = cx + shellR * Math.cos(angle);
    const y = cy + shellR * Math.sin(angle);
    dots += `
      <g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${dotR}" class="lug-dot ${inTune ? "in-tune" : "all-active"}" />
        <text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" class="lug-label" fill="#0c0c0e">${steps.get(i + 1)}</text>
      </g>`;
  }

  return `
    <svg class="lug-map" viewBox="0 0 260 260">
      <circle cx="${cx}" cy="${cy}" r="${shellR + dotR + 6}" class="drum-shell" />
      <circle cx="${cx}" cy="${cy}" r="${shellR - 10}" class="drum-head" />
      <circle cx="${cx}" cy="${cy}" r="30" class="strike-ring" />
      <circle cx="${cx}" cy="${cy}" r="5" class="strike-dot" />
      <text x="${cx}" y="${cy + 50}" class="strike-label">strike center</text>
      ${dots}
    </svg>`;
}

export function accuracyRingSvg(pct) {
  const r = 24;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return `
    <svg class="accuracy-ring" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r="${r}" class="accuracy-ring-track" />
      <circle cx="28" cy="28" r="${r}" class="accuracy-ring-fill"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" />
    </svg>`;
}

export function tuneBadge(hz) {
  if (hz == null) return { cls: "good", text: "Not measured yet" };
  if (hz > IN_TUNE_HZ) return { cls: "loose", text: `${hz.toFixed(1)} Hz low — tighten` };
  if (hz < -IN_TUNE_HZ) return { cls: "tight", text: `${Math.abs(hz).toFixed(1)} Hz high — loosen` };
  return { cls: "good", text: "In tune ✓" };
}

// Collapsible guidance — the method depends on doing these consistently.
export function tuningTipsHtml() {
  return `
    <details class="tips-card">
      <summary>📱 How to get consistent readings</summary>
      <ul>
        <li>Start with every lug finger tight and even — snug by hand, no key yet. That's the baseline the whole method builds on.</li>
        <li>Hold the phone 6–12 inches above the middle of the head.</li>
        <li>Strike the <b>center</b> of the head once, firmly, then let it ring. Center hits give the drum's true fundamental; hits near the rim ring at a second, higher pitch that can confuse any tuner.</li>
        <li>Turn <b>every</b> lug by the same amount each round, following the numbers on the diagram (the star pattern) — that's what keeps the head even.</li>
        <li>As you close in, make smaller moves — an eighth turn or less.</li>
        <li>Tune somewhere quiet, and mute the drum's other head (rest it on carpet or your leg) so only the head you're tuning rings.</li>
      </ul>
    </details>`;
}

export function currentFreqFor(target, hz) {
  const base = target || 122;
  if (hz == null) return base;
  return base - hz; // hz = target - freq
}

// Kit-flow helpers: when tuning is reached as part of a genre-kit sequence
// (params.kitId + params.kitIndex), show progress and a way to move to the
// next piece so the whole kit is tuned in one coherent pass.
export function kitBannerHtml(params) {
  if (!params.kitId) return "";
  const kit = getKit(params.kitId);
  if (!kit) return "";
  const piece = kit.pieces[params.kitIndex] || kit.pieces[0];
  return `
    <div class="card" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
      <div>
        <div style="font-weight:700; font-size:14px;">🎼 ${kit.name}</div>
        <div style="font-size:12px; color:var(--text-dim); margin-top:2px;">
          Piece ${params.kitIndex + 1} of ${kit.pieces.length} · ${piece.label}
        </div>
      </div>
    </div>`;
}

// Starts (or resumes) a kit-tuning sequence at its first piece. Used by both
// Preset Detail ("Start Tuning Kit") and Kit Builder (after assembling a
// fresh or edited kit), so the sequence always begins the same way.
export function beginKitTuning(kit) {
  const first = kit.pieces[0];
  const params = {
    kitId: kit.id,
    kitIndex: 0,
    drumType: first.drumType,
    lugCount: first.lugCount,
    target: first.target,
  };
  navigate(first.drumType === "snare" ? "snare-tuning" : "tuning", params);
}

export function kitNavButtonHtml(params) {
  if (!params.kitId) return "";
  const kit = getKit(params.kitId);
  if (!kit) return "";
  const isLast = params.kitIndex >= kit.pieces.length - 1;
  const label = isLast ? "Finish Kit ✓" : `Next: ${kit.pieces[params.kitIndex + 1].label} ▸`;
  return `<button class="btn btn-primary" id="kit-next-btn" style="margin-top:10px;">${label}</button>`;
}

export function wireKitNav(view, params) {
  const btn = qs(view, "#kit-next-btn");
  if (!btn || !params.kitId) return;
  const kit = getKit(params.kitId);
  if (!kit) return;
  btn.addEventListener("click", () => {
    const isLast = params.kitIndex >= kit.pieces.length - 1;
    if (isLast) {
      navigate("kit-complete", { kitId: params.kitId });
      return;
    }
    const nextIndex = params.kitIndex + 1;
    const nextPiece = kit.pieces[nextIndex];
    const nextParams = {
      kitId: params.kitId,
      kitIndex: nextIndex,
      drumType: nextPiece.drumType,
      lugCount: nextPiece.lugCount,
      target: nextPiece.target,
    };
    navigate(nextPiece.drumType === "snare" ? "snare-tuning" : "tuning", nextParams);
  });
}

// How far off "0% progress" sits, in Hz beyond the in-tune window.
const PROGRESS_RANGE_HZ = 60;

// Mic-driven tuning, round based:
//   prep    — hand-tighten every lug evenly, then start
//   tuning  — strike the CENTER; app reports how far off and how much to
//             turn EVERY lug (same amount, in the numbered star order);
//             repeat until the pitch lands inside the ±IN_TUNE_HZ window
//   done    — in tune
// Turning all lugs equally from an even starting point keeps the head even
// by construction, and every measurement comes from the same spot (center),
// which is far more repeatable than chasing one lug at a time.
// Shared by Tuning, Snare Tuning and Guided Tuning so all three behave the
// same. Returns { stop } for callers that want to stop it early.
export function mountLiveTuning(container, { lugCount, target, fftSize, styleName, voice = false }) {
  const listener = new PitchListener();
  let phase = "prep"; // prep | tuning | done
  let listening = false;
  let lastHit = null; // { freq, hz }
  let hitFailed = false;
  let micError = null;
  let round = 0;
  let voiceOn = voice;

  function speak(text) {
    if (!voiceOn || !text || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch (e) {
      /* speech synthesis unavailable in this browser */
    }
  }

  function currentTurn() {
    if (!lastHit) return null;
    return turnEstimate(centsOff(lastHit.freq, target));
  }

  function instructionText() {
    if (phase === "prep") {
      return "First, hand-tighten every lug until it's finger tight and even — snug by hand, no drum key yet. Then start tuning.";
    }
    if (phase === "done") {
      return "In tune. Every lug got the same treatment, so the head should be even — strike the center once more if you want to confirm.";
    }
    if (hitFailed) return "Didn't catch that one — strike the center of the head again, firmly.";
    if (!lastHit) return "Strike the center of the head once, firmly, and let it ring.";
    const turn = currentTurn();
    if (!turn || turn.turns === 0) return "Very close — strike the center again to confirm.";
    return `Turn every lug ${turn.label} to ${turn.direction}, following the numbers on the diagram. Then strike the center again.`;
  }

  function accuracyPct() {
    if (!lastHit) return 0;
    const a = Math.abs(lastHit.hz);
    if (a <= IN_TUNE_HZ) return 100;
    return Math.max(0, Math.round(100 * (1 - (a - IN_TUNE_HZ) / PROGRESS_RANGE_HZ)));
  }

  function buttonLabel() {
    if (phase === "prep") return "All lugs finger tight — Start";
    if (phase === "done") return "Tune Again";
    return listening ? "Stop Listening" : "Resume Listening";
  }

  function render() {
    const pct = accuracyPct();
    const badge = tuneBadge(lastHit ? lastHit.hz : null);
    const displayFreq = lastHit ? lastHit.freq : currentFreqFor(target, null);
    const turn = currentTurn();
    const showTurn = phase === "tuning" && turn && turn.turns > 0;

    container.innerHTML = `
      <div class="accuracy-ring-wrap card">
        ${accuracyRingSvg(pct)}
        <div>
          <div class="accuracy-text">${lastHit ? `${pct}% to target` : "Not measured yet"}</div>
          <div class="accuracy-sub">${
            lastHit
              ? `${Math.abs(lastHit.hz).toFixed(1)} Hz ${lastHit.hz > 0 ? "below" : "above"} target${round ? ` · round ${round}` : ""}`
              : "Strike the center to measure"
          }</div>
        </div>
      </div>

      <div class="lug-map-wrap">
        ${buildLugMapSvg(lugCount, { inTune: phase === "done" })}
        <div class="pitch-readout">
          <div class="current-freq">${displayFreq.toFixed(1)} Hz</div>
          <div class="target-freq">Target: ${target.toFixed(1)} Hz${styleName ? ` · ${styleName}` : ""}</div>
          <div class="cents-badge ${badge.cls}">${badge.text}</div>
        </div>
        <div class="lug-legend-note">Numbers = the order to turn the lugs. Turn them all by the same amount.</div>
      </div>

      <div class="tune-step card">
        <div class="tune-step-title">${phase === "prep" ? "Before you start" : phase === "done" ? "Finished" : `Round ${round + 1}`}</div>
        <div class="tune-step-text">${instructionText()}</div>
        ${showTurn ? `<div class="turn-callout">${turn.label} on <b>every</b> lug · ${turn.direction}</div>` : ""}
      </div>

      ${micError ? `<div class="mic-error">${micError}</div>` : ""}

      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn ${listening ? "btn-primary listening-pulse" : "btn-primary"}" id="tap-lug-btn">${buttonLabel()}</button>
      </div>
    `;
    qs(container, "#tap-lug-btn").addEventListener("click", onMainButton);
  }

  function handleHit(result) {
    if (phase !== "tuning") return;
    if (!result) {
      hitFailed = true;
      render();
      return;
    }
    hitFailed = false;
    const hz = hzOff(result.frequency, target);
    lastHit = { freq: result.frequency, hz };
    round++;
    if (Math.abs(hz) <= IN_TUNE_HZ) {
      phase = "done";
      stopListening();
    }
    render();
    speak(instructionText());
  }

  async function startListening() {
    micError = null;
    try {
      await listener.start({ targetFreq: target, fftSize, onHit: handleHit });
      listening = true;
      registerCleanup(stopListening);
    } catch (err) {
      micError = micErrorMessage(err);
    }
  }

  async function onMainButton() {
    if (phase === "done") {
      // Tune Again: keep the target, reset the round state.
      phase = "tuning";
      lastHit = null;
      hitFailed = false;
      round = 0;
      await startListening();
      render();
      speak(instructionText());
      return;
    }
    if (phase === "prep") {
      phase = "tuning";
      await startListening();
      render();
      speak(instructionText());
      return;
    }
    if (listening) {
      stopListening();
      render();
      return;
    }
    await startListening();
    render();
  }

  function stopListening() {
    if (listening) listener.stop();
    listening = false;
    hitFailed = false;
  }

  render();
  return {
    stop: stopListening,
    setVoice(on) {
      voiceOn = on;
    },
    speakCurrent() {
      speak(instructionText());
    },
  };
}
