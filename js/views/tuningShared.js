import { qs, escapeHtml, PLAY_ICON } from "../util.js";
import { navigate, registerCleanup } from "../main.js";
import { getKit, generateCrossOrder } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { centsOff, hzOff, turnEstimate } from "../audio/tuningMath.js";
import { playToneForDrumType } from "../audio/synth.js";
import { saveSession, clearSession } from "../storage.js";

// Tolerance ladder. Each pass halves the window; the green band on the
// needle ladder narrows to match, which is the feedback that the goal got
// stricter. Stops at 2.5 Hz — tighter than that isn't reachable by hand,
// the drum drifts more than that as it settles.
export const TOLERANCES = [10, 5, 2.5];

// Lugs are drawn at their physical positions but labelled with their PLACE
// IN THE TUNING ORDER, so the drummer just counts 1, 2, 3 around the head.
// For 6 lugs clockwise from top that reads 1·3·5·2·4·6.
export function lugOrderLabels(lugCount) {
  const order = generateCrossOrder(lugCount);
  return Array.from({ length: lugCount }, (_, position) => order.indexOf(position + 1) + 1);
}

export function lugMapSvg(lugCount, size = 144) {
  const cx = 56, cy = 56, ringR = 44, lugR = lugCount > 6 ? 7 : 7.5;
  const labels = lugOrderLabels(lugCount);
  let discs = "";
  let numerals = "";
  for (let i = 0; i < lugCount; i++) {
    const a = (i / lugCount) * 2 * Math.PI - Math.PI / 2;
    const x = (cx + ringR * Math.cos(a)).toFixed(1);
    const y = (cy + ringR * Math.sin(a)).toFixed(1);
    discs += `<circle cx="${x}" cy="${y}" r="${lugR}" />`;
    numerals += `<text x="${x}" y="${(Number(y) + (lugCount > 6 ? 3.5 : 4)).toFixed(1)}">${labels[i]}</text>`;
  }
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 112 112" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="${ringR}" fill="none" stroke="#2b2e37" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="35" fill="#d9c9a8" fill-opacity=".07"/>
      <circle class="strike-ring" cx="${cx}" cy="${cy}" r="17" fill="none" stroke="#ff7a45" stroke-width="1.3" stroke-dasharray="3.5 6"/>
      <g fill="#ff7a45">${discs}</g>
      <g fill="#121317" font-family="Space Grotesk" font-size="${lugCount > 6 ? 10 : 11}" font-weight="700" text-anchor="middle">${numerals}</g>
    </svg>`;
}

const KEY_GLYPH = `
  <svg class="turn-glyph key" viewBox="0 0 48 48" aria-hidden="true">
    <g stroke="currentColor" stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d="M24 15V7"/><rect x="18.5" y="15" width="11" height="11" rx="2.4" stroke-width="2.6"/>
      <path d="M24 26v12"/><path d="M17.5 38h13"/>
    </g>
  </svg>`;

const CHECK_GLYPH = `
  <svg class="turn-glyph check" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity=".45"/>
    <path d="M15 24.5l6.5 6.5L33 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

const SKIP_ICON = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#8f939f" stroke-width="2.6" stroke-linecap="round"><path d="M6 5l7 7-7 7"/><path d="M15 5v14"/></svg>`;

// Kit-flow helpers ---------------------------------------------------------

export function kitPieceAt(params) {
  if (!params.kitId) return null;
  const kit = getKit(params.kitId);
  if (!kit) return null;
  return { kit, piece: kit.pieces[params.kitIndex] || kit.pieces[0] };
}

export function hasNextPiece(params) {
  const ctx = kitPieceAt(params);
  return !!ctx && params.kitIndex < ctx.kit.pieces.length - 1;
}

export function goToNextPiece(params) {
  const ctx = kitPieceAt(params);
  if (!ctx || !hasNextPiece(params)) {
    // The kit is finished, so there's nothing left to resume.
    clearSession();
    navigate("kit-complete", { kitId: params.kitId });
    return;
  }
  const nextIndex = params.kitIndex + 1;
  saveSession(params.kitId, nextIndex);
  const next = ctx.kit.pieces[nextIndex];
  const nextParams = {
    kitId: params.kitId,
    kitIndex: nextIndex,
    drumType: next.drumType,
    size: next.size,
    lugCount: next.lugCount,
    target: next.target,
  };
  navigate(next.drumType === "snare" ? "snare-tuning" : "tuning", nextParams);
}

export function beginKitTuning(kit) {
  const first = kit.pieces[0];
  saveSession(kit.id, 0);
  navigate(first.drumType === "snare" ? "snare-tuning" : "tuning", {
    kitId: kit.id,
    kitIndex: 0,
    drumType: first.drumType,
    size: first.size,
    lugCount: first.lugCount,
    target: first.target,
  });
}

export function pieceLabelFor(params) {
  const ctx = kitPieceAt(params);
  if (ctx) return ctx.piece.label.toLowerCase();
  const type = (params.drumType || "rack-tom").replace("-", " ");
  return params.size ? `${params.size}" ${type}` : type;
}

// The tuning engine --------------------------------------------------------
//
// Mounts the readout, needle ladder, turn block, diagram and button row into
// `container`. One primary button drives the whole loop (see the handoff's
// state table); the secondary is the preview tone until round 1 passes, then
// becomes Skip, then collapses to zero width on the final round — that
// widening IS the completion signal.
export function mountTuningEngine(container, opts) {
  const { lugCount, target, fftSize, drumType, params = {}, onStateChange, hideDiagram = false } = opts;

  const listener = new PitchListener();
  let roundIndex = 0; // index into TOLERANCES
  let listening = false;
  let everListened = false;
  let lastHit = null; // { freq, hz }
  let inTolerance = false;
  let hitFailed = false;
  let micError = null;

  const tolerance = () => TOLERANCES[roundIndex];
  const isFinalRound = () => roundIndex >= TOLERANCES.length - 1;

  function state() {
    return { roundIndex, tolerance: tolerance(), listening, everListened, inTolerance, lastHit };
  }

  function turn() {
    if (!lastHit) return null;
    return turnEstimate(centsOff(lastHit.freq, target));
  }

  function mode() {
    if (!everListened) return "idle";
    return inTolerance ? "in" : "off";
  }

  function instruction() {
    if (!everListened) {
      // The prep guidance lives here so it's the first thing you read and it
      // disappears for good after the first measurement.
      return "Start with every lug finger tight, then one full turn with the key on each. Then strike the centre of the head.";
    }
    if (micError) return "";
    if (hitFailed) return "Didn't catch that one — strike the centre again, firmly.";
    if (inTolerance) {
      return isFinalRound()
        ? "This drum is done. Move on, or strike again to double-check."
        : "Tighten the window to keep going, or skip to the next drum.";
    }
    return "Strike the centre of the head once, firmly, and let it ring.";
  }

  function turnContent() {
    const m = mode();
    if (m === "idle") return { glyph: KEY_GLYPH, frac: "—", sub: "Press start, then strike the centre.", angle: null };
    if (m === "in") {
      const tol = tolerance();
      const note = isFinalRound() ? "this drum is done" : tol === 10 ? "the head is even" : "nicely seated";
      return { glyph: CHECK_GLYPH, frac: "", sub: `Within ±${tol} Hz — ${note}.`, angle: null };
    }
    const t = turn();
    return {
      glyph: KEY_GLYPH,
      frac: t && t.turns > 0 ? t.label.replace(" turn", "") : "—",
      sub: t && t.turns > 0 ? `${t.direction} · every lug` : "very close — strike again",
      // The key sweeps through the exact fraction being asked for, and
      // anticlockwise to loosen — copying the animation beats reading "7/16".
      angle: t && t.turns > 0 ? t.turns * 360 * (t.direction === "loosen" ? -1 : 1) : null,
    };
  }

  // ±40 Hz maps to the full width of the ladder.
  function needlePct() {
    if (!lastHit) return 50;
    return Math.max(4, Math.min(96, 50 + -lastHit.hz * 1.25));
  }

  function primary() {
    if (!everListened) return { label: "Start listening", cls: "", dot: false, run: startListening };
    if (!inTolerance) {
      return listening
        ? { label: "Listening — strike again", cls: "", dot: true, run: null }
        : { label: "Resume listening", cls: "", dot: false, run: startListening };
    }
    if (!isFinalRound()) {
      const next = TOLERANCES[roundIndex + 1];
      return { label: `Tune further · ±${next} Hz`, cls: "white", dot: false, run: tighten };
    }
    return {
      label: hasNextPiece(params) ? "Next drum" : "Finish",
      cls: "green",
      dot: false,
      run: () => {
        stopListening();
        goToNextPiece(params);
      },
    };
  }

  function render() {
    const m = mode();
    const tone = m === "off" ? "var(--yellow)" : m === "in" ? "var(--green)" : "var(--text-ghost)";
    const heard = lastHit ? lastHit.freq.toFixed(1) : target.toFixed(1);
    const delta = lastHit ? (lastHit.hz > 0 ? `−${lastHit.hz.toFixed(1)}` : `+${Math.abs(lastHit.hz).toFixed(1)}`) : "";
    const tc = turnContent();
    const p = primary();
    const bandW = tolerance() === 10 ? 25 : tolerance() === 5 ? 12.5 : 6.25;
    // Skip only replaces the preview tone once you're actually in tolerance and
    // there's a tighter round to decline. While you're still hunting the pitch
    // — in any round — the preview tone is the more useful button.
    const showSkip = inTolerance && !isFinalRound();
    const collapsed = inTolerance && isFinalRound();

    container.innerHTML = `
      <div class="heard">
        <div class="eyebrow">Heard</div>
        <div class="heard-row">
          <span class="heard-val" style="color:${tone};opacity:${m === "idle" ? 0.5 : 1}">${heard}</span>
          <span class="heard-unit">Hz</span>
        </div>
        <div class="heard-strip">
          <span class="heard-target">TARGET ${target.toFixed(1)}</span>
          <span class="heard-pip"></span>
          <span class="heard-delta" style="color:${tone}">${delta}</span>
        </div>
      </div>

      <div class="ladder">
        <div class="ladder-band" style="left:${(50 - bandW / 2)}%;width:${bandW}%"></div>
        <div class="ladder-fine"></div>
        <div class="ladder-coarse"></div>
        <div class="ladder-centre"></div>
        <div class="needle" style="left:${needlePct()}%;background:${tone};box-shadow:0 0 15px ${tone};opacity:${m === "idle" ? 0.35 : 1}">
          <div class="needle-cap" style="background:${tone}"></div>
        </div>
        <div class="ladder-scale"><span>−40</span><span>−20</span><span class="zero">0</span><span>+20</span><span>+40</span></div>
      </div>

      <div class="turn-block ${m}">
        <span class="turn-glyph-wrap" style="color:${
          m === "off" ? "var(--yellow-ink)" : m === "in" ? "var(--green)" : "var(--text-ghost)"
        };display:flex${tc.angle === null ? "" : `;--key-turn:${tc.angle.toFixed(1)}deg`}">${tc.glyph}</span>
        <div class="turn-text">
          ${tc.frac ? `<div class="turn-frac">${tc.frac}</div>` : ""}
          <div class="turn-sub"${tc.frac ? "" : ' style="font-size:15px"'}>${escapeHtml(tc.sub)}</div>
        </div>
      </div>

      ${
        hideDiagram
          ? ""
          : `<div class="tune-pair">
              <div class="diagram-card">${lugMapSvg(lugCount)}</div>
              <div class="order-card">
                <div class="eyebrow">Turn order</div>
                <div class="order-line">Follow the numbers on the diagram — they jump across.</div>
                <div class="order-line second">Turn every lug by the same amount.</div>
              </div>
            </div>`
      }

      ${micError ? `<div class="mic-error">${escapeHtml(micError)}</div>` : ""}
      <div class="tune-instruction">${escapeHtml(instruction())}</div>
      <div class="tune-spacer"></div>

      <div class="btn-row">
        <button class="pill ${p.cls}" id="primary-btn"${p.run ? "" : " disabled"}>
          ${p.dot ? '<span class="live-dot"></span>' : ""}${escapeHtml(p.label)}
        </button>
        <div class="sec-wrap${collapsed ? " collapsed" : ""}">
          <button class="sec-btn" id="secondary-btn" aria-label="${showSkip ? "Skip to next drum" : "Preview target tone"}">
            ${showSkip ? `<span class="skip-label">Skip</span>${SKIP_ICON}` : PLAY_ICON}
          </button>
        </div>
      </div>
    `;

    const btn = qs(container, "#primary-btn");
    if (p.run) btn.addEventListener("click", p.run);
    qs(container, "#secondary-btn").addEventListener("click", () => {
      if (showSkip) {
        stopListening();
        goToNextPiece(params);
      } else {
        playToneForDrumType(drumType || "rack-tom", target);
      }
    });

    if (onStateChange) onStateChange(state());
  }

  function handleHit(result) {
    if (!result) {
      hitFailed = true;
      render();
      return;
    }
    hitFailed = false;
    const hz = hzOff(result.frequency, target);
    lastHit = { freq: result.frequency, hz };
    inTolerance = Math.abs(hz) <= tolerance();
    render();
  }

  async function startListening() {
    micError = null;
    try {
      await listener.start({ targetFreq: target, fftSize, onHit: handleHit });
      listening = true;
      everListened = true;
      registerCleanup(stopListening);
    } catch (err) {
      micError = micErrorMessage(err);
      everListened = true; // show the error in place of the prep line
    }
    render();
  }

  // Halving keeps the mic open and re-enters the out-of-tolerance state for
  // the new round.
  function tighten() {
    roundIndex = Math.min(roundIndex + 1, TOLERANCES.length - 1);
    inTolerance = lastHit ? Math.abs(lastHit.hz) <= tolerance() : false;
    render();
  }

  function stopListening() {
    if (listening) listener.stop();
    listening = false;
    hitFailed = false;
  }

  render();
  return { stop: stopListening, getState: state };
}
