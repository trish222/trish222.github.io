# Retro CRT Portfolio: Visual Overhaul Plan

Nov 12, 2026 · @Trish

## Decision: continue the codebase, replace the art pipeline

Keep the repo. Throw away the procedural 3D scene and rebuild it as an authored, light-baked Blender scene loaded as a GLB.

The gap between your scene and the references is not code quality. It is how the pixels are made. Sites like these are almost always built by modeling and lighting the room in Blender, rendering the lighting (shadows, bounce light, AO) into textures offline with a path tracer, and then displaying those textures in Three.js with cheap materials. The browser shows something that looks like a Cycles render because it mostly is one.

Your current build does the opposite: geometry generated in code, then lit in real time with shadows, SSAO and post-processing. That is why it looks like plastic primitives and why it rendered slowly. No amount of prompting fixes this, because an LLM writing Three.js primitives cannot produce sculpted bevels, worn plastic, wood grain and soft global illumination.

What is worth keeping is the hard engineering: the DOM-to-CRT projection, the Win98 desktop and window manager, camera paths, interaction, tests and the GitHub Pages workflow. Those plug into a new scene with modest changes.

Fallback: if the AI-built Blender scene still looks amateur after a few rounds, simplify to a single high-quality pre-rendered image or looping video of the desk with the live HTML screen overlaid. That still looks like the references and is the cheapest path to done.

## Art direction

Target: a cozy rainy-night desk lit almost entirely by the green banker's lamp and the CRT glow, shot like a film still. Mood words to give every agent: warm, hazy, lived-in, quiet, slightly desaturated, film grain.

What the references do that yours does not yet:

- **Motivated lighting.** One warm key light (the lamp), a cool fill from the window, the screen as a soft emitter. Large areas fall into shadow. Your scene is evenly lit and the purple wall reads flat.
- **Real backgrounds.** Both references put a real photo or video of a night city behind the glass. A photograph instantly reads as real; procedural rain on a dark plane does not.
- **Clutter that tells a story.** Mugs, papers, books, a phone, cables. Ubernatural uses DVD spines as its project list; Felix Rieseberg uses VHS tapes labeled with past employers. Props are content.
- **Material wear.** Yellowed CRT plastic, scuffed desk varnish, fingerprints on brass. Roughness variation sells realism more than polygon count.
- **Camera grading.** Slight bloom on bright spots, vignette, grain, warm highlights and cool shadows.

Keep your signatures: the green banker's lamp with clickable pull chain, the brass nameplate, the pink LEGO cherry-blossom treehouse (it is the most personal object in the scene), the rainy window and the Win98 login. Add a stack of floppy disks or CD cases whose labels are your projects, and make each one open that project's window.

Palette: walnut and amber for the desk and lamp light, aged beige for the CRT, deep teal-blue night outside, Win98 teal on screen, with LEGO pink as the single accent.

## Tools and asset sources

The one essential new tool is Blender. Everything else is free and small. Verify versions at install time.

| Tool                   | What it does here                                                    | Install                              |
| ---------------------- | -------------------------------------------------------------------- | ------------------------------------ |
| Blender 4.x            | Model, light, bake lightmaps with Cycles, export GLB                 | blender.org                          |
| Blender MCP (required) | Lets Claude Code drive Blender for scene assembly and scripted bakes | github.com/ahujasid/blender-mcp      |
| glTF-Transform CLI     | Compress meshes (meshopt/Draco) and textures (KTX2/WebP)             | npm i -D @gltf-transform/cli         |
| KTX-Software (toktx)   | Needed by glTF-Transform for KTX2 textures                           | github.com/KhronosGroup/KTX-Software |
| pmndrs postprocessing  | Cheap bloom, vignette, noise, tone mapping in one merged pass        | npm i postprocessing                 |
| gltf.report            | Drag-in inspector for GLB size, draw calls, texture memory           | gltf.report                          |

Three.js already ships the loaders you need: GLTFLoader, KTX2Loader, and MeshoptDecoder.

Free asset sources (CC0 or CC-BY, so no licensing hassle):

- **Poly Haven** — CC0 HDRIs, wood and plaster textures, and some props. No attribution needed.
- **Sketchfab** — filter by Downloadable + CC-BY or CC0. Good source for a beige CRT, keyboard and mouse. Credit CC-BY authors in an About or Credits window.
- **ambientCG** — CC0 PBR materials.
- **Pexels / Pixabay videos** — free night-city rain footage for the window. Check each clip's license page.

Blender MCP is how Trish avoids learning Blender: Claude Code imports Poly Haven and Sketchfab assets, places them, lights the scene and runs bake scripts, and Trish approves screenshots. It is weak at sculpting detailed objects from scratch, so it should source hero props (CRT, keyboard, lamp) rather than model them; simple geometry like LEGO bricks can be generated with Python.

## Architecture changes

Roughly half the repo stays as is. The procedural model files are deleted and replaced by one GLB loader.

| File or folder                                                   | Action             | Notes                                                                          |
| ---------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| desktop/ (desktop, windows, resize, session)                     | Keep               | The Win98 OS is done work                                                      |
| overlay/projection.js, screenOverlay.js                          | Keep, re-anchor    | Read screen corners from the GLB's screen_plane mesh instead of procedural CRT |
| overlay/desktopSnapshot.js                                       | Keep, extend       | Snapshot becomes the CRT texture when zoomed out                               |
| scene/camera.js, navigation.js, interaction.js, parallax.js      | Keep, recalibrate  | Camera targets come from Empties in the GLB                                    |
| scene/animation.js, config/, utils/, tests/, scripts/, workflows | Keep               | Update tests for new scene                                                     |
| scene/createScene.js                                             | Rewrite            | Load scene.glb, apply baked materials, wire named objects                      |
| scene/lighting.js                                                | Mostly delete      | Baked light replaces real-time lights and the shadow map                       |
| scene/renderer.js                                                | Rewrite post chain | Drop SSAO and shadows; add bloom, grain, vignette via postprocessing           |
| computer.js, room.js, desks/, lamps/, nameplate.js, treehouse.js | Delete             | Replaced by Blender models                                                     |
| nightwindow.js                                                   | Replace            | Video texture plane plus a rain-on-glass shader                                |
| environment/presets.js                                           | Simplify           | One scene; optional lamp-off variant                                           |
| New: src/scene/loadScene.js, src/scene/crtMaterial.js, src/lofi/ | Add                | GLB loading, CRT screen shader, plain HTML lo-fi mode                          |
| New: art/ (outside public)                                       | Add                | .blend source, bake scripts, raw textures; not shipped                         |

The lamp toggle survives with baked light: bake two lightmaps (lamp on, lamp off) and crossfade between them in the material. Ubernatural's L key does the same job.

## Blender scene contract

This naming contract is the handoff between your Blender work and the agent's code. If the GLB follows it, the agent can wire everything without asking you anything. Save it in the repo as docs/scene-contract.md.

| Object name in Blender               | Type                                           | Code uses it for                                 |
| ------------------------------------ | ---------------------------------------------- | ------------------------------------------------ |
| screen_plane                         | Flat quad, UVs 0–1, sits just behind the glass | Projection corners, CRT shader, snapshot texture |
| screen_glass                         | Curved mesh in front of screen_plane           | Reflection and glare only, transparent           |
| click_crt                            | Low-poly invisible proxy around the monitor    | Raycast target to zoom in                        |
| click_lamp_chain                     | Proxy around the pull chain                    | Lamp toggle                                      |
| click_project_01 … \_06              | Proxies on each floppy or CD                   | Open that project's window                       |
| click_nameplate, click_treehouse     | Proxies                                        | Easter eggs or About window                      |
| window_view                          | Quad behind the window glass                   | Night-city video texture                         |
| lamp_bulb, crt_glow                  | Emissive meshes                                | Bloom sources; intensity tied to lamp state      |
| cam_overview, cam_screen, cam_mobile | Empties (or cameras)                           | Camera positions and look targets                |
| baked\_\*                            | All static scene meshes                        | Use the baked lightmap texture set               |

Bake rules:

1. Join static props into a few objects grouped by material type (wood, plastic, metal, paper) to cut draw calls.
2. Bake lighting into a second UV map (UVMap_Light) as a few atlases, not one per object.
3. Bake two sets: lightmap_lampOn and lightmap_lampOff.
4. Keep the original albedo/roughness textures; the lightmap multiplies over them. Metal and glass keep a small real-time environment reflection so they still glint.
5. Apply all transforms before export. Export glTF Binary, Y-up, with custom properties enabled.

## Phased plan

Phase 2 is the only part you must do yourself; the agent owns the rest. Work on a new branch, theme/crt-baked, so the current site stays live.

| #   | Phase                                                                                                                    | Owner                                       | Output                                   | Rough time   |
| --- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- | ---------------------------------------- | ------------ |
| 0   | Prep: branch, CLAUDE.md, this plan and the scene contract committed, reference images in docs/refs/                      | You + agent                                 | Agent has full context                   | 1 hr         |
| 1   | Gut the scene: delete procedural models, stub createScene with a placeholder GLB, keep desktop and overlay passing tests | Agent                                       | Lean repo that still boots               | 1 session    |
| 2   | Blender scene: source props, block out to match cam_overview, light it, name per contract, bake both lightmaps, export   | Agent via Blender MCP; you approve previews | art/scene.blend, public/models/scene.glb | 3–5 hrs      |
| 3   | Asset pipeline: npm run assets compresses GLB and textures with glTF-Transform, checks budgets                           | Agent                                       | Reproducible optimized assets            | 1 session    |
| 4   | Integration: load GLB, baked materials, lamp crossfade, raycast proxies, re-anchor projection, camera Empties            | Agent                                       | Scene works end to end                   | 2 sessions   |
| 5   | CRT and window: screen shader, glass glare, video window, rain-on-glass                                                  | Agent                                       | The two hero surfaces look right         | 1–2 sessions |
| 6   | Look-dev: post chain, color grade, grain; Playwright screenshots compared against refs                                   | Agent, you approve                          | Final look                               | 1 session    |
| 7   | Mobile and fallbacks: mobile camera, DPR cap, lo-fi HTML mode, reduced motion, no-WebGL                                  | Agent                                       | Works on a phone                         | 1 session    |
| 8   | Content and ship: resume, projects, links, OG image, deploy                                                              | You + agent                                 | Live site                                | 2–3 hrs      |

If Phase 2 stalls, take the fallback from the Decision section: render one still frame in Cycles at 2560 px, use it as the backdrop, and project the live desktop onto it. Phases 3–7 shrink to an afternoon.

## Budgets and acceptance criteria

Give the agent hard numbers so it can check its own work. These are starting targets; adjust after the first profile run.

| Metric                            | Desktop            | Mobile                                |
| --------------------------------- | ------------------ | ------------------------------------- |
| Total download before first frame | ≤ 10 MB            | ≤ 6 MB (lower-res texture set)        |
| Draw calls                        | ≤ 80               | ≤ 50                                  |
| Texture memory                    | ≤ 256 MB           | ≤ 128 MB                              |
| Frame rate (idle, overview)       | 60 fps             | 30 fps or better on a mid-range phone |
| Device pixel ratio cap            | 2                  | 1.5                                   |
| Time to interactive               | ≤ 3 s on broadband | ≤ 5 s on 4G throttling                |

The work is done when:

- [ ] Side by side with the two references at the same size, a viewer would not call yours lower quality.
- [ ] No real-time shadow maps or SSAO remain; lighting comes from bakes.
- [ ] Lamp toggle crossfades lighting in under 400 ms.
- [ ] Clicking the CRT zooms in and the desktop text is crisp and fully usable.
- [ ] On a phone in portrait the monitor fills the screen and every desktop app is tappable.
- [ ] A visible LO-FI button opens a plain HTML portfolio; it is also the no-WebGL fallback.
- [ ] npm test, check:build and check:source pass; GitHub Pages deploy succeeds.
- [ ] Every CC-BY asset is credited in a Credits window.

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

## Prompt sequence for Claude Code

Export this doc as Markdown into docs/visual-plan.md, then run these in order, one per session. Each ends with a verification step so the agent checks itself before you review. Use /clear between prompts; the files carry the context.

**P0 — Context**

```text
Read docs/visual-plan.md, docs/scene-contract.md, docs/architecture.md and the images in docs/refs/. Write a CLAUDE.md that summarizes: the goal (baked-lighting Blender scene, live Win98 DOM on the CRT), the keep/replace table, the scene contract, the budgets, the rule that procedural geometry is not to be reintroduced, and the Agent working rules section word for word. Then create docs/TODO.md from the phases and prompts in this plan, following those rules. Do not change code yet. Show me CLAUDE.md and TODO.md.
```

**P1 — Gut the scene**

```text
On branch theme/crt-baked, delete computer.js, room.js, desks/, lamps/, nameplate.js, treehouse.js and nightwindow.js, and remove real-time shadows and SSAO from lighting.js and renderer.js. Create src/scene/loadScene.js that loads public/models/scene.glb with GLTFLoader + KTX2Loader + MeshoptDecoder. Until the real GLB exists, generate a placeholder GLB with a box named screen_plane and Empties named per the contract. Keep desktop/ and overlay/ working. Run npm test and npm run build and fix failures.
```

**P2 — Bake script (run while you build the scene)**

```text
Write art/scripts/bake.py for Blender 4.x, runnable with blender -b art/scene.blend -P art/scripts/bake.py. It should: create UVMap_Light on all baked_* objects via Smart UV Project into shared atlases, bake Cycles diffuse lighting (direct + indirect) at 2048 px with denoising for two states, lamp on and lamp off, save to art/bakes/, then export public/models/scene.glb with custom properties. Print a report of object names that do not match docs/scene-contract.md.
```

**P3 — Asset pipeline**

```text
Add npm run assets: use @gltf-transform/cli to apply meshopt compression, resize textures (2048 desktop, 1024 mobile variant), and encode KTX2 (UASTC for lightmaps, ETC1S for albedo). Output scene.glb and scene-mobile.glb. Add scripts/check-assets.js that fails if any budget in docs/visual-plan.md is exceeded. Wire it into check:build.
```

**P4 — Integration**

```text
In createScene.js, load the GLB and for every baked_* mesh use a material that multiplies albedo by the lightmap, with a uniform lampMix that crossfades lightmap_lampOn and lightmap_lampOff. Keep metal and glass on MeshStandardMaterial with a small Poly Haven HDRI for reflections. Hook click_* proxies into interaction.js, re-anchor overlay/projection.js to screen_plane's four corners, and read camera positions from cam_* Empties. Write Playwright tests for lamp toggle, CRT zoom, and projection alignment within 2 px.
```

**P5 — CRT and window**

```text
Create src/scene/crtMaterial.js: a shader on screen_plane using the desktop snapshot texture with barrel distortion, scanlines, RGB mask, vignette, slight bloom-friendly brightness, and subtle flicker. When zoomed in, hide it and show live DOM with a CSS scanline and vignette overlay so the transition is seamless. On window_view, play a muted looping night-city rain video (public/media/window.mp4, poster image fallback) and add a rain-droplets-on-glass shader on the glass. Respect prefers-reduced-motion.
```

**P6 — Look-dev**

```text
Add pmndrs postprocessing with one EffectPass: AgX tone mapping, selective bloom on lamp_bulb and crt_glow, vignette, film grain, mild chromatic aberration at edges. Add a debug panel (dev only) to tune them. Then capture Playwright screenshots of cam_overview at 1440x900 and 390x844, place them next to docs/refs/, and write docs/lookdev-review.md listing concrete differences in lighting, color and detail, with proposed fixes. Apply the code-side fixes; list Blender-side fixes for me.
```

**P7 — Mobile and fallbacks**

```text
Load scene-mobile.glb on touch devices or narrow viewports, cap DPR at 1.5, use cam_mobile framing so the monitor fills portrait screens, and make zoom-in the default tap. Build src/lofi/: a fast plain-HTML Win98-styled portfolio using the same content from index.html, reachable from a LO-FI button and used automatically when WebGL is missing. Profile with scripts/ and report numbers against the budget table.
```

**P8 — Content and ship**

```text
Audit index.html content: resume, projects, links, Credits window for CC-BY assets. Add OG/Twitter meta with a screenshot. Run every check, then open a PR from theme/crt-baked to main with a summary and before/after screenshots.
```
