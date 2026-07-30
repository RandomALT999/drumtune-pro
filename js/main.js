import { renderHome } from "./views/home.js";
import { renderDrumSetup } from "./views/drumSetup.js";
import { renderTuning } from "./views/tuning.js";
import { renderSnareTuning } from "./views/snareTuning.js";
import { renderSoundPreview } from "./views/soundPreview.js";
import { renderPresetDetail } from "./views/presetDetail.js";
import { renderKitBuilder } from "./views/kitBuilder.js";
import { renderKitComplete } from "./views/kitComplete.js";
import { renderKits } from "./views/kits.js";
import { renderAdvanced } from "./views/advanced.js";
import { renderMore } from "./views/more.js";
import { installAudioUnlock } from "./audio/unlockAudio.js";

installAudioUnlock();

// The tab bar shows only on these four. Tuning and Setup are focus modes —
// hiding the bar is what buys the vertical room for the 72px readout; you
// leave them via the back chevron in the view's own header.
const TAB_ROUTES = new Set(["home", "kits", "presets", "advanced", "more"]);

const routes = {
  home: renderHome,
  "drum-setup": renderDrumSetup,
  tuning: renderTuning,
  "snare-tuning": renderSnareTuning,
  "sound-preview": renderSoundPreview,
  // The old Presets tab is absorbed by Kits; keep the hash working.
  presets: renderKits,
  "preset-detail": renderPresetDetail,
  "kit-builder": renderKitBuilder,
  "kit-complete": renderKitComplete,
  kits: renderKits,
  advanced: renderAdvanced,
  more: renderMore,
};

const viewRoot = document.getElementById("view-root");
const bottomNav = document.getElementById("bottom-nav");

export function navigate(routeId, params = {}, opts = {}) {
  const state = { route: routeId, params };
  if (opts.replace) window.history.replaceState(state, "", "#" + routeId);
  else window.history.pushState(state, "", "#" + routeId);
  render(routeId, params);
}

export function goBack() {
  window.history.back();
}

// Screens that start a mic listener or an animation loop register a teardown
// here so switching routes always releases the mic instead of leaving it
// running in the background.
let activeCleanup = null;
export function registerCleanup(fn) {
  activeCleanup = fn;
}

window.addEventListener("popstate", (e) => {
  const state = e.state || { route: location.hash.replace("#", "") || "home", params: {} };
  render(state.route, state.params || {});
});

function render(routeId, params) {
  if (activeCleanup) {
    try {
      activeCleanup();
    } catch (e) {
      /* ignore teardown errors */
    }
    activeCleanup = null;
  }

  const view = routes[routeId] || routes.home;
  const isTab = TAB_ROUTES.has(routeId);
  bottomNav.style.display = isTab ? "flex" : "none";

  viewRoot.innerHTML = "";
  const el = view(params);
  if (el) viewRoot.appendChild(el);
  viewRoot.scrollTop = 0;

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    // #presets is an alias for Kits, so light the Kits tab for it too.
    const active = btn.dataset.route === routeId || (btn.dataset.route === "kits" && routeId === "presets");
    btn.classList.toggle("active", active);
  });
}

bottomNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (!btn) return;
  navigate(btn.dataset.route);
});

const initial = location.hash.replace("#", "") || "home";
window.history.replaceState({ route: initial, params: {} }, "", "#" + initial);
render(initial, {});
