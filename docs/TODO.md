# TODO

Generated in P0 from [visual-plan.md](visual-plan.md). Work the first unchecked task(s) only. When a session ends, tick the finished tasks and add a one-line note under each: what changed, plus any known issue. New work goes in Backlog.

## P0 — Context

- [x] Replace CLAUDE.md with goal, keep/replace table, scene contract, budgets, the no-procedural-geometry rule, and the Agent working rules verbatim. Done when: the rules section diffs clean against visual-plan.
  - Note: CLAUDE.md rewritten; AGENTS.md now points to it.
- [x] Create docs/TODO.md from the phases and prompts. Done when: P0–P8 and Backlog exist, and every task has a done-when check.
  - Note: created; P1 includes the decided fates for files the table doesn't list.
- [x] Check the keep/replace table against the import graph. Done when: every import that breaks after the Delete rows are removed is listed (reported in the P0 session; reflected in the P1 tasks below).
  - Note: camera.js (a Keep row) and debug/geometry.js (unlisted) depend on deleted files.

## P1 — Gut the scene

- [x] Delete `src/computer.js`, `room.js`, `desks/`, `lamps/`, `nameplate.js`, `treehouse.js`, `nightwindow.js`. Done when: `npm run check:source` reports no missing imports.
  - Note: all seven files deleted plus `src/environment/`; `check:source` clean (26 modules, no cycles).
- [x] Move `FACING`, `MON_W`, `MON_H`, `SCREEN_W`, `SCREEN_H`, `OVERSCAN` into `src/scene/screenSpec.js` as a temporary stand-in for `camera.js` and `scene.js`. Done when: no module imports `computer.js` (P4 replaces these with values from `screen_plane` and the cam_* Empties).
  - Note: `src/scene/screenSpec.js` holds the constants; `camera.js` and `scene.js` import it, nothing imports `computer.js`.
- [x] Strip `src/scene.js` of desk/lamp/room/rain/treehouse/nameplate wiring (`deskMod`, `lampMod`, `resolveDesk`, `resolveLamp`, `disposeRoom`, `ROOM_PLAN`, `ROOM_RADIUS`, `setFogRange`, `VOID`, `rainState`, `tickRain`, `loadScreenFont`, the `?desk=`/`?lamp=` variants). Done when: the site boots to the placeholder scene and the desktop works.
  - Note: `scene.js` 1355 → 1058 lines; boots on the placeholder and `npm test` passes. Fog, `ROOM_*`, moon, rain, env map and the motion composer are gone; the `navigation.js` wall leash went too, since the ±7° limit already governed.
- [x] Delete `src/lamp-lab.js` (orphaned; `lamp-lab.html` doesn't exist). Done when: the file is gone and no references remain.
  - Note: deleted, no references remain.
- [x] Reduce `src/lamp.js` to the toggle state/logic the lamp interaction needs; no geometry. Done when: the lamp toggle test passes against a placeholder proxy.
  - Note: `lamp.js` is now `createLampState` (577 → 25 lines); the toggle and keyboard tests pass, and the `click_lamp_chain` proxy is wired into the picker (no automated click test on it yet).
- [x] Simplify `src/environment/presets.js` so it no longer imports `nightwindow.js`. Done when: one scene and no scenery builder remain.
  - Note: file deleted, since nothing needs a scenery preset.
- [x] Remove the `room.js` `VOID` dependency from `src/debug/geometry.js`; keep `src/debug/` and `src/perf.js`. Done when: the diagnostics build without `room.js`.
  - Note: `debug/geometry.js` takes the background colour as an argument; `__shadowfit`, `__room`, `__lights`, `__rain`, `__probes` and `__gtao` removed from `debug/experience.js` (432 → 232 lines).
- [x] Remove real-time shadows from `scene/lighting.js` and GTAO/SSAO from `scene/renderer.js`. Done when: grep finds no `shadowMap`, `castShadow` or `GTAOPass` in `src/`.
  - Note: `grep shadowMap|castShadow|GTAOPass src` is empty; the composer is RenderPass + OutputPass.
- [x] Create `src/scene/loadScene.js` (GLTFLoader + KTX2Loader + MeshoptDecoder) and a placeholder `public/models/scene.glb`: a box named `screen_plane` plus contract-named Empties. Rewrite `createScene.js` to use it. Done when: the placeholder loads and the projection anchors to `screen_plane`.
  - Note: `loadScene.js` loads the GLB with KTX2/meshopt wired in (KTX2 uses three's bundled transcoder, so there is no `public/basis`). The placeholder comes from `scripts/make-placeholder-glb.mjs` and uses a flat quad for `screen_plane`, per the contract, so the flat-plane assertion stays intact. The KTX2/meshopt paths are untested until P3.
- [x] Update tests and `scripts/review` that use `__rain`, `__gtao`, `__probes`, `__lights`, `?desk=` and `?lamp=` (`tests/lifecycle.mjs`, `tests/interaction.mjs`, `scripts/review/render-quality.mjs`, `nameplate.mjs`). Delete the `foundation-*` review scripts that only exist for the old lighting. Done when: `npm test` and `npm run test:lifecycle` pass.
  - Note: `npm test` and `test:lifecycle` pass (lifecycle runs on the dev server at 4321). The `foundation-*`, `compare-foundation` and `nameplate` scripts are deleted and `render-quality.mjs` trimmed.
- [x] Add `npm run check:size` (fails if any `src/` file is over 250 lines) and wire it into `check:build`. Done when: it runs inside `check:build`; files over the limit are listed in Backlog if they can't be split yet.
  - Note: `scripts/check-size.mjs` with capped allowlist (no warn mode); `check:build` runs it. Four capped files are in the Backlog as `split <file>`.
- [x] Update the README file map and `.github/copilot-instructions.md` (point it to CLAUDE.md) for the new layout. Done when: no doc names a deleted file as current.
  - Note: README map, the `style.css` comments and `.github/copilot-instructions.md` updated.
- [x] Verify. Done when: `npm test`, `npm run build`, `check:build` and `check:source` all pass; report the lines added and removed.
  - Note: build, `check:build`, `check:source`, `check:size`, `npm test` and `test:lifecycle` pass. No visual or performance claims.

## P2 — Blender scene

- [ ] **B1 (Trish):** approve the Blender MCP block-out previews matched to `cam_overview` against the primary refs. Done when: Trish signs off on the composition.
- [ ] Write `art/scripts/bake.py` (Blender 5.x, `blender -b art/scene.blend -P art/scripts/bake.py`): Smart-UV `UVMap_Light` atlases on `baked_*`, Cycles diffuse direct+indirect bakes at 2048 px with denoise, for lamp on and lamp off, saved to `art/bakes/`, then export `public/models/scene.glb` with custom properties. Done when: the script runs headless and prints a report of names that don't match the contract (empty).
- [x] Assemble the scene via Blender MCP: source hero props (CRT, keyboard, lamp) from CC0/CC-BY, generate LEGO bricks in Python, light it (lamp key, cool window fill, screen emitter), and name everything per `docs/scene-contract.md`. Done when: `art/scene.blend` exists and the name report is clean.
  - Note: block-out at metre scale saved to `art/scene.blend`, with textures in `art/textures/`, credits in `art/credits.md` and a preview at `art/previews/blockout-cam_overview.png`. An in-Blender name check is clean; bake.py's report is still to come. `npm run assets` passes budgets (desktop 5.19 MB / 45 draws / 200 MB tex; mobile 2.96 MB / 45 / 80 MB). Known issue: `tests/interaction.mjs` overlay alignment fails by 39 px until P4 drops `screenSpec.js`.
- [ ] **B2 (Trish):** approve the baked render previews (lamp on and off). Done when: Trish signs off; `public/models/scene.glb` is exported.

## P3 — Asset pipeline

- [x] Add `npm run assets`: `@gltf-transform/cli` meshopt, textures resized to 2048 (desktop) and 1024 (mobile), KTX2 (UASTC lightmaps, ETC1S albedo), outputs `scene.glb` and `scene-mobile.glb`. Done when: it is reproducible from `art/` output.
  - Done: `scripts/assets.mjs` reads `art/export/scene-raw.glb` and writes `public/models/scene.glb` (2048) and `scene-mobile.glb` (1024): resize, UASTC for `lightmap*`, ETC1S for the rest, meshopt. Verified with a synthetic raw GLB only; the real export arrives with P2. Missing input or `toktx` exits with a clear message.
- [x] Add `scripts/check-assets.js` that fails when any budget in visual-plan is exceeded, and wire it into `check:build`. Done when: it passes on the current assets and fails on an over-budget test file.
  - Done: budgets are parsed from the visual-plan table. Download size, draw calls and worst-case texture memory are checked per GLB; it passes on the placeholders and fails on a 341 MB-texture test file. The placeholder script now also writes `scene-mobile.glb`. Download is the GLB only, not the whole first-frame load.
- [x] Verify KTX2 decoding with a real KTX2 texture. Confirm whether KTX2Loader needs setTranscoderPath with basis_transcoder.js/.wasm served from public/ (copied from three/examples/jsm/libs/basis/); fix if so. Done when a KTX2 texture loads in the browser with no console errors.
  - Done: `KTX2Loader` needed `setTranscoderPath`. `public/basis/` holds the transcoder and its Apache-2.0 `LICENSE.txt`, and `loadScene.js` points at it. Verified in Chromium: UASTC and ETC1S textures transcode with no loader errors.

## P4 — Integration

- [ ] In `createScene.js`, give `baked_*` meshes a material that multiplies albedo by a lightmap, with a `lampMix` uniform that crossfades lampOn/lampOff. Done when: the lamp toggle crossfades in under 400 ms.
- [ ] Keep metal and glass on MeshStandardMaterial with a small Poly Haven HDRI. Done when: brass and glass glint in the overview.
- [ ] Hook the `click_*` proxies into `interaction.js` through the nearest-hit picker. Done when: the CRT, lamp chain, projects, nameplate and treehouse each trigger exactly one action.
- [ ] Re-anchor `overlay/projection.js` to the four corners of `screen_plane`, and read camera poses from the `cam_*` Empties; delete `scene/screenSpec.js`. Done when: no hard-coded screen or camera constants remain.
- [ ] Playwright tests for the lamp toggle, CRT zoom, and projection alignment within 2 px. Done when: `npm test` includes them and they pass.
- [ ] `cam_screen` frames `screen_plane` straight-on: camera on the plane's normal through its center, no side angle. The zoomed view must not inherit the overview's yaw or parallax. Done when: the zoomed screen edges are parallel to the viewport edges.

## P5 — CRT and window

- [ ] Create `src/scene/crtMaterial.js`: the snapshot texture with barrel distortion, scanlines, RGB mask, vignette, bloom-friendly brightness and subtle flicker. When zoomed in, hide it and show the live DOM with a CSS scanline/vignette overlay. Done when: the zoom transition has no visible pop.
- [ ] `window_view` plays the muted looping `public/media/window.mp4` with a poster fallback, plus a rain-droplets-on-glass shader. Done when: it plays, and with reduced motion it shows only the poster/static frame.
- [ ] Convex CRT look when zoomed in, per `docs/refs/design/ref-curved-screen.png`: content bulges, edges curve inward, corners rounded. Propose options before implementing; text must stay crisp and clicks must land where they appear.

## P6 — Look-dev

- [ ] Add pmndrs `postprocessing` (ask first; it is a new dependency) with one EffectPass: AgX tone mapping, selective bloom on `lamp_bulb`/`crt_glow`, vignette, grain, and mild edge chromatic aberration, plus a dev-only tuning panel. Done when: the post chain is one merged pass.
- [ ] Delete `src/tonemap.js` once the AgX pass replaces it. Done when: nothing imports it.
- [ ] Capture `cam_overview` at 1440×900 and 390×844 with the `scripts/review/` capture tools, set the captures next to `docs/refs/`, and write `docs/lookdev-review.md` covering lighting, color and detail differences with fixes. Done when: code-side fixes are applied and the Blender-side fixes are listed for Trish.

## P7 — Mobile and fallbacks

- [ ] Load `scene-mobile.glb` on touch devices or narrow viewports, cap DPR at 1.5, use `cam_mobile` framing so the monitor fills portrait screens, and make zoom-in the default tap. Done when: on a 390×844 portrait screen the monitor fills the view and every app is tappable.
- [ ] Build `src/lofi/`: a plain-HTML Win98-styled portfolio built from the same content, reachable from a LO-FI button and used automatically when WebGL is missing. Done when: the no-WebGL test lands on lo-fi.
- [ ] Profile with `scripts/` and report the numbers against the budget table. Done when: every budget is met or listed in Backlog.

## P8 — Content and ship

- [ ] Audit `index.html` content: resume, projects, links, and a Credits window for CC-BY assets. Done when: every CC-BY asset is credited.
- [ ] Add OG/Twitter meta with a screenshot. Done when: the meta validates.
- [ ] Run every check, then open a PR from `theme/crt-baked` to `main` with a summary and before/after screenshots (only when Trish asks). Done when: all acceptance criteria in visual-plan are ticked and the Pages deploy succeeds.

## Backlog

- split src/scene.js (1058 lines; capped in `scripts/check-size.mjs`)
- split src/desktop/desktop.js (455 lines; capped)
- split src/desktop/windows.js (438 lines; capped)
- split src/style.css (1628 lines; capped)
- `public/textures/desk-wood-*` are orphaned since the procedural desk was deleted; remove them or reuse in P2/P4.
- `src/style.css` comments reference `VOID` in `room.js` and `SCREEN_W/H` in `computer.js`; fix them when P1 touches those values.
- `window_view` is a flat teal placeholder; needs a real night-city photo/video (P5).
- Treehouse canopy is a round blob; flatten and tier it like `docs/refs/design/cherryblossom.png`.
- Plaster wall reads grey; warm it toward the palette.
- Floppy labels show the Verbatim brand; replace with project labels (P8).
- `docs/architecture.md` still describes procedural models and the frozen shadow map; update its scene/rendering sections after P4.
