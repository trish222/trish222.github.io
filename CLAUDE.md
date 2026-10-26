# CLAUDE.md — trish222.github.io

## Brief

This is a portfolio branch: Windows 98 retro theme with a 3D isometric intro.
Reference images are in `/design-references`; each prompt will say which one to use
and what to take from it.

## Rules

- Only use assets and libraries licensed MIT, Apache, OFL, or CC0.
- No Microsoft logos, icons, wallpapers, or fonts.
- Build 3D objects from primitives in code rather than importing models.
- Keep the site mobile responsive.

Current third-party inventory: `three` and its `examples/jsm` addons (MIT),
`@fontsource/playfair-display` (OFL-1.1), `tailwindcss` / `vite` / `playwright`
(MIT), and `public/env/studio-small-09-256.hdr` — "Studio Small 09" by Sergej
Majboroda via Poly Haven, CC0 (see `public/env/LICENSE.txt`). Desktop icons are
Unicode emoji, not Microsoft artwork. Every 3D object is built from primitives in
code; nothing is an imported model.

## Stack

- **Build:** Vite 5. `npm run dev`, `npm run build`, `npm run preview` (preview is
  pinned to port 4317 because the Playwright scripts hardcode it). Root `index.html`
  is the entry.
- **Language:** vanilla ES modules. No framework, no TypeScript, no JSX.
- **Styling:** Tailwind CSS v4, CSS-first (`@import "tailwindcss"` at the top of
  `src/style.css`), via the `@tailwindcss/vite` plugin. There is **no
  `tailwind.config.js` and no `postcss.config.js`** — v4 needs neither, and content
  scanning is automatic, so ignore any advice about `content` globs or class purging.
- **3D:** `three` (vanilla, see decision below), lazy-loaded.
- **Deploy:** GitHub Pages via `.github/workflows/deploy.yml`, on push to `main` only.
  Runs `npm install && npm run build`, publishes `dist/`. `base: '/'` in
  `vite.config.js` — this is a user site, so don't change it.

### Layout

```
index.html        all markup — canvas, windows, taskbar, Start menu (static, no templating)
src/main.js       window manager: focus/open/close/minimize/maximize, drag, taskbar, clock
src/scene.js      camera, floor, lighting, env map, AO, hover
src/computer.js   the CRT machine, built from primitives
public/env/       CC0 studio HDRI used as the environment map
src/style.css     Win95 design tokens (:root vars) + all component CSS
public/           copied as-is
design-references/  local mood board (CRT monitor photos, isometric angles) — untracked
```

### The scene

`src/scene.js` and `src/computer.js` are the only modules that import three.
Orthographic camera **20° down / 45° around**. The azimuth matches
`design-references/isometric-angle.webp`; the elevation comes from a CAD axis
tripod supplied later, where the two ground axes fall ~18-19° below the horizon
either side of a vertical z. For an orthographic camera at a symmetric 45°
azimuth that on-screen slope is `atan(sin(elevation))`, which puts the elevation
at 20° — much flatter than the 35° this started at.

Flattening the camera is not a one-line change, because three things are sized
against how much floor the frame sees (`frustum / sin(elevation)`, so 2.9 world
units of depth per unit of screen height at 20° against 1.7 at 35°):

- **`FLOOR_SIZE`** — at 70 the plane's far edge came into frame across the top
  corners, showing scene background either side of it. Now 160.
- **The key light's shadow camera** — outside its box a surface simply has no
  shadow, so at ±42 the cast shadow stopped dead on a straight line mid-frame.
  Now ±80, with `shadow.radius` down from 5 to 3 since the same map now covers
  nearly four times the ground.
- **`FILL_DEPTH`** — see below; the old value left the type a band across the top
  with bare floor under it.

The floor is a plain light-grey plane whose texture is drawn with canvas 2D: the name
repeated in deep blue Playfair Display, rows tightly leaded and staggered, after
`design-references/floor-text.png`. Drawing the type into the floor texture rather
than extruding geometry is deliberate — the shadow then falls *across* the letters
as one continuous surface, which is the effect the reference has.

**The type lies flat on the ground plane**, foreshortened with it: baselines run
down-right along world +X, glyph tops point up-right along -Z. There is no
counter-rotation cancelling the camera azimuth — that would make the rows read
level on screen, which looks like a 2D overlay rather than a floor. `FLOOR_SPIN`
picks which floor axis the baselines follow; 0 is the upright reading at this
camera.

Because both floor axes are now foreshortened diagonals, sizing goes through
`PROJ_X` / `PROJ_Z` (screen extent per world unit along each axis) rather than
assuming one axis is screen-horizontal. `LINE_FILL` sets how much of the viewport
width a line's *horizontal* extent covers, and is the single knob for type size:
at 0.62 a whole name sits inside the frame with cream around it, and raising it
toward 1 scales the type up until lines run off the edges.

On a portrait viewport the type settles into a diagonal band with cream corners.
That is geometric, not a bug: a tall frame sees a long stretch of *both* floor
axes, so covering it with one name per line would need type several times larger
than on desktop. The band is the honest result of keeping the name readable.

Row count is derived from the viewport rather than fixed, so a narrow screen gets
more rows instead of a band of type adrift in cream. `FILL_DEPTH` is the knob: at
16:9 it yields 8 rows (it was 4 before the camera flattened to 20°, which left the
type a band across the top with bare floor under it). Portrait has its own `FILL_DEPTH_MOBILE` because a phone
frame is far deeper in floor terms — the desktop figure leaves the type a small
patch surrounded by cream. To pin an exact count everywhere, clamp `ROWS_MIN` and
`ROWS_MAX` to the same number.

`LINE_IN_TEX` keeps the drawn line well inside the texture so a cream border
survives at every edge. This matters: the floor plane is much larger than the
texture, and `ClampToEdge` stretches the border pixels across the rest of it. With
a glyph sliced by the texture edge, that smears into long blue streaks running the
width of the floor — very visible once the type went diagonal.

`CREAM` is a historical name — the ground is now a neutral grey (`#dcdee0`), and
the key and hemisphere tints were neutralised along with it. That second part
matters: a warm key over a neutral ground still renders as cream, so the colour
constant alone does not control how grey the floor reads.

One `DirectionalLight` sits ~13° above the floor — the shallow angle is what makes
the shadow long and diagonal — plus ambient and hemisphere fill. Its shadow camera
is ±80: a surface outside that box has no shadow at all, so the box has to bound
the whole visible floor, not just the machine. **Light
intensities look ~3x too high because three's physical lighting divides them by
PI.** They are tuned so the lit ground lands on `CREAM` and the shadowed ground sits at
~0.72 of it, matching the tonal drop in the reference. Changing one means re-checking
the others.

`_scene-shot.mjs` renders the scene with the Win95 chrome hidden, for looking at
the 3D on its own. Note `.git/info/exclude` holds `_*.mjs`, so all of these helper
scripts are local-only and never committed.

`src/main.js` is imperative DOM code keyed off `id="window-<name>"` and `data-window` /
`data-drag` / `data-target` attributes, with a `WINDOWS` registry object at the top.
Add a window by adding markup in `index.html` **and** an entry in that registry.

### Visual checks

`_review.mjs` is the one to use: `npm run preview` in one shell, `node _review.mjs` in
another. It shoots desktop / mobile / light / reduced-motion / no-WebGL variants into
`.impeccable/review/` and prints a per-variant probe plus a console-error tally. The
no-WebGL pass stubs `getContext('webgl*')` to `null`; `scene: "fallback"` there and
`scene: "live WxH"` elsewhere is the expected result.

`_shot.mjs` and `_one.mjs` are older one-off scripts still pointing at elements from a
previous theme (`#ink-field`) — they will throw. Fix or ignore; `_review.mjs` supersedes them.

## 3D: vanilla Three.js, not React Three Fiber

**Decision: vanilla `three`.** `src/scene.js` owns one `<canvas id="scene">` and exports
`initScene(canvas)` / `disposeScene()`. `main.js` lazy-loads it via dynamic `import()`
after the desktop is wired up, so the ~130 KB gzipped of Three.js lands in its own chunk
instead of blocking first paint (entry chunk stays ~2.4 KB gzipped).

Why not R3F:

1. **There is no React here.** R3F would mean adding `react`, `react-dom`,
   `@react-three/fiber` and almost certainly `drei` — pulling a framework into a site
   whose entire UI layer is ~290 lines of vanilla DOM code.
2. **The existing UI would have to move or straddle.** The window manager, drag logic
   and taskbar are hand-rolled imperative DOM. R3F's value is reconciling a scene graph
   against React state; with no React state to reconcile, you either rewrite the desktop
   as components or run a React island beside it and maintain two mental models.
3. **The 3D scope suits it.** The references point at an ambient scene — an isometric
   CRT/desk — not dozens of stateful interactive meshes. That's a `buildScene()` plus a
   `requestAnimationFrame` loop, which is exactly what vanilla Three.js is.
4. **Weight and cold start matter** on a static GitHub Pages portfolio.

Reconsider only if the desktop itself gets rebuilt in React — then R3F stops being an
island and starts paying for itself.

Conventions for the scene:
- Keep `three` imports inside `src/scene.js`. `main.js` stays a DOM/UI module.
- `initScene` returns `false` and renders nothing when WebGL is unavailable; the flat
  teal `body` background is the fallback. Keep the `no-webgl` review pass clean.
- `prefers-reduced-motion` renders a single static frame instead of starting the loop.
- The rAF loop pauses on `visibilitychange`.
- Push geometries and materials onto `disposables` so `disposeScene()` can free them.
- The canvas is `pointer-events: none` and first in `#desktop`, so icons and windows
  (later in the DOM) paint above it without needing z-index bumps.

### The computer

`src/computer.js` builds the CRT, stand and keyboard from primitives. Shape comes
from `crt-computer.png` (thick bezel, recessed screen, button panel bottom right,
green LED) and `crt-computer-big.webp` (deep tapered back, side vents, round
stand).

`FACING` is 0: the machine is square to the floor grid, so its bezel edges run
parallel to the name text (which lies along +X) and the screen turns to face
left. At the 45-degree camera azimuth that lands on the even three-quarter view
of `crt-computer-full.jpeg`, front and one side both in play — and it is what
brings the side vents into shot.

Two things there are less obvious than they look:

- **The bezel is an `ExtrudeGeometry` with a hole, not a box.** A solid box plus a
  dark inset panel cannot make a recess — the panel just covers the screen, which
  is exactly the bug that made the screen render as a grey rectangle. The hole
  sits above centre (`OPEN_CY`) so the bottom bezel is the deepest, which is where
  the button panel and LED go.
- **Vents are slats over a dark cavity**, so the gaps read as the slots. Their x
  position is derived from the funnel's taper at that depth — hard-coding it
  leaves them floating off the surface.

#### What carries the realism

The silhouette was already right; what was missing was everything a real desk
has that a clean render does not.

- **The keyboard is a 101-key layout, not a grid.** `keyLayout()` lays the field
  out in key units (`KU` is the pitch) from rows of widths — 1.5u Tab, 2.25u
  Enter, 6.25u space — plus the nav cluster and numpad, with the tall `+` and
  Enter spanning two rows. The ragged right edge of the alpha block and the two
  side clusters are what identify a keyboard at a glance; a uniform grid reads as
  a placeholder. Single-unit caps go in one `InstancedMesh`; the wide and tall
  ones get their own geometry so the corner radius is not stretched with them.
  A dark `well` under the caps keeps the gaps between keys from showing shell
  plastic. The whole thing is rotated ~2° off square, because nobody aligns a
  keyboard to their monitor.
- **The screen is on.** `screenTexture()` draws an abstract desktop — teal ground,
  one window, a taskbar — into an offscreen canvas, then composites it through
  `blur(1.5px)` plus a wide low-alpha pass for phosphor bleed, and lays scanlines
  over it. The blur matters: a crisp bitmap on the glass looks like a screenshot
  pasted onto a render. Scanline pitch is 5px in a 576px texture so the lines
  survive being drawn at ~200px across — finer pitches average away to nothing.
  A small `PointLight` in front of the tube spills onto its own bezel;
  `SCREEN_GLOW` in `scene.js` scales it with the picture brightness, which also
  carries a shallow flicker.
- **Two cables.** At this camera the floor directly behind a body is hidden by
  it — screen-up is world -Z — so a cable run only becomes visible once it breaks
  out sideways past the silhouette. That is why the keyboard cord swings left and
  the mouse cord crosses open floor. They ride on `lift` with the things they plug
  into. `CABLE` is deliberately darker than the shells; at shell colour a cord
  reads as a scratch on the floor. There was a third run — a mains lead out of the
  monitor's back, clearing the funnel on the right — removed on request; it read as
  a stray wire rather than as part of the machine.
- **The case is not one moulding.** A dark frame standing a hair proud of the
  bezel wall gives the shell seam; the rear shell uses its own slightly cooler
  `PLASTIC_BACK`; the stand gets a moulded step and a dark swivel collar; and
  `plasticTextures()` carries a low-frequency value-noise octave under the
  per-pixel grain, so the plastic ages unevenly instead of reading as one
  uniform surface.
- **The plastic is textured through `map`, not just `roughnessMap`.** One noise
  field comes out as two textures: a wide-range roughness/bump map, and a
  near-white albedo map with a few percent of value swing. Roughness alone was
  invisible — on a surface this matt the sheen barely moves, so the shell read as
  one flat colour whatever the roughness did. Both maps share a field on purpose:
  on real plastic the duller patches are also the darker ones. Scale matters as
  much as amplitude — at 512px tiled twice across the shell a texel is about a
  device pixel, and the blotches sit at a tenth of a tile; the earlier 256px/6×
  settings averaged away to flat vinyl at the size the machine actually renders.
- **The shell is kept out of the floor's value range.** It used to sit within a
  shade of the lit ground, which read as bright and flat. The palette came down
  about 7%, `envMapIntensity` from 0.8 to 0.5 (the HDRI was doing a lot of the
  lifting), roughness up to 0.68, and the screen's spill light from 2.6 to 2.1 —
  it was washing out its own bezel. GTAO went to `blendIntensity` 1.0 / radius
  1.15 so the creases actually darken. `envMapIntensity` is now 0.34: the HDRI
  is ambient from every direction, so it was filling exactly the faces the key
  never reaches — the right flank, the funnel — and flattening the body. The
  floor keeps its own full-strength env, so the ground tone the lighting is
  calibrated against does not move with it.
- **Three of the monitor's shadows are painted, not cast.** The key's shadow map
  covers ±80 world units of floor, so a texel is ~0.08 units: a bezel lip or the
  gap between a monitor and the base it sits on never lands on one, and GTAO is
  desktop-only, so nothing on a phone supplies them either. So they are drawn.
  `recessShadowTexture` is a black alpha frame over the picture, heaviest down
  the left and across the top where the lip stands between the glass and the
  key; `sleeveShadowTexture` is a sleeve of shade down the stand's neck,
  darkest under the collar; `baseShadeTexture` darkens the top faces of the foot
  and the step, which look straight up into the underside of the monitor and
  used to be the brightest plastic in the scene instead of the darkest. The base
  gradient is deliberately flatter than the contact-shadow one — only a narrow
  ring of each disc is ever visible, and a falloff that has faded by the rim
  leaves the stand looking lit.
- **GTAO `scale` tops out around 1.15 here.** Pushed to 1.35+ the sampling noise
  shows as blotches on the flat of the bezel — the one surface in frame with
  nothing in the depth or normal buffer for the denoiser to lock onto, so
  widening its kernel only smears the noise into larger blobs. 1.15 with
  `samples: 24` is clean; 12 samples is not enough at that scale.
- **The badge says `TRISH T-1500`.** No real brand may appear on the bezel, so
  the model number is ours.

Hover is raycast from `window` rather than the canvas, because the canvas is
`pointer-events: none` so the Win95 chrome stays clickable; events over a window
or the taskbar are ignored. The easing is time-based, not per-frame, so the
picture settles at the same speed regardless of frame rate.

**Hover happens on the screen, not in world space.** The machine used to lift and
turn; it no longer moves at all. `screenDisplay()` builds *two* composited
pictures — the idle desktop and the same desktop with `hello` in the window body —
and `setScreen(v)` crossfades them into one live `CanvasTexture`, which `scene.js`
drives from `hover.value` alongside the brightness bump. The two pictures are
identical outside the window body, so the alpha blend only changes what it should.
`setScreen` skips the redraw and the texture re-upload once the mix has settled,
so a still hover costs nothing per frame.

`buildComputer` still returns `lift` — the machine's meshes and the cables hang off
it, while the contact shadows hang off `root` and stay on the floor. Nothing moves
it now, but if anything ever animates the machine again it has to move `lift`:
moving `root` takes the contact shadows up with it, and they float over the floor
as a detached grey blob.

### three 0.186 gotchas

- **`PCFSoftShadowMap` was removed.** It still exists as a constant, so setting it
  silently degrades to hard PCF with only a console warning. `VSMShadowMap` plus
  `shadow.radius` / `shadow.blurSamples` is the soft option now, and it wants
  `shadow.bias = 0`.
- **`RGBELoader` is deprecated** in favour of `HDRLoader`.
- The environment map is an ambient light source, so it has to be paid for
  somewhere: when it loads, `ENV_INTENSITY` goes up and the flat fills come down
  to `AMBIENT_WITH_ENV` / `HEMI_WITH_ENV`. Left alone, the HDRI blows the cream
  out to white and flattens the shadow until it stops reading. The scene renders
  before the HDRI arrives and still looks right without it, just flatter.
- GTAO runs through an `EffectComposer`, **desktop only** — it is the most
  expensive thing in the scene. `OutputPass` takes over the colour-space
  conversion the renderer would otherwise do, so the lighting calibration below
  holds on both paths.

`window.__scene` and `window.__composer` are debug handles for the review
scripts.

## Notes / known rough edges

- **Rule violation still outstanding:** `--font` in `src/style.css` asks for
  `'MS Sans Serif'` and `'Trebuchet MS'`, both Microsoft fonts. Nothing is bundled
  (it only resolves if the visitor already has them), but it breaks the no-MS-fonts
  rule and needs an OFL substitute.
- The scene chunk is ~161 kB gzipped plus a 128 kB HDRI, all lazy-loaded after
  the desktop paints. The entry chunk is still ~2.5 kB gzipped.
- No tests, no linter, no README. Don't assume a test command exists.
- `npm audit` reports pre-existing advisories in the Vite 5 dependency tree (esbuild,
  rollup, postcss, nanoid). Clearing them fully means Vite 8 — a deliberate upgrade, not
  a drive-by.
- `playwright` is a devDependency, so CI installs it; browsers are not downloaded by
  `npm install` (that needs `npx playwright install`), so the deploy is unaffected.
- `.github/copilot-instructions.md` is now just a pointer to this file.
- `design-references/` is gitignored — it holds third-party reference imagery
  (one is a watermarked stock photo) and must not ship.
- Work happens on theme branches (`theme/windows98`); only `main` deploys.
