import { qs } from "../util.js";
import { navigate, registerCleanup } from "../main.js";
import { getKit, generateCrossOrder } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { centsOff, hzOff, turnEstimate, IN_TUNE_HZ, toleranceForStep } from "../audio/tuningMath.js";

// Maps each lug id -> its step number in the cross/star tightening order.
// The diagram labels lugs by STEP, not by physical id, so the numbers
// themselves tell you what order to turn them in.
function starSteps(lugCount) {
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

export function tuneBadge(hz, tolerance = IN_TUNE_HZ) {
  if (hz == null) return { cls: "good", text: "Not measured yet" };
  if (hz > tolerance) return { cls: "loose", text: `${hz.toFixed(1)} Hz low — tighten` };
  if (hz < -tolerance) return { cls: "tight", text: `${Math.abs(hz).toFixed(1)} Hz high — loosen` };
  return { cls: "good", text: "In tune ✓" };
}

// A drum key that rotates through exactly the amount the user needs to turn
// each lug — a turn fraction is much easier to copy from a moving picture
// than from the text "3/16 turn". Loosen mirrors the sweep counter-clockwise.
function drumKeyAnimHtml(turn) {
  if (!turn || turn.turns === 0) return "";
  const loosen = turn.direction === "loosen";
  const deg = Math.round(turn.turns * 360) * (loosen ? -1 : 1);
  const r = 46;
  const circ = 2 * Math.PI * r;
  const sweep = turn.turns * circ;
  return `
    <div class="key-anim ${loosen ? "loosen" : "tighten"}" style="--turn-deg:${deg}deg;">
      <svg viewBox="0 0 120 120" class="key-anim-svg" aria-hidden="true">
        <circle cx="60" cy="60" r="${r}" class="key-track" />
        <circle cx="60" cy="60" r="${r}" class="key-sweep"
          stroke-dasharray="${sweep.toFixed(1)} ${(circ - sweep).toFixed(1)}" />
        <g class="key-rot">
          <rect x="42" y="20" width="36" height="9" rx="3" class="key-part" />
          <rect x="56.5" y="27" width="7" height="27" class="key-part" />
          <rect x="50" y="50" width="20" height="20" rx="3" class="key-part" />
          <circle cx="60" cy="60" r="4.5" class="key-socket" />
        </g>
      </svg>
      <div class="key-anim-label">${turn.label}<span>${turn.direction} · every lug</span></div>
    </div>`;
}

// Collapsible guidance — the method depends on doing these consistently.
export function tuningTipsHtml() {
  return `
    <details class="tips-card">
      <summary>📱 How to get consistent readings</summary>
      <ul>
        <li>Start from an even baseline: every lug finger tight by hand, then one full turn with the key on each, in the numbered star order.</li>
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
//   prep    — even baseline: finger tight by hand, then one full key turn
//             on every lug in the star order. Shown once and never again.
//   tuning  — strike the CENTER; app reports how far off and how much to
//             turn EVERY lug (same amount, in the numbered star order),
//             with a drum key animating that exact fraction; repeat until
//             the pitch lands inside the current tolerance window
//   done    — inside tolerance; "Tune Further" halves the window (10 → 5 →
//             2.5 Hz, then holds) and drops straight back into tuning
// Turning all lugs equally from an even starting point keeps the head even
// by construction, and every measurement comes from the same spot (center),
// which is far more repeatable than chasing one lug at a time.
// Shared by Tuning and Snare Tuning so both behave the same.
// Returns { stop } for callers that want to stop it early.
export function mountLiveTuning(container, { lugCount, target, fftSize, styleName, voice = false }) {
  const listener = new PitchListener();
  let phase = "prep"; // prep | tuning | done
  let listening = false;
  let lastHit = null; // { freq, hz }
  let hitFailed = false;
  let micError = null;
  let round = 0;
  let refineStep = 0; // 0 = ±10 Hz, 1 = ±5, 2+ = ±2.5
  let voiceOn = voice;

  const tolerance = () => toleranceForStep(refineStep);

  function speak(text) {
    if (!voiceOn || !text || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      // Instruction text carries light markup for the card; strip it so the
      // synthesizer doesn't read tag names aloud.
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text.replace(/<[^>]*>/g, "")));
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
      return "Get an even starting point: hand-tighten every lug until it's finger tight, then give each one <b>one full turn</b> with the drum key, following the numbers on the diagram.";
    }
    if (phase === "done") {
      return `In tune within ±${tolerance()} Hz. Every lug got the same treatment, so the head should be even. Tune further to tighten the window${refineStep >= 2 ? "" : ` to ±${toleranceForStep(refineStep + 1)} Hz`} and fine-tune from there.`;
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
    const tol = tolerance();
    if (a <= tol) return 100;
    return Math.max(0, Math.round(100 * (1 - (a - tol) / PROGRESS_RANGE_HZ)));
  }

  function buttonLabel() {
    if (phase === "prep") return "Done — Start Tuning";
    if (phase === "done") {
      return refineStep >= 2 ? "Tune Further" : `Tune Further (±${toleranceForStep(refineStep + 1)} Hz)`;
    }
    return listening ? "Stop Listening" : "Resume Listening";
  }

  function render() {
    const pct = accuracyPct();
    const tol = tolerance();
    const badge = tuneBadge(lastHit ? lastHit.hz : null, tol);
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
          <div class="target-freq">Target: ${target.toFixed(1)} Hz ±${tol}${styleName ? ` · ${styleName}` : ""}</div>
          <div class="cents-badge ${badge.cls}">${badge.text}</div>
        </div>
        <div class="lug-legend-note">Numbers = the order to turn the lugs. Turn them all by the same amount.</div>
      </div>

      ${showTurn ? drumKeyAnimHtml(turn) : ""}

      <div class="tune-step card">
        <div class="tune-step-title">${
          phase === "prep" ? "Before you start" : phase === "done" ? "Finished" : `Round ${round + 1}`
        }</div>
        <div class="tune-step-text">${instructionText()}</div>
      </div>

      ${micError ? `<div class="mic-error">${micError}</div>` : ""}

      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn btn-primary${listening ? " listening-pulse" : ""}" id="tap-lug-btn">${buttonLabel()}</button>
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
    if (Math.abs(hz) <= tolerance()) {
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
    // From prep or done, the button starts a listening pass. Either way the
    // prep card is behind us for good — it never reappears once tuning has
    // begun, since re-reading "hand-tighten everything" mid-tune is wrong.
    if (phase === "prep" || phase === "done") {
      if (phase === "done") {
        refineStep++; // Tune Further: halve the window (capped in tuningMath)
        lastHit = null;
        round = 0;
      }
      phase = "tuning";
      hitFailed = false;
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
