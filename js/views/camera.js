import { el, qs } from "../util.js";
import { registerCleanup } from "../main.js";
import { starSteps } from "./tuningShared.js";

// Camera-assisted overlay. Honest scope: this is an ALIGNMENT GUIDE, not
// object-tracked AR — the app can't detect the actual drum in the frame
// (that needs real computer vision). It shows the live rear camera with a
// drum-circle guide the user lines up with their real drum: lug positions
// numbered in the cross/star turning order, and the strike target at the
// CENTER of the head, matching the tuning method (strike center, then turn
// every lug by the same amount in the numbered order).
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
        <span class="cam-key strike"></span> Strike the <b>center</b> to measure ·
        <span class="cam-key lug"></span> the numbers are the order to turn the lugs —
        turn every one by the same amount each round.
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

  function renderOverlay() {
    const { w, h } = size();
    if (!w || !h) return;
    if (!center) center = { x: w / 2, y: h / 2 };
    const cx = Math.max(0, Math.min(w, center.x));
    const cy = Math.max(0, Math.min(h, center.y));
    const r = Math.min(w, h) * 0.5 * (Number(qs(view, "#cam-size").value) / 100);
    const steps = starSteps(lugCount);

    let lugs = "";
    for (let i = 0; i < lugCount; i++) {
      const ang = (i / lugCount) * 2 * Math.PI - Math.PI / 2;
      const lx = cx + r * Math.cos(ang);
      const ly = cy + r * Math.sin(ang);
      lugs += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="13" class="cam-lug active" />`;
      lugs += `<text x="${lx.toFixed(1)}" y="${(ly + 1).toFixed(1)}" class="cam-lug-num">${steps.get(i + 1)}</text>`;
    }

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = `
      <circle cx="${cx}" cy="${cy}" r="${r}" class="cam-rim" />
      <circle cx="${cx}" cy="${cy}" r="${(r * 0.9).toFixed(1)}" class="cam-head" />
      <circle cx="${cx}" cy="${cy}" r="${Math.max(18, r * 0.22).toFixed(1)}" class="cam-strike-ring" />
      <circle cx="${cx}" cy="${cy}" r="5" class="cam-strike-dot" />
      ${lugs}
    `;
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

  qs(view, "#cam-size").addEventListener("input", renderOverlay);

  function setLugCount(n) {
    lugCount = Math.min(12, Math.max(4, n));
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
