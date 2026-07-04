import { el, qs } from "../util.js";
import { registerCleanup } from "../main.js";
import { generateCrossOrder, generateLugs } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { centsOff, classifyStatus, turnEstimate } from "../audio/tuningMath.js";

export function renderGuidedTuning(params) {
  const lugCount = params.lugCount || 8;
  const order = generateCrossOrder(lugCount);
  const lugs = generateLugs(lugCount);
  const target = params.target || 122;
  const listener = new PitchListener();

  let stepIndex = 0;
  let voiceOn = true;
  let listening = false;
  let micError = null;
  let inTuneSince = null;

  const view = el(`
    <div class="guided-order-track" id="order-track"></div>

    <div class="guided-prompt">
      <div class="lug-index"></div>
      <div class="prompt-text"></div>
      <div class="turn-estimate"></div>
    </div>

    <div id="mic-error-slot"></div>

    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn btn-secondary" id="listen-btn">Listen</button>
    </div>

    <div class="card" style="display:flex; align-items:center; justify-content:space-between;">
      <div>
        <div class="field-label" style="margin-bottom:2px;">Voice prompts</div>
        <div style="font-size:13px; color:var(--text-dim);">Read aloud as each lug is reached</div>
      </div>
      <div class="chip active" id="voice-toggle">On</div>
    </div>

    <div class="btn-row" style="margin-top:20px;">
      <button class="btn btn-secondary" id="prev-step">Previous</button>
      <button class="btn btn-primary" id="next-step">Mark Done &amp; Next</button>
    </div>
  `);

  function currentLug() {
    return lugs.find((l) => l.id === order[stepIndex]) || lugs[0];
  }

  function speak(text) {
    if (!voiceOn || !("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } catch (e) {
      /* speech synthesis unavailable in this browser */
    }
  }

  function promptTextFor(lug) {
    if (lug.cents == null) return `Lug ${lug.id} — tap Listen to measure it.`;
    const turn = turnEstimate(lug.cents);
    if (turn.turns === 0) return `Lug ${lug.id} is in tune.`;
    const dir = turn.direction === "tighten" ? "Tighten" : "Loosen";
    return `Lug ${lug.id} is ${Math.round(Math.abs(lug.cents))} cents ${lug.cents > 0 ? "low" : "high"}. ${dir} about ${turn.label}.`;
  }

  function renderTrack() {
    const track = qs(view, "#order-track");
    track.innerHTML = order
      .map((lugId, i) => {
        const cls = i < stepIndex ? "done" : i === stepIndex ? "current" : "";
        const dot = `<div class="step ${cls}">${lugId}</div>`;
        return i < order.length - 1 ? dot + `<div class="arrow">→</div>` : dot;
      })
      .join("");
  }

  function renderPrompt() {
    const done = stepIndex >= order.length;
    const lug = done ? null : currentLug();
    qs(view, ".lug-index").textContent = done ? "Complete" : `Step ${stepIndex + 1} of ${order.length}`;
    qs(view, ".prompt-text").textContent = done ? "All lugs complete — nice work!" : promptTextFor(lug);
    const turn = !done && lug.cents != null ? turnEstimate(lug.cents) : null;
    qs(view, ".turn-estimate").textContent = turn && turn.turns > 0 ? `≈ ${turn.label} — ${turn.direction}` : "";
    qs(view, "#mic-error-slot").innerHTML = micError ? `<div class="mic-error">${micError}</div>` : "";

    const listenBtn = qs(view, "#listen-btn");
    listenBtn.textContent = listening ? "Stop Listening" : "Listen";
    listenBtn.className = `btn ${listening ? "btn-primary listening-pulse" : "btn-secondary"}`;
    listenBtn.disabled = done;

    renderTrack();
  }

  function goToStep(newIndex, { announce = true } = {}) {
    stopListening();
    stepIndex = Math.max(0, Math.min(order.length, newIndex));
    renderPrompt();
    if (announce) {
      if (stepIndex < order.length) speak(promptTextFor(currentLug()));
      else speak("All lugs complete. Nice work!");
    }
  }

  function handleUpdate(result) {
    if (!result || result.clarity < 0.75) {
      inTuneSince = null;
      return;
    }
    const lug = currentLug();
    const cents = centsOff(result.frequency, target);
    lug.cents = cents;
    lug.status = classifyStatus(cents);
    renderPrompt();

    if (lug.status === "in-tune") {
      if (inTuneSince == null) {
        inTuneSince = Date.now();
      } else if (Date.now() - inTuneSince > 700) {
        inTuneSince = null;
        goToStep(stepIndex + 1);
      }
    } else {
      inTuneSince = null;
    }
  }

  async function toggleListen() {
    if (stepIndex >= order.length) return;
    if (listening) {
      stopListening();
      renderPrompt();
      return;
    }
    micError = null;
    try {
      await listener.start({ targetFreq: target, fftSize: 2048, onUpdate: handleUpdate });
      listening = true;
      registerCleanup(stopListening);
    } catch (err) {
      micError = micErrorMessage(err);
    }
    renderPrompt();
  }

  function stopListening() {
    if (listening) listener.stop();
    listening = false;
    inTuneSince = null;
  }

  qs(view, "#listen-btn").addEventListener("click", toggleListen);
  qs(view, "#next-step").addEventListener("click", () => goToStep(stepIndex + 1));
  qs(view, "#prev-step").addEventListener("click", () => goToStep(stepIndex - 1));
  qs(view, "#voice-toggle").addEventListener("click", (e) => {
    voiceOn = !voiceOn;
    e.currentTarget.classList.toggle("active", voiceOn);
    e.currentTarget.textContent = voiceOn ? "On" : "Off";
  });

  renderPrompt();
  speak(promptTextFor(currentLug()));

  return view;
}
