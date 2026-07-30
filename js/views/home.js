import { el, qs, qsa, escapeHtml, CHEVRON } from "../util.js";
import { navigate } from "../main.js";
import { genrePresets, getKit } from "../data.js";
import { loadSession, clearSession } from "../storage.js";

const ONE_DRUM = [
  { drum: "rack-tom", label: "Rack tom", hint: '10–14"' },
  { drum: "floor-tom", label: "Floor tom", hint: '14–18"' },
  { drum: "snare", label: "Snare", hint: "+ wires" },
  { drum: "bass-drum", label: "Bass drum", hint: '18–24"' },
  { drum: "custom", label: "Custom", hint: "your Hz", dim: true },
];

function relativeTime(ts) {
  if (!ts) return "";
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// Renders only when a kit session is actually in progress; otherwise the same
// top/bottom hairline rules carry an empty state.
function resumeBlockHtml(session) {
  if (!session) {
    return `
      <div class="hairline-block" style="flex:none;margin-top:18px">
        <div class="eyebrow">Nothing in progress</div>
        <div class="empty-note" style="margin-top:8px">Pick a drum to tune one head, or build a kit to work through several in order.</div>
      </div>`;
  }
  const { kit, index } = session;
  const segs = kit.pieces
    .map((_, i) => `<i class="${i < index ? "done" : i === index ? "current" : ""}"></i>`)
    .join("");
  const next = kit.pieces[index];
  return `
    <div class="hairline-block" style="flex:none;margin-top:18px;padding:15px 0 17px">
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="eyebrow accent">Half-tuned</span>
        <span class="meta">${escapeHtml(relativeTime(session.at))}</span>
      </div>
      <div style="font:700 25px 'Space Grotesk',sans-serif;letter-spacing:-.03em;margin-top:8px">${escapeHtml(kit.name)}</div>
      <div style="display:flex;align-items:center;gap:11px;margin-top:12px">
        <div class="progress-strip">${segs}</div>
        <span style="font:500 11px 'Space Grotesk',sans-serif;color:var(--text-dim)">${index} of ${kit.pieces.length}</span>
      </div>
      <button class="pill sm" id="resume-btn" style="margin-top:15px">Continue · ${escapeHtml(next.label)}</button>
    </div>`;
}

export function renderHome() {
  const raw = loadSession();
  let session = null;
  if (raw) {
    const kit = getKit(raw.kitId);
    // A saved session can outlive its kit (deleted, or a session kit lost on
    // reload) — drop it rather than rendering a broken resume card.
    if (kit && raw.index < kit.pieces.length) session = { ...raw, kit, index: raw.index };
    else clearSession();
  }

  const view = el(
    `
    <div style="flex:none;display:flex;align-items:flex-start;justify-content:space-between">
      <div class="screen-title">Ready when<br><span class="dim">you are.</span></div>
      <button id="info-btn" aria-label="About" style="flex:none;width:34px;height:34px;margin-top:4px;border:none;background:transparent;padding:0;cursor:pointer;display:flex;align-items:center;justify-content:center">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#4a4f60" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-5"/><path d="M12 8h.01"/></svg>
      </button>
    </div>

    ${resumeBlockHtml(session)}

    <div class="eyebrow" style="flex:none;margin-top:17px">One drum</div>
    <div class="rows" style="flex:none;margin-top:3px">
      ${ONE_DRUM.map(
        (d) => `
        <button class="row" data-drum="${d.drum}">
          <span class="row-title${d.dim ? " dim" : ""}">${escapeHtml(d.label)}</span>
          <span class="meta">${escapeHtml(d.hint)}</span>
          ${CHEVRON}
        </button>`
      ).join("")}
    </div>

    <div class="eyebrow" style="flex:none;margin-top:20px;margin-bottom:11px">Or a whole kit</div>
    <div class="chips" style="flex:none">
      ${genrePresets
        .slice(0, 4)
        .map((g) => `<button class="chip" data-kit="${g.id}">${escapeHtml(g.name.replace(" Kit", ""))}</button>`)
        .join("")}
      <button class="chip dashed" id="build-chip"><span class="plus">+</span>Build</button>
    </div>
    <div class="spacer"></div>
  `,
    { scrolls: true }
  );

  qsa(view, "[data-drum]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const drum = btn.dataset.drum;
      if (drum === "snare") navigate("drum-setup", { drum: "snare" });
      else navigate("drum-setup", { drum, mode: drum === "custom" ? "custom" : undefined });
    })
  );

  qsa(view, "[data-kit]").forEach((btn) =>
    btn.addEventListener("click", () => navigate("preset-detail", { kitId: btn.dataset.kit }))
  );

  qs(view, "#build-chip").addEventListener("click", () => navigate("kit-builder", { mode: "new" }));
  qs(view, "#info-btn").addEventListener("click", () => navigate("more"));

  const resume = qs(view, "#resume-btn");
  if (resume && session) {
    resume.addEventListener("click", () => {
      const piece = session.kit.pieces[session.index];
      navigate(piece.drumType === "snare" ? "snare-tuning" : "tuning", {
        kitId: session.kitId,
        kitIndex: session.index,
        drumType: piece.drumType,
        size: piece.size,
        lugCount: piece.lugCount,
        target: piece.target,
      });
    });
  }

  return view;
}
