import { el, qs, qsa, headerHtml, wireHeader, escapeHtml, PLAY_ICON } from "../util.js";
import { navigate } from "../main.js";
import { getKit, genrePresets } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";
import { beginKitTuning } from "./tuningShared.js";
import { loadSession } from "../storage.js";

const TYPE_COLOR = {
  "rack-tom": "var(--accent)",
  "floor-tom": "#c96a3c",
  snare: "var(--blue)",
  "bass-drum": "#7d6bd6",
};

export function renderPresetDetail(params) {
  const kit = getKit(params.kitId);
  if (!kit) {
    return el(`<div class="scrolls"><div class="empty-note" style="padding-top:40px">That kit isn't around any more.</div></div>`, {
      scrolls: true,
    });
  }

  const session = loadSession();
  const currentIndex = session && session.kitId === kit.id ? session.index : -1;
  const hz = kit.pieces.map((p) => p.target);
  const maxHz = Math.max(...hz, 1);

  const view = el(
    `
    ${headerHtml({ label: "kit", action: "Edit kit" })}
    <div style="flex:none;padding:0 0 2px">
      <div class="screen-title-lg">${escapeHtml(kit.name)}</div>
      <div class="blurb" style="margin-top:9px">${escapeHtml(kit.tag || "")}</div>
    </div>

    <div class="eyebrow" style="flex:none;margin-top:22px">Pieces</div>
    <div class="rows" style="flex:none;margin-top:3px">
      ${kit.pieces
        .map((p, i) => {
          const status =
            currentIndex > i
              ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="3" stroke-linecap="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`
              : currentIndex === i
              ? `<span class="status-dot"></span>`
              : `<span class="meta">${i + 1}</span>`;
          return `
          <div class="row row-sm" style="align-items:center">
            <span class="status-col">${status}</span>
            <span style="flex:1;min-width:0">
              <span class="row-title" style="display:block">${escapeHtml(p.label)}</span>
              <span class="meta">${p.lugCount} lugs · ${p.target} Hz</span>
            </span>
            <button class="icon-circle sm" data-preview="${i}" aria-label="Preview ${escapeHtml(p.label)}">${PLAY_ICON}</button>
          </div>`;
        })
        .join("")}
    </div>

    <div class="card" style="flex:none;margin-top:20px">
      <div class="eyebrow">Pitch spread</div>
      <div style="display:flex;align-items:flex-end;gap:8px;height:82px;margin-top:14px">
        ${kit.pieces
          .map(
            (p, i) => `
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;height:100%;justify-content:flex-end">
            <div class="bar-rise" style="width:100%;height:${Math.max(8, (p.target / maxHz) * 100)}%;border-radius:4px 4px 0 0;background:${
              TYPE_COLOR[p.drumType] || "var(--accent)"
            };animation-delay:${i * 60}ms"></div>
          </div>`
          )
          .join("")}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${kit.pieces.map((p) => `<span class="meta" style="flex:1;text-align:center">${p.target}</span>`).join("")}
      </div>
    </div>

    <div class="spacer"></div>
    <div class="footer-actions">
      <button class="pill" id="start-kit">${currentIndex > 0 ? "Resume kit" : "Start tuning kit"}</button>
    </div>
  `,
    { scrolls: true }
  );

  wireHeader(view, {
    onAction: () => navigate("kit-builder", { mode: "edit", kitId: kit.id }),
  });

  qsa(view, "[data-preview]").forEach((b) =>
    b.addEventListener("click", () => {
      const p = kit.pieces[Number(b.dataset.preview)];
      playToneForDrumType(p.drumType, p.target);
    })
  );

  qs(view, "#start-kit").addEventListener("click", () => {
    if (currentIndex > 0) {
      const p = kit.pieces[currentIndex];
      navigate(p.drumType === "snare" ? "snare-tuning" : "tuning", {
        kitId: kit.id,
        kitIndex: currentIndex,
        drumType: p.drumType,
        size: p.size,
        lugCount: p.lugCount,
        target: p.target,
      });
      return;
    }
    beginKitTuning(kit);
  });

  return view;
}
