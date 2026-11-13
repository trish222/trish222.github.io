# Frame rate, and what holds it at 60

For the matched local/Pages investigation, browser-launch diagnosis and
motion-resize fix, see [performance-investigation.md](performance-investigation.md).
The hardware-accelerated headless Chromium used in that investigation does
not support the older blanket assumption below that headless always means
SwiftShader; read the actual WebGL renderer for every run.

## Startup profiling

Use the existing Playwright dependency to collect Chrome CPU profiles,
WebGL call counts, resource timings, startup phase marks, and screenshots.
No profiling library or browser extension is shipped to visitors.

Build and start a production preview in one terminal:

```sh
npm run build
npm run preview -- --host 127.0.0.1 --port 4320
```

In another terminal:

```sh
npm run profile:startup
```

Results go to the gitignored `.startup-profiles/` directory. Import the
`.cpuprofile` files into Chrome DevTools' Performance panel; the JSON files
include the measured phases, graphics renderer, and resource sizes.
For readable function names when investigating a hotspot, build with
`npm run build -- --minify false` first. Use the same build settings for
both sides of a comparison, then restore the ordinary production build.
Pass a separate destination to retain comparisons:
`npm run profile:startup -- /tmp/portfolio-startup-before`.
`PROFILE_URL` can override the default preview URL.
If Chromium is missing, install it with `npx playwright install chromium`.

### November 11, 2026 investigation

The largest sampled startup cost was Three.js's `onFirstUse`, which
performs synchronous shader diagnostic queries. Production now disables
`renderer.debug.checkShaderErrors`; development retains the checks.
The renderer is also created directly, replacing a capability test that
created a second, disposable WebGL context. Renderer-construction failure
still enters the existing no-WebGL login. The desk textures now preload
from HTML, and the temporary room-image placeholder has been removed.

A local diagnostic A/B used the same unminified production build settings,
Chrome CPU sampling, cache-disabled requests, DPR 1, and the Mac's Apple M1
Metal renderer:

| Viewport | Before: interactive | After production shader checks and context fix |
| --- | --- | --- |
| Desktop, 1440×900 | 7.37 s | 2.68 s |
| Mobile-sized, 390×844 | 6.98 s | 2.13 s |

The final minified build without placeholder images measured 2.00 s and
1.03 s to interactive respectively in a separate run. These are individual
local observations, not phone benchmarks or guaranteed visitor timings.
Browser/driver warming, network, and machine load affect results; the
profile disables HTTP caching but cannot reset the operating system's GPU
driver caches. Do not attribute every millisecond of the difference to a
single setting.

`room:first-frame` marks the return from the first render call, not the
instant pixels physically appear on the display. `room:interactive` follows
the monitor, orbit, and lamp handler setup. Both can be inspected as User
Timing marks in DevTools without installing anything.

An explicit `compileAsync` prewarm was tested and omitted: it moved work
out of the first draw but did not improve total startup in this run.
No geometry, lighting, shadow resolution, or camera framing changed.
Production browser checks covered both viewports, normal/reduced motion,
lamp keyboard control, monitor fly-in, Escape back to the room, and the
no-WebGL fallback.

Read this before optimising anything, and before calling a frame time a
regression.

## The budget

**A flat 16.7ms median on both viewports, worst frame under ~20ms, zero
frames over 33.4ms, in both directions of the fly-in.** That is what the
scene has measured at repeatedly, on a real GPU at DPR 1, through
`_perfcheck.mjs`.

## The rule

**Never read a frame time without its A/B beside it, measured on one
machine in one sitting.** A number compared against a figure written
down earlier compares two machines as much as two scenes. This trap has
been walked into twice on this branch: once when a busy machine made
both arms read 21ms and looked exactly like a treehouse regression (the
`notree` arm came back identical, and the whole scene measured 16.6
again an hour later with a *larger* model in it), and once when a
pre-existing branch-wide regression was nearly attributed to the
treehouse. `_perfcheck.mjs ... notree` exists so the attribution can be
made properly.

The corollary: **a prediction is not a reading.** Several things in this
scene are documented as "not measured" — the rain, the lamp, the group
scales. The reasoning for each is sound (static geometry under a frozen
shadow map costs one pass at startup and nothing per frame), but if the
number matters, run the script.

## What got it to 16.7, in order of how much each was worth

1. **The live HTML comes off the glass during the move** — a bitmap in
   the 3D texture instead. This was nearly all of it: ~57ms a frame
   became a flat 60fps. See [screen-overlay.md](screen-overlay.md).
2. **The shadow map is rendered once and frozen.** Nothing in the scene
   ever casts a different shadow: the lights are fixed and nothing that
   casts one moves. `renderer.shadowMap.autoUpdate = false` plus one
   `needsUpdate = true` saves re-rendering a 2048² VSM depth pass with
   16 blur samples every frame. **Anything animated back into the scene
   has to either not cast, or this has to be reverted.** Two things
   already live inside that rule: the orbit moves the *camera*, and a
   shadow map is in the light's space; and the lamp's toggle changes an
   *intensity*, not occlusion. The frozen map is also load-bearing for
   the cutaway — see [lighting.md](lighting.md).
3. **`MAX_DPR` is 1.5, not 2.** The scene shades through GTAO on a
   full-screen composite, so cost goes with the square of this; on a 2x
   display the difference is not visible on matt plastic and a blurred
   tube.
4. **`--scan` and `--blur` are snapped to a coarse grid while the camera
   moves** — every distinct value costs a raster. Snapped while
   *orbiting* too, for the same reason; see `cameraMoving`.

## Why the models are free

The treehouse is ~790 instances in 64 meshes, all static, under the
frozen shadow map — so it adds instances and a handful of draw calls
rather than per-frame work. It has measured free at every scale it has
been given, including when the canopy roughly doubled its blossom: the
interior cull more than pays for the extra plate footprints. A *group
scale* changes instance matrices and nothing else, so there is no
mechanism by which it can cost anything.

The desk, the room and the window are the same story: static geometry,
one shadow pass at startup.

## The meter

`src/perf.js` is a stats.js panel plus a rolling log of frame deltas
tagged with `fly.value`, exposed as `window.__perf`. `scene.js` reaches
it only through a dynamic `import()` behind `import.meta.env.DEV`; Vite
folds that to `false` when building, so rollup drops the branch and
stats.js with it. **Verify after touching it:**
`npm run build && grep -r showPanel dist/` must find nothing.

`_perfcheck.mjs` measures the flight only. The orbit itself is not in
those numbers — it adds one `controls.update()` and one overlay
transform per moving frame, which is small against what the flight does,
but it has not been measured.
