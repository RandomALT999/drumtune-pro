import { el, qs, escapeHtml } from "../util.js";
import { navigate } from "../main.js";
import { getKit } from "../data.js";
import { upsertSavedKit, clearSession } from "../storage.js";

export function renderKitComplete(params) {
  const kit = getKit(params.kitId);

  const view = el(
    `
    <div style="flex:none;padding-top:38px;text-align:center">
      <svg class="turn-glyph check" viewBox="0 0 48 48" style="width:64px;height:64px;color:var(--green)" aria-hidden="true">
        <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" stroke-width="2" stroke-opacity=".45"/>
        <path d="M15 24.5l6.5 6.5L33 18" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <div class="screen-title-lg" style="margin-top:20px">That's the<br>whole kit.</div>
      <div class="blurb" style="margin-top:11px">Every head was measured from the centre and every lug turned the same amount, so the drums should sit evenly together.</div>
    </div>

    ${
      kit
        ? `<div class="eyebrow" style="flex:none;margin-top:26px">Final pitches</div>
           <div class="rows" style="flex:none;margin-top:3px">
             ${kit.pieces
               .map(
                 (p) => `
               <div class="row row-sm">
                 <span class="row-title">${escapeHtml(p.label)}</span>
                 <span class="meta" style="color:var(--green)">${p.target} Hz</span>
               </div>`
               )
               .join("")}
           </div>`
        : ""
    }

    <div class="spacer"></div>
    <div class="footer-actions">
      ${kit ? `<button class="pill" id="save-btn">Save these settings</button>` : ""}
      <button class="pill ghost" id="done-btn">Done</button>
    </div>
  `,
    { scrolls: true }
  );

  clearSession();

  const save = qs(view, "#save-btn");
  if (save && kit) {
    save.addEventListener("click", () => {
      upsertSavedKit({
        id: String(kit.id).startsWith("saved-") ? kit.id : `saved-${Date.now()}`,
        name: kit.name,
        tag: kit.tag,
        styleId: kit.styleId,
        pieces: kit.pieces,
        tunedCount: kit.pieces.length,
      });
      save.textContent = "Saved ✓";
      save.disabled = true;
      save.classList.add("is-disabled");
    });
  }

  qs(view, "#done-btn").addEventListener("click", () => navigate("home", {}, { replace: true }));

  return view;
}
