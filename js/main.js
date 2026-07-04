import { renderHome } from "./views/home.js";
import { renderDrumSetup } from "./views/drumSetup.js";
import { renderTuning } from "./views/tuning.js";
import { renderSnareTuning } from "./views/snareTuning.js";
import { renderGuidedTuning } from "./views/guidedTuning.js";
import { renderSoundPreview } from "./views/soundPreview.js";
import { renderPresets } from "./views/presets.js";
import { renderPresetDetail } from "./views/presetDetail.js";
import { renderKitBuilder } from "./views/kitBuilder.js";
import { renderKitComplete } from "./views/kitComplete.js";
import { renderKits } from "./views/kits.js";
import { renderAdvanced } from "./views/advanced.js";
import { renderCamera } from "./views/camera.js";
import { renderAbout } from "./views/about.js";

const TOP_LEVEL_ROUTES = new Set(["home", "presets", "kits", "advanced"]);

const routes = {
  home: { title: "DrumTune Pro", render: renderHome },
  "drum-setup": { title: "Drum Setup", render: renderDrumSetup },
  tuning: { title: "Tuning", render: renderTuning },
  "snare-tuning": { title: "Snare Tuning", render: renderSnareTuning },
  "guided-tuning": { title: "Guided Tuning", render: renderGuidedTuning },
  "sound-preview": { title: "Sound Preview", render: renderSoundPreview },
  presets: { title: "Tuning Presets", render: renderPresets },
  "preset-detail": { title: "Kit Preview", render: renderPresetDetail },
  "kit-builder": {
    title: "Build Kit",
    render: renderKitBuilder,
    dynamicTitle: (p) => (p.mode === "edit" ? "Edit Kit" : "Tune All Drums"),
  },
  "kit-complete": { title: "Kit Complete", render: renderKitComplete },
  kits: { title: "Saved Kits", render: renderKits },
  advanced: { title: "Frequency Analysis", render: renderAdvanced },
  camera: { title: "Camera Mode", render: renderCamera },
  about: { title: "About", render: renderAbout },
};

const viewRoot = document.getElementById("view-root");
const appTitle = document.getElementById("app-title");
const backBtn = document.getElementById("back-btn");
const aboutBtn = document.getElementById("about-btn");
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

// Screens that start a mic listener or a speech/animation loop register a
// teardown here so switching routes always releases the mic instead of
// leaving it running in the background.
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

  const entry = routes[routeId] || routes.home;
  appTitle.textContent = entry.dynamicTitle ? entry.dynamicTitle(params) : entry.title;
  backBtn.hidden = TOP_LEVEL_ROUTES.has(routeId);
  bottomNav.style.display = TOP_LEVEL_ROUTES.has(routeId) ? "flex" : "none";

  viewRoot.innerHTML = "";
  const el = entry.render(params);
  if (el) viewRoot.appendChild(el);
  viewRoot.scrollTop = 0;

  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === routeId);
  });
}

backBtn.addEventListener("click", goBack);
aboutBtn.addEventListener("click", () => navigate("about"));
bottomNav.addEventListener("click", (e) => {
  const btn = e.target.closest(".nav-btn");
  if (!btn) return;
  navigate(btn.dataset.route);
});

const initial = location.hash.replace("#", "") || "home";
window.history.replaceState({ route: initial, params: {} }, "", "#" + initial);
render(initial, {});
