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
Orthographic camera 35° down / 45° around, matching
`design-references/isometric-angle.webp`.

The floor is a cream plane whose texture is drawn with canvas 2D: the name
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
16:9 it yields 4 rows. Portrait has its own `FILL_DEPTH_MOBILE` because a phone
frame is far deeper in floor terms — the desktop figure leaves the type a small
patch surrounded by cream. To pin an exact count everywhere, clamp `ROWS_MIN` and
`ROWS_MAX` to the same number.

`LINE_IN_TEX` keeps the drawn line well inside the texture so a cream border
survives at every edge. This matters: the floor plane is much larger than the
texture, and `ClampToEdge` stretches the border pixels across the rest of it. With
a glyph sliced by the texture edge, that smears into long blue streaks running the
width of the floor — very visible once the type went diagonal.

One `DirectionalLight` sits ~13° above the floor — the shallow angle is what makes
the shadow long and diagonal — plus ambient and hemisphere fill. **Light
intensities look ~3x too high because three's physical lighting divides them by
PI.** They are tuned so lit cream lands on `CREAM` and shadowed cream sits at ~0.72
of it, matching the tonal drop in the reference. Changing one means re-checking
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

Hover is raycast from `window` rather than the canvas, because the canvas is
`pointer-events: none` so the Win95 chrome stays clickable; events over a window
or the taskbar are ignored. The easing is time-based, not per-frame, so the lift
settles at the same speed regardless of frame rate.

**`buildComputer` returns `root` and `lift`, and hover must move `lift`.** The
machine's meshes hang off `lift`; the contact shadows hang off `root` and stay on
the floor. Lifting `root` takes the contact shadows up with it, and they float
over the floor as a detached grey blob under the machine.

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
