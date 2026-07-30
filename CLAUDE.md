# DrumTune Pro

A mobile app that helps drummers tune toms and snares by listening to individual lug pitches and guiding tightening/loosening adjustments visually.

**Hosted:** [github.com/RandomALT999/drumtune-pro](https://github.com/RandomALT999/drumtune-pro) — live at [randomalt999.github.io/drumtune-pro](https://randomalt999.github.io/drumtune-pro/) via GitHub Pages (auto-deploys from the `master` branch root on every push). This is the app link to use for the competition submission and for real-device (HTTPS) testing.

## Status / Decision (locked in)

**Single track: Web/PWA build.** This is both the personal-use app and the Maine App Challenge competition submission (web-based platform project format). The Flutter/native track is dropped.

- No Apple Developer account or Xcode needed; uses Safari "Add to Home Screen" for personal iPhone use.
- Web Audio API handles pitch/FFT analysis fine on iOS Safari.
- Camera-Assisted Mode was built (as an alignment-guide overlay, not object-tracked AR) and then **removed by request** along with Guided Tuning Mode — see the note under Main Screens.

## Competition Constraints (Maine App Challenge)

- **Deadline:** April 3, 2027, 11:59:59 PM ET (confirm against the official site before final crunch).
- **Format:** web-based platform project (fully functional in browser, mobile-optimized, source included).
- **Required:** in-app About page (name, description, instructions, link to video presentation).
- **AI disclosure rule:** AI used only as a *development tool* (e.g., using Claude to write code) → general disclosure only, no System Card needed. This app has no AI embedded at runtime — sound-style presets are static, pre-programmed lookup tables (Warm/Rock/Metal/etc.), not live model calls. (If that ever changes, a live runtime AI feature would require a mandatory System Card — see the official rules — but there is no such feature planned.)
- Submission needs: app link/package, YouTube video (unlisted, ≤5 min), signed Consent forms, two screenshots.

## Core Concept

The user taps each lug on a drumhead while holding their phone nearby. The app detects the pitch of each lug via the microphone, compares it to a target tuning frequency, and shows which lugs need tightening or loosening — like a guitar tuner, but for drums, with a visual lug map.

### UI layer — follows the design handoff (do not regress)

The whole presentation layer was replaced from a Claude Design project
(`DrumTune Pro.dc.html` + `HANDOFF.md`, project `a2389cdd-0fbe-4af2-8d5f-b5f8995fd32d`,
readable via the `DesignSync` MCP). **Future sessions must not reintroduce the emoji
list rows (🥁 🎯 ⚙️ …), the centred-title header bar, or `--surface-3`** — all three
were deliberately deleted. Rules of thumb from the handoff:

- Hairline dividers for lists; cards only for meters and diagrams.
- Every view owns its own 54px header row (back chevron + uppercase context label
  left, live state or one text action right). There is no global header any more.
- Font is **Space Grotesk**, self-hosted in `assets/fonts/` (a CDN link would break
  the offline PWA). Tokens and the type scale live at the top of `css/styles.css`.
- Primary actions are 58px full-width pills; controls are ≥42px tall (the app is
  used one-handed with a stick in the other).
- Nav is **Tune · Kits · Analyze · More**. Tuning and Setup hide the tab bar — they
  are focus modes, and that's what buys room for the 72px readout.
- Everything ships **empty**: em-dashes and empty states are the shipping default,
  never mock data.

### Main Screens
- **Home (Tune tab)** — two-line greeting, a **resume card** when a kit session
  exists (progress strip + `Continue · <next piece>`, else `NOTHING IN PROGRESS`),
  a hairline `One drum` list (Rack tom / Floor tom / Snare / Bass drum / Custom),
  then genre chips + a dashed `+ Build`.
- **Drum Setup** — `step 1 of 2`. Four labelled rows separated by hairlines: Drum
  (row → Home's list is the picker), Diameter, Lugs, Sound (row → the style picker).
  A label turns accent while its group is the last one touched. Footer shows the
  live `TARGET <n> Hz` in `--head` — recomputed on every change, since that's the
  whole point of the screen — plus a 52px preview-tone circle and `Start listening`.
  Custom Hz replaces the Sound row in place, keeping the A440/A442 chips.
- **Tuning Screen** (primary) — uses the **round-based, all-lugs-at-once method**
  (see Tuning Method below). Top to bottom: 72px `Heard` readout (ghosted at 50%
  before the first measurement, yellow out of tolerance, green in), target/delta
  strip, **needle ladder** whose green band width *is* the tolerance (25% / 12.5% /
  6.25%), **turn block** (yellow fill + rotating drum key out of tolerance; green
  tint + check in), diagram + turn-order cards, instruction line, button row.
- **Smart Adjustment Estimation** — turn amount in sixteenths, applied to *every*
  lug equally, animated on a drum key through that exact fraction.
- **Sound Preview** — the style picker reached from Setup's Sound row (and Kit
  Builder's `Sound · whole kit`); target Hz is size- and drum-type-aware via
  `targetFrequencyFor`.
- **Snare Tuning** — the same tuning engine plus the wire cards it always needs in
  view. The wire card keeps its `ILLUSTRATIVE` pill: it is a labelled mock.
- **Kits tab** — absorbs the old Presets tab. `Yours` (saved kits) then
  `Start from a genre` (the 6 presets).
- **Kit detail / Kit Builder / Complete** — detail has per-piece status glyphs,
  preview circles and a pitch-spread card; the builder's footer is **disabled
  styling** while the kit is empty; complete lists final pitches in green.
- **Analyze** — 16-bar spectrum + overtone rows. Empty until you start listening;
  pausing freezes the last numbers rather than clearing them.
- **More** — new tab. About copy, `How to use it` as 5 numbered rows, reference
  pitch, walkthrough placeholder, and the Maine App Challenge AI disclosure (which
  is why the ⓘ button is off every other screen).

**Removed by request (do not rebuild without asking):** Camera-Assisted Mode and
Guided Tuning Mode.

### Tuning Method (the core interaction — changed after real-device use)

Every tuning screen mounts the same engine, `mountTuningEngine`
(`js/views/tuningShared.js`). One primary button drives the whole loop; the
secondary beside it changes role and finally collapses:

| state | primary | fill | secondary |
|---|---|---|---|
| idle, never listened | `Start listening` | accent | ▶ preview tone |
| listening, out of tolerance | `Listening — strike again` + pulsing dot | accent | ▶ preview tone |
| in tolerance, round 1 | `Tune further · ±5 Hz` | white | `Skip →` |
| in tolerance, round 2 | `Tune further · ±2.5 Hz` | white | `Skip →` |
| in tolerance, round 3 (final) | `Next drum` / `Finish` | **green** | *(collapses to 0 width)* |

1. **Prep** — hand-tighten every lug finger tight, then **one full turn with the key on each** in the star order. This is the even baseline the rest depends on. It's the idle-state instruction line, so it's the first thing you read and it disappears for good after the first measurement (re-reading "hand-tighten everything" mid-tune would be wrong).
2. **Strike the CENTER** of the head — not near a lug. One measurement per strike.
3. The app reports how far off the pitch is and **how much to turn EVERY lug by the same amount**, in the numbered star order shown on the diagram — with a **drum key animation** rotating through exactly that fraction (easier to copy than reading "3/16 turn").
4. Repeat until the pitch lands inside the current tolerance window.
5. **Tune further** halves the window without closing the mic: ±10 → ±5 → ±2.5 Hz, then holds at ±2.5 (chasing tighter than that by hand isn't realistic — the drum drifts more than that as it settles). `TOLERANCES` in `tuningShared.js`. The green band on the needle ladder narrows in the same 550ms transition — that narrowing *is* the feedback that the goal got stricter.

**Lug numbering.** Lugs are drawn at their physical positions but labelled with
their *place in the tuning order*, so the drummer just counts 1, 2, 3. Computed
from `generateCrossOrder(n)`: for position `p`, `label = order.indexOf(p) + 1`.
6 lugs clockwise from top reads **1·3·5·2·4·6**; 8 reads **1·3·5·7·2·4·6·8**.
Never print the order as a separate "1 → 4 → 2 → 5" string — that was the
confusing bit.

Why this replaced the old per-lug walk: a strike near the rim excites an overtone louder than the fundamental, so per-lug readings flipped between two pitches ~60 Hz apart depending on exactly where the stick landed (reported on-device for snare and floor tom, and the user found center hits were the only reliable spot). Center strikes excite the fundamental cleanly, so every measurement comes from the same repeatable place; turning all lugs equally from an even start keeps the head even by construction instead of chasing one lug at a time. There is no "active lug" any more — all lugs share one state in the UI.

### Known Hard Parts
- Bass/floor-tom low-frequency detection needs a larger FFT window size — implemented: `PitchListener` uses fftSize 4096 for floor-tom/bass-drum vs. 2048 for everything else, and the YIN search range is biased around the target frequency (±) to avoid octave errors.
- Snare buzz/choke detection and batter-vs-resonant ratio analysis both depend on clean pitch tracking under noisier conditions than a single tom lug. **Still mocked** — real dissonance/buzz analysis across both heads at once is a harder DSP problem than single-lug pitch tracking and hasn't been built; the Snare Tuning screen labels it "Mock diagnostic" rather than pretending it's real.

## Tech Stack (web build — the only track)

- **Pitch detection for tuning: spectral peak scan** (`js/audio/spectralPeak.js`) — Goertzel magnitude scan over the search range, then **take the LOWEST peak that's a real feature (≥15% of the strongest), not the loudest**. The pitch being tuned is the fundamental = the drum's lowest mode; an edge/rim strike makes an overtone (~1.6× the fundamental, inharmonic) *louder* than the fundamental, so magnitude-based picking flipped between the two as the strike moved (on-device: snare/floor tom oscillated high↔low, and a 2 cm move toward center flipped the reading). Lowest-significant-peak reports the fundamental regardless of strike position. Reinforced by the search window (`pitchListener.js`, 0.55×–1.5× target) which keeps the ~1.6× overtone out of range at normal tuning distances. Verified against synthetic fundamental+overtone mixtures at 44.1/48 kHz — center and edge strikes both report the fundamental; genuinely flat/sharp drums read their true pitch even when the overtone is 3× louder. (An earlier magnitude+distance-scoring and 1/1.6 pair-check version still flipped when the overtone dominated — that's what this replaced.)
- **YIN implementation** (`js/audio/yin.js`, vendored vanilla JS, no Pitchy.js — keeps the app offline-capable) is still used for the Advanced screen's continuous readings; it uses candidate-dip scoring rather than textbook first-below-threshold.
- `js/audio/pitchListener.js` wraps `getUserMedia` + `AnalyserNode`; screens call `registerCleanup()` (in `main.js`) so the mic is always released when navigating away. Two modes: continuous (`onUpdate`, YIN, used by Advanced's FFT view) and **hit-based** (`onHit`) — RMS-onset detection, then ONE spectral-peak measurement per strike on a long (8192-sample) window taken at the end of a ~350 ms capture, past the stick-attack noise but before the ring drifts. Tuning screens use hit mode: each center strike = one round of the method above. `generateCrossOrder` (opposite lugs alternate, 6-lug = 1,4,2,5,3,6) now drives the **numbering on the diagram** via `starSteps` rather than an auto-advancing active lug.
- In-tune tolerance starts at **±10 Hz** (`IN_TUNE_HZ` in `tuningMath.js`), judged in Hz not cents — an on-device finding: cents scale with pitch, so the old ±15-cent window was barely ~1 Hz at typical drum pitches and unreachable by hand. "Tune Further" then halves it twice (`toleranceForStep`). All tuning readouts show the Hz difference ("12.4 Hz low — tighten"); `centsOff` is kept only for the turn-amount heuristic.
- `js/audio/synth.js` synthesizes preview tones (oscillator + filtered noise burst) for Sound Preview / style pickers / kit-piece previews — there are no licensed drum recordings bundled, so previews are procedural, not sample playback. **Each drum type has its own distinct synthesis** (`playToneForDrumType`) — rack tom, floor tom, bass drum, and snare all sound different; snare in particular is noise-dominant with only a brief pop, not a tom body with noise layered on top (that was a bug, now fixed).
- `targetFrequencyFor(drumType, size, styleId)` in `data.js` — the base-frequency-by-size table + per-style multiplier that makes target Hz size- and drum-type-aware everywhere (Drum Setup, Sound Preview, genre kits, Kit Builder), instead of a flat number per style regardless of what's actually selected.
- `js/audio/tuningMath.js` — Hz/cents-off-target math and the Smart Adjustment Estimation heuristic. Now calibrated for the **all-lugs-at-once** method: ~100 cents ≈ 1/8 turn *on every lug* (turning them all moves pitch further than turning one, which the earlier ~60-cent single-lug figure assumed). Still a rough estimate — head ply, shell and current tension all shift it, and response is non-linear near finger-tight — but the loop is iterative, so re-measuring covers the error.
- `js/audio/fftPeaks.js` — local-maxima peak-picking over `AnalyserNode` frequency data for the Advanced screen's live overtone table.
- SVG for lug diagrams, Canvas for FFT visualization
- Web Speech API wiring survives in `mountLiveTuning` (`setVoice`/`speakCurrent`) but nothing calls it now that Guided Mode is gone
- `js/storage.js` — LocalStorage-backed saved-kit persistence (kits are stored in the same shape as genre-kit presets, so any saved kit reuses the whole preset-detail/kit-tuning flow)
- Safari "Add to Home Screen" for app-like UX on iPhone
- Local (non-runtime-API) tuning logic for sound presets — no runtime AI, so no System Card is needed

## Working with Claude Code on this project

**Model segmentation strategy:**
- **Sonnet** — UI, navigation, standard app logic, most day-to-day work.
- **Opus** — computationally intensive/precision work: YIN pitch detection implementation, real-time audio pipeline, FFT analysis, harmonic/overtone detection, smart adjustment estimation math.

**Current stage: full feature set implemented** (pitch detection, FFT, tuning math, synthesized preview tones, kit persistence), scoped down to the round-based center-strike method. If odd edge cases turn up in the spectral-peak detection or turn-estimate math, that's the first place to look — consider a focused Opus pass on `js/audio/` specifically.

**Session hygiene:** start a fresh conversation when switching between feature areas (e.g., UI → audio pipeline) rather than carrying one long thread. Keep this CLAUDE.md concise and update it as architecture decisions land, rather than letting context balloon.

**SOLVED — iOS standalone dead strip under the nav.** Root cause was a meta tag, not CSS: `apple-mobile-web-app-status-bar-style: black-translucent` combined with `viewport-fit=cover` makes iOS draw the page from y=0 *under* the status bar while still sizing the viewport ~62px **shorter than the screen** — so the bottom ~62px is outside the page and no layout or paint can reach it. That's why every CSS/JS attempt failed (`100dvh`, `visualViewport` re-reads on timers/resize/touch, `position:fixed + inset:0`, forced `scrollTo` nudges) and why scroll-locking the body made it permanent. Fix: `content="black"`, which makes iOS lay the web view out below the status bar and size it to the rest of the screen. Keep `viewport-fit=cover` — the bottom inset is still needed to clear the home indicator.

⚠️ **iOS reads that meta only at install time**: changing it does nothing until the Home Screen icon is deleted and re-added.

Diagnostic that separates the two cases in one number — `barGap = innerHeight - bar.getBoundingClientRect().bottom`. If `barGap > 0` it's an ordinary CSS bug; if `barGap === 0` but `screen.height - innerHeight > 0`, the page already reaches its own bottom and the viewport itself is short (this bug). Full write-up, including a probe for reading `env()` values from JS: `C:\Users\limpe\OneDrive\Documents\60 Seconds App\IOS-NOTES.md`.

Two related rules from those notes, also applied here: the canvas background propagates from `<html>`, not `<body>` (so `html` carries the nav's surface color as a backstop), and safe-area insets should be **scaled, not added whole** — `max(calc(env(safe-area-inset-bottom) * 0.6), 8px)` rather than adding the full ~34px to a fixed height.

**GitHub Pages deploy quirk:** the build queue occasionally gets stuck ("building" for 10+ min, then errors). Re-trigger manually with `gh api -X POST repos/RandomALT999/drumtune-pro/pages/builds`.

**Testing on a real device:** `getUserMedia` (mic access) only works in a secure context — HTTPS, or `localhost` on the device itself. Opening this over plain HTTP from a phone on the same Wi-Fi (e.g. `http://<lan-ip>:5173`) will fail with a "needs a secure connection" message (see `pitchListener.js`) rather than silently misbehaving. To test on an iPhone for real: tunnel the local static server over HTTPS (`ngrok http 5173` is installed on this machine) and open the `https://` ngrok URL on the phone — that also lets you exercise "Add to Home Screen" over a real secure origin.

## Open TODOs
- [ ] Confirm April 3, 2027 deadline is still current on the official Maine App Challenge site before final crunch.
- [x] ~~Build Camera-Assisted Mode~~ — built, then removed by request along with Guided Tuning Mode.
- [x] ~~Replace the hardcoded per-kit descending tom targets with real interval math~~ — done via `targetFrequencyFor(drumType, size, styleId)`; still a mock physics model (linear base-freq table + style multiplier), not real acoustic modeling, but no longer hand-picked magic numbers.
- [ ] Real snare buzz/choke/looseness detection — currently a labeled mock on the Snare Tuning screen.
- [ ] Test the YIN pitch detector against real drum hits on a real device — only exercised in a sandboxed preview browser so far (no mic hardware there), so mic-permission and low-frequency (floor tom/bass drum) accuracy are unverified in practice.
- [ ] `BASE_FREQ_TABLE`/`STYLE_MULTIPLIER` in `data.js` are still hand-guessed starting points (not measured against real drums) — revisit once real tuning sessions give a sense of whether the numbers are in a sane ballpark.
