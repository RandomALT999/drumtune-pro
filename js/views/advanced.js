import { el, qs, escapeHtml } from "../util.js";
import { registerCleanup } from "../main.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { findOvertones } from "../audio/fftPeaks.js";

const ROW_LABELS = ["Fundamental", "Overtone 2", "Overtone 3", "Overtone 4", "Overtone 5"];
const BAR_COUNT = 16;

export function renderAdvanced() {
  const listener = new PitchListener();
  let listening = false;
  let rafId = null;
  let overtoneTimer = null;
  // Values persist after Pause so the last reading stays readable.
  let rows = null;

  const view = el(
    `
    <div style="flex:none;display:flex;align-items:flex-start;justify-content:space-between;gap:12px">
      <div class="screen-title">Analyze</div>
      <span class="badge" id="badge" style="margin-top:10px"><span class="dot"></span><span id="badge-text">Idle</span></span>
    </div>
    <div class="blurb" style="flex:none;margin-top:9px">Everything the mic hears, broken into its frequencies. Useful for checking how clean a drum's fundamental is.</div>

    <div class="spectrum idle" id="spectrum" style="flex:none;margin-top:20px">
      ${Array.from({ length: BAR_COUNT })
        .map(
          (_, i) =>
            `<span class="bar" style="height:${8 + ((i * 37) % 55)}%;background:#2f3340;animation-duration:${(1.5 + (i % 5) * 0.15).toFixed(
              2
            )}s;animation-delay:${(i * 80) % 900}ms"></span>`
        )
        .join("")}
    </div>
    <div class="meta" id="idle-note" style="flex:none;margin-top:10px;text-align:center">Nothing coming in yet.</div>
    <div id="mic-slot" style="flex:none"></div>

    <div style="flex:none;margin-top:24px;display:flex;align-items:center">
      <span class="eyebrow">Overtone series</span>
      <button class="help-btn" id="help-btn" aria-label="What is the overtone series?">?</button>
    </div>
    <div class="help-box" id="help-box" hidden>
      Every drum note is a stack of frequencies, not just one. The <b>fundamental</b>
      is the lowest and is the pitch you actually tune — it should land near your
      target Hz. The rows below it are <b>overtones</b>: higher ways the head vibrates
      at the same time (on drums they aren't neat multiples of the fundamental like on
      a guitar string). How to use this: strike the drum and compare the fundamental
      against your target. If an overtone shows much louder than the fundamental, the
      head is likely uneven — go around the lugs and even them out.
    </div>
    <div class="rows" id="overtones" style="flex:none;margin-top:3px"></div>

    <div class="spacer"></div>
    <div class="footer-actions">
      <button class="pill" id="listen-btn">Start listening</button>
    </div>
  `,
    { scrolls: true }
  );

  const spectrum = qs(view, "#spectrum");
  const bars = Array.from(spectrum.children);

  function paintRows() {
    qs(view, "#overtones").innerHTML = ROW_LABELS.map((label, i) => {
      const r = rows && rows[i];
      const color = i === 0 ? "var(--accent)" : "var(--blue)";
      return `
        <div class="row row-sm" style="align-items:center">
          <span class="pip" style="background:${r ? color : "var(--surface-2)"}"></span>
          <span class="row-title">${escapeHtml(label)}</span>
          <span class="meta">${r ? r.freq.toFixed(1) + " Hz" : "—"}</span>
          <span class="meta" style="width:44px;text-align:right">${r ? r.ampPct + "%" : "—"}</span>
        </div>`;
    }).join("");
  }

  function paintBadge() {
    const badge = qs(view, "#badge");
    badge.classList.toggle("live", listening);
    qs(view, "#badge-text").textContent = listening ? "Live" : rows ? "Paused" : "Idle";
    qs(view, "#idle-note").style.display = listening || rows ? "none" : "block";
    spectrum.classList.toggle("idle", !listening);
    spectrum.classList.toggle("live", listening);
  }

  function loop() {
    if (!listening) return;
    const analyser = listener.getAnalyser();
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    const step = Math.max(1, Math.floor(Math.min(data.length, 220) / BAR_COUNT));
    let peakIdx = 0;
    let peak = 0;
    const vals = bars.map((_, i) => {
      let sum = 0;
      for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
      const v = sum / step;
      if (v > peak) { peak = v; peakIdx = i; }
      return v;
    });
    bars.forEach((bar, i) => {
      bar.style.height = `${Math.max(6, (vals[i] / 255) * 100)}%`;
      bar.style.background = i === peakIdx ? "var(--accent)" : vals[i] > peak * 0.45 ? "var(--blue)" : "#2f3340";
    });
    rafId = requestAnimationFrame(loop);
  }

  function stopListening() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    if (overtoneTimer) clearInterval(overtoneTimer);
    overtoneTimer = null;
    if (listening) listener.stop();
    listening = false;
  }

  async function toggle() {
    const btn = qs(view, "#listen-btn");
    if (listening) {
      stopListening();
      btn.textContent = "Start listening";
      paintBadge();
      return;
    }
    qs(view, "#mic-slot").innerHTML = "";
    try {
      await listener.start({ fftSize: 4096, onUpdate: () => {} });
      listening = true;
      registerCleanup(stopListening);
      btn.textContent = "Pause";
      paintBadge();
      rafId = requestAnimationFrame(loop);
      overtoneTimer = setInterval(() => {
        const peaks = findOvertones(listener.getAnalyser(), listener.getSampleRate(), 5);
        if (peaks.length) {
          rows = peaks;
          paintRows();
        }
      }, 350);
    } catch (err) {
      qs(view, "#mic-slot").innerHTML = `<div class="mic-error">${escapeHtml(micErrorMessage(err))}</div>`;
    }
  }

  qs(view, "#listen-btn").addEventListener("click", toggle);
  qs(view, "#help-btn").addEventListener("click", () => {
    const box = qs(view, "#help-box");
    box.hidden = !box.hidden;
  });
  paintRows();
  paintBadge();
  return view;
}
