# Practical refactor results — November 2026

Work is isolated on `refactor/portfolio-structure`. No push or deployment was performed.

## Recovery and baseline

The original dirty tree contained edits to `docs/computer.md`, `src/computer.js`, and `scripts/test-interaction.mjs`, plus the deletion of `public/vite.svg`. These were preserved in commit `8dc86ec`, tagged `checkpoint/pre-refactor-2026-11-11`, before implementation. All existing ignored/local material was also archived at `/tmp/portfolio-refactor-checkpoint/local-artifacts.tgz`. Every retired artifact was checked against its recovery copy by SHA-256 before removal. The temporary archive is local and can expire with system temporary-file cleanup; Git preserves the tracked checkpoint permanently.

The baseline production build and build-provenance check passed. The baseline interaction suite passed five configurations. Existing calibration and performance notes were used as the starting point; no earlier standalone architecture-audit file was present in the checkout.

## Final structure and responsibilities

See [README](../README.md) for the complete directory map and commands, and [architecture](architecture.md) for authoritative ownership and replacement contracts.

`src/scene.js`: **5,159 → 1374 lines**. This includes removing obsolete isometric-path branches and lengthy historical comments, as well as extracting executable responsibilities; it is not a claim that all of the reduction represents removed algorithms.

Extracted responsibilities: calibrated camera fitting/spline/zoom, OrbitControls and return tweens, transient parallax, pointer picking and gesture listeners, post-processing, animation scheduling/visibility, lighting creation and presets, model placement, screen-surface projection/homography, DOM snapshots, and diagnostic implementations. `main.js` now initializes the desktop; window state/placement/taskbar/dragging are separate from login/apps/session behavior.

The coordinator still owns the connected monitor/fullscreen GSAP transitions, lamp fade and fill/exposure response, responsive coordination, and lifecycle wiring. Diagnostic compatibility uses live accessors rather than a second mutable scene state.

## Cleanup and file inventory

- Retired **692** temporary/generated files: 91 root artifacts plus 601 calibration images/experimental output files. Full paths, recovery actions, and hashes are in [refactor-artifacts.json](refactor-artifacts.json).
- Retained `_startup-verify.mjs` as `tests/startup.mjs`; `_nameplate-review.mjs` as `scripts/review/nameplate.mjs`.
- Moved `scripts/test-interaction.mjs` to `tests/interaction.mjs` and updated package scripts.
- Moved four previously linked CRT captures from `.impeccable/review` to `references/monitor`; updated `docs/computer.md` links.
- Preserved old agent guidance, camera notes, script catalog, and unrelated theme brief in labeled `docs/history` documents. CLAUDE and Copilot now point to AGENTS and the single specification.
- Added scoped ignores for review output and local tool state. Production code/assets contain no generated review screenshots.
- Removed unused leaf dependencies `@fontsource/atkinson-hyperlegible` and `@fontsource/playfair-display` from manifest and lockfile. Their licensed, vendored WOFF2 assets remain unchanged. No source or generator imports the packages, and lockfile dependency validation passes.
- Removed unused projection constants/imports, the dead generic disposal list, duplicated lighting literals, and the obsolete isometric home selection. Explicit development variant imports replace broad dynamic globs and their redundant default-module imports.
- Fixed invalid vendor media-query syntax in the CSS generator and regenerated its output.

New tracked files (existing source files changed in place are described above):

- `AGENTS.md`
- `README.md`
- `docs/architecture.md`
- `docs/history/agent-guidance-before-refactor.md`
- `docs/history/camera-before-refactor.md`
- `docs/history/legacy-theme-brief.md`
- `docs/history/review-scripts-before-refactor.md`
- `docs/refactor-artifacts.json`
- `references/README.md`
- `references/monitor/angled.png`
- `references/monitor/desktop.png`
- `references/monitor/focused.png`
- `references/monitor/mobile.png`
- `scripts/check-source.mjs`
- `scripts/review/capture.mjs`
- `scripts/review/nameplate.mjs`
- `src/config/experience.js`
- `src/debug/experience.js`
- `src/debug/geometry.js`
- `src/desktop/desktop.js`
- `src/desktop/resize.js`
- `src/desktop/session.js`
- `src/desktop/windows.js`
- `src/environment/presets.js`
- `src/overlay/desktopSnapshot.js`
- `src/overlay/projection.js`
- `src/overlay/screenOverlay.js`
- `src/scene/animation.js`
- `src/scene/camera.js`
- `src/scene/createScene.js`
- `src/scene/interaction.js`
- `src/scene/lighting.js`
- `src/scene/navigation.js`
- `src/scene/parallax.js`
- `src/scene/renderer.js`
- `src/utils/lifecycle.js`
- `tests/interaction.mjs`
- `tests/lifecycle.mjs`
- `tests/projection.mjs`
- `tests/responsive.mjs`
- `tests/startup.mjs`
- `docs/refactor.md` (this record)

## Verified behavior and build

- Production build, compiled asset/provenance checks, local import/cycle check, lockfile top-level dependency validation, and Git whitespace checks pass.
- Interaction matrix passes: 1440×900 at DPR 1 and 2, desktop DPR 2 reduced motion, and 390×844 DPR 3 with/without reduced motion. It checks fixed drawing buffers and GPU resource reuse during motion, inverted parallax, drag/return, monitor entry, subpixel overlay registration, login, window dragging and pointer resizing, scrolling/links, logoff, seated exit, and viewport resize.
- Startup checks pass for desktop/phone and normal/reduced motion: first frame, keyboard lamp toggling, real monitor click, Escape, and no-WebGL fallback.
- Responsive checks pass at 560, 561, 650, 760, 761px and 844×390 coarse-pointer landscape. Fullscreen is shared at ≤760px or short/coarse; this avoids the previously inaccessible cropped Start button in the intermediate-width range. Keyboard window resizing is checked on the in-monitor desktop.
- Development checks pass for disposal/reinitialization, stale snapshot work, monitor reentry, back-bar and surrounding-room exit, diagnostic reports and camera seeking, classic desk, and alternate lamp. Lifecycle tests use Vite's actual module URL so HMR timestamps do not create a second test-only scene instance.
- Impeccable's mechanical detector returned no findings for the changed UI targets.
- Pages workflow and `/` base remain intact. The local production output passes the same provenance/asset check used in deployment. No remote release was attempted.

## Visual comparison and limits

Home and monitor captures were compared with the saved checkpoint at 1440×900, 390×844 and 650×900. The capture metadata records **identical seated camera coordinates** at all three sizes. Rendered comparisons preserve the room, lamp, CRT, desk and treehouse composition. Files are in ignored `.review-artifacts/baseline` and `.review-artifacts/current`. The capture tool waits for UI transition settling on future runs; old captures are reference material, not automated pixel goldens.

No visual-quality or frame-rate improvement is claimed. The final main JavaScript is about 235.2 kB gzip versus 229.9 kB at baseline; optional diagnostic chunks add about 4.4 kB gzip only when requested. The existing large-chunk warning remains. Automated interaction checks establish behavior/resource reuse, not performance equivalence on every device.

## Retained uncertainty and technical debt

- Retain `public/env` (inactive HDR and license), the classic desk/cone lamp, the lamp lab, local mood board, and historical startup/interaction profiles. They are referenced development tools/assets or useful evidence; removing them would discard future visual references or measured history.
- `.impeccable` now holds only tool configuration/cache. The stale theme brief and generated calibration sweeps are no longer active project context.
- The coordinator is substantially smaller but still owns closely related transition and lamp-response state. Further extraction should follow a concrete development need rather than another layer of interfaces. The diagnostic compatibility interface remains broad because existing measurement tools tune many systems.
- Procedural models remain long by design. Model-specific materials are cohesive; introducing a shared material framework would add complexity without a demonstrated need.
- New lighting presets still need visual calibration of exposure and lamp-off response. Only the current night preset/scenery is implemented.
- The existing Vite 5 toolchain has not been upgraded. Dependency modernization is separate work.
- Desktop fonts still include pre-existing system-font fallback names; no Microsoft font files are bundled. Asset/license policy otherwise remains unchanged.

Manual verification still recommended: physical iOS Safari/Android touch devices, browser zoom/display changes on the target hardware, and subjective camera/lamp motion quality. Chromium emulation and screenshots do not replace those checks. No new performance benchmark comparison was performed.

## Next visual-development steps

Replace the CRT geometry first through its stable anchor/surface/texture interface, checking the projected corners and transition on each size. Then replace the outside-window scenery provider. Calibrate any day/night lighting preset only after those shapes are settled. Keep desktop application code unchanged during those model/scenery tasks.
