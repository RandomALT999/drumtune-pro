import { el } from "../util.js";

export function renderAbout() {
  const view = el(`
    <div class="card">
      <div style="font-weight:700; font-size:18px; margin-bottom:4px;">DrumTune Pro</div>
      <div style="color:var(--text-dim); font-size:14px;">
        A web app that helps drummers tune toms and snares by listening to individual
        lug pitches and guiding tightening/loosening adjustments visually — like a
        guitar tuner, but for drums.
      </div>
    </div>

    <div class="section-title">How to Use</div>
    <ul class="about-list">
      <li><b>1. Set up your drum.</b> Choose drum type, diameter, and lug count.</li>
      <li><b>2. Tap a lug</b> near the drumhead and let the app listen.</li>
      <li><b>3. Follow the guidance.</b> Green means in tune; tighten or loosen as shown.</li>
      <li><b>4. Use Guided Mode</b> to work through lugs in the correct cross pattern.</li>
    </ul>

    <div class="section-title">Video Presentation</div>
    <div class="card" style="display:flex; align-items:center; justify-content:space-between;">
      <span style="font-size:14px; color:var(--text-dim);">Unlisted YouTube link — added at submission</span>
      <span class="badge-soon">Pending</span>
    </div>

    <div class="section-title">Maine App Challenge</div>
    <div class="disclosure-box">
      Built with Claude Code as a development tool. No AI is embedded at runtime in
      this app — sound-style presets use static, pre-programmed lookup tables rather
      than live model calls.
    </div>
  `);
  return view;
}
