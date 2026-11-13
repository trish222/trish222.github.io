# Rendering foundation: measured changes

This follows the [render-quality audit](render-quality-audit.md), using audit
checkpoint `d2b7e1c` and its preserved production build as the before state. The
CRT/room geometry, seated camera, camera path, projection, tone mapping, lamp
controls and HTML desktop have not been redesigned.

## Selected configuration

| Setting | Before | Selected |
| --- | --- | --- |
| Desktop color density | Up to DPR 1.5 | Up to native DPR 2 |
| Motion color density | Up to DPR 1 | Same; retained buffers, no gesture-time resizing |
| Resting AO density | Same as color buffer | 0.75 pixels per CSS pixel, capped at color density |
| GTAO samples | 24 | 12; original world radius, clip bounds and 16-sample denoiser retained |
| Moon / hemisphere intensity | 2.2 / 19 | 2.6 / 15; positions and shadow calibration unchanged |
| Reflections | No shared workstation environment | One 128px-face PMREM of the real room/desk, local to workstation materials at half their previous environment multipliers |
| Wood relief | Roughness map reused as a bump map | Matching CC0 512px OpenGL normal map, strength 0.25; roughness remains independent |
| Plastic relief | Roughness noise bump at 0.006–0.009 | 0.002; material colors and roughness unchanged |
| HTML desktop | Independent browser layer | Same; no WebGL-resolution dependency |

At 1440×900 and device DPR 2, color increases from **2160×1350 to 2880×1800**.
AO decreases from **2160×1350 to 1080×675**: one quarter as many AO/depth-normal
pixels, with half the GTAO sample count. The saved AO work pays for the sharper
color image. Mobile and reduced motion still use direct rendering without AO.
The browser continues drawing live desktop text independently of all these
buffers. MSAA, FXAA, bloom, depth of field and sharpening passes were not added.

## Measurements and evidence

All timing comparisons ran sequentially on Chromium 153 / WebGL2 / ANGLE Metal
**Apple M1**, 1440×900 viewport, device DPR 2. Timing is delivered RAF cadence,
not an isolated GPU timer. Fixed-camera measurements freeze application animation
after warm-up, preserving the same position and quaternion. Development
experiments used the same source baseline; final comparisons used two compiled
production builds, alternating order across three trials.

| Experiment | Typical p50 / p95, ms | Decision |
| --- | --- | --- |
| Original DPR 1.5, full AO, 24 samples | 33.3 / 33.4 | Baseline |
| Full AO, 12 samples | 33.3 / 33.4 | Sample reduction alone insufficient |
| AO at 75% of color dimensions, 24 samples | 33.2 / 33.4 | Insufficient saving |
| AO at half color dimensions, 24 samples | 16.7 / 33.3 | Retains contacts; some slow frames |
| Half-size AO, 12 samples, color DPR 1.5 | 16.7 / 16.8 | Best efficiency; basis of selected AO policy |
| Half-size SSAO, 16 samples | 16.7 / 16.8 | Reject: poorer creases and false wall shading; lacks the calibrated GTAO world clip |
| Existing contact textures, no screen-space AO | 16.7 / 16.8 | Reject: keys, bricks and recesses lose depth |
| Half-size GTAO + 2× target MSAA | 33.3 / 33.4 | Reject: edge benefit too costly for the remaining budget |
| Color DPR 2, AO capped at 0.75 CSS density | 16.8–33.3 / 33.4 | Selected sharpness headroom |
| Global room environment at 0.08 or 0.2 | 16.7 / 33.4 at color DPR 1.5 | Reject: broader shading cost for subtle gain |
| Local workstation environment at 0.5 multiplier | 16.7 / 16.8 at color DPR 1.5 | Keep: subtle coherent sheen without lighting every room/brick material with IBL |
| 512px vs 1K scanned wood normals | Both 16.7 / 16.8 at color DPR 1.5 | Keep 512px: no worthwhile visible 1K improvement |

The smaller denoiser radii of 2 and 3 were also compared. They expose more noise
on the bezel and tiny contacts; the original radius of 4 was retained. DPR 1.75
was an intermediate option (roughly 16.7 / 33.4 ms) but DPR 2 provides native
Retina detail while staying inside the original resting frame budget. AO at the
selected density has softer subpixel creases than full-resolution AO; the
existing contact textures and VSM shadows preserve object grounding.

Final compiled comparison, three trials:

| | Before | After |
| --- | --- | --- |
| Mean resting frame interval, range across trials | 32.2–33.2 ms | 27.1–28.5 ms |
| Resting p50 | 33.3 ms | 33.3 ms |
| Resting p95 | 33.4–33.5 ms | 33.4 ms |
| Worst sampled resting interval | 50.0–50.1 ms | 33.4–33.5 ms |
| Warm local interactive mark, approximate | 0.48–0.49 s | 0.68 s |
| First compared interactive mark | 0.83 s | 1.23 s |

The overall foundation adds about **0.2 s in warmed local startup runs**, and
about 0.4 s in the first compared run. Reflection capture and shader preparation
complete before input is enabled. This trades startup work for stable resources
during interaction. These numbers include the complete change, not just PMREM.

Matched real-input profiling found drag p95 around 16.7–16.8 ms in both builds,
with selected-build drag averages around 59.6 fps. Enter/exit p95 also stayed
around 16.8 ms. No canvas resizing, shader compilation, or geometry-buffer uploads
occurred during drag. Isolated CPU long tasks occurred in both builds: up to
98 ms before and 80–107 ms after. The change does **not** establish that every
transition frame is hitch-free; final entry averages were 55.8–57.6 fps versus
58.2–58.8 before. Those outliers should remain visible in future profiling rather
than being hidden by averages. The small existing flight snapshot/texture uploads
remain separate from steady room rendering.

## Reflection and material implementation

`scene/lighting.js` owns the one-time reflection capture. It renders the actual
room and desk with nearby props and lamp illumination excluded. This avoids
self-reflections and baking a lamp-on pool into the lamp-off state. Capture
preserves visibility and frozen shadow-map state in `finally`; the complete
scene's shadows are warmed first. Only workstation PBR materials receive the
result, and explicit lamp/nameplate environments retain their current behavior.
The PMREM render target is disposed with the scene. There is no recurring cube
camera work or additional HDR download.

The new normal map comes from the same Poly Haven Wood Table 001 scan already
used by the desk. The 512px JPEG is approximately 15 kB and approximately 1.33 MiB
of uncompressed RGBA storage including mipmaps, before driver overhead. Its
UV orientation/repeat and anisotropy match the existing wood maps. It remains
non-color data; albedo remains sRGB. The 1K normal would need roughly four times
the storage for no useful gain in these views. Licensing is recorded beside the
asset. Reducing plastic bump strength removes excessive relief without making
the shell metallic or changing the CRT's shape.

Three's documented [GTAO](https://threejs.org/docs/pages/GTAOPass.html) and
[PMREM](https://threejs.org/docs/pages/PMREMGenerator.html) APIs were checked against
the installed r186 implementation. No dependency was added.

## HTML resolution and calibration

At the entered pose, the login dialog produced **identical PNG hashes** at WebGL
DPR 1, 1.5 and 2. Its bounds and CSS matrix were identical, while the canvas varied
from 1440×900 through 2160×1350 to 2880×1800. The comparison hides only the blinking
caret and captures the opaque dialog, excluding the fractional outer edge where
canvas pixels legitimately differ. No application CSS or projection changes
were needed. The signed-in desktop continues using the same independent HTML
layer; the interaction suite exercises login, windows, scrolling and screen
registration at different DPRs.

The **flight snapshot is different**: it is still a 900px-wide logical bitmap
composited through the existing CRT treatment into the 3D picture texture and
shown during camera travel. It remains subject to the motion buffer's resolution
and intentional phosphor blur. The selected configuration improves the room at
rest, not this temporary bitmap. Raising snapshot resolution alone would not
remove its downstream blur and was not shipped speculatively.

## Evidence locations and reproduction

All generated images/data remain ignored under `.review-artifacts/foundation/`:

- `ao/`, `refine/`: individual AO, sample, density and AA comparisons.
- `light/`, `reflections/`, `material/`: independent lighting and surface trials.
- `best/`: three reversed-order combined-candidate trials.
- `poses/`: baseline/candidate home, maximum allowed turn, entered and lamp-off
  views; `metadata.json` also records the HTML resolution hashes.
- `production/`: authoritative compiled before/after images and three-trial
  frame/startup measurements in `results.json`.
- `interaction/`: matched real-input measurements, raw frame deltas, GL call
  counts, long tasks and source asset hashes. Baseline hashes differ from current
  `dist` by design; selected-build assets matched.
- `baseline-dist/`: the preserved audit-era production build, never published.

To compare the preserved build on port 4323 with current preview on 4320:

```sh
node scripts/review/compare-foundation.mjs
node scripts/profile-interaction.mjs 'http://127.0.0.1:4323/?diagnostics=1' 'http://127.0.0.1:4320/?diagnostics=1' --trials=2 --dpr=2 --output=.review-artifacts/foundation/interaction
```

The exploratory `foundation.mjs` / `foundation-variants.js` and
`foundation-poses.mjs` scripts were run against the **audit checkpoint source** on
Vite port 4321. Their baselines are not a substitute for the compiled comparison.
They require the downloaded 1K normal and its 512px derivative under the ignored
artifact directory. The source URL is
`https://dl.polyhaven.org/file/ph-assets/Textures/jpg/1k/wood_table_001/wood_table_001_nor_gl_1k.jpg`;
the derivative was made with `sips -Z 512`. The chosen derivative is retained in
`public/textures`, with its license. Run all performance tools sequentially.

## Remaining limits before CRT redesign

- Resolution cannot add authentic CRT shell construction, shape, seam detail or
  authored plastic normals. The current procedural models and glass/glare layers
  are still the dominant realism limits.
- The shared room reflection is static and local to the workstation. It has no
  parallax correction or dynamic reflected props, and the lamp/nameplate retain
  their older synthetic environment. It is not ray tracing or global illumination.
- Baked contact textures and frozen VSM shadows remain approximations. Small AO
  creases soften at the capped density; shadow calibration was preserved.
- At DPR 2, resting parallax is roughly 35–37 fps on this setup, not a locked
  60 fps. Manual turns/flight preserve the lower-resolution fast path. Larger
  viewports or integrated GPUs with lower throughput need separate profiling.
- The headless M1 tests do not establish physical-phone, Safari/WebKit, battery
  or sustained fanless thermal behavior. No claim is made that CPU transition
  outliers have been eliminated.

The foundation is ready for a CRT model replacement behind the existing builder
contract. Preserve the flat interactive plane and anchors when changing the
shell; compare home/turn/entered/lamp-off views again and regenerate the static
reflection if room/desk surfaces change. No push or deployment was performed.
