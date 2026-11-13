# Local production vs GitHub Pages: November 11, 2026

## Findings

The original local production build and Pages served **identical JavaScript
and CSS bytes**, not just similarly named files. The successful Pages run
[43065703619](https://github.com/trish222/trish222.github.io/actions/runs/43065703619)
and public deployment record identify `theme/windows98` commit
`4c729e93591566ee69e7f636468e22fbb7b02e48`, the original checkout HEAD.

At 1440×900, DPR 1, three alternating trials per origin measured dragging
at 59.84–60.00 fps, p95 16.7–16.8 ms. The deployment-specific slowdown did
not reproduce under those matched conditions.

At DPR 2, a repeatable bottleneck appeared **on both origins**. The old
`syncRenderQuality()` changed the canvas from 2160×1350 to 1440×900 on
motion and back at rest. Damping, small late changes, and the automatic
return home caused more switches. An idle/return phase wrote the canvas
dimensions ten times and repeatedly recreated composer textures.

CPU sampling attributed about **103 ms to the canvas width setter at drag
start**, and 174 ms cumulatively to that setter over a five-second
settle/return phase. These calls coincided with 100–133 ms frame gaps and
long tasks. Shader compilation was absent during those interaction phases.
This is a verified motion bottleneck, not proof of every difference seen in
the user's everyday Chrome profile. Per-origin zoom, viewport, DPR,
extensions and system load remain possible explanations for the original
local/live discrepancy.

## Browser environment

- macOS arm64; Playwright **1.63.0** was already installed.
- Executable: `~/Library/Caches/ms-playwright/chromium-1243/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`.
- Executable permission: `100755`; no missing browser download or dependency.
- No central Playwright configuration: the repository uses standalone scripts.
- The sandboxed launch failed with `Target page, context or browser has been closed`,
  Chromium `SIGABRT`, and cleanup `kill EPERM`. A minimal launch outside the
  sandbox succeeded once in **each** mode: visible and headless.
- Both modes reported Chromium **153.0.8010.12**, WebGL2, and
  `ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)`.
- The new scripts use `channel: 'chromium'`, headless by default. No forced
  SwiftShader, GPU-disabling flags, browser reinstall, or website workaround
  was required. `--headed` is available on the interaction profiler.

This confirms hardware rendering for these runs. rAF intervals are browser
callback pacing, **not physical display presentation times or GPU execution
durations**. No GPU timestamp queries, device GPU capture, physical-phone
profiling, or measurements inside the user's extension-loaded Chrome
profile were performed. A visible launch passing does not establish that
headless performance equals visible performance.

## Code and deployment audit

| Area | Evidence and outcome |
| --- | --- |
| Vite/Pages | `base: '/'` is correct for this user site. CI uses Node 22, `npm ci`, build verification and `dist/` artifact upload. No runtime environment branch distinguishes preview from Pages. |
| Branches | Both `main` and `theme/windows98` publish to one Pages environment; a later deployment can replace the site. The current public deployment is the expected commit. Branch policy was preserved. |
| Caching | Pages HTML advertises `max-age=600`, ETag and Last-Modified. Asset URLs are content-hashed. Comparison contexts disabled browser HTTP caching. No registered service workers on either origin. CDN or driver caches cannot be reset by that browser setting. |
| Assets | Initial JS/CSS hashes matched; real font, icon and texture requests succeeded. Functional browser tests found no missing application assets. A pre-existing `/favicon.ico` console 404 remains. |
| Rendering | Scene inventory: 269 meshes, 1,120 mesh instances, about 200,362 triangles before visibility/pass accounting. Desktop full AO draws roughly 543 GL calls/frame; movement without AO roughly 270, varying with camera culling. Mobile direct rendering roughly 265. |
| Shadows/lights | Static VSM maps already freeze after startup. Moon shadow is 2048² with 16 blur samples. Lamp intensity fades do not invalidate occlusion maps. Geometry, lights, materials and shadows were preserved. |
| Controls/tweens | One scene rAF loop plus GSAP's ticker. Orbit updates stand down during flights and return-home tweens. Upstream OrbitControls also updates on pointer input, so damping is input-rate-sensitive; no evidence justified changing its values or internals. |
| Frame pacing | The original motion DPR switch was expensive, including unchanged-ratio writes at DPR 1. Repeated quality switches caused the measured high-DPR stalls. |
| Programs/textures | No `compileShader`, `linkProgram`, or `getProgramParameter` calls during measured dragging. No continuous hover texture uploads during drag; flight handovers upload a still once or twice. No new prewarming or texture degradation was introduced. |
| Memory | Startup builds procedural geometry and canvas textures. Interaction CPU profiles contained minor GC, but the large stalls mapped to canvas setters. No claim of a long-duration leak audit. |
| DOM/CSS | Overlay transformations are gated by camera changes; scan/blur values snap in motion; flight uses a bitmap while the expensive HTML is hidden. Pointer hover raycasts already skip active dragging. Desktop clock updates once a second. Those mechanisms were retained. |
| Lifecycle | One scene initialization path; scene disposal removes its controls, listeners and rAF. Visibility pauses the loop. No duplicate scene loop or duplicate input registration was found on normal initialization. |

## Changes

- `src/scene.js`: keep the visible canvas allocated throughout motion. Only
  a real DPR/breakpoint change calls the renderer's `setPixelRatio`;
  viewport resizing still calls `setSize`. High-DPR desktop movement uses
  a retained small `EffectComposer` with the **same previous motion DPR 1**
  and `RenderPass → OutputPass` path. The original full-resolution AO
  composer keeps its buffers while inactive. The motion output writes to
  the canvas without swapping into a second, unused target. Prewarming
  prepares the motion target before interaction, including when DPR changes
  after startup. No new renderer, animation loop, or animation library.
  Mobile retains the direct renderer at its existing full DPR cap 2 during
  movement, replacing the temporary cap 1.5; that path measured near 60 fps
  in the matched emulated-mobile runs.
- `vite.config.js`: emit `build-info.json` with revision, branch, dirty flag,
  timestamp and SHA-256 hashes of generated assets. It adds no runtime request
  or animation work. Dirty builds describe a revision **plus local edits**.
- `scripts/check-build.mjs`: verify provenance hashes alongside existing
  compiled-entry and public-file checks. The unchanged Pages workflow already
  runs this command.
- New browser, deployment, interaction profiler and regression scripts;
  npm entry points; ignored `.interaction-profiles/` artifacts.
- `src/main.js`: write the minute-precision taskbar clock only when its text
  changes, avoiding repeated DOM replacement on the one-second poll. Its
  separate contribution to frame time was not isolated.

Keeping all desktop rendering at full resolution was tested and rejected:
in later sessions, dragging fell to about 48 fps while the old
low-resolution path remained around 58 fps. The final implementation reuses
one extra small color/depth target instead, trading some retained GPU memory
for stable resolution switching. It disposes that target and its output
material on scene teardown. Lower-powered physical devices still need
testing. High-DPR desktop **idle** AO varied from about 15–31 fps across
the headless sessions as machine/driver conditions changed (their cause
was not isolated); this patch does not claim to
solve full-resolution idle AO cost or guarantee 60 fps on every GPU.

## Measured result and limits

Three alternating pairs with CPU sampling at 1440×900, DPR 2, are recorded
in `verification/`. Both sides used Apple M1 Metal; the updated source
already had the final buffer reuse, before the small clock guard:

| Drag metric | Unchanged Pages | Updated local buffer reuse |
| --- | --- | --- |
| Worst rAF interval per trial | 199.9–216.7 ms | 66.7–83.3 ms |
| p95 interval per trial | 16.8 ms | 16.8–33.4 ms |
| Mean-derived FPS per trial | 57.3–57.5 | 52.9–57.3 |
| Canvas dimension writes per trial | 2 | 0 |
| Texture allocations per trial | 2 | 0 |
| Texture allocations over settle/return | 18 | 0 |

Fly-in worst intervals were 200–233 ms on Pages and about 67 ms locally.
Both sides still had slow full-AO idle frames. Local dragging retained one
50–60 ms long task in each sampled trial, beyond the eliminated resource
churn; those residuals were not attributed conclusively.

After the clock guard, one final matched pair (`final-check/`) measured:
drag worst **216.5 → 66.7 ms**, no canvas writes or texture allocations in
the updated drag, and no updated drag long tasks. However, its updated
drag p95 was **33.3 ms versus 16.8 ms**, and FPS **54.5 versus 57.5**.
The final result is therefore a **verified reduction in large stalls and
resource churn**, not a verified sustained-FPS improvement. The retained
target adds memory; a full-resolution output canvas also has a different
presentation cost from physically resizing it. This tradeoff needs review
on the user's ordinary visible Chrome/GPU before calling the issue solved.

At 390×844, DPR 3, three touch-emulated pairs measured updated dragging at
59.84–60.00 fps, p95 16.7 ms, worst 16.8–33.3 ms. Pages measured
59.68–59.84 fps, p95 16.8 ms, worst 33.3–50 ms. There were no drag long tasks
on either side. This mobile render path was unchanged by the later
desktop-only buffer refinements; the final functional suite also passed
on it. These are M1 viewport emulations, not physical phone benchmarks.

## Method and artifacts

The interaction script alternates origins across trials using one browser
installation, fresh contexts, identical viewport/DPR/input paths, cache
disabled, no extensions, readiness marks, fonts and the prepared monitor
still, then an additional warmup. It records idle, real mouse dragging with
rapid direction changes, damping/return, fly-in and fly-out separately.
Playwright IPC/input scheduling adds overhead; these are controlled
comparisons, not hardware mouse latency measurements. GL wrappers count
calls without synchronizing or timing each driver call.

Raw JSON, individual frame deltas, environment data, failed requests and
profiles are local, gitignored under `.interaction-profiles/`:

- `results.json`: original DPR 1, three trials per origin; matching bytes.
- `before-dpr2/`: original DPR 2 with CPU sampling, one trial per origin.
- `fixed-dpr2/`: one diagnostic trial holding full-resolution buffers;
  zero canvas writes and no long tasks during motion.
- `after-dpr2/`: exploratory full-resolution local/unchanged-live pairs. Pair 3 overlapped
  a local build and contains additional host-load stalls; retain it as raw
  evidence rather than treating every outlier as an application regression.
- `mobile/`: 390×844, DPR 3, touch-emulated contexts, three pairs.
- `desktop-repeat/`: the full-resolution experiment slowed in later sessions;
  this prompted preserving the previous low-resolution desktop motion path.
- `fixed-canvas/`: disabling only the default canvas resize still left
  composer reallocation, which the final retained target also avoids.
- `desktop-headed/`: visible launches worked, but the local drag missed
  the canvas (unchanged orbit, AO still active). This is an **invalid matched
  interaction pair**, not evidence of a local/live FPS difference. The
  profiler now records camera-motion frames and flags invalid drags.
- `final-desktop/`: intermediate pooled-target experiment, before removing
  the output pass's unnecessary swap; its second target first allocated on
  drag. Final measurements belong to the later verification directory.
- `verification/`: three matched pairs with final buffer reuse and CPU
  sampling; see the table above. All six drags verified camera movement.
- `final-check/`: final built source including the clock guard, one matched
  pair with CPU sampling and valid camera dragging.
- `startup-after/`: existing startup script's desktop/mobile CPU profiles,
  JSON and screenshots at DPR 1. Interactive marks: **965 / 511 ms** in this
  run. These startup-only figures are not dragging measurements or a new
  startup speedup claim.
- `startup-final/`: the existing startup script repeated after buffer reuse,
  at DPR 1, before the clock guard: **1,286 / 948 ms** to interactive,
  desktop/mobile, with no page errors. The variability is another reason
  not to claim a startup speedup from this interaction change.
- `deployment.json`: public deployment history, cache headers and hashes,
  collected after local modifications (so its local JS comparison is false).

## Reproduce

```sh
npm run build
npm run check:build
npm run preview -- --host 127.0.0.1 --port 4320 --strictPort
```

In a second terminal, outside any sandbox that blocks Chromium:

```sh
npm run check:browser
npm run check:deployment
npm run test:interaction
npm run profile:startup -- .interaction-profiles/startup
npm run profile:interaction -- --dpr=2 --output=.interaction-profiles/desktop
npm run profile:interaction -- --width=390 --height=844 --dpr=3 --touch --output=.interaction-profiles/mobile
```

Profiler defaults: local preview plus Pages, three trials each. Positional
URLs override them. `--cpu` writes a CPU profile for each phase; run both
sides with the same sampling setting. `--headed` selects a visible browser.
`--fixed-resolution` and `--fixed-canvas` are external diagnostic overrides
for the old desktop composer, not application query options. `check:deployment` reads public
GitHub data and can encounter API rate limits; it never writes remotely.

The legacy `_perfcheck.mjs` needs the dev-only `?perf` meter and therefore
cannot compare production origins. Older review scripts that force
SwiftShader or assert obsolete wall/leash behavior were not used as GPU
performance evidence. No dependencies were added or upgraded.

## Checks actually run

- Production build and `check:build`: passed, including generated asset
  hashes and all public files.
- Existing `_startup-verify.mjs`: passed desktop/mobile, normal/reduced
  motion, lamp, monitor flight, Escape and no-WebGL fallback.
- New `test:interaction`: passed all four scenarios (desktop DPR 1 and 2,
  mobile DPR 3 normal and reduced motion). Checks no canvas resize or GPU
  buffer/texture/shader allocation during drag/return, automatic home,
  camera ownership, login, desktop window drag, mobile maximize, resume
  scrolling/links, logoff, resize, and a DPR change after startup.
- Negative regression check against unchanged Pages: failed as expected
  on `camera motion must not resize WebGL canvas`, **12 writes versus 0**.
  This confirms the assertion catches the original behavior; it is not a
  browser-launch failure.
- Existing startup CPU profiler: ran on both viewports; screenshots reviewed.
- Local/Pages performance: three DPR 1 baseline pairs, multiple DPR 2
  diagnostic sets, three final buffer-reuse pairs, three mobile pairs, and
  the final clock-guard pair. Raw outliers were retained and disclosed.
- Visible browser launch: passed. Its attempted performance comparison was
  invalid because one drag did not move the camera; it is excluded.
- Physical GPU timing, physical mobile testing, and the user's regular
  browser profile: not available in this automation session.
- Syntax checks and `git diff --check`: passed. Existing build warnings
  remain (vendored CSS media-query syntax, dynamic/static import overlap,
  large entry chunk); they existed in the identical baseline build.

No push or deployment was performed. After review and deployment, repeat
the same comparison on the published build, inspect `build-info.json`, and
also test ordinary visible Chrome at matching zoom, viewport and DPR with
extensions disabled. The current remote origin still runs the old code.
