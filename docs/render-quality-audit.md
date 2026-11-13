# Rendering and realism audit

This is the baseline at audit checkpoint `d2b7e1c`. See
[the measured rendering foundation](rendering-foundation.md) for the subsequent
authorized changes and current configuration.

Audited 2026-11-12 against the current production build. The seated camera, room,
monitor geometry, lighting, tone mapping, and projection are preserved. No
production rendering changes passed the benefit/cost threshold for this task.

## Findings in priority order

1. **Resolution limits fine detail, especially during movement.** Desktop DPR is
   capped at 1.5 (`src/scene.js`, `scenePixelRatio`). On a DPR 2 display at
   1440×900 CSS pixels, the actual canvas and resting composer are 2160×1350,
   rather than the display's 2880×1800 pixels. The separate motion composer uses
   DPR 1: its 1440×900 image is enlarged into the same 2160×1350 canvas. That is
   a confirmed source of softness, intentionally buying responsive camera motion.
   A canvas-size read alone misses the motion reduction. At DPR 1, native detail
   is already limited by the display; the application does not supersample.
2. **The composer has no geometry antialiasing.** The WebGL context reports
   `antialias: true`, but both composer targets have `samples: 0`. Three r186's
   installed `EffectComposer` creates half-float, single-sample targets. Canvas
   MSAA cannot recover the geometry edges already rasterized into those targets.
   This produces stair steps and shimmer, which are distinct from blur. A 4×
   target comparison smooths edges, at a large measured frame-time cost.
3. **Lighting and reflections are the main realism opportunity.** The night
   preset has hemisphere intensity 19, directional intensity 2.2, and scene
   environment intensity 0. The HDR loader returns before fetching an environment.
   These light intensities are different light types and are not directly
   comparable physical measurements, but the broad, unshadowed fill and missing
   reflected room are strong candidates for the weak shape/material separation.
   The lamp and nameplate are exceptions: their materials have their own small,
   synthetic reflection environment. The rest of the workstation does not inherit
   those reflections. CRT glass has a procedural additive glare layer rather than
   a reflected view of the actual room. Raising DPR leaves these limitations intact.
4. **AO supplies important depth but consumes much of the frame budget.** Resting
   desktop uses RenderPass → GTAOPass → OutputPass. GTAO redraws scene geometry
   for depth/normals, takes 24 samples, denoises the occlusion, and composites it.
   Its denoiser filters the AO, not the underlying color image. Removing AO in a
   controlled capture improves frame delivery but visibly flattens keys, brick
   creases, the stand, and object contacts. It is not a suitable global blur fix.
   AO is already disabled during camera motion; mobile and reduced-motion paths
   omit the composer altogether. Those paths consequently differ in shading and AA.
5. **The models already contain substantial geometry and bevels.** The scene
   inventory contains 271 mesh objects, approximately 200,960 submitted model
   triangles including instances, and 99 unique materials. This is a scene
   inventory, not a per-frame GPU counter; shadow/AO passes add more work. The CRT
   uses rounded boxes, an extruded bezel with five bevel segments, shaped glass,
   seams, buttons, cables, and detailed keys. Increasing subdivision everywhere
   will not make it photographic. Some desk trim and casework still use sharp
   boxes; selective visible edge treatment is more useful than general tessellation.

## Other pipeline checks

| Area | Verified state | Assessment |
| --- | --- | --- |
| Canvas/CSS | Canvas covers 1440×900 CSS pixels exactly; no CSS filter or transform on `#scene` | No accidental canvas stretching beyond deliberate DPR resampling |
| Post-processing | GTAO and OutputPass; no bloom, DOF, FXAA, motion blur or full-scene blur | No cinematic blur to remove |
| CRT picture | Baked canvas blur/glow, scanlines, glare; live HTML uses `--blur`, approximately 0.9 viewport pixels at home, fading during entry | Intentional localized softness, independent of room sharpness; snapshot rasterization is another finite-resolution layer |
| Color | sRGB output; ACES Filmic; configured exposure 1.45, runtime 1.46 from exposure quantization; color textures tagged sRGB, inspected roughness/bump data untagged | No demonstrated global gamma error; OutputPass performs final conversion on composer paths |
| Moon shadow | Frozen VSM, 2048², radius 4, 16 blur samples; orthographic span 47×46 world units | About 0.023 world units per shadow texel before filtering; deliberately soft, not full-image blur |
| Lamp shadow | Frozen VSM spotlight, 1024², radius 9, 16 blur samples | Wide source softness is deliberate; inspect contacts before changing resolution/bias |
| Texture filtering | Inspected maps retain mipmaps, trilinear minification and linear magnification; max device anisotropy 16; room/CRT use 16, desk wood 8 | Already protects oblique surfaces; disabling mipmaps/using nearest would introduce shimmer |
| Texture size | Wood albedo/roughness 512², CRT plastic maps 512² tiled twice, wall noise 512², floor 2048×1688 in runtime | Wood is a plausible close-view texel-density limit; maximum texture size is not the right default |
| Surface detail | CRT plastic metalness 0, shell roughness around 0.5 after mapping, small bump from the roughness noise; wood shares roughness and bump data | Reasonable PBR foundation, but generic noise is not authored molded plastic or wood relief |
| Camera | Perspective 28° FOV, calibrated seated pose and projection | Compressed perspective contributes to presentation, not raster blur; preserve calibration |
| Development/build | Same renderer settings, assets and pass graph; development adds diagnostics/HMR and shader-error checks | No production quality downgrade found in code; audit captures use compiled preview, not development |
| CI/deployment | Vite build then build artifact verification; Pages uploads `dist` | No image recompression or deployment-specific rendering override in pipeline; live site was not compared/deployed in this audit |

The color-space assignments follow the [Three.js color-management guidance](https://threejs.org/manual/pages/color-management.html).
Composer behavior was checked in the installed r186 source as well as the
[EffectComposer documentation](https://threejs.org/docs/pages/EffectComposer).

## Controlled browser evidence

Chromium 153, macOS, WebGL2, ANGLE Metal Renderer **Apple M1**, device DPR 2,
1440×900 viewport, max MSAA samples 4, max texture size 16384, max anisotropy 16.
The harness warms the application, parks the seated camera, freezes application
animation scheduling, and varies one rendering setting at a time. Screenshots
retain DPR 2 output dimensions for comparison. Each variant warms for 20 frames,
then records 90 RAF intervals; three trials reverse order on alternate trials.
Timings measure delivered frame cadence, not isolated GPU execution duration.
CPU submission times are recorded separately and exclude GPU completion. These
short headless runs do not establish Safari behavior, battery impact, or sustained
fanless thermal performance.

Generated evidence is under `.review-artifacts/render-quality/final/`:
`inventory.json`, `timings.json`, and `baseline.png`, `dpr1.png`, `dpr2.png`,
`msaa4.png`, `noAO.png`. Earlier exploratory captures are in the parent directory;
use the isolated final run for timing conclusions.

| Variant | Render buffer | Frame cadence, approximately | Visual result |
| --- | --- | --- | --- |
| DPR 1 + AO | 1440×900 | 16.7 ms | Softer detail, less edge stability |
| Baseline DPR 1.5 + AO | 2160×1350 | 33.3 ms | Current balance; visible edge aliasing |
| DPR 2 + AO | 2880×1800 | 50–66.7 ms | Better fine edges, same material limitations |
| DPR 1.5 + 4× MSAA + AO | 2160×1350 | 50 ms | Smoother silhouettes and keys; substantial extra cost |
| DPR 1.5 without AO | 2160×1350 | 16.7 ms | Similar color-image sharpness; noticeably weaker contact depth |

These are rounded observations; exact trial p50/p95 and submission times are in
the JSON. DPR 2 processes **78% more pixels** than DPR 1.5 in each full-size pass.
Four-sample targets add multisample storage and resolves; they do not improve
texture detail or cure material noise. Neither option is a free M1 quality fix.

The separate interaction profiler (`interaction-final/results.json`) confirms
real camera movement, about 59.5 fps while dragging in its clean second trial,
about 31 fps idle, 57.5 fps entering, and 60 fps exiting. No drawing-buffer writes,
shader compilation, or geometry-buffer uploads occurred during the drag. The
first exploratory profiler run overlapped browser checks; final interaction
trial 1 overlapped the tail of an exploratory resolution run, so prefer trial 2.
One first-visit favicon 404 was recorded; the clean second trial had no errors.

`npm test` passed projection math, interaction at desktop DPR 1/2 and phone DPR 3,
reduced-motion variants, HTML login/windows, screen-plane registration, seated
return, responsive boundaries, and no-WebGL fallback. The fixed-camera resolution
comparisons change neither the camera nor CSS projection coordinates. Build,
build provenance, and source checks passed. The scoped mechanical audit returned
no findings; it does not assess material realism.

## Recommended settings and staged plan

1. **Preserve the shipping resolution policy for now.** Keep desktop cap 1.5,
   mobile cap 2, DPR 1 motion buffers, sRGB/ACES, frozen shadows, and existing
   mipmaps/anisotropy. Do not ship DPR 2 or 4× MSAA globally on this evidence.
   Keep `antialias: true` for the direct mobile/reduced-motion paths. Preserve
   OutputPass on the composer path. Avoid DOF, bloom, sharpening filters, and
   temporal effects as substitutes for detail.
2. **Recover an affordable AO budget before increasing resolution.** Next test
   half-resolution GTAO while leaving the color image at DPR 1.5, then separately
   test sample-count reduction. Compare thin bezel lips, keys, brick joints and
   contact halos at the identical seated and entered poses. Do not remove AO
   globally. If sufficient budget is recovered, compare 2× target MSAA against
   DPR 2; test both resting and motion composers before adopting either. A
   future static bake could reduce runtime work but requires authored UVs and
   careful integration with lamp changes; it is not part of this audit.
3. **Test coherent reflected illumination and fill separately.** First add a
   low-intensity, prefiltered environment matching the room/window in a review
   branch. A single static PMREM is much cheaper than dynamic reflections; do not
   introduce per-frame cube captures. Then test reducing hemisphere fill while
   retaining the night brightness hierarchy. Simply enabling the existing studio
   HDR may wash out the room or give implausible studio reflections. Evaluate
   plastic, walnut, glass and metals together, including lamp-off state. Materials
   with explicit lamp/nameplate environments need a deliberate consistency check.
4. **Author surface response where it is visible.** Separate plastic micro-normal
   detail from broad roughness variation. Keep molded plastic dielectric; improve
   highlights through lighting before reducing roughness. Test a licensed 1K wood
   set with independently authored normal/roughness maps at the current grain
   scale. Keep 512px if a matched screenshot shows no useful gain. Doubling each
   texture dimension costs roughly 4× storage including the proportional mip
   chain; apply upgrades selectively. Existing materials tuned to absent IBL,
   including desk brass at metalness 0.88, should be recalibrated after IBL rather
   than independently brightened now.
5. **Refine only silhouette and construction details that survive the camera.**
   Small visible bevels, coherent seams, real part thickness, and measured CRT
   shell transitions matter more than additional subdivisions. Preserve original
   dimensions, anchor, planar projection surface, picking and screen contract.
   Do not move the camera to conceal model deficiencies.

For each stage, compare home, maximum allowed head turn, entered screen, and
lamp-off captures at desktop DPR 1/2 and phone DPR 3. Measure real drag/entry/exit
as well as idle cadence, then do a sustained 10-minute run on the M1 Air in Chrome
and Safari. Prefer changes that maintain approximately 16.7 ms delivery during
interaction without visible contact or alignment regressions. Preserve a Git
checkpoint before any broad asset replacement.

## Would Blender/GLB help?

**Yes, for authored geometry, normals, UVs and material baking; GLB alone will not
improve sharpness or lighting.** The current procedural CRT already has bevels,
so export format is not the root problem. Blender becomes useful when matching a
specific CRT's shell taper, curvature, seams, bevel widths and smooth normals, or
when baking high-detail normals/AO onto a modest mesh. Avoid importing a dense
render mesh or expecting Blender lighting to transfer automatically. Optimize
material slots, mesh count, texture size and download/decode cost. Replace one
asset behind the existing builder contract, retaining the HTML desktop and flat
projection surface. Validate contact shadows and invalidate frozen maps after
changing casters. This can improve realism without a scene-engine rewrite.

## Remaining uncertainties

- Reflection/fill contribution has strong code evidence but no calibrated lighting
  A/B in this task; final intensities and exposure need rendered comparisons.
- Close-up wood density, plastic noise amplitude, hard desk edges and shadow bias
  merit isolated crops/variants; none is established as a global blur defect.
- 2× MSAA, half-resolution AO, sustained thermal behavior, physical Retina viewing,
  Safari/WebKit and actual live Pages asset parity remain untested here.
- Reduced-motion/mobile intentionally lose AO. Whether to restore equivalent
  static contact detail deserves a separate budgeted test.

## Reproduce

With `npm run build` and `npm run preview` running:

```sh
node scripts/review/render-quality.mjs 'http://127.0.0.1:4320/?diagnostics=1' .review-artifacts/render-quality/final
node scripts/profile-interaction.mjs 'http://127.0.0.1:4320/?diagnostics=1' --trials=2 --dpr=2 --output=.review-artifacts/render-quality/interaction-final
npm test
```

Run measurement commands sequentially with other browser workloads closed.
The reusable harness lives in `scripts/review`; generated artifacts stay ignored.
No scene redesign, dependency change, push, or deployment was performed.
