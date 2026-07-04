import { el, qs } from "../util.js";
import { registerCleanup } from "../main.js";
import { overtoneRows, generateLugs } from "../data.js";
import { PitchListener, micErrorMessage } from "../audio/pitchListener.js";
import { findOvertones } from "../audio/fftPeaks.js";

const HARMONIC_LABELS = ["Fundamental", "2nd Harmonic", "3rd Harmonic", "4th Harmonic", "5th Harmonic"];

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
    label: HARMONIC_LABELS[i] || `${i + 1}th Harmonic`,
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

// Static placeholder curve, shown until the user opts into live listening.
function drawMockSpectrum(canvas) {
  const { ctx, w, h } = sizeCanvas(canvas);
  drawGrid(ctx, w, h);
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent-2").trim() || "#4da3ff";
  const peaks = [0.15, 0.95, 0.4, 0.62, 0.22, 0.3, 0.18, 0.5, 0.12, 0.2];
  const barW = w / peaks.length;
  ctx.fillStyle = accent;
  peaks.forEach((p, i) => {
    const barH = p * h * 0.9;
    ctx.globalAlpha = i === 1 ? 1 : 0.55;
    ctx.fillRect(i * barW + 3, h - barH, barW - 6, barH);
  });
  ctx.globalAlpha = 1;
}

function drawLiveSpectrum(canvas, analyser) {
  const { ctx, w, h } = sizeCanvas(canvas);
  drawGrid(ctx, w, h);
  const styles = getComputedStyle(document.documentElement);
  const accent = styles.getPropertyValue("--accent-2").trim() || "#4da3ff";

  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  // Only the low/mid range where drum fundamentals & early harmonics live.
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
    <div class="section-title">FFT Spectrum <span class="badge-soon" id="fft-badge">Mock data</span></div>
    <div class="analysis-canvas-wrap">
      <canvas id="fft-canvas"></canvas>
    </div>
    <div id="mic-error-slot"></div>
    <button class="btn btn-secondary" id="listen-toggle" style="margin-bottom:8px;">Start Listening</button>

    <div class="section-title">Overtone Series</div>
    <div class="card" id="overtone-card">
      ${overtoneRowsHtml(overtoneRows)}
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
  drawMockSpectrum(canvas);

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
      stopListening();
      btn.textContent = "Start Listening";
      qs(view, "#fft-badge").textContent = "Mock data";
      drawMockSpectrum(canvas);
      qs(view, "#overtone-card").innerHTML = overtoneRowsHtml(overtoneRows);
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

  return view;
}
