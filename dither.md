# Dithered Drifting Clouds — Background Effect

A 2-color (white + blue) animated cloud background: fBm noise rendered through an
ordered Bayer dither, with the whole field drifting across the screen like real
weather. One fullscreen WebGL triangle, no textures, no dependencies, negligible CPU.

This doc has everything needed to rebuild it on another branch from scratch.

---

## 1. How it works

Three independent layers of the idea. Keep them separate in your head — each is
tuned on its own.

**a) Cloud shape — domain-warped fBm**

Fractional Brownian motion: value noise summed over 6 octaves, each double the
frequency and half the amplitude. Each octave is also *rotated* (`mat2(.8,.6,-.6,.8)`)
which breaks up the axis-aligned grid artifacts plain fBm produces.

Plain fBm looks like generic blobs. The fix is **domain warping** — sample noise,
then use that result to offset the coordinates of a second noise lookup:

```glsl
vec2 q = vec2(fbm(p + A), fbm(p + B));
float v = fbm(p + warp * q);
```

That is what produces billowing, cauliflower-edged cloud banks instead of smudges.

**b) 2-color quantization — ordered (Bayer) dither**

Each pixel's cloud density is compared against a threshold from a repeating 8×8
Bayer matrix. Above → ink, below → paper. No intermediate colors ever exist:

```glsl
float ink = step(bayer8(gl_FragCoord.xy / uPix), v);
```

An 8×8 matrix yields 64 *perceived* gray levels from 2 actual colors. Dense regions
fill solid, sparse regions thin into crosshatch. Smooth at a distance, crunchy up close.

The matrix is computed, not sampled from a texture, via a bit-interleaving trick:

```glsl
float bayer2(vec2 a){ a = floor(a); return fract(a.x/2.0 + a.y*a.y*0.75); }
#define bayer4(a) (bayer2(0.5*(a))*0.25 + bayer2(a))
#define bayer8(a) (bayer4(0.5*(a))*0.25 + bayer2(a))
```

**c) Motion — translate the field, don't churn it**

The single most important detail. The dither grid is **fixed in screen space**; the
clouds move *through* it. The entire noise domain translates:

```glsl
p.x -= t * speed * scale;
```

and the **warp field translates with it**, so a cloud keeps its identity as it
crosses the screen rather than morphing into a different cloud halfway. A separate,
much slower `uEvolve` term adds internal churn on top — real clouds drift *and*
slowly change shape, at different rates.

Two further touches sell it:

- **Parallax** — a second, larger, slower deck (0.42× speed) combined with a soft
  `max` so banks overlap rather than averaging into mush. The speed difference reads
  as distance.
- **Anisotropic stretch** — sample space is squashed across the wind direction, so
  banks elongate along travel instead of staying circular.

### Why it reads as "pixelated but not quite"

Two different resolutions are in play. The *dot pitch* is tiny (2–4 device px) while
the *noise* is low-frequency. True pixelation would render at 1/8 scale and
nearest-neighbor upscale — blocky and much coarser. Here you render at full
resolution and quantize only **color**, never **position**.

---

## 2. Critical gotchas

These are the things that look fine for five minutes and wrong afterward.

| Issue | Rule |
|---|---|
| **Dither moiré** | `uPix` must be an **integer number of device pixels**. `gl_FragCoord` is in device px; a fractional `uPix` puts cell boundaries mid-pixel, unevenly resampling the Bayer tile → drifting low-frequency stripes. Drive the control in device px, never CSS px × DPR. |
| **Shimmer at 1dp** | Cells flip faster than the panel settles. Use 2dp minimum; 3dp (= 1.5 CSS px @ DPR 2) is the sweet spot. |
| **Grid moving with clouds** | If the Bayer grid translates too, you get a sliding texture that reads as a scrolling JPEG. Grid stays in screen space. Always. |
| **Boiling instead of drifting** | Caused by feeding time into octaves as independent offsets instead of translating the whole domain. Keep `uEvolve` low (0.2–0.4). |
| **Dead-horizontal wind** | Reads as a scrolling texture. A few degrees of tilt (−7°) looks far more natural. |
| **Unbounded `t`** | After hours, float precision in the noise hash degrades and the texture gets grainier. Irrelevant for a page visit; wrap `t` if you ever need a kiosk build. |
| **DPR cost** | Clamp `devicePixelRatio` to 2. A 3× retina fullscreen canvas is ~2.25× the fragments for no visible gain. |

---

## 3. Production module

The implementation lives in **`src/dither-clouds.js`** — copy that one file.
It is dependency-free and needs no build step. Do not re-type it from this doc;
this section documents the API, the file is the source of truth.

```js
import { initDitherClouds, DEFAULTS } from './dither-clouds.js';

const handle = initDitherClouds(canvas, { /* option overrides */ });
```

Returns `null` if WebGL is unavailable (keep a CSS fallback colour on the
canvas), otherwise a handle:

| Method | Purpose |
|---|---|
| `stop()` / `start()` | Manual pause / resume |
| `set({ ... })` | Live-update any option — e.g. swap `ink` on a theme toggle |
| `destroy()` | Full teardown: listeners, observer, GL context |

Built in: `prefers-reduced-motion` draws a single static frame and never
animates; an `IntersectionObserver` pauses when scrolled offscreen;
`visibilitychange` pauses in background tabs; the backing store only
reallocates when the element actually changes size; `devicePixelRatio` is
clamped to 2.

### Grass (optional, off by default)

Set `grass: true`. Three treatments via `grassStyle`:

- **`'blades'`** — layered meadow. Each blade is a tapered, curved shape
  evaluated as a 2D distance field, planted in jittered cells; the five
  nearest cells are tested per pixel so leaning blades resolve. Four depth
  rows, with back rows multiplied below 1.0 before dithering so they *read*
  as lighter — the dither does the atmospheric perspective.
- **`'soft'`** — no blades; an organic noisy edge dissolving into the sky.
  Reads as a distant fog bank.
- **`'persp'`** — ground receding to the horizon, dither density falling off
  with distance. Currently reads as hazy water; needs work.

`grassDither: false` gives a hard silhouette instead. `grassInk` defaults to
`ink` — a separate colour breaks the 2-colour conceit, so change it only
deliberately.

## 4. Wiring it up

**Markup** — the canvas sits behind content, content needs a stacking context:

```html
<section id="hero">
  <canvas id="cloud-bg" aria-hidden="true"></canvas>
  <div class="hero-wrapper"><!-- content --></div>
</section>
```

**CSS** — `clientWidth/Height` drives the backing store, so the canvas must be
laid out by CSS, not sized by attributes:

```css
#hero { position: relative; isolation: isolate; }

#cloud-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  z-index: 0;
  /* fallback if WebGL is unavailable */
  background: #fff;
}

#hero .hero-wrapper { position: relative; z-index: 1; }
```

**JS**:

```js
import { initDitherClouds } from './dither-clouds.js';

const canvas = document.getElementById('cloud-bg');
if (canvas) initDitherClouds(canvas);
```

As shipped on `theme/frutiger`: canvas added to `#hero` in `index.html`,
`#cloud-bg` rules + `#hero { background: #fff }` in `src/style.css`, init at
the end of `src/main.js`. Note `#hero::before` had a white/green wash that
muddied the two colours — it is now `background: none`.

**Theming** — pass colors in as 0..1 RGB triples to match a light/dark toggle:

```js
const clouds = initDitherClouds(canvas, {
  paper: [1, 1, 1],
  ink:   [0.42, 0.58, 0.83],
});
```

To swap colors live, keep the `gl`/uniform handles around and call
`gl.uniform3fv(u.ink, next)` — no need to tear down and re-init.

---

## 5. Tuning guide

| Control | Range | Notes |
|---|---|---|
| `wind` | 0.0004 – 0.25 | Travel speed. Shipped at **0.0004** (near-static). Tune on an exponential scale — linear sliders waste all their travel on speeds that are too fast. |
| `angle` | −45 – 45° | Wind direction. Never 0. |
| `evolve` | 0 – 2 | Shape morph, independent of travel. 0 = rigid cutouts sliding by; >1 = lava. **0.2–0.4.** |
| `parallax` | 0 – 1 | Blend of the second deck. 0.7 gives good depth. |
| `stretch` | 1 – 3 | Elongation along the wind. 1.7 reads as windswept. |
| `scale` | 0.5 – 6 | Cloud size — *lower is bigger*. 2.2 at desktop width. |
| `dot` | 1 – 8 device px | Integer only. 3 = 1.5 CSS px @ DPR 2. Shipped at **1** — viable only because the wind is near-zero; at speed it shimmers. |
| `contrast` | 0.02 – 0.6 | Tight (~0.2) = hard-edged banks; wide (~0.5) = wispy. |
| `bias` | −0.4 – 0.4 | Overall ink coverage. Slightly negative = mostly white. |
| `warp` | 0 – 3 | Domain warp strength. 0 = generic noise; 1.4 = cloud-like. |

**Coarser grain without a bigger dot:** swap `bayer8` for `bayer4` in `main()`.
16 levels instead of 64 — visibly louder crosshatch at the same dot pitch.

**Mobile:** bump `scale` down (~1.4) so clouds don't become confetti on a narrow
viewport, and consider `dot: 2`.

**Grass knobs:** `horizon` `bladeH` `bladeW` `bladeDens` `lean` `sway`, plus
`fade` for style B. `bladeW` is in uv units so it scales with viewport height
(0.0035 ≈ 2 CSS px). Past `bladeDens` ~100 blades get thinner than the dither
cell and dissolve into noise.

---

## 6. Why WebGL over the alternatives

- **Canvas 2D + `ImageData`** — per-pixel JS every frame. Acceptable at 1/4
  resolution, chuggy at full, and the downscale costs you the fine dot pitch that
  makes the effect work.
- **SVG `feTurbulence` + dot mask** — can't do domain warping (so: generic blobs),
  animates poorly, and filter performance is bad at fullscreen.
- **WebGL** — one fullscreen triangle, zero CPU per frame, resolution-independent,
  every parameter a uniform. ~2 KB of shader.
