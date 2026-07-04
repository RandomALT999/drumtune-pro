import { el } from "../util.js";

export function renderCamera() {
  const view = el(`
    <div class="camera-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="7" width="18" height="13" rx="2"/>
        <path d="M8 7l1.5-2.5h5L16 7"/>
        <circle cx="12" cy="13.5" r="3.5"/>
      </svg>
      <div style="font-weight:600; color:var(--text);">Camera-Assisted Mode — Planned</div>
      <div>AR overlay of lug numbers on the live camera feed, with the target lug glowing when prompted. Not implemented in this UI skeleton.</div>
    </div>
    <button class="btn btn-secondary" disabled>Enable Camera</button>
  `);
  return view;
}
