import { el, qsa } from "../util.js";
import { navigate } from "../main.js";
import { loadSavedKits } from "../storage.js";

export function renderHome() {
  const kitCount = (loadSavedKits() || []).length;

  const view = el(`
    <div class="section-title">Quick Tune</div>
    <button class="tap-card" data-route="drum-setup" data-drum="rack-tom">
      <div class="emoji-badge">🥁</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Tune Rack Tom</div>
        <div class="tap-card-sub">Pick size &amp; lug count</div>
      </div>
      <div class="chevron">›</div>
    </button>
    <button class="tap-card" data-route="drum-setup" data-drum="floor-tom">
      <div class="emoji-badge">🥁</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Tune Floor Tom</div>
        <div class="tap-card-sub">Larger FFT window for low end</div>
      </div>
      <div class="chevron">›</div>
    </button>
    <button class="tap-card" data-route="drum-setup" data-drum="snare">
      <div class="emoji-badge">🎯</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Tune Snare</div>
        <div class="tap-card-sub">Includes wire balance check</div>
      </div>
      <div class="chevron">›</div>
    </button>
    <button class="tap-card" data-route="drum-setup" data-mode="custom">
      <div class="emoji-badge">⚙️</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Custom Tuning</div>
        <div class="tap-card-sub">Pick a drum, set your own target Hz</div>
      </div>
      <div class="chevron">›</div>
    </button>
    <button class="tap-card" data-route="kit-builder" data-mode="new">
      <div class="emoji-badge">🎚️</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Tune All Drums</div>
        <div class="tap-card-sub">Build your kit, then tune every piece in sequence</div>
      </div>
      <div class="chevron">›</div>
    </button>

    <div class="section-title">Your Kits</div>
    <button class="tap-card" data-route="kits">
      <div class="emoji-badge">💾</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Saved Drum Kits</div>
        <div class="tap-card-sub">${kitCount} kit${kitCount === 1 ? "" : "s"} saved</div>
      </div>
      <div class="chevron">›</div>
    </button>

    <div class="section-title">Explore</div>
    <button class="tap-card" data-route="camera">
      <div class="emoji-badge">📷</div>
      <div class="tap-card-body">
        <div class="tap-card-title">Camera-Assisted Mode</div>
        <div class="tap-card-sub">Line up lugs &amp; strike points on the live camera</div>
      </div>
      <div class="chevron">›</div>
    </button>
  `);

  qsa(view, "[data-route]").forEach((btn) => {
    btn.addEventListener("click", () => {
      navigate(btn.dataset.route, { drum: btn.dataset.drum, mode: btn.dataset.mode });
    });
  });

  return view;
}
