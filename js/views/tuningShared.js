import { qs } from "../util.js";
import { navigate, registerCleanup } from "../main.js";
import { getKit, generateCrossOrder } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { centsOff, hzOff, classifyStatus, turnEstimate, IN_TUNE_HZ } from "../audio/tuningMath.js";

export function buildLugMapSvg(lugs, activeLugId) {
  const cx = 130,
    cy = 130,
    shellR = 108,
    dotR = 15;
  const dots = lugs
    .map((lug, i) => {
      const angle = (i / lugs.length) * 2 * Math.PI - Math.PI / 2;
      const x = cx + shellR * Math.cos(angle);
      const y = cy + shellR * Math.sin(angle);
      const isActive = lug.id === activeLugId;
      // lug.hz is target - freq: positive = low (tighten, ↓ tension arrow).
      const arrow =
        lug.hz == null
          ? ""
          : lug.hz > IN_TUNE_HZ
          ? `<text x="${x}" y="${y + 4}" class="lug-label" fill="#0c0c0e" font-size="13">↓</text>`
          : lug.hz < -IN_TUNE_HZ
          ? `<text x="${x}" y="${y + 4}" class="lug-label" fill="#0c0c0e" font-size="13">↑</text>`
          : "";
      return `
        <g>
          <circle cx="${x}" cy="${y}" r="${dotR}" class="lug-dot ${lug.status} ${isActive ? "active-pulse" : ""}" />
          ${arrow || `<text x="${x}" y="${y + 4}" class="lug-label" fill="${lug.status === "pending" ? "var(--text-dim)" : "#0c0c0e"}">${lug.id}</text>`}
        </g>`;
    })
    .join("");

  return `
    <svg class="lug-map" viewBox="0 0 260 260">
      <circle cx="${cx}" cy="${cy}" r="${shellR + dotR + 6}" class="drum-shell" />
      <circle cx="${cx}" cy="${cy}" r="${shellR - 10}" class="drum-head" />
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

// Lugs listed in the cross ("star") tightening order — opposite lugs
// alternate so tension pulls evenly across the head instead of walking
// around the rim. Same order Guided Mode uses.
export function starOrder(lugs) {
  return generateCrossOrder(lugs.length).map((id) => lugs.find((l) => l.id === id));
}

export function tuneBadge(hz) {
  if (hz == null) return { cls: "good", text: "Strike the lug to begin" };
  if (hz > IN_TUNE_HZ) return { cls: "loose", text: `${hz.toFixed(1)} Hz low — tighten` };
  if (hz < -IN_TUNE_HZ) return { cls: "tight", text: `${Math.abs(hz).toFixed(1)} Hz high — loosen` };
  return { cls: "good", text: "In tune ✓" };
}

// Collapsible mic-placement guidance shown on the tuning screens — readings
// are only as consistent as where the phone sits relative to the lug.
export function tuningTipsHtml() {
  return `
    <details class="tips-card">
      <summary>📱 How to get consistent readings</summary>
      <ul>
        <li>Hold the phone 3–6 inches above the drumhead, close to the lug you're tuning, so that lug's pitch dominates the mic.</li>
        <li>Strike once, about 1 inch in from the rim at that lug, then let it ring — only the initial hit is measured, since the pitch drifts as the note fades.</li>
        <li>If readings keep flipping between two different values, strike a little closer to the center — near the rim the head rings at two pitches at once, which can confuse the reading.</li>
        <li>Wait for the reading, adjust the tension rod, then strike again.</li>
        <li>Tune somewhere quiet — voices and music can throw off detection.</li>
        <li>To hear one head alone, rest the drum's other head on carpet or your leg to mute it.</li>
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

// Mic-driven tuning: mounts the accuracy ring, lug map, per-hit readout and
// a Start/Stop Listening button into `container`. Each detected drum strike
// gives one measurement (initial-attack pitch only — the ring-out drifts).
// A lug that lands within tolerance locks in as tuned permanently and the
// active lug advances to the next unlocked one until every lug is locked,
// so later noise or decaying ring can't knock a finished lug back out.
// Shared by Tuning and Snare Tuning so both behave identically.
// Returns { stop } for callers that want to stop it early.
export function mountLiveTuning(container, { lugs, target, fftSize, styleName }) {
  const listener = new PitchListener();
  // Advance through lugs in the cross/star order, not numeric order, so the
  // head is pulled evenly. nextActive() = first unlocked lug in that order.
  const order = starOrder(lugs);
  const nextActive = () => order.find((l) => !l.locked) || order[order.length - 1];
  let activeLug = nextActive();
  let listening = false;
  let lastHit = null; // { freq, hz } from the most recent strike
  let hitFailed = false; // strike detected but pitch unreadable
  let micError = null;
  let allDone = lugs.every((l) => l.locked);

  function statusLine() {
    if (allDone) return { cls: "good", text: "All lugs in tune ✓" };
    if (lastHit) return tuneBadge(lastHit.hz);
    if (hitFailed) return { cls: "loose", text: "Couldn't read that — strike once, cleanly" };
    if (listening) return { cls: "good", text: `Strike lug ${activeLug.id} near the rim` };
    if (activeLug.hz != null) return tuneBadge(activeLug.hz);
    return { cls: "good", text: "Start listening, then strike the lug" };
  }

  function render() {
    const inTuneCount = lugs.filter((l) => l.locked).length;
    const accuracy = Math.round((inTuneCount / lugs.length) * 100);
    const badge = statusLine();
    const displayFreq = lastHit ? lastHit.freq : currentFreqFor(target, activeLug.hz);
    const turn = lastHit ? turnEstimate(centsOff(lastHit.freq, target)) : null;

    container.innerHTML = `
      <div class="accuracy-ring-wrap card">
        ${accuracyRingSvg(accuracy)}
        <div>
          <div class="accuracy-text">${accuracy}% Tuning Accuracy</div>
          <div class="accuracy-sub">${inTuneCount} of ${lugs.length} lugs in tune</div>
        </div>
      </div>

      <div class="lug-map-wrap">
        ${buildLugMapSvg(lugs, allDone ? -1 : activeLug.id)}
        <div class="pitch-readout">
          <div class="current-freq">${displayFreq.toFixed(1)} Hz</div>
          <div class="target-freq">Target: ${target.toFixed(1)} Hz · Lug ${activeLug.id}${styleName ? ` · ${styleName}` : ""}</div>
          <div class="cents-badge ${badge.cls}">${badge.text}</div>
          ${turn && turn.turns > 0 ? `<div class="turn-estimate">≈ ${turn.label} — ${turn.direction}</div>` : ""}
        </div>
        <div class="lug-legend">
          <span><i class="legend-dot" style="background:var(--green)"></i>In tune</span>
          <span><i class="legend-dot" style="background:var(--yellow)"></i>Slight</span>
          <span><i class="legend-dot" style="background:var(--red)"></i>Off</span>
        </div>
      </div>

      ${micError ? `<div class="mic-error">${micError}</div>` : ""}

      <div class="btn-row" style="margin-bottom:10px;">
        <button class="btn ${listening ? "btn-primary listening-pulse" : "btn-secondary"}" id="tap-lug-btn" ${allDone ? "disabled" : ""}>
          ${allDone ? "Done ✓" : listening ? "Stop Listening" : "Start Listening"}
        </button>
      </div>
    `;
    qs(container, "#tap-lug-btn").addEventListener("click", toggle);
  }

  function handleHit(result) {
    if (allDone) return;
    if (!result) {
      hitFailed = true;
      lastHit = null;
      render();
      return;
    }
    hitFailed = false;
    const hz = hzOff(result.frequency, target);
    lastHit = { freq: result.frequency, hz };
    activeLug.hz = hz;
    activeLug.status = classifyStatus(result.frequency, target);

    if (activeLug.status === "in-tune") {
      // Lock it in — once a lug hits the target range it stays counted as
      // tuned; only unlocked lugs get measured from here on.
      activeLug.locked = true;
      const next = order.find((l) => !l.locked);
      if (next) {
        activeLug = next;
        lastHit = null;
      } else {
        allDone = true;
        stopListening();
      }
    }
    render();
  }

  async function toggle() {
    if (listening) {
      stopListening();
      render();
      return;
    }
    micError = null;
    try {
      await listener.start({ targetFreq: target, fftSize, onHit: handleHit });
      listening = true;
      registerCleanup(stopListening);
    } catch (err) {
      micError = micErrorMessage(err);
    }
    render();
  }

  function stopListening() {
    if (listening) listener.stop();
    listening = false;
    lastHit = null;
    hitFailed = false;
  }

  render();
  return { stop: stopListening };
}
