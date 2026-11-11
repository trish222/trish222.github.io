# CLAUDE.md — trish222.github.io

## Brief

A portfolio branch: Windows 98 retro theme with a 3D isometric intro.
The visitor opens on the corner of a night-time room — a steel
tanker desk with a CRT on it, a brick-built cherry treehouse beside it,
a green banker's lamp, a rainy window in the left wall. Pressing the
monitor flies the camera into the screen; signing in on the Win98 login
hands over to the desktop, which is real DOM chrome.

Reference images are in `/design-references`; each prompt will say which
one to use and what to take from it.

## Rules

- Only use assets and libraries licensed MIT, Apache, OFL, or CC0, plus
  GSAP (free under GreenSock's standard licence).
- **No Microsoft logos, icons, wallpapers, or fonts.**
- **Build 3D objects from primitives in code** rather than importing
  models. A shade is an open-ended cone; a stud is a cylinder; a brick
  is a bevelled box.
- Keep the site mobile responsive.
- Work happens on theme branches (`theme/windows98`). Both `main` and
  `theme/windows98` deploy to the same Pages site; the latest deployment wins.

### Third-party inventory

`three` + its `examples/jsm` addons (MIT) · `gsap` (GreenSock standard
licence — the one documented exception, imported as `gsap/gsap-core` so
CSSPlugin stays out of the bundle) · `tailwindcss` / `vite` /
`playwright` / `stats.js` (MIT; stats.js is dev-only and dropped from
the production build) · `98.css` (MIT, build-time only — see
[docs/desktop-ui.md](docs/desktop-ui.md)) · `@fontsource/playfair-display`
and `@fontsource/atkinson-hyperlegible` (OFL-1.1, vendored into
`public/fonts/`) · `public/fonts/departure-mono-regular.woff2` —
Departure Mono by Helena Zhang, OFL-1.1, checked in from its GitHub
release because it is not on npm · `public/env/studio-small-09-256.hdr`
— "Studio Small 09" by Sergej Majboroda via Poly Haven, CC0 (vendored
but **no longer loaded**; see docs/lighting.md) ·
`public/textures/desk-wood-*.jpg` — "Wood Table 001" by Rob Tuytel via
Poly Haven, CC0, the desk's walnut top. Licences live beside the assets.

Desktop icons are our own pixel art, drawn from primitives by
`scripts/make-icons.mjs` — not Microsoft artwork, and no longer emoji.
Every 3D object is built from primitives in code; nothing is an imported
model.

## Stack and commands

- **Build:** Vite 5. `npm run dev`, `npm run build`, `npm run preview`
  (preview is pinned to **port 4317** because the Playwright scripts
  hardcode it). Root `index.html` is the entry.
- **Language:** vanilla ES modules. No framework, no TypeScript, no JSX.
- **Styling:** Tailwind CSS v4, CSS-first (`@import "tailwindcss"` at the
  top of `src/style.css`), via the `@tailwindcss/vite` plugin. There is
  **no `tailwind.config.js` and no `postcss.config.js`** — v4 needs
  neither and content scanning is automatic, so ignore any advice about
  `content` globs or class purging.
- **3D:** `three` (vanilla, see the decision below), lazy-loaded.
- **Also:** `npm run icons` regenerates the desktop icons;
  `npm run vendor:98` regenerates `src/vendor/98.scoped.css`.
- **Deploy:** GitHub Pages via `.github/workflows/deploy.yml`, on push
  to `main` or `theme/windows98`, or manual dispatch. Runs `npm ci`,
  `npm run build`, and `npm run check:build`, then publishes `dist/`.
  Pages must use **GitHub Actions** as its source, not the source branch.
  See [docs/deployment.md](docs/deployment.md). `base: '/'` in
  `vite.config.js` — this is a user site, so don't change it.

## Layout

```
index.html        all markup — canvas, the screen box (login + the whole desktop inside it), hint (static, no templating)
src/main.js       window manager: focus/open/close/minimize/maximize, drag, taskbar, clock, the sign-in
src/scene.js      camera, lighting, hover/pick, the orbit, the fly-in, the lamp state
src/room.js       the room: plank floor, two walls, wainscot, skirting, crown, rug, fog, the void
src/nightwindow.js  the window in the left wall: joinery, the parallax night backdrop behind it, the rain
src/computer.js   the CRT machine, keyboard and mouse, built from primitives
src/desks/executive.js  the bulky walnut executive desk it stands on, likewise — the default
src/desks/classic.js    the steel tanker desk it replaced; still builds, still reachable with ?desk=classic
src/treehouse.js  the brick-built cherry treehouse, and the spare bricks beside it
src/nameplate.js  the walnut-and-brass desk nameplate, left of the top in front of the lamp; brushed brass, reflecting the lamp's drawn room
src/lamps/greenlamp.js  the desk lamp the room ships with — green glass banker's lamp
src/lamp.js       the cone lamp it replaced; still builds, still reachable with ?lamp=lamp
src/tonemap.js    the tone-mapping operators, and the void's pre-image on the composer path
src/perf.js       dev-only stats.js FPS meter; never reaches production
src/style.css     Win95 design tokens (:root vars) + all component CSS
src/vendor/       98.scoped.css — generated, never hand-edited
lamp-lab.html     dev harness for one lamp on a slab under the room's night rig (not a build input)
scripts/          vendor-98css.mjs, make-icons.mjs
public/fonts/     the OFL faces at stable, preloadable paths
public/icons/     placeholder desktop icons, generated
public/textures/  CC0 walnut scan for the desk top, vendored and relit
public/env/       CC0 studio HDRI — vendored, no longer loaded
design-references/  local mood board — untracked, must not ship
_*.mjs            Playwright review scripts; local-only (.git/info/exclude)
docs/             the detailed notes indexed below
```

`src/scene.js`, `src/computer.js`, the desk modules, `src/room.js`,
`src/nightwindow.js`, `src/treehouse.js`, `src/nameplate.js` and the
lamp modules are the only modules that import three. `src/main.js` stays a DOM/UI module.

## Rules that apply to every task

**1. Pressing the monitor must keep flying in, and the arrival pose
must only ever move on purpose.** That interaction is the site's front
door. `SCREEN_TARGET` and `screenFrustum` are read off the screen
mesh's world matrix, so anything that moves the glass moves the
fly-in's destination as a side effect — which is the thing to avoid.
In particular, do not re-centre the computer kit on the desk — see the
`KIT_FRONT_Z` note in [docs/desk.md](docs/desk.md). `_screenpos.mjs`
and `_sideshot.mjs` are the A/B. The framing itself is one constant,
`ARRIVE_PAD`: the flight stops with the bezel still around the glass
rather than covering the viewport with it, and the canvas therefore
stays opaque until the sign-in — see
[docs/screen-overlay.md](docs/screen-overlay.md).

**2. One press never does two things.** The lamp and the machine are
picked in a single raycast that takes the nearest hit; a press can only
ever be one of the two. Anything new that is pressable goes through
`pickTarget`, not a second handler. The canvas press parked *at* the
screen — a click on the room, which flies the camera back out — is the
one target that is not a raycast, because nothing out there is
pickable at that framing; it is still the same `initCanvasPress` and
the same `CLICK_SLOP`, and the two states cannot overlap.

**3. The shadow map is rendered once and frozen.**
`renderer.shadowMap.autoUpdate = false`. Anything animated back into the
scene has to either not cast, or this has to be reverted — and reverting
it costs a 2048² VSM pass with 16 blur samples every frame. The frozen
map is also what lets the room be bigger than its own lighting: only
`CAST_H` x `CAST_Z1` of the left wall casts — the panel at the size the
map was calibrated against — and everything the room grew by is a
non-caster. See [docs/room.md](docs/room.md).

**4. Frame budget: 16.7ms median on both viewports, zero janky frames.**
And **never read a frame time without its A/B beside it, on one machine
in one sitting** — see [docs/perf.md](docs/perf.md). A prediction is not
a reading.

**5. Dev-only code must not reach production, and that is verified by
grep, not by reasoning.** Three branches sit behind
`import.meta.env.DEV`: the perf meter (`npm run build && grep -r
showPanel dist/` must find nothing); the `?lamp=` resolver, which is
what keeps `src/lamp.js` out of the bundle (grep `dist/` for
`0x3d5a4e`, the cone's shade green — `lamp-shade` will not do, both
lamp modules use it); and the `?desk=` resolver, which keeps
`src/desks/classic.js` out of it (grep for `0xc2b79e`, the tanker
desk's cream enamel — a wood tint will not do, both desk modules carry
walnut).

**6. Three colours have to agree exactly:** `VOID` in `src/room.js`, the
fog colour, and `--scene-void` in `src/style.css`. See `src/tonemap.js`
for what tone mapping does to that promise and how it is kept.

**7. Measure geometry, don't eyeball it.** "Does it fit", "is it off the
edge", "is it in front of the monitor" are questions about projected
corners and about what is on the ray — `window.__fit`, `window.__pick`,
`window.__shadowfit`, `window.__probes`, `window.__histogram`. Several
of the model's defects were invisible at the home framing and obvious
from a side view or in a number.

**8. Conservative boxes fail safe, so keep them.**
`Box3.setFromObject` takes the AABB of a *rotated* AABB for an
`InstancedMesh`, so for yawed models (the treehouse, the cone lamp's
shade) it over-reports. Read the true-box script beside it before
acting, in either direction — never instead of it.

**9. `prefers-reduced-motion` has no render loop.** It draws a single
frame. That is the only path with nothing to paper over a late asset or
an un-advanced fade, so it is where those bugs surface first — treat the
reduced-motion variant as a real test, not a formality.

**10a. Leaving the screen has three routes and one move.** A click on
the room, Escape, and the `#screen-back-bar` button all call
`flyFromScreen`; a menu open on the desktop takes the press first
(`dismissChrome` / `body.menu-open`), and none of them ends the
session. All three are refused while a phone's desktop has the
viewport — Log Off reverses that move first, and the back bar hides
itself there rather than sitting on screen doing nothing. See
[docs/screen-overlay.md](docs/screen-overlay.md).

**10. The desktop is inside the monitor, and inert until the sign-in.**
`#screen-shell` is a sibling of the login inside the overlay box, so
the desktop is laid out at the machine's own resolution —
`SCREEN_BASE_W`, 900, with 900 x `SCREEN_BASE_H` minus the taskbar of
work area — and mapped onto the glass by the same matrix; on a desktop
viewport signing in moves no camera. On a handheld it does: a second,
shorter dolly (`dive`, see "THE SECOND MOVE" in `src/scene.js`) takes
the glass from the bezel framing to covering the viewport, and the
desktop then takes the page at the phone's own size. `isHandheld` is
what decides — "narrow, or short and being touched" — and `PHONE` in
`main.js` and "THE PHONE'S DESKTOP" in `style.css` are the same test;
the three have to stay in step.

`SCREEN_BASE_W` is the one knob for how big everything on the glass
reads. The shell is `opacity: 0; pointer-events: none` until
`signed-in` lands on the body, so any control that has to work before
then (the lamp's hidden button, the drag hint) lives outside `#screen`.
Anything that reads pointer *coordinates* rather than acting on a
target has to go through `glassPoint`; everything else the browser puts
through the transform itself. See
[docs/screen-overlay.md](docs/screen-overlay.md).

**11. Leaving the screen has three routes and one move.** A click on
the room around it, Escape, and the `#screen-back-bar` button all call
`flyFromScreen` and nothing else. A menu open on the desktop takes the
press first (`dismissChrome`, `body.menu-open`), and none of the three
ends the session — the desktop stays signed in on the glass and
pressing the monitor again comes back to it. Log Off is the only thing
that logs off.

## 3D: vanilla Three.js, not React Three Fiber

**Decision: vanilla `three`.** `src/scene.js` owns one
`<canvas id="scene">` and exports `initScene(canvas)` /
`disposeScene()`. `main.js` lazy-loads it via dynamic `import()` after
the desktop is wired up, so three lands in its own chunk instead of
blocking first paint.

Why not R3F: there is no React here, and R3F would mean adding `react`,
`react-dom`, `@react-three/fiber` and almost certainly `drei` to a site
whose entire UI layer is a few hundred lines of vanilla DOM code. The
window manager, drag logic and taskbar are hand-rolled imperative DOM;
R3F's value is reconciling a scene graph against React state, and with
no React state to reconcile you either rewrite the desktop as components
or run a React island beside it and maintain two mental models. The 3D
scope — an ambient scene, not dozens of stateful interactive meshes — is
a `buildScene()` plus a `requestAnimationFrame` loop, which is exactly
what vanilla three is. Weight and cold start matter on a static GitHub
Pages portfolio.

Reconsider only if the desktop itself gets rebuilt in React.

Conventions for the scene:

- Keep `three` imports inside the modules listed above.
- `initScene` returns `false` and renders nothing when WebGL is
  unavailable; `initWithoutScene` takes over. Keep the no-WebGL review
  pass clean.
- `prefers-reduced-motion` renders a single static frame instead of
  starting the loop.
- The rAF loop pauses on `visibilitychange`.
- Push geometries and materials onto `disposables` so `disposeScene()`
  can free them.
- The canvas is `pointer-events: none` and first in `#desktop`, so icons
  and windows (later in the DOM) paint above it without z-index bumps.
  `body.orbit-live` is the one state that turns pointer events on, and
  only before the sign-in.

## three 0.186 gotchas

- **`PCFSoftShadowMap` was removed.** It still exists as a constant, so
  setting it silently degrades to hard PCF with only a console warning.
  `VSMShadowMap` plus `shadow.radius` / `shadow.blurSamples` is the soft
  option now, and it wants `shadow.bias = 0` — use `normalBias`.
- **VSM shadows are refused for point lights** outright, which is why
  the lamp carries a spot alongside its point light.
- **`RGBELoader` is deprecated** in favour of `HDRLoader`.
- **The environment map is an ambient light source**, which is why it is
  off: `ENV_INTENSITY` is 0 and `loadEnvironment` returns before
  fetching when it is.
- **GTAO runs through an `EffectComposer`, desktop only** — it is the
  most expensive thing in the scene. `OutputPass` takes over the
  colour-space conversion the renderer would otherwise do, so the
  lighting calibration holds on both paths.

## Debug handles

Exposed for the review scripts: `window.__scene`, `window.__camera`,
`window.__composer`, `window.__fit(name?)`, `window.__pick(x, y)`,
`window.__fov(deg)`, `window.__zoom(f)`, `window.__orbit(swing, rise)`,
`window.__flyTo(t)`, `window.__diveTo(t)`, `window.__flyFrom(mode)`, `window.__enter()`,
`window.__lights(opts)`, `window.__lamp(opts)`, `window.__shadowfit()`,
`window.__probes()`, `window.__histogram()`, `window.__pixel(u, v)`,
`window.__rain(speed?)`, `window.__tonemap(name)`, `window.__perf`
(dev only). `__pick` runs the **real** `pickTarget`, so what it reports
is the live precedence rather than a restatement of it.

## The docs

Plain paths, deliberately — read the one you need.

| | read this when |
|---|---|
| [docs/camera-and-orbit.md](docs/camera-and-orbit.md) | touching the camera's angles, the frustum/zoom constants, or the orbit leash and its click-vs-drag decision |
| [docs/screen-overlay.md](docs/screen-overlay.md) | touching the live HTML on the glass, its homography, the still, the fly-in timeline, or the sign-in hand-over |
| [docs/lighting.md](docs/lighting.md) | touching the moon, the fill, the CRT's spill, the shadow box, the exposure or the tone mapping |
| [docs/room.md](docs/room.md) | touching the room — floor, walls, mouldings, rug, fog — or the window, its night sky and its rain |
| [docs/desk.md](docs/desk.md) | touching the desk, its paint, its walnut top, or where the kit sits on it |
| [docs/computer.md](docs/computer.md) | touching the CRT, the keyboard, the picture on the glass or the hover |
| [docs/lamps.md](docs/lamps.md) | touching either lamp, the lamp-module contract, `?lamp=`, the lamp lab, or the press precedence |
| [docs/treehouse.md](docs/treehouse.md) | touching the tree, the house, the canopy, the spare bricks or the brick-batching kit |
| [docs/desk.md](docs/desk.md) — "The nameplate" | touching the nameplate, its engraving, or the brass it re-finishes from the lamp's |
| [docs/desktop-ui.md](docs/desktop-ui.md) | touching the windows, drag/focus, the phone interaction model, the fonts, the icons or 98.css |
| [docs/scripts.md](docs/scripts.md) | you need to *check* something — which `_*.mjs` script answers it, and how to read what it prints |
| [docs/perf.md](docs/perf.md) | optimising anything, or before calling a frame time a regression |

## Notes / known rough edges

- **Rule violation still outstanding:** `--font` in `src/style.css` asks
  for `'MS Sans Serif'` and `'Trebuchet MS'`, both Microsoft fonts.
  Nothing is bundled (it only resolves if the visitor already has them),
  but it breaks the no-MS-fonts rule and needs an OFL substitute. The
  vendored 98.css falls back to the same `--font`, so fixing it fixes
  the login screen too — one knob, not two. An OFL pixel face was fitted
  here and reverted on request; see docs/desktop-ui.md for what fitting
  one costs.
- **Three review scripts are out of date.** `_orbit.mjs` asserts the
  old ±90° azimuth leash; the azimuth is clamped off the walls now
  (about -1°..+88° on desktop) — see docs/camera-and-orbit.md.
  `_roomshots.mjs` and `_winshots.mjs` read a `window.__walls` that went
  with the wall fade.
- The scene chunk is ~215 kB gzipped plus ~106 kB of walnut for the desk
  top, all lazy-loaded after the desktop paints. The entry chunk is
  ~3.9 kB gzipped. GSAP is ~26 kB of the scene chunk (importing
  `gsap/gsap-core` rather than `gsap` saves ~7 kB of that); OrbitControls
  ~8 kB; the treehouse ~8 kB and no asset at all.
- No tests, no linter, no README. Don't assume a test command exists.
- `/favicon.ico` 404s — there isn't one. Pre-existing; the review
  scripts filter it out.
- `npm audit` reports pre-existing advisories in the Vite 5 dependency
  tree (esbuild, rollup, postcss, nanoid). Clearing them fully means
  Vite 8 — a deliberate upgrade, not a drive-by.
- `playwright` is a devDependency, so CI installs it; browsers are not
  downloaded by `npm install` (that needs `npx playwright install`), so
  the deploy is unaffected.
- Some in-file comments have drifted from the code they sit beside (a
  couple of stale figures and one "nothing imports this yet" in
  `greenlamp.js`). The constants are the truth; fix comments only when
  you are already editing that code.
- `.github/copilot-instructions.md` is a pointer to this file.
- `design-references/` is gitignored — it holds third-party reference
  imagery (one is a watermarked stock photo) and must not ship.
