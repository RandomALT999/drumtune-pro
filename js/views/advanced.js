import { el, qs } from "../util.js";
import { registerCleanup } from "../main.js";
import { generateLugs } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { findOvertones } from "../audio/fftPeaks.js";

const ROW_LABELS = ["Fundamental", "Overtone 2", "Overtone 3", "Overtone 4", "Overtone 5"];

const EMPTY_OVERTONES_HTML = `
  <div style="text-align:center; font-size:13px; color:var(--text-dim); padding:8px 0;">
    Start listening, then strike the drum to see its frequency makeup.
  </div>`;

function overtoneRowsHtml(rows) {
  return rows
    .map(
      (row) => `
    <div class="overtone-row">
      <span class="harmonic-label">${row.label}</span>
      <span>${row.freq}</span>
      <span class="harmonic-label">${row.amp}</span>
    </div>`
    )
    .join("");
}

function livePeaksToRows(peaks) {
  return peaks.map((p, i) => ({
    label: ROW_LABELS[i] || `Overtone ${i + 1}`,
    freq: `${p.freq.toFixed(1)} Hz`,
    amp: `${p.ampPct}%`,
  }));
}

function drawGrid(ctx, w, h) {
  const styles = getComputedStyle(document.documentElement);
  const grid = styles.getPropertyValue("--border").trim() || "#34384a";
  ctx.strokeStyle = grid;
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (h / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function sizeCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function drawEmptySpectrum(canvas) {
  const { ctx, w, h } = sizeCanvas(canvas);
  drawGrid(ctx, w, h);
}

function drawLiveSpectrum(canvas, analyser) {
  const { ctx, w, h } = sizeCanvas(canvas);
  drawGrid(ctx, w, h);
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent-2").trim() || "#4da3ff";

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  // Only the low/mid range where drum fundamentals & early overtones live.
  const bins = Math.min(data.length, 120);
  const barW = w / bins;
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < bins; i++) {
    const barH = (data[i] / 255) * h * 0.95;
    ctx.fillRect(i * barW + 1, h - barH, Math.max(1, barW - 2), barH);
  }
  ctx.globalAlpha = 1;
}

export function renderAdvanced() {
  const listener = new PitchListener();
  let listening = false;
  let rafId = null;
  let overtoneTimer = null;

  const view = el(`
    <div class="section-title">FFT Spectrum <span class="badge-soon" id="fft-badge">Idle</span></div>
    <div class="analysis-canvas-wrap">
      <canvas id="fft-canvas"></canvas>
    </div>
    <div id="mic-error-slot"></div>
    <button class="btn btn-secondary" id="listen-toggle" style="margin-bottom:8px;">Start Listening</button>

    <div class="section-title">
      Overtone Series
      <button class="help-btn" id="overtone-help-btn" aria-label="What is the overtone series?">?</button>
    </div>
    <div class="help-box" id="overtone-help" hidden>
      Every drum note is a stack of frequencies, not just one. The
      <b>fundamental</b> is the lowest and is the pitch you actually tune —
      it should land near your target Hz. The rows below it are
      <b>overtones</b>: higher ways the head vibrates at the same time (on
      drums they aren't neat multiples of the fundamental like on a guitar
      string). How to use this: strike the drum and compare the fundamental
      against your target. If an overtone shows much louder than the
      fundamental, the head is likely uneven — go around the lugs and even
      them out. Comparing the pattern before and after tuning also shows how
      "ringy" vs. "focused" the drum has become.
    </div>
    <div class="card" id="overtone-card">
      ${EMPTY_OVERTONES_HTML}
    </div>

    <div class="section-title">Lug Consistency</div>
    <div class="card">
      ${generateLugs(8)
        .map((lug) => {
          const pct = lug.cents == null ? 0 : Math.max(6, 100 - Math.abs(lug.cents) * 2);
          const color =
            lug.status === "in-tune" ? "var(--green)" : lug.status === "slight" ? "var(--yellow)" : lug.status === "off" ? "var(--red)" : "var(--text-faint)";
          return `
          <div class="meter-row">
            <div class="meter-row-label"><span>Lug ${lug.id}</span><span>${lug.cents == null ? "—" : lug.cents + "¢"}</span></div>
            <div class="meter"><div class="meter-fill" style="width:${pct}%; background:${color};"></div></div>
          </div>`;
        })
        .join("")}
    </div>
  `);

  const canvas = qs(view, "#fft-canvas");
  drawEmptySpectrum(canvas);

  function loop() {
    if (!listening) return;
    drawLiveSpectrum(canvas, listener.getAnalyser());
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

  async function toggleListen() {
    const btn = qs(view, "#listen-toggle");
    if (listening) {
      // Freeze in place: the canvas keeps its last frame and the overtone
      // table keeps its most recent readings for reference.
      stopListening();
      btn.textContent = "Start Listening";
      qs(view, "#fft-badge").textContent = "Paused";
      return;
    }
    qs(view, "#mic-error-slot").innerHTML = "";
    try {
      await listener.start({ fftSize: 4096, onUpdate: () => {} });
      listening = true;
      registerCleanup(stopListening);
      btn.textContent = "Stop Listening";
      qs(view, "#fft-badge").textContent = "Live";
      rafId = requestAnimationFrame(loop);
      overtoneTimer = setInterval(() => {
        const peaks = findOvertones(listener.getAnalyser(), listener.getSampleRate(), 4);
        if (peaks.length) {
          qs(view, "#overtone-card").innerHTML = overtoneRowsHtml(livePeaksToRows(peaks));
        }
      }, 350);
    } catch (err) {
      qs(view, "#mic-error-slot").innerHTML = `<div class="mic-error">${micErrorMessage(err)}</div>`;
    }
  }

  qs(view, "#listen-toggle").addEventListener("click", toggleListen);
  qs(view, "#overtone-help-btn").addEventListener("click", () => {
    const box = qs(view, "#overtone-help");
    box.hidden = !box.hidden;
  });

  return view;
}
