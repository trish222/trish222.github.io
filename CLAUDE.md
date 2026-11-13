# Portfolio agent guidance

This file holds the rules for every agent session (Claude Code, and Codex through AGENTS.md). Start each session by reading [docs/TODO.md](docs/TODO.md).

## Goal

Replace the procedural, real-time-lit desk scene with an authored Blender scene. Its lighting (shadows, bounce, AO) is baked offline in Cycles and shipped as `public/models/scene.glb`, then shown in Three.js with cheap materials. The live Win98 DOM desktop stays and is projected onto the CRT's `screen_plane`. Branch: `theme/crt-baked`. The current site stays live on `main`.

The look is a cozy rainy-night desk lit almost entirely by the green banker's lamp and the CRT glow, shot like a film still. Mood words: warm, hazy, lived-in, quiet, slightly desaturated, film grain. Palette: walnut and amber, aged-beige CRT, deep teal-blue night, Win98 teal on screen, LEGO pink as the single accent. Keep the signatures: the green banker's lamp with its pull chain, the brass nameplate, the pink LEGO cherry-blossom treehouse, the rainy window, the Win98 login, and project floppies/CDs that open project windows.

Fallback: if the Blender scene still looks amateur after a few rounds, use one pre-rendered Cycles still (2560 px) as the backdrop and project the live desktop onto it.

## Which document wins

- [docs/visual-plan.md](docs/visual-plan.md) and [docs/scene-contract.md](docs/scene-contract.md) govern the scene, art, lighting and rendering.
- [docs/architecture.md](docs/architecture.md) still governs the experience and interaction contract: the seated opening view, parallax, monitor entry/exit, the functional desktop, the lamp toggle, and the responsive query. Its clauses about procedural models, the frozen shadow map, real-time lighting and GTAO are superseded.
- [README.md](README.md) lists the commands.
- `docs/history/` holds superseded procedural-era docs. Do not read or follow them unless asked.

## Keep / replace

| File or folder (under `src/`) | Action | Notes |
| --- | --- | --- |
| `desktop/` (desktop, windows, resize, session) | Keep | The Win98 OS is done work |
| `overlay/projection.js`, `overlay/screenOverlay.js` | Keep, re-anchor | Read screen corners from the GLB's `screen_plane` instead of the procedural CRT |
| `overlay/desktopSnapshot.js` | Keep, extend | Snapshot becomes the CRT texture when zoomed out |
| `scene/camera.js`, `navigation.js`, `interaction.js`, `parallax.js` | Keep, recalibrate | Camera targets come from Empties in the GLB |
| `scene/animation.js`, `config/`, `utils/`, `tests/`, `scripts/`, workflows | Keep | Update tests for the new scene |
| `scene/createScene.js` | Rewrite | Load scene.glb, apply baked materials, wire named objects |
| `scene/lighting.js` | Mostly delete | Baked light replaces real-time lights and the shadow map |
| `scene/renderer.js` | Rewrite post chain | Drop SSAO and shadows; add bloom, grain, vignette via postprocessing |
| `computer.js`, `room.js`, `desks/`, `lamps/`, `nameplate.js`, `treehouse.js` | Delete | Replaced by Blender models |
| `nightwindow.js` | Replace | Video texture plane plus a rain-on-glass shader |
| `environment/presets.js` | Simplify | One scene; optional lamp-off variant |
| New: `scene/loadScene.js`, `scene/crtMaterial.js`, `lofi/` | Add | GLB loading, CRT screen shader, plain HTML lo-fi mode |
| New: `art/` (repo root, outside `public`) | Add | .blend source, bake scripts, raw textures; not shipped |

Files the plan does not list, with their decided fate (details in TODO P1/P6):

- `lamp-lab.js`: delete (orphaned).
- `lamp.js`: keep only the toggle state and logic.
- `tonemap.js`: delete in P6, once the AgX pass replaces it.
- `perf.js`, `debug/`: keep.
- `camera.js` screen constants: move to a temporary `scene/screenSpec.js` until P4 reads them from the GLB.

The lamp toggle survives with baked light: bake lamp-on and lamp-off lightmaps and crossfade between them in the material.

## Scene contract (summary)

The full contract and bake rules are in [docs/scene-contract.md](docs/scene-contract.md), which uses Blender 5.x through Blender MCP.

- `screen_plane` (flat quad, UV 0–1) drives projection corners, the CRT shader and the snapshot texture. `screen_glass` is for glare only.
- `click_crt`, `click_lamp_chain`, `click_project_01`…`_06`, `click_nameplate` and `click_treehouse` are invisible raycast proxies. They go through the existing nearest-hit picker.
- `window_view` holds the night-city video. `lamp_bulb` and `crt_glow` are the bloom emitters, tied to lamp state.
- `cam_overview`, `cam_screen` and `cam_mobile` are Empties that supply camera positions and look targets.
- `baked_*` meshes use the lightmap set (`UVMap_Light`, `lightmap_lampOn` / `lightmap_lampOff`).
- Name mismatches are fixed in Blender and re-exported, never aliased in code.

## Hard rules

- **Do not reintroduce procedural geometry.** No scene object is built in JavaScript; everything comes from the GLB. Do not bring back real-time shadow maps or SSAO/GTAO.
- Hero props (CRT, keyboard, lamp) are sourced from CC0/CC-BY libraries such as Poly Haven, Sketchfab and ambientCG, not modeled from scratch. Simple geometry like LEGO bricks may be generated in Blender Python. Credit every CC-BY asset in a Credits window.
- The `<=760px` / short-or-coarse fullscreen query in CSS must stay identical to `src/config/experience.js`.
- One press has one action.
- Keep generated output out of `src` and `public`. Captures go to ignored output directories.
- Preserve asset licenses. Do not use Microsoft artwork or bundled Microsoft fonts.
- After structural changes, run `npm run build`, `npm run check:build`, `npm run check:source` and `npm test` (with `npm run preview` running). Do not claim visual or performance gains without screenshot or profile evidence.
- Do not push, deploy or open PRs unless asked.

## Budgets

| Metric                            | Desktop            | Mobile                                |
| --------------------------------- | ------------------ | ------------------------------------- |
| Total download before first frame | ≤ 10 MB            | ≤ 6 MB (lower-res texture set)        |
| Draw calls                        | ≤ 80               | ≤ 50                                  |
| Texture memory                    | ≤ 256 MB           | ≤ 128 MB                              |
| Frame rate (idle, overview)       | 60 fps             | 30 fps or better on a mid-range phone |
| Device pixel ratio cap            | 2                  | 1.5                                   |
| Time to interactive               | ≤ 3 s on broadband | ≤ 5 s on 4G throttling                |

## References and tools

- Primary look targets: [docs/refs/retro-crt-portfolio.png](docs/refs/retro-crt-portfolio.png) and [docs/refs/retro-crt-portfolio2.png](docs/refs/retro-crt-portfolio2.png). Both show motivated warm lamp light, a real night-city photo behind the glass, story-telling clutter and worn materials.
- Current site: [docs/refs/current-portfolio.png](docs/refs/current-portfolio.png). It is evenly lit, with a flat purple wall and plastic-looking primitives.
- `docs/refs/design/` holds detail references for specific objects (CRT, cherry blossom). Open them only when working on that object, not every session.
- The screenshot scripts in `scripts/review/` (`npm run review -- URL OUTPUT` → `capture.mjs`) can be reused for the P6 comparison.

## Agent working rules

Two rules matter as much as any prompt: the agent works from a written TODO list, and it writes as little code as the task needs. Both go into CLAUDE.md in P0 so every session starts with them.

**The TODO list (docs/TODO.md)**

- P0 generates it from this plan: one section per phase P0–P8, each task a checkbox with its done-when check.
- Every session starts by reading TODO.md and works the first unchecked task(s) only.
- Every session ends by ticking finished tasks and adding a one-line note under each: what changed, any known issue.
- Work discovered mid-task goes into a Backlog section at the bottom, not into the current change. No work happens that isn't on the list.
- The Blender handoffs (B1, B2) appear in the list as tasks owned by Trish, so the agent knows when to wait.

**Concise code**

- Write the least code that meets the task. No speculative options, abstractions, config flags or helpers for one caller.
- Prefer Three.js and browser built-ins over new code; no new dependency without asking.
- Delete dead code, unused exports and commented-out blocks in files you touch. Comments explain why, never restate what.
- Keep files small: about 200 lines max per file and about 40 lines per function. Split by responsibility when a file grows past that.
- P1 adds npm run check:size, which fails the build if any file in src/ exceeds 250 lines; wire it into check:build.
- Each session reports lines added and removed. A visual or cleanup task that adds more than it removes needs a reason.
