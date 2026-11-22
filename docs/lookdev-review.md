# Look-dev review (P6)

The cam_overview captures after the post chain, from `npm run review` (scripts/review/capture.mjs, reduced motion, so rain and grain are still):

| | Lamp on | Lamp off |
| --- | --- | --- |
| 1440×900 | [home-1440](refs/lookdev/home-1440.png) | [home-1440-lampoff](refs/lookdev/home-1440-lampoff.png) |
| 390×844 | [home-390](refs/lookdev/home-390.png) | [home-390-lampoff](refs/lookdev/home-390-lampoff.png) |

The "before" set (HEAD 5470d29, per-material AgX, no post) is in `.review-artifacts/p6-before/`, which git ignores; rerun `npm run review -- <url> <dir>` on an older build to regenerate it. The targets are [retro-crt-portfolio.png](refs/retro-crt-portfolio.png) (ref 1) and [retro-crt-portfolio2.png](refs/retro-crt-portfolio2.png) (ref 2).

## What the post chain does now

- **One EffectPass** (`src/scene/post.js`, `src/scene/filmEffect.js`). The film effect does the following:
  - Applies AgX exactly once, with `renderer.toneMapping` set to `NoToneMapping`.
  - Adds the glow before AgX.
  - Applies the grade after AgX: warm highlights, lifted blacks, faded shoulder and saturation.
  - Adds vignette, grain, a slight softness (a half-texel tent) and chromatic aberration that appears only past `caStart`.
- **Alpha in the HalfFloat buffer says what each pixel holds**:
  - `1`: scene light, which gets AgX.
  - `2`: the emitters `lamp_bulb` and `crt_glow`, which get AgX and bloom.
  - `0.5`: the CRT and the city view, which are already display-referred. They get the grade but are not mapped again.
  - `0`: the void, which is left exactly `#1c1a2a`.
- **Glass blends keep the alpha of what is behind them.**
- **Glow**: a quarter-resolution source plus one mipmap blur. It holds three things:
  - emitter bloom (`bloomIntensity` / `bloomThreshold`)
  - the screen's and the city's own glow (`displayGlow` / `displayThreshold`)
  - warm halation over `halationThreshold`
  - The bulb's emissive follows `lampMix`, so its bloom fades with the 0.3 s crossfade.
- **The look fades out on the CRT's own arrival curve** (`1 − smoothstep(0.5, 1, zoom)`), so at the screen the live DOM hand-over is untouched. `tests/crt.mjs` peaks at 2.5 levels (cap 3; it was ≤ 2.1 before, see Color 4).
- **Every setting lives in `LOOK`** (`src/config/look.js`) and in the `?debug` panel; copy outputs them with the rest.

## Lighting

1. **The bulb can never bloom.** `lamp_bulb` sits inside a closed diffuser panel under the shade, so it is hidden from every angle (checked from below the shade). Ref 1 shows a hot opening and a glow under the lip.
   - *Blender:* open the shade's underside, or make the diffuser panel (or a thin strip under the lip) part of `lamp_bulb`, so it is visible from cam_overview.
   - *Code:* nothing more needed. Bloom keys off the mesh's marker and already fades with the lamp.
2. **`crt_glow` is fully occluded.** It is a copy of `screen_plane` 3 mm behind it, the same size. With the screen hidden it blooms, so the marker works.
   - *Code (applied):* the screen now glows from its own picture (`displayGlow` 0.35), which gives ref 1's glowing-screen read.
   - *Blender:* either delete `crt_glow` (then drop it from REQUIRED and the contract), or make it a slightly larger ring just in front of the bezel opening, if a separate glow source is still wanted.
3. **The desk is lit almost evenly from the lamp to the right edge.** Ref 1 has a hot pool under the lamp that falls off to near-dark at the right, and ref 2 is darker away from its lamp.
   - *Code (applied):* the vignette (0.42 from radius 0.35) darkens the corners a little.
   - *Blender:* in the lamp-on bake, lower the world/fill contribution and give the lamp a tighter, brighter cone, so the right third (books, floppies) sits about one stop below the pool under the lamp.
4. **Lamp off is almost black apart from the screen.** The CRT's spill on the keyboard and desk front is faint; ref 2's room still reads by its practicals.
   - *Blender:* raise the screen's emission strength in the lamp-off bake, so the keyboard and the desk front catch a teal-white spill. Possibly add a dim warm practical (hall light through the curtain edge).
5. **Curtains read flat white-grey.** Ref 2's curtains are warm and lit by the lamp, with folds.
   - *Blender:* a warmer curtain albedo, and the re-bake already in Backlog (curtain texel weight and fold unwrap).

## Color

1. **The grade (applied, code).** Compared with before:
   - Highlights are warmer (`warmth` 0.14, weighted by luminance).
   - Blacks are lifted slightly toward a cool grey (`lift` 0.03, `liftColor` [0.75, 0.72, 0.8]).
   - A soft shoulder (`fade` 0.06) is added.
   - Saturation is unchanged (1.02).

   This gives both references' warm, faded film read without the muddy look of a stronger lift. I tried and rejected lift 0.05 with a bluer `liftColor`: it greyed the lamp-off scene and the 390 crop.
2. **The city view is more saturated and sharper than the room.** Ref 2's city is hazier and warmer, with lights blooming.
   - *Code (applied):* `displayGlow` and halation now bloom the city lights.
   - *Proposed (Trish's tuned values, not changed):* `windowSaturation` 1.3 → about 1.1 and `windowContrast` 1.19 → about 1.05, to sit the city behind the glass.
3. **The iced coffee reads milky (a regression from the pipeline).** Glass now composites in linear light before AgX, where before it composited per fragment after AgX. So `glassEnvIntensity` 4.6 (tuned under the old blend) adds more. `glassEnvIntensity` 2.2 brings the coffee back (tested, not applied, because it is a tuned value).
   - *Proposed:* re-tune it with the `?debug` slider. Alternatively, soft-clip `glassLight` in `bakedMaterial.js`'s LM_GLASS path if the window glass should keep its current strength.
4. **The hand-over margin is thinner.** At arrival, `tests/crt.mjs` peaks at 2.5/255 (1440 login, blue; was 2.1). It comes from the same linear-light glass blending, in the screen glare over the picture.
   - *Proposed:* if it creeps up, re-measure `GLARE_MATCH` in `createScene.js` against the test.

## Detail

1. **Edges.** At DPR ≥ 2 the composer runs without MSAA; the softness tent and the small pixels hide the steps, and it saves about 5.5 ms. Below DPR 2 it keeps MSAA 4.
2. **Story-telling clutter.** Both references carry more of it: books with readable spines, a speaker, cables and a phone in ref 1; a plant, VHS tapes, a phone and glasses in ref 2. *Blender:* add 2–3 hero props from CC0/CC-BY libraries. Candidates:
   - a desk plant
   - a cassette or VHS stack
   - a corded phone or speaker
   - glasses on the papers
3. **Surfaces.** The keyboard, case and monitor have the same clean cream plastic; ref 1 shows grime in the key gaps and edge wear.
   - *Blender:* a cavity/AO-driven grime mask on the keycaps and vents (lamp-on and lamp-off bakes).
4. **Wall.** The wall under the window sill is a flat surface with no texture; ref 1's wall shows a soft lamp gradient.
   - *Blender:* a plaster texture with subtle variation, and the lamp-pool change from Lighting 3.
5. **The lamp's spec rectangle in the window top** (existing Backlog item). It is still visible as a soft white rectangle at the top of the frame at 1440×900.

## Frame time (desktop, idle cam_overview, 1440×900)

Measured as 200 synchronous renders, each synced with a 1 px `readPixels`, in headed Chromium on the M1. Production builds were interleaved (`frametime2.mjs` in the session scratchpad) because background load moved absolute numbers by about 7 ms during the session.

| | Before (HEAD) | After |
| --- | --- | --- |
| DPR 2, interleaved, under load | 20.9 ms | 20.4 ms |
| DPR 1, interleaved | 9.6 ms | 14.9 ms |

- At DPR 2 the chain costs about the same as the canvas MSAA it replaces.
- At DPR 1 it costs about 5 ms more, mostly MSAA 4 on the HalfFloat buffer. That is within 60 fps; MSAA 2 at DPR 1 is in Backlog if needed.
- The glow pass (quarter resolution) is about 3.5 ms of the DPR 2 figure.
