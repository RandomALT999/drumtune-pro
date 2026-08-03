import { el, qs, qsa, headerHtml, wireHeader, escapeHtml, CHEVRON } from "../util.js";
import { navigate } from "../main.js";
import { drumTypes, soundPresets, genrePresets, targetFrequencyFor, getKit, registerSessionKit } from "../data.js";
import { upsertSavedKit } from "../storage.js";
import { beginKitTuning } from "./tuningShared.js";

const ADD_TYPES = [
  { id: "rack-tom", label: "Rack tom" },
  { id: "floor-tom", label: "Floor tom" },
  { id: "snare", label: "Snare" },
  { id: "bass-drum", label: "Bass" },
];
const LUG_CHOICES = [4, 6, 8, 10, 12];

function typeMeta(id) {
  return drumTypes.find((d) => d.id === id) || drumTypes[0];
}

export function renderKitBuilder(params) {
  const isEdit = params.mode === "edit" && params.kitId;
  const source = isEdit ? getKit(params.kitId) : null;
  const isBuiltIn = isEdit && genrePresets.some((k) => k.id === params.kitId);

  let uid = 0;
  let pieces = source
    ? source.pieces.map((p) => ({ uid: uid++, drumType: p.drumType, size: p.size, lugCount: p.lugCount }))
    : [];
  let styleId = params.styleId || source?.styleId || "balanced";
  let openUid = null; // which piece row is expanded for editing

  const view = el(
    `
    ${headerHtml({ label: isEdit ? "edit kit" : "new kit", action: "Save kit" })}
    <div style="flex:none">
      <input id="kit-name" class="screen-title-lg" placeholder="Untitled kit"
        value="${escapeHtml(source ? (isBuiltIn ? `${source.name} (edited)` : source.name) : "")}"
        style="width:100%;background:transparent;border:none;padding:0;color:var(--text);outline:none" />
      <div class="blurb" id="summary" style="margin-top:9px"></div>
    </div>

    <div style="flex:none;display:flex;align-items:baseline;justify-content:space-between;margin-top:24px">
      <span class="eyebrow">Tuning order</span>
      <span class="meta" id="order-hint">tap a drum to edit</span>
    </div>
    <div id="pieces" style="flex:none;margin-top:3px"></div>

    <div class="chips" style="flex:none;margin-top:14px">
      ${ADD_TYPES.map((t) => `<button class="chip dashed" data-add="${t.id}"><span class="plus">+</span>${escapeHtml(t.label)}</button>`).join("")}
    </div>

    <button class="field-row field last" id="sound-row" style="flex:none;margin-top:22px">
      <span class="field-label">Sound · whole kit</span>
      <span class="field-value" id="style-value"></span>
      ${CHEVRON}
    </button>

    <div class="spacer"></div>
    <div class="footer-actions">
      <button class="pill" id="start-btn">Start tuning kit</button>
    </div>
  `,
    { scrolls: true }
  );

  function buildPieces() {
    return pieces.map((p, i) => {
      const meta = typeMeta(p.drumType);
      return {
        id: `${p.drumType}-${i + 1}`,
        label: `${p.size}" ${meta.label}`,
        drumType: p.drumType,
        size: p.size,
        lugCount: p.lugCount,
        target: targetFrequencyFor(p.drumType, p.size, styleId),
      };
    });
  }

  function kitObject() {
    const chosen = soundPresets.find((s) => s.id === styleId);
    return {
      // Editing a built-in preset forks a copy rather than mutating it.
      id: isEdit && !isBuiltIn ? source.id : `custom-${Date.now()}`,
      name: (qs(view, "#kit-name").value || "").trim() || "Untitled kit",
      tag: chosen?.tag || "",
      styleId,
      pieces: buildPieces(),
    };
  }

  function pieceRowHtml(p, i) {
    const meta = typeMeta(p.drumType);
    const hz = targetFrequencyFor(p.drumType, p.size, styleId);
    const open = p.uid === openUid;
    return `
      <div class="piece" data-uid="${p.uid}">
        <div class="row row-sm piece-head" style="align-items:center" data-toggle="${p.uid}" role="button" tabindex="0">
          <span class="drag-handle" data-drag="${p.uid}" aria-label="Reorder ${escapeHtml(meta.label)}"><i></i><i></i><i></i></span>
          <span style="flex:1;min-width:0">
            <span class="row-title" style="display:block">${p.size}" ${escapeHtml(meta.label)}</span>
            <span class="meta">${p.lugCount} lugs · ${hz} Hz</span>
          </span>
          <svg class="chev piece-chev${open ? " open" : ""}" viewBox="0 0 24 24" fill="none" stroke-width="2.4" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
          <button class="x-btn" data-del="${i}" aria-label="Remove">✕</button>
        </div>
        ${
          open
            ? `<div class="piece-editor">
                 <div class="field-label" style="margin-bottom:9px">Diameter</div>
                 <div class="seg">
                   ${meta.sizes.map((s) => `<button data-size="${s}" class="${s === p.size ? "on" : ""}">${s}</button>`).join("")}
                 </div>
                 <div class="field-label" style="margin:14px 0 9px">Lugs</div>
                 <div class="seg lugs">
                   ${LUG_CHOICES.map((n) => `<button data-lug="${n}" class="${n === p.lugCount ? "on" : ""}">${n}</button>`).join("")}
                 </div>
               </div>`
            : ""
        }
      </div>`;
  }

  function paint() {
    const host = qs(view, "#pieces");
    if (pieces.length === 0) {
      host.innerHTML = `<div class="empty-note" style="padding:6px 0 2px">Add the drums you want to work through. They're tuned top to bottom.</div>`;
      qs(view, "#order-hint").textContent = "";
    } else {
      host.innerHTML = pieces.map(pieceRowHtml).join("");
      qs(view, "#order-hint").textContent = pieces.length > 1 ? "drag to reorder" : "tap a drum to edit";
      wirePieces(host);
    }

    qs(view, "#summary").textContent = pieces.length
      ? `${pieces.length} piece${pieces.length === 1 ? "" : "s"} · one sound across the kit`
      : "Nothing added yet.";
    qs(view, "#style-value").textContent = soundPresets.find((s) => s.id === styleId)?.name || "Balanced";

    const start = qs(view, "#start-btn");
    start.disabled = pieces.length === 0;
    start.classList.toggle("is-disabled", pieces.length === 0);
  }

  function wirePieces(host) {
    qsa(host, "[data-del]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const removed = pieces[Number(b.dataset.del)];
        if (removed && removed.uid === openUid) openUid = null;
        pieces.splice(Number(b.dataset.del), 1);
        paint();
      })
    );
    qsa(host, "[data-toggle]").forEach((r) =>
      r.addEventListener("click", (e) => {
        if (e.target.closest("[data-del]") || e.target.closest("[data-drag]")) return;
        const u = Number(r.dataset.toggle);
        openUid = openUid === u ? null : u;
        paint();
      })
    );
    qsa(host, ".piece-editor [data-size]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = pieces.find((x) => x.uid === openUid);
        if (p) p.size = Number(b.dataset.size);
        paint();
      })
    );
    qsa(host, ".piece-editor [data-lug]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const p = pieces.find((x) => x.uid === openUid);
        if (p) p.lugCount = Number(b.dataset.lug);
        paint();
      })
    );
    qsa(host, "[data-drag]").forEach((h) => h.addEventListener("pointerdown", startDrag));
  }

  // Pointer-based reorder so the drag handle actually does what it looks like
  // it does. Rows swap as you pass their midpoint.
  function startDrag(e) {
    e.preventDefault();
    e.stopPropagation();
    const host = qs(view, "#pieces");
    const uidDragged = Number(e.currentTarget.dataset.drag);
    const handle = e.currentTarget;
    try {
      handle.setPointerCapture(e.pointerId);
    } catch (err) {
      /* capture unsupported */
    }
    const rowOf = (u) => host.querySelector(`.piece[data-uid="${u}"]`);
    rowOf(uidDragged)?.classList.add("dragging");

    const move = (ev) => {
      const from = pieces.findIndex((p) => p.uid === uidDragged);
      const rows = qsa(host, ".piece");
      for (let i = 0; i < rows.length; i++) {
        if (i === from) continue;
        const r = rows[i].getBoundingClientRect();
        const mid = r.top + r.height / 2;
        if ((i < from && ev.clientY < mid) || (i > from && ev.clientY > mid)) {
          const [moved] = pieces.splice(from, 1);
          pieces.splice(i, 0, moved);
          paint();
          rowOf(uidDragged)?.classList.add("dragging");
          break;
        }
      }
    };
    const up = () => {
      rowOf(uidDragged)?.classList.remove("dragging");
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  }

  wireHeader(view, {
    onAction: () => {
      if (pieces.length === 0) return;
      upsertSavedKit(kitObject());
      navigate("kits", {}, { replace: true });
    },
  });

  qsa(view, "[data-add]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const meta = typeMeta(btn.dataset.add);
      const piece = { uid: uid++, drumType: meta.id, size: meta.sizes[0], lugCount: meta.lugs };
      pieces.push(piece);
      openUid = piece.uid; // open the new piece so size/lugs are right there
      paint();
    })
  );

  qs(view, "#sound-row").addEventListener("click", () =>
    navigate("sound-preview", { ...params, styleId, forKit: true, returnTo: "kit-builder" })
  );

  qs(view, "#start-btn").addEventListener("click", () => {
    if (pieces.length === 0) return;
    const kit = kitObject();
    registerSessionKit(kit);
    beginKitTuning(kit);
  });

  paint();
  return view;
}
