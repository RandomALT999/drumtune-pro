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
  let name = source ? (isBuiltIn ? `${source.name} (edited)` : source.name) : "";

  const view = el(
    `
    ${headerHtml({ label: isEdit ? "edit kit" : "new kit", action: "Save kit" })}
    <div style="flex:none">
      <input id="kit-name" class="screen-title-lg" placeholder="Untitled kit"
        value="${escapeHtml(name)}"
        style="width:100%;background:transparent;border:none;padding:0;color:var(--text);outline:none" />
      <div class="blurb" id="summary" style="margin-top:9px"></div>
    </div>

    <div style="flex:none;display:flex;align-items:baseline;justify-content:space-between;margin-top:24px">
      <span class="eyebrow">Tuning order</span>
      <span class="meta">tuned in this order</span>
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

  function paint() {
    const host = qs(view, "#pieces");
    if (pieces.length === 0) {
      host.innerHTML = `<div class="empty-note" style="padding:6px 0 2px">Add the drums you want to work through. They're tuned top to bottom.</div>`;
    } else {
      host.innerHTML = `<div class="rows">${pieces
        .map((p, i) => {
          const meta = typeMeta(p.drumType);
          const hz = targetFrequencyFor(p.drumType, p.size, styleId);
          return `
          <div class="row row-sm" style="align-items:center" data-i="${i}">
            <span class="drag-handle" aria-hidden="true"><i></i><i></i><i></i></span>
            <span style="flex:1;min-width:0">
              <span class="row-title" style="display:block">${p.size}" ${escapeHtml(meta.label)}</span>
              <span class="meta">${p.lugCount} lugs · ${hz} Hz</span>
            </span>
            <button class="x-btn" data-del="${i}" aria-label="Remove">✕</button>
          </div>`;
        })
        .join("")}</div>`;
      qsa(host, "[data-del]").forEach((b) =>
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          pieces.splice(Number(b.dataset.del), 1);
          paint();
        })
      );
    }

    qs(view, "#summary").textContent = pieces.length
      ? `${pieces.length} piece${pieces.length === 1 ? "" : "s"} · one sound across the kit`
      : "Nothing added yet.";
    qs(view, "#style-value").textContent = soundPresets.find((s) => s.id === styleId)?.name || "Balanced";

    const start = qs(view, "#start-btn");
    start.disabled = pieces.length === 0;
    start.classList.toggle("is-disabled", pieces.length === 0);
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
      pieces.push({ uid: uid++, drumType: meta.id, size: meta.sizes[0], lugCount: meta.lugs });
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

  qs(view, "#kit-name").addEventListener("input", () => {});

  paint();
  return view;
}
