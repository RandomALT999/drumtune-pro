# DrumTune Pro

A mobile app that helps drummers tune toms and snares by listening to individual lug pitches and guiding tightening/loosening adjustments visually.

**Hosted:** [github.com/RandomALT999/drumtune-pro](https://github.com/RandomALT999/drumtune-pro) — live at [randomalt999.github.io/drumtune-pro](https://randomalt999.github.io/drumtune-pro/) via GitHub Pages (auto-deploys from the `master` branch root on every push). This is the app link to use for the competition submission and for real-device (HTTPS) testing.

## Status / Decision (locked in)

**Single track: Web/PWA build.** This is both the personal-use app and the Maine App Challenge competition submission (web-based platform project format). The Flutter/native track is dropped.

- No Apple Developer account or Xcode needed; uses Safari "Add to Home Screen" for personal iPhone use.
- Web Audio API handles pitch/FFT analysis fine on iOS Safari.
- Camera-Assisted Mode is now built (`js/views/camera.js`) as an **alignment-guide overlay, not object-tracked AR** — it can't detect the actual drum in the frame (that needs real computer vision), so it shows a drag-to-position drum-circle guide over the live rear-camera feed with lug markers, the active lug in star order, and a strike target. Honest framing in the UI ("line the circle up with your drum") rather than pretending to track it.

## Competition Constraints (Maine App Challenge)

- **Deadline:** April 3, 2027, 11:59:59 PM ET (confirm against the official site before final crunch).
- **Format:** web-based platform project (fully functional in browser, mobile-optimized, source included).
- **Required:** in-app About page (name, description, instructions, link to video presentation).
- **AI disclosure rule:** AI used only as a *development tool* (e.g., using Claude to write code) → general disclosure only, no System Card needed. This app has no AI embedded at runtime — sound-style presets are static, pre-programmed lookup tables (Warm/Rock/Metal/etc.), not live model calls. (If that ever changes, a live runtime AI feature would require a mandatory System Card — see the official rules — but there is no such feature planned.)
- Submission needs: app link/package, YouTube video (unlisted, ≤5 min), signed Consent forms, two screenshots.

## Core Concept

The user taps each lug on a drumhead while holding their phone nearby. The app detects the pitch of each lug via the microphone, compares it to a target tuning frequency, and shows which lugs need tightening or loosening — like a guitar tuner, but for drums, with a visual lug map.

### Main Screens
- **Home** — cards for Tune Rack Tom / Tune Floor Tom / Tune Snare / Custom Tuning / **Tune All Drums** / Saved Drum Kits.
- **Drum Setup** — select drum type, diameter, number of lugs (illustrated diagrams), then a **Sound Style vs. Custom Hz** toggle (applies to any drum type, not just "Custom Tuning" — that used to be its own pseudo drum-type with no size, which didn't make sense; now it's just this toggle defaulted to manual entry). Custom Hz mode has its own ▶ Preview button so you can hear the exact entered frequency before committing.
- **Tuning Screen** (primary) — uses the **round-based, all-lugs-at-once method** (see Tuning Method below). Circular top-down drum graphic with every lug shown in the same state and **numbered by its step in the star order** (the numbers themselves tell you the turning order), a strike target at the **center** of the head, live pitch reading, target pitch, and a progress ring based on how close the pitch is to target.
- **Guided Tuning Mode** — the exact same round-based flow (it mounts the same shared component), with each round's instruction read aloud. Voice on/off toggle.
- **Smart Adjustment Estimation** — estimates turn amount (1/8, 1/4, 1/2…) from the pitch delta, applied to *every* lug equally.
- **Sound Preview** — style presets (Warm, Balanced, Punchy, Resonant, Jazz, Rock, Metal); target Hz shown/previewed is size- and drum-type-aware when reached with that context (via `targetFrequencyFor`), not a flat number.
- **Snare Tuning** — its own dedicated tuning screen (not a generic tom screen) with the wire-balance check (buzz/choke/looseness, batter-vs-resonant ratio) shown inline alongside the lug map, since snare tuning always needs that context.
- **Tune All Drums / Kit Builder** — add/remove screen for assembling a kit from scratch: add any number of rack/floor toms (each with its own size + lug count), toggle a snare and/or bass drum on or off, then pick **one** Sound Style that's applied across every piece (each piece's actual Hz still comes out size-appropriate via `targetFrequencyFor`, not literally identical). Flows straight into tuning every piece in sequence, same as a genre preset, ending on the same kit-complete "save to your kits?" screen.
- **Tuning Presets** — built-in genre kits (Rock, Jazz, Metal, Fusion, Funk, Gospel), each with one `styleId` shared across its pieces; per-piece target frequencies are derived from size + that style (see `targetFrequencyFor`) so the kit descends from high rack toms down to the floor tom for a uniform, related sound — not tuned independently. Tapping a kit opens a preset-detail screen to preview each piece's sound first, an **Edit Kit** button (opens the same Kit Builder add/remove screen, pre-populated — editing forks a new custom kit rather than mutating the built-in preset), and "Start Tuning Kit" which flows straight into tuning each piece in sequence, ending on a kit-complete summary.
- **Advanced Frequency Analysis** (pro mode) — FFT spectrum + overtone table, both empty until you start listening and frozen on the last reading when you stop, with a "?" explaining how to read the overtone series. (The old "Lug Consistency" panel was removed — the current method never measures lugs individually, so it could never populate.)
- **Camera-Assisted Mode** — live rear-camera feed with a drag-to-position drum-circle guide overlaid: lug markers **numbered in the star turning order** and a pulsing strike target at the **center** of the head, matching the tuning method. Size + lug-count controls. An alignment guide the user lines up with their real drum, not object-tracked AR.
- **Progress Indicator** — "% to target" ring driven by how close the measured pitch is to the target Hz.

### Tuning Method (the core interaction — changed after real-device use)

Every tuning screen runs the same loop, in `mountLiveTuning` (`js/views/tuningShared.js`):

1. **Prep** — hand-tighten every lug finger tight and even (no key yet). This is the baseline the rest depends on.
2. **Strike the CENTER** of the head — not near a lug. One measurement per strike.
3. The app reports how far off the pitch is and **how much to turn EVERY lug by the same amount**, in the numbered star order shown on the diagram.
4. Repeat until the pitch lands inside the ±10 Hz window.

Why this replaced the old per-lug walk: a strike near the rim excites an overtone louder than the fundamental, so per-lug readings flipped between two pitches ~60 Hz apart depending on exactly where the stick landed (reported on-device for snare and floor tom, and the user found center hits were the only reliable spot). Center strikes excite the fundamental cleanly, so every measurement comes from the same repeatable place; turning all lugs equally from an even start keeps the head even by construction instead of chasing one lug at a time. There is no "active lug" any more — all lugs share one state in the UI.

### Known Hard Parts
- Bass/floor-tom low-frequency detection needs a larger FFT window size — implemented: `PitchListener` uses fftSize 4096 for floor-tom/bass-drum vs. 2048 for everything else, and the YIN search range is biased around the target frequency (±) to avoid octave errors.
- Snare buzz/choke detection and batter-vs-resonant ratio analysis both depend on clean pitch tracking under noisier conditions than a single tom lug. **Still mocked** — real dissonance/buzz analysis across both heads at once is a harder DSP problem than single-lug pitch tracking and hasn't been built; the Snare Tuning screen labels it "Mock diagnostic" rather than pretending it's real.

## Tech Stack (web build — the only track)

- **Pitch detection for tuning: spectral peak scan** (`js/audio/spectralPeak.js`) — Goertzel magnitude scan over the search range, then **take the LOWEST peak that's a real feature (≥15% of the strongest), not the loudest**. The pitch being tuned is the fundamental = the drum's lowest mode; an edge/rim strike makes an overtone (~1.6× the fundamental, inharmonic) *louder* than the fundamental, so magnitude-based picking flipped between the two as the strike moved (on-device: snare/floor tom oscillated high↔low, and a 2 cm move toward center flipped the reading). Lowest-significant-peak reports the fundamental regardless of strike position. Reinforced by the search window (`pitchListener.js`, 0.55×–1.5× target) which keeps the ~1.6× overtone out of range at normal tuning distances. Verified against synthetic fundamental+overtone mixtures at 44.1/48 kHz — center and edge strikes both report the fundamental; genuinely flat/sharp drums read their true pitch even when the overtone is 3× louder. (An earlier magnitude+distance-scoring and 1/1.6 pair-check version still flipped when the overtone dominated — that's what this replaced.)
- **YIN implementation** (`js/audio/yin.js`, vendored vanilla JS, no Pitchy.js — keeps the app offline-capable) is still used for the Advanced screen's continuous readings; it uses candidate-dip scoring rather than textbook first-below-threshold.
- `js/audio/pitchListener.js` wraps `getUserMedia` + `AnalyserNode`; screens call `registerCleanup()` (in `main.js`) so the mic is always released when navigating away. Two modes: continuous (`onUpdate`, YIN, used by Advanced's FFT view) and **hit-based** (`onHit`) — RMS-onset detection, then ONE spectral-peak measurement per strike on a long (8192-sample) window taken at the end of a ~350 ms capture, past the stick-attack noise but before the ring drifts. Tuning screens use hit mode: each center strike = one round of the method above. `generateCrossOrder` (opposite lugs alternate, 6-lug = 1,4,2,5,3,6) now drives the **numbering on the diagram** via `starSteps` rather than an auto-advancing active lug.
- In-tune tolerance is **±10 Hz** (`IN_TUNE_HZ` in `tuningMath.js`), judged in Hz not cents — an on-device finding: cents scale with pitch, so the old ±15-cent window was barely ~1 Hz at typical drum pitches and unreachable by hand. All tuning readouts show the Hz difference ("12.4 Hz low — tighten"); `centsOff` is kept only for the turn-amount heuristic.
- `js/audio/synth.js` synthesizes preview tones (oscillator + filtered noise burst) for Sound Preview / style pickers / kit-piece previews — there are no licensed drum recordings bundled, so previews are procedural, not sample playback. **Each drum type has its own distinct synthesis** (`playToneForDrumType`) — rack tom, floor tom, bass drum, and snare all sound different; snare in particular is noise-dominant with only a brief pop, not a tom body with noise layered on top (that was a bug, now fixed).
- `targetFrequencyFor(drumType, size, styleId)` in `data.js` — the base-frequency-by-size table + per-style multiplier that makes target Hz size- and drum-type-aware everywhere (Drum Setup, Sound Preview, genre kits, Kit Builder), instead of a flat number per style regardless of what's actually selected.
- `js/audio/tuningMath.js` — Hz/cents-off-target math and the Smart Adjustment Estimation heuristic. Now calibrated for the **all-lugs-at-once** method: ~100 cents ≈ 1/8 turn *on every lug* (turning them all moves pitch further than turning one, which the earlier ~60-cent single-lug figure assumed). Still a rough estimate — head ply, shell and current tension all shift it, and response is non-linear near finger-tight — but the loop is iterative, so re-measuring covers the error.
- `js/audio/fftPeaks.js` — local-maxima peak-picking over `AnalyserNode` frequency data for the Advanced screen's live overtone table.
- SVG for lug diagrams, Canvas for FFT visualization
- Web Speech API for guided voice prompts (Guided Tuning's voice toggle)
- `js/storage.js` — LocalStorage-backed saved-kit persistence (kits are stored in the same shape as genre-kit presets, so any saved kit reuses the whole preset-detail/kit-tuning flow)
- Safari "Add to Home Screen" for app-like UX on iPhone
- Local (non-runtime-API) tuning logic for sound presets — no runtime AI, so no System Card is needed

## Working with Claude Code on this project

**Model segmentation strategy:**
- **Sonnet** — UI, navigation, standard app logic, most day-to-day work.
- **Opus** — computationally intensive/precision work: YIN pitch detection implementation, real-time audio pipeline, FFT analysis, harmonic/overtone detection, smart adjustment estimation math.

**Current stage: full feature set implemented** (pitch detection, FFT, tuning math, synthesized preview tones, kit persistence, and now the Camera-Assisted alignment overlay). If odd edge cases turn up in the spectral-peak detection or turn-estimate math, that's the first place to look — consider a focused Opus pass on `js/audio/` specifically.

**Session hygiene:** start a fresh conversation when switching between feature areas (e.g., UI → audio pipeline) rather than carrying one long thread. Keep this CLAUDE.md concise and update it as architecture decisions land, rather than letting context balloon.

**SETTLED — iOS standalone viewport gap (do not re-attempt without new information):** in "Add to Home Screen" standalone mode, iOS reports a short viewport on launch and only corrects it after a *real user scroll*. Every programmatic fix failed on-device across many rounds: `100dvh`, JS `visualViewport` re-reads (on timers, resize, touch events), `position:fixed + inset:0` pinning, and forced `scrollTo` nudges — and scroll-locking the body made the gap *permanent* by removing the user-scroll trigger. Accepted behavior: brief gap on launch that settles on first scroll, visually blended by matching the body background to the nav's surface color.

**GitHub Pages deploy quirk:** the build queue occasionally gets stuck ("building" for 10+ min, then errors). Re-trigger manually with `gh api -X POST repos/RandomALT999/drumtune-pro/pages/builds`.

**Testing on a real device:** `getUserMedia` (mic access) only works in a secure context — HTTPS, or `localhost` on the device itself. Opening this over plain HTTP from a phone on the same Wi-Fi (e.g. `http://<lan-ip>:5173`) will fail with a "needs a secure connection" message (see `pitchListener.js`) rather than silently misbehaving. To test on an iPhone for real: tunnel the local static server over HTTPS (`ngrok http 5173` is installed on this machine) and open the `https://` ngrok URL on the phone — that also lets you exercise "Add to Home Screen" over a real secure origin.

## Open TODOs
- [ ] Confirm April 3, 2027 deadline is still current on the official Maine App Challenge site before final crunch.
- [x] ~~Build Camera-Assisted Mode~~ — done as an alignment-guide overlay (`js/views/camera.js`): live rear camera + drag-to-position drum-circle guide, lugs, active-lug-in-star-order, strike target. NOT object-tracked AR (no CV drum detection) — a real-CV upgrade to auto-detect and track the drum's ellipse would be the next step if wanted.
- [x] ~~Replace the hardcoded per-kit descending tom targets with real interval math~~ — done via `targetFrequencyFor(drumType, size, styleId)`; still a mock physics model (linear base-freq table + style multiplier), not real acoustic modeling, but no longer hand-picked magic numbers.
- [ ] Real snare buzz/choke/looseness detection — currently a labeled mock on the Snare Tuning screen.
- [ ] Test the YIN pitch detector against real drum hits on a real device — only exercised in a sandboxed preview browser so far (no mic hardware there), so mic-permission and low-frequency (floor tom/bass drum) accuracy are unverified in practice.
- [ ] `BASE_FREQ_TABLE`/`STYLE_MULTIPLIER` in `data.js` are still hand-guessed starting points (not measured against real drums) — revisit once real tuning sessions give a sense of whether the numbers are in a sane ballpark.
