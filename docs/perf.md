# Frame rate, and what holds it at 60

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
