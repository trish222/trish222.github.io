# Experience and architecture specification

This is the authoritative specification for the existing workstation portfolio. It supersedes historical theme briefs and agent instructions. Visual redesign is a separate task.

The visitor opens at a seated first-person desk view: 28° field of view, 12° downward angle, and a gentle 10° view around the CRT front. Fine mouse pointers produce smooth inverted parallax without changing the permanent camera pose. Manual rotation stays within ±7° horizontally and ±4° vertically and returns to neutral after release. Touch and reduced motion disable passive parallax. Reduced motion renders on demand rather than running an ambient loop.

The monitor press flies into a live HTML login/desktop. Desktop windows open, focus, drag, minimize, maximize, close, resize, and scroll without moving the camera. Login remains distinct from monitor navigation. Leaving the monitor by Escape, the back bar, or the surrounding room returns to the seated desk view; leaving does not log off. On phones, Log Off first reverses the additional fullscreen dolly. A menu consumes its dismissal gesture before navigation. A lamp press toggles only the lamp. Picking uses the nearest hit across lamp and computer.

Keep room, monitor geometry, treehouse, desk, lighting, rain, tone mapping, and screen alignment visually consistent with the checkpoint unless a later task explicitly changes them. The shadow map is rendered once and frozen; re-aiming a light or changing a caster requires invalidating it.

## Ownership

| Module | Responsibility |
| --- | --- |
| `main.js` | CSS and one desktop initialization; HMR cleanup |
| `scene.js` | Experience parameters/state; GSAP monitor/fullscreen transitions; subsystem wiring and disposal |
| `scene/createScene.js` | Room/furniture assembly and placement in the original desk-front reference frame |
| `scene/camera.js` | Seated target, monitor fit, calibrated spline and logarithmic zoom, fullscreen dolly |
| `scene/navigation.js` | OrbitControls, wall limits, damping, return tween, drag state |
| `scene/interaction.js` | Pointer listeners, click/drag distinction, hover/cursor state, nearest-hit picking |
| `scene/parallax.js` | Damped pointer offset and reversible presentation-only camera displacement |
| `scene/renderer.js` | AO and motion composers, calibrated clip box and post-processing passes |
| `scene/lighting.js` | Night preset, directional/hemisphere rig and shadow camera |
| `scene/animation.js` | Frame scheduling, visibility pause/resume, and clock |
| `overlay/screenOverlay.js`, `projection.js` | Surface corner projection, facing test, and unchanged CSS homography |
| `overlay/desktopSnapshot.js` | DOM cloning, inline images/styles, rasterization, mutation debounce, async cancellation |
| `desktop/desktop.js` | Login/session, applications, menus, icons, clock, scene API integration |
| `desktop/windows.js`, `resize.js` | Window state/taskbar, placement/dragging/maximizing, resize gestures |
| `desktop/session.js`, `utils/lifecycle.js` | Shared desktop listener/timer lifetime |
| `config/experience.js` | Fullscreen desktop media query shared by scene and desktop JS |
| `environment/presets.js` | Scenery builder selection |
| `debug/` | Optional diagnostic commands; accessors inspect real state rather than owning a duplicate |

Existing model paths stay stable. Their long procedural files have cohesive responsibilities. Materials specific to a model stay with it; the nameplate deliberately shares the lamp's brass kit. The production graph starts at `index.html -> main.js -> desktop/desktop.js -> scene.js`; scene subsystems import models or mathematical helpers, never the coordinator. `npm run check:source -- --graph` prints the full graph and checks cycles. `lamp-lab.html -> lamp-lab.js` and alternate models are development paths. Pages publishes only Vite's `dist` output.

## Responsive contract

Scene framing retains its calibrated `<=760px` threshold. Desktop fullscreen handover is a different decision: `(max-width: 760px), (max-height: 520px) and (pointer: coarse)`. `config/experience.js` and the corresponding CSS rule must match exactly. The previously mismatched 561–759px range now receives the fullscreen desktop in both JavaScript and CSS. Keeping it on the cropped monitor left the Start button outside the viewport, as verified by the boundary test.

## Replacing the CRT

Keep the desktop markup and `src/desktop` unchanged. A computer builder returns `root`, `screenAnchor`, `projectionSurface`, `screen`, `screenMat`, `screenGlow`, `setScreen`, `setStill`, and `clearStill`. `projectionSurface` has `{ mesh, width, height, overscan }`: a flat local XY picture plane with +Z facing outward. `screen` remains an alias for existing debug consumers. The camera reads the anchor's world position after placement; overlay projection reads the surface mesh's world matrix. Preserve this contract and update the model's exported screen/monitor dimensions when replacing its geometry. Width, height, overscan and model-facing direction belong to `computer.js`, not the desktop.

The camera rig owns `SEATED_FRAME`, seated eye angles, arrival padding, spline knots/tension and cover fit. Adjust these there and verify both the journey and the projected corners. The coordinator retains the shared field of view and lifecycle. Do not re-center the computer kit casually: its original desk-front datum is intentional.

## Lamp, scenery, and lighting extension points

The lamp model contract remains `buildLamp`, `setLamp`, `aimLamp`, `lampLevels`, `disposeLamp`, and model-specific constants. Visitor actions call the coordinator's `setLampOn`; the existing fade and exposure/fill response remain centralized there. Model geometry knows nothing about portfolio applications.

Register a scenery builder in `environment/presets.js` and change `WINDOW_SCENERY`. A builder receives `{ anisotropy }` and returns `{ backdrop, materials, dispose? }` in the window's local coordinate space (origin at sill center, +Z into the room). The backdrop is separate from joinery so bounds/picking do not include distant scenery. A custom provider owns and disposes its resources via `dispose`; built-in scenery uses the existing tracked resources. Near glass/rain remain part of the window. The registry ships only the current night view; no day scene has been designed.

`NIGHT_LIGHTING` and `createLighting` define the existing rig. Future day/night presets can supply the same fields; lamp-off fill/exposure response and scene tone exposure must be calibrated alongside a new preset. No day/night toggle or unvalidated lighting values are introduced here.

## Lifecycle and references

Dispose cancels the animation loop, navigation tween/controls, pointer listeners, snapshot observers/timers/idle work, GSAP transitions, render passes/targets, models, and diagnostics. Generation checks reject initialization/environment/texture callbacks after disposal. Desktop listeners/timers share an abortable lifetime. No-WebGL still exposes the HTML login.

The existing rendered implementation and checkpoint `checkpoint/pre-refactor-2026-11-11` are the visual baseline. Review screenshots belong in ignored `.review-artifacts`, not production directories. Local `design-references/crt-computer*` images are CRT references, `desk.png` is a desk reference, and `cherryblossom*` images support the treehouse. `isometric-angle.webp` describes an older framing and is not camera authority. None of these mood-board files are licensed production assets or a mandate to redesign this phase. The unrelated older theme brief is preserved in `docs/history/legacy-theme-brief.md`. Prior CRT reference captures are retained in `references/monitor`; generated calibration sweeps were retired to the external recovery archive.
