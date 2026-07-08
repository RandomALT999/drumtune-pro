import { el, qs } from "../util.js";
import { registerCleanup } from "../main.js";
import { generateCrossOrder } from "../data.js";

// Camera-assisted overlay. Honest scope: this is an ALIGNMENT GUIDE, not
// object-tracked AR — the app can't actually detect the drum in the frame
// (that needs real computer vision). Instead it shows the live rear camera
// with a drum-circle guide the user lines up with their real drum: lug
// positions around the rim, the active lug highlighted in the cross/star
// tuning order, and a pulsing target for where to strike that lug. The guide
// is drag-to-move and size-adjustable so it can be fitted to any drum at any
// angle/distance.
function cameraErrorMessage(err) {
  if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return "Camera needs a secure connection (HTTPS). Open the hosted https:// link on your phone to use camera mode.";
  }
  if (err && err.name === "NotAllowedError") {
    return "Camera access was denied. Allow camera access in your browser settings, then tap Retry.";
  }
  if (err && err.name === "NotFoundError") {
    return "No camera was found on this device.";
  }
  return "Couldn't access the camera. Check your browser's camera permissions, then tap Retry.";
}

export function renderCamera(params = {}) {
  let lugCount = Math.min(12, Math.max(4, params.lugCount || 6));
  let order = generateCrossOrder(lugCount);
  let stepIndex = 0;
  let stream = null;
  let center = null; // { x, y } in px, drag-positioned
  let dragging = false;

  const view = el(`
    <div id="cam-wrap">
      <video id="cam-video" playsinline autoplay muted></video>
      <svg id="cam-overlay" xmlns="http://www.w3.org/2000/svg"></svg>
      <div id="cam-hint">Line the orange circle up with your drum — drag to move, use Size to fit.</div>
      <div id="cam-msg" hidden></div>
    </div>

    <div id="cam-controls">
      <div class="cam-row">
        <button class="btn btn-sm btn-secondary" id="cam-prev">◀ Prev</button>
        <div id="cam-lug-label"></div>
        <button class="btn btn-sm btn-secondary" id="cam-next">Next ▶</button>
      </div>
      <div class="cam-row">
        <label class="cam-ctl-label">Size</label>
        <input type="range" id="cam-size" min="55" max="94" value="76" />
      </div>
      <div class="cam-row">
        <label class="cam-ctl-label">Lugs</label>
        <div class="stepper cam-lugs">
          <button type="button" id="cam-lug-minus">−</button>
          <span class="stepper-value" id="cam-lug-count">${lugCount}</span>
          <button type="button" id="cam-lug-plus">+</button>
        </div>
      </div>
      <div class="cam-caption">
        <span class="cam-key lug"></span> Lugs · <span class="cam-key active"></span> tune this one next ·
        <span class="cam-key strike"></span> strike here (about an inch from the rim, in line with the lug).
        Hit the drum's center instead to hear its overall pitch.
      </div>
    </div>
  `);

  const wrap = qs(view, "#cam-wrap");
  const videoEl = qs(view, "#cam-video");
  const svg = qs(view, "#cam-overlay");
  const msg = qs(view, "#cam-msg");
  videoEl.muted = true;

  function size() {
    const r = wrap.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  function radius(w, h) {
    return Math.min(w, h) * 0.5 * (Number(qs(view, "#cam-size").value) / 100);
  }

  function renderOverlay() {
    const { w, h } = size();
    if (!w || !h) return;
    if (!center) center = { x: w / 2, y: h / 2 };
    const cx = Math.max(0, Math.min(w, center.x));
    const cy = Math.max(0, Math.min(h, center.y));
    const r = radius(w, h);
    const activeLug = order[stepIndex];

    let lugs = "";
    for (let i = 0; i < lugCount; i++) {
      const ang = (i / lugCount) * 2 * Math.PI - Math.PI / 2;
      const lx = cx + r * Math.cos(ang);
      const ly = cy + r * Math.sin(ang);
      const tx = cx + (r + 20) * Math.cos(ang);
      const ty = cy + (r + 20) * Math.sin(ang);
      const active = i + 1 === activeLug;
      lugs += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="${active ? 11 : 8}" class="cam-lug ${active ? "active" : ""}" />`;
      lugs += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" class="cam-lug-num ${active ? "active" : ""}">${i + 1}</text>`;
    }

    // Strike target: ~1 inch in from the rim, in line with the active lug —
    // where you actually tap to read/adjust that one lug's tension.
    const aAng = ((activeLug - 1) / lugCount) * 2 * Math.PI - Math.PI / 2;
    const sx = cx + r * 0.8 * Math.cos(aAng);
    const sy = cy + r * 0.8 * Math.sin(aAng);

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" class="cam-rim" />
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.9).toFixed(1)}" class="cam-head" />
      <circle cx="${cx}" cy="${cy}" r="4" class="cam-center" />
      ${lugs}
      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="15" class="cam-strike-ring" />
      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" class="cam-strike-dot" />
    `;
    qs(view, "#cam-lug-label").textContent = `Lug ${activeLug} · step ${stepIndex + 1} of ${lugCount}`;
  }

  function showMessage(text) {
    msg.hidden = false;
    msg.innerHTML = `<div>${text}</div><button class="btn btn-sm btn-secondary" id="cam-retry">Retry</button>`;
    qs(msg, "#cam-retry").addEventListener("click", startCamera);
  }

  async function startCamera() {
    msg.hidden = true;
    try {
      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("insecure-context");
      }
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      videoEl.srcObject = stream;
      await videoEl.play().catch(() => {});
    } catch (err) {
      showMessage(cameraErrorMessage(err));
    }
  }

  function stopAll() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    ro.disconnect();
  }

  // Drag the guide: press/drag anywhere on the overlay moves the circle there.
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    try {
      svg.setPointerCapture(e.pointerId);
    } catch (err) {
      /* capture unsupported */
    }
    moveTo(e);
  });
  svg.addEventListener("pointermove", (e) => {
    if (dragging) moveTo(e);
  });
  svg.addEventListener("pointerup", (e) => {
    dragging = false;
    try {
      svg.releasePointerCapture(e.pointerId);
    } catch (err) {
      /* no-op */
    }
  });
  function moveTo(e) {
    const rect = wrap.getBoundingClientRect();
    center = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    renderOverlay();
  }

  qs(view, "#cam-prev").addEventListener("click", () => {
    stepIndex = (stepIndex - 1 + lugCount) % lugCount;
    renderOverlay();
  });
  qs(view, "#cam-next").addEventListener("click", () => {
    stepIndex = (stepIndex + 1) % lugCount;
    renderOverlay();
  });
  qs(view, "#cam-size").addEventListener("input", renderOverlay);

  function setLugCount(n) {
    lugCount = Math.min(12, Math.max(4, n));
    order = generateCrossOrder(lugCount);
    stepIndex = Math.min(stepIndex, lugCount - 1);
    qs(view, "#cam-lug-count").textContent = lugCount;
    renderOverlay();
  }
  qs(view, "#cam-lug-minus").addEventListener("click", () => setLugCount(lugCount - 1));
  qs(view, "#cam-lug-plus").addEventListener("click", () => setLugCount(lugCount + 1));

  // Overlay needs the container's real pixel size, which isn't known until
  // the view is in the DOM and laid out — render on the first sized callback
  // and on every resize/rotate.
  const ro = new ResizeObserver(() => renderOverlay());
  ro.observe(wrap);

  registerCleanup(stopAll);
  startCamera();

  return view;
}
