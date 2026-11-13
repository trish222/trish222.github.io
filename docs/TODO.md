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

- [ ] Delete `src/computer.js`, `room.js`, `desks/`, `lamps/`, `nameplate.js`, `treehouse.js`, `nightwindow.js`. Done when: `npm run check:source` reports no missing imports.
- [ ] Move `FACING`, `MON_W`, `MON_H`, `SCREEN_W`, `SCREEN_H`, `OVERSCAN` into `src/scene/screenSpec.js` as a temporary stand-in for `camera.js` and `scene.js`. Done when: no module imports `computer.js` (P4 replaces these with values from `screen_plane` and the cam_* Empties).
- [ ] Strip `src/scene.js` of desk/lamp/room/rain/treehouse/nameplate wiring (`deskMod`, `lampMod`, `resolveDesk`, `resolveLamp`, `disposeRoom`, `ROOM_PLAN`, `ROOM_RADIUS`, `setFogRange`, `VOID`, `rainState`, `tickRain`, `loadScreenFont`, the `?desk=`/`?lamp=` variants). Done when: the site boots to the placeholder scene and the desktop works.
- [ ] Delete `src/lamp-lab.js` (orphaned; `lamp-lab.html` doesn't exist). Done when: the file is gone and no references remain.
- [ ] Reduce `src/lamp.js` to the toggle state/logic the lamp interaction needs; no geometry. Done when: the lamp toggle test passes against a placeholder proxy.
- [ ] Simplify `src/environment/presets.js` so it no longer imports `nightwindow.js`. Done when: one scene and no scenery builder remain.
- [ ] Remove the `room.js` `VOID` dependency from `src/debug/geometry.js`; keep `src/debug/` and `src/perf.js`. Done when: the diagnostics build without `room.js`.
- [ ] Remove real-time shadows from `scene/lighting.js` and GTAO/SSAO from `scene/renderer.js`. Done when: grep finds no `shadowMap`, `castShadow` or `GTAOPass` in `src/`.
- [ ] Create `src/scene/loadScene.js` (GLTFLoader + KTX2Loader + MeshoptDecoder) and a placeholder `public/models/scene.glb`: a box named `screen_plane` plus contract-named Empties. Rewrite `createScene.js` to use it. Done when: the placeholder loads and the projection anchors to `screen_plane`.
- [ ] Update tests and `scripts/review` that use `__rain`, `__gtao`, `__probes`, `__lights`, `?desk=` and `?lamp=` (`tests/lifecycle.mjs`, `tests/interaction.mjs`, `scripts/review/render-quality.mjs`, `nameplate.mjs`). Delete the `foundation-*` review scripts that only exist for the old lighting. Done when: `npm test` and `npm run test:lifecycle` pass.
- [ ] Add `npm run check:size` (fails if any `src/` file is over 250 lines) and wire it into `check:build`. Done when: it runs inside `check:build`; files over the limit are listed in Backlog if they can't be split yet.
- [ ] Update the README file map and `.github/copilot-instructions.md` (point it to CLAUDE.md) for the new layout. Done when: no doc names a deleted file as current.
- [ ] Verify. Done when: `npm test`, `npm run build`, `check:build` and `check:source` all pass; report the lines added and removed.

## P2 — Blender scene

- [ ] **B1 (Trish):** approve the Blender MCP block-out previews matched to `cam_overview` against the primary refs. Done when: Trish signs off on the composition.
- [ ] Write `art/scripts/bake.py` (Blender 5.x, `blender -b art/scene.blend -P art/scripts/bake.py`): Smart-UV `UVMap_Light` atlases on `baked_*`, Cycles diffuse direct+indirect bakes at 2048 px with denoise, for lamp on and lamp off, saved to `art/bakes/`, then export `public/models/scene.glb` with custom properties. Done when: the script runs headless and prints a report of names that don't match the contract (empty).
- [ ] Assemble the scene via Blender MCP: source hero props (CRT, keyboard, lamp) from CC0/CC-BY, generate LEGO bricks in Python, light it (lamp key, cool window fill, screen emitter), and name everything per `docs/scene-contract.md`. Done when: `art/scene.blend` exists and the name report is clean.
- [ ] **B2 (Trish):** approve the baked render previews (lamp on and off). Done when: Trish signs off; `public/models/scene.glb` is exported.

## P3 — Asset pipeline

- [ ] Add `npm run assets`: `@gltf-transform/cli` meshopt, textures resized to 2048 (desktop) and 1024 (mobile), KTX2 (UASTC lightmaps, ETC1S albedo), outputs `scene.glb` and `scene-mobile.glb`. Done when: it is reproducible from `art/` output.
- [ ] Add `scripts/check-assets.js` that fails when any budget in visual-plan is exceeded, and wire it into `check:build`. Done when: it passes on the current assets and fails on an over-budget test file.

## P4 — Integration

- [ ] In `createScene.js`, give `baked_*` meshes a material that multiplies albedo by a lightmap, with a `lampMix` uniform that crossfades lampOn/lampOff. Done when: the lamp toggle crossfades in under 400 ms.
- [ ] Keep metal and glass on MeshStandardMaterial with a small Poly Haven HDRI. Done when: brass and glass glint in the overview.
- [ ] Hook the `click_*` proxies into `interaction.js` through the nearest-hit picker. Done when: the CRT, lamp chain, projects, nameplate and treehouse each trigger exactly one action.
- [ ] Re-anchor `overlay/projection.js` to the four corners of `screen_plane`, and read camera poses from the `cam_*` Empties; delete `scene/screenSpec.js`. Done when: no hard-coded screen or camera constants remain.
- [ ] Playwright tests for the lamp toggle, CRT zoom, and projection alignment within 2 px. Done when: `npm test` includes them and they pass.

## P5 — CRT and window

- [ ] Create `src/scene/crtMaterial.js`: the snapshot texture with barrel distortion, scanlines, RGB mask, vignette, bloom-friendly brightness and subtle flicker. When zoomed in, hide it and show the live DOM with a CSS scanline/vignette overlay. Done when: the zoom transition has no visible pop.
- [ ] `window_view` plays the muted looping `public/media/window.mp4` with a poster fallback, plus a rain-droplets-on-glass shader. Done when: it plays, and with reduced motion it shows only the poster/static frame.

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

- `src/style.css` comments reference `VOID` in `room.js` and `SCREEN_W/H` in `computer.js`; fix them when P1 touches those values.
- `docs/architecture.md` still describes procedural models and the frozen shadow map; update its scene/rendering sections after P4.
