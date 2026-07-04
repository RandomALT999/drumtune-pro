import { el, qs, qsa } from "../util.js";
import { navigate } from "../main.js";
import { drumTypes, soundPresets, genrePresets, targetFrequencyFor, getKit, registerSessionKit } from "../data.js";
import { playToneForDrumType } from "../audio/synth.js";
import { upsertSavedKit } from "../storage.js";
import { beginKitTuning } from "./tuningShared.js";

const EMOJI = { "rack-tom": "🥁", "floor-tom": "🥁", snare: "🎯", "bass-drum": "🔊" };

function typeMeta(drumType) {
  return drumTypes.find((d) => d.id === drumType);
}

export function renderKitBuilder(params) {
  const isEdit = params.mode === "edit" && params.kitId;
  const sourceKit = isEdit ? getKit(params.kitId) : null;
  const isBuiltIn = isEdit && genrePresets.some((k) => k.id === params.kitId);

  let uidCounter = 0;
  let pieces = sourceKit
    ? sourceKit.pieces.map((p) => ({ uid: uidCounter++, drumType: p.drumType, size: p.size, lugCount: p.lugCount }))
    : [{ uid: uidCounter++, drumType: "rack-tom", size: typeMeta("rack-tom").sizes[0], lugCount: typeMeta("rack-tom").lugs }];
  let styleId = sourceKit?.styleId || "balanced";

  const editBannerText = !isEdit
    ? ""
    : isBuiltIn
    ? `Editing <b>${sourceKit.name}</b> — save creates your own customized copy (the built-in preset stays untouched), or tune it directly right now.`
    : `Editing <b>${sourceKit.name}</b> — saving updates this kit in place.`;

  // Editing a saved kit only offers Save (per the user's own kit, in place).
  // Editing a built-in preset offers both Save-as-copy and tuning it directly,
  // since forking a preset is exactly the "customize then maybe tune" flow.
  const actionButtonsHtml = !isEdit
    ? `<button class="btn btn-primary" id="start-tuning-btn" style="margin-top:20px;">Start Tuning Kit</button>`
    : `
    <div class="section-title">Kit Name</div>
    <div class="field">
      <input type="text" id="kit-name-input" value="${sourceKit ? sourceKit.name : "My Kit"}" />
    </div>
    ${
      isBuiltIn
        ? `
    <div class="btn-row" style="margin-top:4px;">
      <button class="btn btn-secondary" id="save-kit-btn">Save Kit</button>
      <button class="btn btn-primary" id="start-tuning-btn">Start Tuning Kit</button>
    </div>`
        : `<button class="btn btn-primary" id="save-kit-btn" style="margin-top:4px;">Save Kit</button>`
    }
    `;

  const view = el(`
    ${isEdit ? `<div class="card">${editBannerText}</div>` : ""}

    <div class="section-title">Pieces in This Kit</div>
    <div id="pieces-list"></div>

    <div class="btn-row" style="margin-bottom:16px;">
      <button class="btn btn-secondary" id="add-rack-btn">+ Add Rack Tom</button>
      <button class="btn btn-secondary" id="add-floor-btn">+ Add Floor Tom</button>
    </div>

    <div class="section-title">Other Drums</div>
    <div class="chip-row" id="other-drums-row" style="margin-bottom:20px;">
      <div class="chip" id="toggle-snare">+ Snare</div>
      <div class="chip" id="toggle-bass">+ Bass Drum</div>
    </div>

    <div class="section-title">Sound Style <span class="badge-soon">Applies to whole kit</span></div>
    <div class="genre-list" id="style-list"></div>

    ${actionButtonsHtml}
  `);

  const piecesList = qs(view, "#pieces-list");
  const styleList = qs(view, "#style-list");
  const otherDrumsRow = qs(view, "#other-drums-row");
  const saveBtn = qs(view, "#save-kit-btn");
  const startBtn = qs(view, "#start-tuning-btn");
  const actionBtns = [saveBtn, startBtn].filter(Boolean);

  function hasType(drumType) {
    return pieces.some((p) => p.drumType === drumType);
  }

  function renderOtherDrums() {
    qs(otherDrumsRow, "#toggle-snare").classList.toggle("active", hasType("snare"));
    qs(otherDrumsRow, "#toggle-bass").classList.toggle("active", hasType("bass-drum"));
  }

  function renderPieces() {
    piecesList.innerHTML = pieces
      .map((p) => {
        const meta = typeMeta(p.drumType);
        const freq = targetFrequencyFor(p.drumType, p.size, styleId);
        return `
        <div class="tap-card" data-uid="${p.uid}">
          <div class="emoji-badge">${EMOJI[p.drumType] || "🥁"}</div>
          <div class="tap-card-body">
            <div class="tap-card-title">${meta.label}</div>
            <div class="chip-row" style="margin:8px 0 6px;">
              ${meta.sizes
                .map((s) => `<div class="chip size-chip ${s === p.size ? "active" : ""}" data-uid="${p.uid}" data-size="${s}">${s}"</div>`)
                .join("")}
            </div>
            <div class="stepper" style="margin-bottom:6px;">
              <button type="button" class="lug-minus" data-uid="${p.uid}">−</button>
              <div class="stepper-value">${p.lugCount} lugs</div>
              <button type="button" class="lug-plus" data-uid="${p.uid}">+</button>
            </div>
            <div style="font-size:12px; color:var(--text-dim);">≈ ${freq} Hz</div>
          </div>
          <button class="btn btn-sm btn-secondary remove-piece" data-uid="${p.uid}" aria-label="Remove">✕</button>
        </div>`;
      })
      .join("");

    qsa(piecesList, ".size-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const p = pieces.find((pc) => pc.uid === Number(chip.dataset.uid));
        p.size = Number(chip.dataset.size);
        playToneForDrumType(p.drumType, targetFrequencyFor(p.drumType, p.size, styleId));
        renderAll();
      });
    });
    qsa(piecesList, ".lug-minus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = pieces.find((pc) => pc.uid === Number(btn.dataset.uid));
        p.lugCount = Math.max(4, p.lugCount - 1);
        renderAll();
      });
    });
    qsa(piecesList, ".lug-plus").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = pieces.find((pc) => pc.uid === Number(btn.dataset.uid));
        p.lugCount = Math.min(12, p.lugCount + 1);
        renderAll();
      });
    });
    qsa(piecesList, ".remove-piece").forEach((btn) => {
      btn.addEventListener("click", () => {
        pieces = pieces.filter((pc) => pc.uid !== Number(btn.dataset.uid));
        renderAll();
      });
    });
  }

  function renderStyleList() {
    styleList.innerHTML = soundPresets
      .map(
        (s) => `
      <div class="tap-card style-pick ${s.id === styleId ? "selected" : ""}" data-id="${s.id}" role="button" tabindex="0">
        <div class="emoji-badge">🎚️</div>
        <div class="tap-card-body">
          <div class="tap-card-title">${s.name}</div>
          <div class="tap-card-sub">${s.tag}</div>
        </div>
      </div>`
      )
      .join("");
    qsa(styleList, ".style-pick").forEach((row) => {
      row.addEventListener("click", () => {
        styleId = row.dataset.id;
        renderAll();
      });
    });
  }

  function renderAll() {
    renderPieces();
    renderOtherDrums();
    renderStyleList();
    actionBtns.forEach((btn) => (btn.disabled = pieces.length === 0));
  }

  qs(view, "#add-rack-btn").addEventListener("click", () => {
    const meta = typeMeta("rack-tom");
    pieces.push({ uid: uidCounter++, drumType: "rack-tom", size: meta.sizes[0], lugCount: meta.lugs });
    renderAll();
  });
  qs(view, "#add-floor-btn").addEventListener("click", () => {
    const meta = typeMeta("floor-tom");
    pieces.push({ uid: uidCounter++, drumType: "floor-tom", size: meta.sizes[0], lugCount: meta.lugs });
    renderAll();
  });

  function toggleSingleton(drumType) {
    if (hasType(drumType)) {
      pieces = pieces.filter((p) => p.drumType !== drumType);
    } else {
      const meta = typeMeta(drumType);
      pieces.push({ uid: uidCounter++, drumType, size: meta.sizes[0], lugCount: meta.lugs });
    }
    renderAll();
  }
  qs(otherDrumsRow, "#toggle-snare").addEventListener("click", () => toggleSingleton("snare"));
  qs(otherDrumsRow, "#toggle-bass").addEventListener("click", () => toggleSingleton("bass-drum"));

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

  function buildKitObject(id) {
    const name = isEdit ? qs(view, "#kit-name-input")?.value.trim() || sourceKit.name : "My Kit";
    return {
      id,
      name,
      tag: soundPresets.find((s) => s.id === styleId)?.tag || "",
      styleId,
      pieces: buildPieces(),
    };
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (pieces.length === 0) return;
      const id = isBuiltIn ? `custom-${Date.now()}` : sourceKit.id;
      upsertSavedKit(buildKitObject(id));
      navigate("kits", {}, { replace: true });
    });
  }

  if (startBtn) {
    startBtn.addEventListener("click", () => {
      if (pieces.length === 0) return;
      const id = isEdit ? `custom-${Date.now()}` : `tune-all-${Date.now()}`;
      const kit = buildKitObject(id);
      registerSessionKit(kit);
      beginKitTuning(kit);
    });
  }

  renderAll();
  return view;
}
