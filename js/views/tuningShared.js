import { qs } from "../util.js";
import { navigate, registerCleanup } from "../main.js";
import { getKit } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { centsOff, classifyStatus, turnEstimate } from "../audio/tuningMath.js";

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
      const arrow =
        lug.cents == null
          ? ""
          : lug.cents > 5
          ? `<text x="${x}" y="${y + 4}" class="lug-label" fill="#0c0c0e" font-size="13">↓</text>`
          : lug.cents < -5
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

export function pickActiveLug(lugs) {
  return lugs.find((l) => l.status !== "in-tune") || lugs[0];
}

export function centsBadge(cents) {
  if (cents == null) return { cls: "good", text: "Tap this lug to begin" };
  if (cents > 5) return { cls: "loose", text: `${Math.round(cents)} cents low — tighten` };
  if (cents < -5) return { cls: "tight", text: `${Math.round(Math.abs(cents))} cents high — loosen` };
  return { cls: "good", text: "In tune" };
}

export function currentFreqFor(target, cents) {
  const base = target || 122;
  if (cents == null) return base;
  return base * Math.pow(2, -cents / 1200);
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

// Mic-driven tuning: mounts the accuracy ring, lug map, live pitch readout and
// a Tap Lug / Stop Listening button into `container`, and re-renders that
// subtree on every pitch update. Marking a lug "in tune" and auto-advancing
// to the next one both happen here so Tuning and Snare Tuning behave
// identically. Returns { stop } for callers that want to stop it early.
export function mountLiveTuning(container, { lugs, target, fftSize, styleName }) {
  const listener = new PitchListener();
  let activeLug = pickActiveLug(lugs);
  let listening = false;
  let reading = null; // { freq, cents }
  let micError = null;
  let inTuneSince = null;

  function render() {
    const inTuneCount = lugs.filter((l) => l.status === "in-tune").length;
    const accuracy = Math.round((inTuneCount / lugs.length) * 100);
    const cents = reading ? reading.cents : activeLug.cents;
    const badge = centsBadge(cents);
    const currentFreq = reading ? reading.freq : currentFreqFor(target, activeLug.cents);
    const turn = cents == null ? null : turnEstimate(cents);

    container.innerHTML = `
      <div class="accuracy-ring-wrap card">
        ${accuracyRingSvg(accuracy)}
        <div>
          <div class="accuracy-text">${accuracy}% Tuning Accuracy</div>
          <div class="accuracy-sub">${inTuneCount} of ${lugs.length} lugs in tune</div>
        </div>
      </div>

      <div class="lug-map-wrap">
        ${buildLugMapSvg(lugs, activeLug.id)}
        <div class="pitch-readout">
          <div class="current-freq">${currentFreq.toFixed(1)} Hz</div>
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
        <button class="btn ${listening ? "btn-primary listening-pulse" : "btn-secondary"}" id="tap-lug-btn">
          ${listening ? "Stop Listening" : `Tap Lug ${activeLug.id}`}
        </button>
      </div>
    `;
    qs(container, "#tap-lug-btn").addEventListener("click", toggle);
  }

  function handleUpdate(result) {
    if (!result || result.clarity < 0.75) {
      reading = null;
      inTuneSince = null;
      render();
      return;
    }
    const cents = centsOff(result.frequency, target);
    reading = { freq: result.frequency, cents };
    activeLug.cents = cents;
    activeLug.status = classifyStatus(cents);

    if (activeLug.status === "in-tune") {
      if (inTuneSince == null) {
        inTuneSince = Date.now();
      } else if (Date.now() - inTuneSince > 700) {
        inTuneSince = null;
        const next = lugs.find((l) => l.status !== "in-tune");
        if (next) {
          activeLug = next;
          reading = null;
        } else {
          stopListening();
        }
      }
    } else {
      inTuneSince = null;
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
      await listener.start({ targetFreq: target, fftSize, onUpdate: handleUpdate });
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
    reading = null;
    inTuneSince = null;
  }

  render();
  return { stop: stopListening };
}
