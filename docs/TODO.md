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

- [x] **B1 (Trish):** approve the Blender MCP block-out previews matched to `cam_overview` against the primary refs. Done when: Trish signs off on the composition.
  - Note: block-out built and committed; scene in `art/scene.blend`, textures in `art/textures/`, budgets pass (5.19 MB / 2.96 MB, 45 draw calls). Known issue: overlay registration test fails until P4 reads `screen_plane`.
- [ ] Restore normal and roughness maps in `art/scene.blend` (re-download from Poly Haven/Sketchfab) so the bake captures surface detail; strip them only in the export/assets pipeline so the GLB stays in budget. Done when: the bake shows surface detail and `npm run assets` still passes budgets.
- [ ] Write `art/scripts/bake.py` (Blender 5.x, `blender -b art/scene.blend -P art/scripts/bake.py`): Smart-UV `UVMap_Light` atlases on `baked_*`, Cycles diffuse direct+indirect bakes at 2048 px with denoise, for lamp on and lamp off, saved to `art/bakes/`, then export `public/models/scene.glb` with custom properties. Done when: the script runs headless and prints a report of names that don't match the contract (empty).
- [x] Assemble the scene via Blender MCP: source hero props (CRT, keyboard, lamp) from CC0/CC-BY, generate LEGO bricks in Python, light it (lamp key, cool window fill, screen emitter), and name everything per `docs/scene-contract.md`. Done when: `art/scene.blend` exists and the name report is clean.
  - Note: block-out at metre scale saved to `art/scene.blend`, with textures in `art/textures/`, credits in `art/credits.md` and a preview at `art/previews/blockout-cam_overview.png`. An in-Blender name check is clean; bake.py's report is still to come. `npm run assets` passes budgets (desktop 5.19 MB / 45 draws / 200 MB tex; mobile 2.96 MB / 45 / 80 MB). Known issue: `tests/interaction.mjs` overlay alignment fails by 39 px until P4 drops `screenSpec.js`.
- [ ] bake.py must bake base color for procedural materials (e.g. the CRT plastic) so they survive export. Done when: the exported GLB shows the procedural albedo (CRT plastic, nameplate brass, lamp shade, coffee) as baked textures.
- [ ] bake.py must also bake the CRT detail pass (`art/scripts/crt_details.py`, node group `plastic_detail` on `Material.017`/`.018`/`.021`/`.022`/`mouse_beige`/`.004`): the micro-grain bump to a normal map, the noise roughness to a roughness map, and the procedural colours (top yellowing, AO grime, and the `detail_ink`/`led`/`beige` face-attribute tints for the badge, buttons and LEDs) into the albedo, plus the LED mask as an emissive map. Done when: the exported GLB shows the badge, beige buttons and glowing LEDs with no new material slots, and no face attributes or vertex colours are exported.
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
  - Interim: `baked_*` (and `screen_plane`) use flat `MeshBasicMaterial` with the GLB's map, colour, vertex colours and alpha until bake.py ships lightmaps.
- [ ] Keep metal and glass on MeshStandardMaterial with a small Poly Haven HDRI. Done when: brass and glass glint in the overview.
- [ ] Hook the `click_*` proxies into `interaction.js` through the nearest-hit picker. Done when: the CRT, lamp chain, projects, nameplate and treehouse each trigger exactly one action.
- [x] Re-anchor `overlay/projection.js` to the four corners of `screen_plane`, and read camera poses from the `cam_*` Empties; delete `scene/screenSpec.js`. Done when: no hard-coded screen or camera constants remain.
  - Note: corners come from the plane's UV corners and are measured in world space (meshopt quantization scales the node); no overscan inset. The rig flies from `cam_overview`/`cam_mobile` (GLB FOV) to `cam_screen`'s axis. `screenSpec.js`, `make-placeholder-glb.mjs`, `__zoom` and the legacy frustum knobs are deleted. Name check: only `window_glass` was off-contract; renamed to `baked_window_glass` in Blender and re-exported.
- [ ] Draw the project titles onto the floppy labels at runtime: a canvas over the blank `floppy_labels` atlas, laid out per the "Floppy labels" section of `docs/scene-contract.md` (cell i = `click_project_0i`), with titles taken from the project content. Done when: each floppy shows its project's title and clicking it opens that project.
- [ ] Playwright tests for the lamp toggle, CRT zoom, and projection alignment within 2 px. Done when: `npm test` includes them and they pass.
  - Partial: `tests/alignment.mjs` (in `npm test`) clicks `click_crt` and checks all four overlay corners against `screen_plane` at the overview, on arrival and after exit: worst error 0.28 px at 1440×900 and 390×844. The lamp crossfade test waits for the lightmap material.
- [x] `cam_screen` frames `screen_plane` straight-on: camera on the plane's normal through its center, no side angle. The zoomed view must not inherit the overview's yaw or parallax. Done when: the zoomed screen edges are parallel to the viewport edges.
  - Note: arrival lands on `cam_screen`'s axis through the plane centre; `alignment.mjs` measures 0.000 px edge skew.
- [x] Mouse parallax tuned for the new `cam_overview`: pointer up moves the view down, pointer right moves the view left (inverse, like looking around). Subtle range, smoothed, disabled in `cam_screen` and with `prefers-reduced-motion`; on touch devices use gentle device tilt or nothing. Done when it feels like leaning around the desk.
  - Note: strengths now metres (0.04 x / 0.025 y, 4.5 cm radial cap, 0.09 s smoothing); the camera keeps looking at the target, so the shift also rotates the view slightly. Gating (cam_screen, reduced motion, touch) was already in `scene.js`. `tests/interaction.mjs` thresholds retuned; `npm test` passes (19). No feel check by eye yet.

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

## Step 6 progress (scene finish, preview rendered 2026-11-13; awaiting Trish's review)

Saved in `art/scene.blend`; nothing exported to `public/`, nothing committed.

- Done: bezel rim, `screen_glass` and `crt_glow` refit to `screen_plane` (plane unchanged), so the pale band is gone in Blender. Papers are now paper-thin; floppies restacked on them with `click_project_*` moved to match. Project labels on the floppies (`baked_floppy_labels`, built by `art/scripts/floppy_labels.py`; titles are drawn from the resume, so Trish should confirm them). Pencils and pen in the cup (joined into `baked_pencilcup`). Mug (`baked_mug`, CC BY, credited). Sheer curtains (`baked_curtains`). Treehouse rebuilt with a green studded baseplate (`art/scripts/treehouse.py`, which also refits `click_treehouse`). Noise-driven roughness and tint wear on CRT plastics, desk, brass, LEGO, mug, floor, wall, lamp and stationery. `click_*` proxies hidden from renders.
- Lighting (in progress): Cycles on the M1 GPU. Lamp key is a 2700 K area light, moved under the shade (the shade is a closed solid that blocked it), at 6 W. Lamp bulb uses a 2700 K blackbody. The CRT emits Win98 teal. The window fill is cool at 4 W. The world HDRI stays at 0.04. `window_view` now projects the Shanghai Bund HDRI as an emissive night-city photo (strength 0.22, saturation 0.7; Blender only, not exportable).
- Look-tuning done: `window_view` strength 0.22→0.09 and saturation 0.6; screen emission 3→1.4; `light_screen` 0.6→2.5 W so the keyboard catches the CRT; lamp key 6→3.8 W; new `light_fill_right` (1.2 W, warm) so the treehouse reads; `brass` metallic 1→0.35 so the nameplate engraving reads (full metal mirrored the dark room and would bake black). Final render: `art/previews/step6-cam_overview.png` (1920×1080, 256 spp).
- Open for Trish: the banker's-lamp shade reads near-black. Its texture is very dark green, and a cool rim light from the window had no visible effect. Brighten the shade's albedo or give it a faint glass emission. The CRT bezel's inner chamfer is slightly hot.
- Half-finished or needs follow-up: the pale-band fix and the new objects reach the site only after export (bake.py / P2). Sheer curtains need an alpha-blended material on the web side. The Verbatim "V" is still embossed on the floppy shutters.
- Round 2 (finished 2026-11-13; saved, rendered to `art/previews/step6-cam_overview-r2.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Done (1) lamp shade: green texels of `baked_lamp` moved to a new `lamp_shade` material: mid emerald, roughness 0.18, clear coat, faint warm-green emission 0.12. New `light_shade_spec` is glossy-only and light-linked to `baked_lamp` (collection `ll_shade_spec`) so it adds a top highlight.
  - Done (2) bezel edge: `light_screen` moved forward (y −0.145 → −0.20) and its spread narrowed to 70° so it no longer floods the inner chamfer.
  - Done (3) CRT plastic: `Material.017`/`.018` now use flat aged beige with low-frequency yellowing noise and AO-driven grime; dark texels (vents, tube) keep the texture. The procedural albedo won't export to the GLB, so bake.py must bake albedo too.
  - Done (4) CRT top: verts of `baked_crt_monitor` and `click_crt` above z 1.240 compressed so the top goes 1.306 → 1.278 (top bezel ≈ 4.2 cm, sides ≈ 3.8 cm). `screen_plane`, `screen_glass`, `crt_glow` and `cam_screen` are untouched; the alignment test isn't rerun because nothing was exported.
  - Done (5) city view: `window_view_night` adds a white-noise jitter to the lookup (soft blur at render spp), saturation 0.35, contrast −0.4, a sodium-orange multiply and strength 0.12.
  - Done (6) iced coffee: the liquid (brown vertex colour) gets a height ramp, dark coffee to a cream layer in the top ~25%; ice and straw keep their vertex colours.
  - Done (9) nameplate: bevel widened to 1.5 mm (4 segments), then Bevel + Boolean applied; `tmp_letters` and `tmp_cam` deleted (`nameplate_brass_orig` mesh still kept with a fake user). `nameplate_brass` is now warm brass (base 0.62/0.36/0.09, metallic 0.6, coat 0.25), and the plate joined `ll_shade_spec` so the glossy-only `light_shade_spec` gives the bevel a highlight. Known issue: the highlight is a thin line on the top and bottom edges, not a strong glint.
  - Done (8) light reach: `light_bounce_right` is now 1.6 W, 1.2×0.8 m and a deeper amber, so the right desk falls off from the lamp and the papers no longer read near-white.
  - Done (7) treehouse: `blossom()` takes radii in metres (converted to studs/plates), the trunk is 62 plates with a gentle curve and branches to every tier, and there are three rounded tiers plus a hut cluster and four `droop()` hanging clusters. It is now 26 cm tall (was 19 cm) and 42k verts (was 28k), and the canopy overhangs the plate by about 2 cm on the left and 6 cm on the right, over the books. `click_treehouse` refit.
  - Done (10) floppy labels: `floppy_labels.py` writes a blank atlas (paper, colour band, ruled lines; no text). The existing UVs already matched cell i = `click_project_0i` with a consistent orientation, so they were kept. Layout documented in `scene-contract.md` ("Floppy labels"). Added the P4 runtime-label task and the P2 bake-albedo task.

- Round 3 (finished 2026-11-13; saved, rendered to `art/previews/step6-cam_overview-r3.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Done (1) window view: rebuilt the `window_view_night` colour chain. The HDRI is desaturated (0.35), passed through gamma 1.7 so mids drop while HDR lights stay hot, tinted warm with a 60% sodium multiply and lifted toward blue-black (+0.01/0.02/0.05) at strength 0.035. The cube jitter is now a disc of radius 0.009 (in direction space), so bright points blur into round bokeh. Known issue: the sheer curtains still read bright at both window edges.
  - Done (2) treehouse canopy: `build_canopy()` now places 13 overlapping near-round clusters (2–4.4 cm, slightly flattened, spread front to back and weighted to one side) plus the hut cluster and two short `droop()` sprays. Height (26.6 cm), trunk curve and hut are unchanged; two branch targets moved to meet the new clusters. 37k verts.
  - Done (3) lamp shade: `lamp_shade` base 0.004/0.13/0.045 and emission 0.04/0.55/0.2 at 0.1 (was a yellow-green emission that read sage); coat and roughness kept.
  - Done (4) grounding: in `baked_crt_keyboard`, the keyboard's islands were lowered 3.9 mm and the mouse's 1.9 mm to the desk top (z 0.7499). The keyboard's base lies wholly on the desk (y −0.388 vs the desk edge at −0.394); only its upper front lip overhangs, and moving it back is blocked by the computer case. A close-up shows a dark contact line under the front edge. The nameplate is flush, and the floppies rest on the papers. Known issue: the mouse's edge now clips the paper-stack corner by about 1.5 mm, hidden under the mouse.
  - Done (5) lamp reach: new `light_lamp_spill` (2700 K elliptical area light, 1.0×0.7 m, 2 W, diffuse-only so it doesn't wash out the brass) above the front-centre of the desk; `light_lamp_key` raised 3.8 → 4.3 W. `nameplate_brass` base deepened to 0.52/0.28/0.06. bake.py must treat `light_lamp_spill` as a lamp light (off in the lamp-off bake).

- Round 4 (2026-11-13; saved, rendered to `art/previews/step6-cam_overview-r4.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Waiting (1) nameplate font: Cinzel Regular, Cormorant Garamond SemiBold and IM Fell English are in `art/fonts/` with their OFL texts (static instances cut from the variable fonts with fontTools). Each is engraved 0.6 mm deep into a rebuilt blank plate (`nameplate_brass_blank`) and stored as the meshes `nameplate_brass_cinzel` / `_cormorant` / `_imfell` (fake users). Comparison: `art/previews/nameplate-fonts.png`. The plate still shows the old font (mesh `nameplate_brass_dejavu`); to apply, set `baked_nameplate_brass.data` to the picked mesh and delete the other fonts. Known issue: IM Fell is 23k verts (others 4–5k), so decimate it if picked.
  - Done (2) lamp shade: `lamp_shade` is now procedural cased glass. Patchy deep-to-mid emerald (thickness noise), smudged roughness 0.05–0.2 and coat roughness 0.02–0.12, faint waviness and pitting bump, emission that grows toward the lower edge, and an opal-white underside plus a 1 mm rim band. The shade's brass fittings (finials, bracket, yoke and collars above z 0.995) moved to a new `lamp_trim_brass`, a copy of the lamp texture warmed toward brass with patchy tarnish and metallic ≥ 0.6; the stand keeps `DefaultMaterial`. The procedural albedo is another bake-albedo case for P2.
  - Done (3) lamp reach: new `light_lamp_reach` (2700 K, 0.25×0.12 m, 3.5 W, diffuse-only) at the shade, aimed across to the right desk; new `light_lamp_reach_right` (2700 K ellipse, 0.7×0.45 m, 1 W, diffuse-only) over the right desk, because the CRT shades the books and treehouse from the lamp. At 960 px, mean luma vs r3: right desk 68→106, books 33→58, treehouse base 24→43; left desk stays brightest at 128. Known issue: the wall under the right sill rose 32→46, and the CRT bezel 126→138. bake.py must treat both as lamp lights.
  - Done (4) keyboard: keyboard islands of `baked_crt_keyboard` (plus its cable) and all of `baked_crt_keycaps` moved 1.5 cm to −x; z unchanged, so it stays grounded. The mouse is untouched, and the nearest object (the nameplate) is 7.6 cm away.
  - Done (5) city view: the round-3 blur radius was the second input of `Math.002` (a halving attempt on the first input did nothing); it went from 0.009 to 0.0045. The lookup now reads `art/textures/shanghai_bund_8k_city.hdr` (a 1272×744 crop of the 8k HDRI, 2.5 MB, via equirect-to-crop math nodes) instead of the 4k, so the buildings and window rows read faintly. The world light still uses the 4k.
  - Done (6) sill and frame: `baked_sill` and `baked_window_frame` use the new procedural `walnut_dark` (wave and noise grain along each member, uprights switched to z, a 0.018–0.14 dark walnut ramp, bevel-driven edge wear that is lighter and rougher). `plank_flooring_04` now has no users.
  - Done (7) curtains: `curtain_sheer` base 0.8 → 0.42 and translucency 0.85 → 0.36; curtain mean luma 109 → 84. The city lights seen through them stay the brightest pixels.

- Round 5 (2026-11-14; saved, rendered to `art/previews/step6-cam_overview-r5.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Done (1) nameplate: `baked_nameplate_brass` now uses `nameplate_brass_cinzel`. The `_dejavu`, `_cormorant` and `_imfell` meshes and the Cormorant/IM Fell font datablocks were removed from the .blend, their files and OFL texts were deleted from `art/fonts/`, and the credits row now lists Cinzel only. `nameplate_brass_blank` and `_orig` are kept.
  - Done (2) brightness: `light_lamp_reach` 3.5 → 1.4 W, re-aimed down at the right desk (target 0.6/−0.05/0.85, spread 75° → 55°) so it stops washing the wall; `light_lamp_reach_right` 1 → 0.3 W, re-aimed straight down at the desk (it was tilted toward the wall). Mean luma at 960 px, r3/r4/r5: left desk 111/120/117, right desk 81/119/101, wall under sill 34/45/32, lamp pool 140/154/153. Known issue: books (34/60/36) and treehouse base (16/29/16) fell back to r3 levels.
  - Done (3) CRT: beige in `Material.017`/`.018` darkened and warmed (0.64/0.58/0.44 → 0.42/0.355/0.245 and 0.62/0.53/0.36 → 0.39/0.32/0.20). Top bezel luma 156 → 131, lower bezel 162 → 134, now below the lamp pool.
  - Done (4) city view: bokeh radius (`Math.002`) 0.0045 → 0.003.

- Round 6 (2026-11-14; saved, rendered to `art/previews/step6-cam_overview-r6.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Done (1) right desk: new `light_right_accent` (2700 K ellipse, 0.3×0.2 m, 0.22 W, spread 55°, diffuse-only) straight above the books and floppies, and `light_treehouse_accent` (2700 K, 0.2 m, 0.12 W, diffuse-only) light-linked to `baked_treehouse` alone via collection `ll_treehouse`, so the wall can't pick it up. Mean luma at 960 px, r5 → r6 test: right desk 101→106, floppies 88→105, mug 86→108, books 36→50, blossoms 60→96, treehouse base 16→26; left desk 117 and wall under the right sill 16 unchanged. bake.py must treat both as lamp lights and keep the light linking.
  - Done (2) keyboard: `Material.021`/`.022` get an `aged_beige` multiply (0.66/0.60/0.52) after the tint mix; keyboard luma 115 → 94, close to the CRT case. Another bake-albedo case for P2.
  - Done (3) city view: bokeh radius 0.003 → 0.002; strength unchanged, so it stays darker than the desk.

- Round 7 (2026-11-14; saved, rendered to `art/previews/step6-cam_overview-r7.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Done (1) mouse: its 921 faces in `baked_crt_keyboard` (y < −0.2, x > 0.25) moved to `mouse_beige`, a copy of `Material.021` with `aged_beige` 0.27/0.225/0.16. Mouse luma 148 → 103 (keys 86; it sits in the brighter right-front light). Another bake-albedo case for P2.
  - Done (2) city view: the real blur radius is `Math.002`'s second input (the r6 change edited its linked first input, so it did nothing); 0.0045 → 0.0011. Building edges and window rows now read; window luma 84 → 73, still below the desk.
  - Done (3) right side: `light_right_accent` 0.22 → 0.38 W, `light_treehouse_accent` 0.12 → 0.19 W. Mean luma at 960 px, r6 → r7: books 48→56, mug 108→117, floppies 102→108, blossoms 120→131; left desk 139, wall under the right sill 13 and curtains 85/83 unchanged.

- Round 8, CRT detail pass (2026-11-14; saved, rendered to `art/previews/step6-cam_overview-r8.png` and `art/previews/crt-closeup.png` at 1920×1080, 256 spp; nothing exported or committed; awaiting Trish's review).
  - Done: new `art/scripts/crt_details.py` (rerunnable). On `baked_crt_monitor`'s chin it adds a rounded power button (12×7 mm), a 3 mm green LED and an embossed Cinzel "TRISH" badge, conformed to the curved bezel and joined into the monitor mesh. On the case, the green LED in `baked_crt_cables` now glows and its blue power button is retinted beige. All of it is tinted through face attributes (`detail_ink`, `led`, `beige`) in the existing materials: no new slots, so draw calls are unchanged (47 mobile).
  - Done: a shared `plastic_detail` node group on the monitor, case, keyboard and mouse adds top-surface yellowing (by world normal Z), AO grime in seams, vents and around keys, and a sub-millimetre noise bump. Roughness on `Material.017`/`.018` went from a flat 0.62 to noise-varied 0.40–0.54, and on the keyboard and mouse from 0.42–0.68 to 0.36–0.55. Specular went to 0.5. `screen_plane`, `screen_glass`, `crt_glow` and `cam_screen` were not touched.
  - Done (tweak, after the renders, not re-rendered): the badge is now 10 mm Cinzel, faux-bolded by a second copy shifted 0.18 mm (a curve offset broke the outlines), with ink 0.72 → 0.88. Font curve resolution 12 → 3, so the monitor went from 11,659 to 9,390 faces. The monitor LED is 4 mm across (was 3.2) and glows 1.6× the case LED (`led` = 1.6). The r8 and close-up renders predate this tweak.
  - Known issue: the case LED and button sit behind the keyboard, so they barely show from `cam_overview`. The grain and sheen are subtle at overview distance and show mainly in the close-up. All of it needs the P2 bake (see the P2 task).

## Backlog

- split src/scene.js (1058 lines; capped in `scripts/check-size.mjs`)
- split src/desktop/desktop.js (455 lines; capped)
- split src/desktop/windows.js (438 lines; capped)
- split src/style.css (1628 lines; capped)
- `public/textures/desk-wood-*` are orphaned since the procedural desk was deleted; remove them or reuse in P2/P4.
- `src/style.css` comments reference `VOID` in `room.js` and `SCREEN_W/H` in `computer.js`; fix them when P1 touches those values.
- `window_view` is a flat teal placeholder; needs a real night-city photo/video (P5).
- Treehouse canopy is a round blob; flatten and tier it like `docs/refs/design/cherryblossom.png`. (Rebuilt tiered in B1 round 2; awaiting Trish's review.)
- Plaster wall reads grey; warm it toward the palette. (Tinted deep warm brown in B1 round 2; awaiting review.)
- Floppy labels show the Verbatim brand; replace with project labels (P8).
- `docs/architecture.md` still describes procedural models and the frozen shadow map; update its scene/rendering sections after P4.
- Sheer curtains (Step 6), fallback regular curtains or blinds.
- `screen_glass`/`crt_glow` show a pale band above and below `screen_plane` at arrival; resize the glass opening or the plane in Blender so the live DOM fills the tube.
- `art/previews/blockout-cam_overview.png` predates B1 round 2; re-render it.
- `src/style.css` comments still cite `screenSpec.js`, `SCREEN_W/H` and the overscan inset; update them with the CSS split.
