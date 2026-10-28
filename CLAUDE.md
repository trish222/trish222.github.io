# CLAUDE.md — trish222.github.io

## Brief

This is a portfolio branch: Windows 98 retro theme with a 3D isometric intro.
Reference images are in `/design-references`; each prompt will say which one to use
and what to take from it.

## Rules

- Only use assets and libraries licensed MIT, Apache, OFL, or CC0, plus GSAP
  (free under GreenSock's standard license).
- No Microsoft logos, icons, wallpapers, or fonts.
- Build 3D objects from primitives in code rather than importing models.
- Keep the site mobile responsive.

Current third-party inventory: `three` and its `examples/jsm` addons (MIT),
`gsap` (GreenSock standard licence — the one documented exception to the list
above; it drives the fly-in timeline, imported as `gsap/gsap-core` so CSSPlugin
stays out of the bundle), `@fontsource/playfair-display` (OFL-1.1, vendored into
`public/fonts/` — see below), `@fontsource/atkinson-hyperlegible`
(OFL-1.1, likewise vendored), `tailwindcss` / `vite` / `playwright` / `stats.js`
(MIT; `stats.js` is dev-only and is dropped from the production build),
`98.css` (MIT, build-time only — see below),
`public/fonts/departure-mono-regular.woff2` — Departure Mono by Helena
Zhang, OFL-1.1, checked in from its GitHub release because it is not on
npm, and `public/env/studio-small-09-256.hdr` — "Studio Small 09" by Sergej
Majboroda via Poly Haven, CC0 (see `public/env/LICENSE.txt`). Desktop icons are
our own pixel art, drawn from primitives by `scripts/make-icons.mjs` — not
Microsoft artwork, and no longer emoji either. Every 3D object is built from
primitives in code; nothing is an imported model.

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

### 98.css

The login screen on the CRT is built with [98.css] (MIT). It is **not**
imported from `node_modules` — `npm run vendor:98` derives
`src/vendor/98.scoped.css` from it, and that generated file is what
`src/style.css` imports. Three things have to change first, all of them
in `scripts/vendor-98css.mjs`:

- **It ships MS Sans Serif as woff/woff2.** Those are Microsoft fonts,
  which the rules above forbid, and importing the package directly makes
  Vite emit the binaries into `dist/`. The `@font-face` blocks are
  dropped and the stack falls back to the site's own `--font`. (Its
  icons are fine — all inline `data:` SVGs redrawn by the 98.css author,
  no Microsoft artwork.)
- **It styles bare `body`, `h1`-`h4`, `button`, `input`, `select`,
  `table` and `textarea`**, which would stomp the desktop chrome. Every
  rule is scoped under `.ui98`, so the kit only applies inside the login
  screen.
- **`.window` and `.window-body` are already taken** by the desktop's own
  chrome, and `main.js` drives every `.window` on the page through the
  window manager. They are renamed `.win98` / `.win98-body` — so the
  login dialog's markup reads `class="login-dialog win98"` rather than
  the `class="window"` the 98.css docs show.

Regenerate after bumping the dependency; never hand-edit the output.

[98.css]: https://github.com/jdan/98.css

### Layout

```
index.html        all markup — canvas, windows, taskbar, Start menu, drag hint (static, no templating)
src/main.js       window manager: focus/open/close/minimize/maximize, drag, taskbar, clock
src/scene.js      camera, floor, lighting, env map, AO, hover, the orbit, the fly-in
src/computer.js   the CRT machine, built from primitives
public/env/       CC0 studio HDRI used as the environment map
src/style.css     Win95 design tokens (:root vars) + all component CSS
src/perf.js       dev-only stats.js FPS meter; never reaches production
src/vendor/       98.scoped.css — generated, see "98.css" above
scripts/          vendor-98css.mjs, which generates it
public/fonts/     the four OFL faces at stable, preloadable paths (see "Typography")
public/icons/     placeholder desktop icons, generated — `npm run icons`
scripts/make-icons.mjs  draws them; no dependencies, PNG written by hand
public/           copied as-is
design-references/  local mood board (CRT monitor photos, isometric angles) — untracked
```

### The scene

`src/scene.js` and `src/computer.js` are the only modules that import three.
Orthographic camera **20° down / 37° around**. The elevation comes from a CAD
axis tripod, where the two ground axes fall ~18-19° below the horizon either
side of a vertical z. For an orthographic camera at a symmetric 45° azimuth
(which is where this started, after `design-references/isometric-angle.webp`)
that on-screen slope is `atan(sin(elevation))`, which puts the elevation at 20°
— much flatter than the 35° it began at.

The azimuth then came off that symmetry by 8°, on request, to turn more picture
toward the viewer. The screen looks down world +Z and the camera sits in the
+X/+Z octant, so a *smaller* azimuth walks the camera round toward the front.
The two ground axes are no longer mirror images — +X now falls ~11.7° below the
horizon and +Z ~24° — so the floor type lies flatter and stacks more steeply.
Both fall straight out of `PROJ_X` / `PROJ_Z`, so the type resized and re-rowed
itself; nothing was hand-retuned. Keep any further swing slight: past ~30° the
side vents leave the shot and the view stops reading as isometric.

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

### The live page on the glass, and the fly-in

**The CRT's picture is real HTML, not a texture.** `#screen` in
`index.html` is a plain DOM box holding a Windows 98 login dialog
(98.css, see above, over `--desktop` teal); `updateScreenOverlay` in
`scene.js` lays it onto the screen plane with a CSS `matrix()` every
frame. The camera is **orthographic**, so the projection of a plane is
affine — three projected corners give the transform exactly, with none
of the `matrix3d` homography a perspective camera would need, and the
same two lines hold at every point of the fly-in. If the camera ever
becomes perspective, this is the code that breaks.

Three things there are less obvious than they look:

- **The box is sized from JS, not CSS.** `SCREEN_BASE_W` and the height
  derived from it are the denominators of the matrix, and `offsetHeight`
  rounds to whole pixels. The base width also sets how big the dialog
  lands once the page has the viewport: at 1200 it is near its natural
  size on a desktop viewport, so the arrival does not read as a
  blown-up screenshot.
- **It is mapped inside the overscan, not onto the whole panel.** The
  bezel lip overhangs the glass by more than the opening's lateral
  clearance, so at the isometric camera it clips about 1.5% off the left
  edge of the screen — enough for the overlay to spill onto the
  plastic. `OVERSCAN` in `computer.js` is the black border `drawPicture`
  already draws; sitting inside it keeps the live HTML clear of the lip
  *and* lets the real tube's overscan frame it.
- **Scanline pitch and blur are divided by the current scale.** They are
  authored in the box's own pixels but want to be constant in device
  pixels; at the isometric framing the box draws five times smaller than
  it is. The blur is the same point `screenTexture` makes — a crisp
  bitmap on the glass looks like a screenshot pasted onto a render.
  Both fade out as the camera arrives, along with the vignette and the
  recess shadow in `.crt-fx`.

**The fly-in is one parameter.** `fly.value` is 0 at the establishing
shot and 1 with the page filling the viewport, and `applyFly` derives
the entire camera pose from it — so a resize part-way through re-derives
the framing instead of losing it. `applyFly(0)` reproduces the original
isometric pose exactly; that is the only definition of it now. Note
`applyFly` is **linear** in its parameter: the easing lives on the
timeline, so `__flyTo` and the spline both work in geometry rather than
in time.

**What drives that parameter is one paused GSAP timeline**, built once
by `buildFlyTimeline`. `play()` flies in, `reverse()` flies out along
the identical eased curve — so the back animation *is* the forward one
run backwards rather than a second implementation that can drift. It
carries two tweens, both on a plain proxy object read in `onUpdate`
rather than GSAP writing camera properties directly:

- **the move**, 1.6s on `power3.inOut`;
- **the crossfade**, 0.3s on `power1.inOut`, starting at 1.3s so it
  overlaps the tail of the move. It fades the canvas out, fades the live
  HTML overlay in, and scales the page the last 1.5% up to its resting
  size, so the arrival settles rather than popping. Before this the
  canvas fade was a CSS transition that could only start once the camera
  had already stopped — that gap *was* the pop.

GSAP owns the timing; `applyFly` owns the pose. Keep it that way: the
curved path means position is sampled off a spline rather than
interpolated between two values, and a mid-flight resize has to be able
to re-derive everything from `fly.value`.

`gsap.ticker.lagSmoothing(250, 250)` is set deliberately. GSAP's default
(500ms counted as 33ms) protects the animation at the cost of wall-clock
time — on a software renderer it stretched this 1.6s flight past 30
seconds. 250/250 reproduces the `Math.min(dt, 0.25)` cap the old
hand-rolled loop used, on the same reasoning: a machine that cannot hold
4fps should arrive promptly rather than sit through a long flight.

**The camera follows a CatmullRomCurve3, not a two-phase blend.** It
used to run a turn (to 55%) overlapping a zoom (from 45%), the overlap
existing only to disguise the hand-over between them; a single
C1-continuous spline has no hand-over to disguise. `buildFlyPath` fits
three curves — position, look-at target, and log-frustum — through four
poses **sampled off that old path** at `FLY_KNOTS`, so the arc it was
art-directed into survives the rebuild instead of being re-invented.
`samplePose` is that old path, kept solely as the knot source.

All three curves share one parameterisation, which is what keeps
position, target and zoom locked to each other. The frustum is a curve
too, carrying `log(height)` in `x` — reusing three's Catmull-Rom for it
guarantees identical parameterisation where a separate scalar easing
would drift, and log space matters because for an orthographic camera
the frustum height *is* the zoom, so lerping it linearly lurches. It is
clamped to its endpoints: a frustum that dips below the final height and
comes back reads as a bounce. `screenFrustum` uses `min`, not `max`: the
screen is 4:3-ish and the viewport rarely is, so "fills the viewport"
means cropping the other axis rather than letterboxing it.

`FLY_TENSION` is 0.42 rather than three's default 0.5 — slacker, so the
curve bows a little more gently through the knots.

Three things have to be given up along the way:

- **GTAO fades out over the first 30%.** Its radius is in world units,
  tuned against a frame that sees 18 of them; six times closer in it is
  no longer sampling creases and blotches the bezel instead.
- **The canvas stops at the taskbar**, so the 40px the taskbar vacates
  would show the bare teal WebGL-fallback `body` against the grey floor.
  `body.screen-active` carries `--scene-floor` through there instead and
  crosses to teal on `--scene-fade`. `--scene-floor` has to match `CREAM`
  in `scene.js`. That hand-over tracks the **zoom**, not the crossfade,
  and is held until `fly.value` passes 0.7: the floor is out of shot long
  before the canvas starts to dissolve, and mixing on the crossfade
  leaves a visibly lighter band under a screen that has already gone
  teal. It is snapped to 5% so most frames rewrite the same string and
  cost no style invalidation.
- **The live HTML comes off the glass for the length of the move** — see
  "the still" below.

### The still, and why the live overlay stands down mid-flight

The picture during the flight is a **bitmap of the login drawn into the
3D screen texture** (`setStill` / `clearStill` in `computer.js`), not the
live DOM overlay. The overlay is hidden — `visibility: hidden`, set
inline, because an element at `opacity: 0` is still painted — and fades
back in over the crossfade. Both show the same login at the same place,
so the hand-over has nothing to give away.

This is purely about raster cost, and it is the single largest win in
the whole animation. `#screen-page` carries a blur filter and `.crt-fx`
three gradients plus an inset box-shadow; the CSS matrix rescales the box
every frame, and the compositor cannot reuse a raster across a scale
change. So the browser re-blurred and re-drew those gradients once per
frame over an area that by the end of the move is the whole viewport.
Measured: **~57ms a frame flying out on a 390x844 viewport**. Moving the
picture into the texture — which the GPU was drawing anyway — takes the
move to a flat 60fps in both directions on both viewports.

Things that were tried first and did **not** work, so they do not need
trying again: replacing the subtree with a single `<img>` of the same
bitmap (~45ms frames — an `<img>` with a filter still forms its own
render surface); dropping the filter and the box-shadow (no measurable
change). Hiding the overlay outright was the only thing that moved the
number, which is what the texture approach amounts to.

`drawStill` rasterises the overlay through an SVG `<foreignObject>`,
which is the only way to get the browser's own layout of real HTML into
a canvas. Two non-obvious requirements:

- **It must be assembled as DOM and serialised with `XMLSerializer`.**
  `foreignObject` content is parsed as XML, and neither half is
  well-formed as authored — the login markup has bare `<input ...>`, and
  the stylesheets carry 98.css's icons as inline `data:` SVG, so the CSS
  text is full of raw `<` and `&`. Hand-concatenating the strings
  produces a document the parser rejects outright, and the only symptom
  is an image that never decodes.
- **Every stylesheet has to be inlined and the `:root` tokens copied
  onto the wrapper**, since the SVG renders as an image with no access to
  the parent document or the network, and `:root` inside it is the `<svg>`
  rather than the `<html>` the selectors expect. Styles are collected
  from `document.styleSheets` rather than imported, so it keeps working
  whatever Vite does to the CSS between dev and build. **Fonts cannot be
  fetched from in there either**, so the dialog renders in the local
  fallback of `--font` — which is fine only because `--font` is itself a
  local stack. Give the chrome a webfont and the still and the live
  overlay set the same dialog in two different typefaces, swapping at
  the exact moment the still exists to paper over; the fix is to fetch
  the face once and append it as a `data:` URI `@font-face` after the
  collected CSS, and to copy `word-spacing` and `-webkit-font-smoothing`
  onto the wrapper, since it inherits those from a `body` that does not
  exist in here.

It is drawn in idle time after init and refreshed on `input` (and on
`depart`, since the form may have been typed into), never on the click —
a few milliseconds of rasterising is a visible hitch if it lands on the
first frame of the move. Every failure path leaves `stillCanvas` null and
the flight then shows the abstract desktop picture instead, with the
login arriving on the crossfade. Different, still smooth, never broken.
`canvas.toDataURL` is called purely to detect tainting early, where it
would otherwise surface later as a WebGL security error on upload.

`--scan` and `--blur` are still written on `#screen`, but **snapped to a
coarse grid while the camera moves** (`BLUR_STEP`, `SCAN_STEP`). They
feed a filter and three gradients, so every distinct value costs a
raster; the steps are invisible under motion and resolve exactly at
rest, which is where stepping would show. `--zoom` stays per-frame —
it only drives opacity on a layer promoted with `will-change`, which the
compositor does for free.

Body classes carry the state to CSS: `screen-active` for the whole trip,
`screen-zooming` only while the camera moves, `screen-focused` once it
has arrived. `prefers-reduced-motion` gets the destination without the
journey. With no WebGL none of it exists — `initScene` returns false and
`initWithoutScene` takes over; see the sign-in gate below.

### Typography, and the desktop icons

**The chrome face is a local stack and the window faces are vendored.**
`--font` asks for MS Sans Serif, then Trebuchet MS, then Arial: nothing
is bundled for it, so title bars, buttons, menus, icon labels, the
taskbar and the login dialog render in whatever the visitor already has.
The vendored 98.css falls back to `--font` too, so it is one knob for the
whole kit. (This is the rule violation tracked under "Notes" below — see
there before reaching for it.)

The two faces that *are* shipped are OFL and vendored into
`public/fonts/` with their provenance in the `LICENSE.txt` beside them,
rather than imported from `node_modules`, for the same reason Playfair
is: Vite hashes what it emits and a preload needs a URL that does not
move.

- **Playfair Display** — the name repeated across the 3D floor.
- **Atkinson Hyperlegible** (`--font-body`) — reading matter inside
  windows, set on `.window-body`. The chrome face is a readability tax
  on anything longer than a label; the controls inside a window body are
  chrome and opt back in explicitly.
- **Departure Mono** (`--font-mono`) — the resume and anything else that
  wants to read as a terminal.

A pixel chrome face (Pixelify Sans) was fitted and then taken back out on
request. Two things it needed are worth knowing if one is ever fitted
again, because neither is obvious and both cost a round trip to find:
`-webkit-font-smoothing: none` plus integer sizes, since antialiasing
only greys the edges of blocks that are already the right shape; and a
widened word space, since a one-column space reads as "Awebapp" at UI
sizes. The third is in the still — see "fonts cannot be fetched" under
the fly-in, which stops being a footnote the moment `--font` is a face
the generic fallback does not resemble.

**The desktop icons are 32×32 PNGs in `public/icons/`**, generated by
`scripts/make-icons.mjs` (`npm run icons`) from rectangles, tapers and
discs — the same reasoning as the 3D machine: a checked-in binary with
no source is a dead end, and at this size every pixel should be placed
rather than resampled. They are **placeholders for Trish's own pixel
art**: drop real PNGs of the same names over them and nothing else
changes. They replaced emoji, which are a font rather than artwork and
so render as whatever the visitor's OS feels like. Everything that shows
one — desktop, taskbar, Start menu, title bars — draws it with
`image-rendering: pixelated`, at 32px on the desktop and 16px everywhere
else. The Start button's mark is a little CRT: the machine the site is
set inside, and nothing anyone else owns. `document.png` is the odd one
out — it is not a desktop icon at all but the row glyph in the Recycle
Bin's listing, drawn separately so `resume.png` keeps meaning the
resume and real art dropped over either does not borrow the other's
meaning.

The window registry in `main.js` carries the icon basename alongside the
title, and skips any entry whose `#window-<id>` does not exist — which is
what lets a desktop icon land before its window does.

### Looking around the establishing shot

**The camera is the visitor's at `fly.value === 0`, and nobody else's.**
`OrbitControls` (three/addons, MIT) hang off `camera` and the canvas. No
pan, no wheel zoom (with `enableZoom` off, OrbitControls returns before
it would `preventDefault`, so the page still scrolls), and both angles
clamped — but the two clamps are expressed in **different frames**, and
that is the thing to understand before touching them:

- **Azimuth is measured off the monitor's front**, not off home.
  `ORBIT_SWING` is ±90° of it, and the front is azimuth `FACING` — the
  screen looks down the machine's local +Z, so a camera dead in front
  of the glass sits at exactly the machine's own y-rotation. The leash
  is therefore the full half-turn the machine can be seen from: a
  profile of one flank round to a profile of the other.
- **Elevation is measured off home**, where `ORBIT_UP` / `ORBIT_DOWN`
  give 10° steeper and only 4° flatter. That asymmetry is the floor:
  the frame reads `frustum / sin(elevation)` of floor depth, so dropping
  the camera reaches for the edge of `FLOOR_SIZE` and of the key light's
  shadow box, while raising it costs nothing.

**Home is not the middle of the azimuth range, and is not meant to be.**
It is 37° round from the front, so the swing runs −127° one way and +53°
the other. Nothing recenters it: `applyFly(0)` is still the opening
framing and still where the walk home goes. The far side of the machine
is simply further away than the near side.

Three things keep it from fighting the rest of the file:

- **`applyFly(0)` is still the only definition of home.** `initOrbit`
  seeds `orbitHome` from the pose it produced, and the elevation limits
  are offsets from *those* angles, so moving `ELEVATION` moves that half
  of the leash with it. The azimuth half follows `FACING` instead, so
  it moves with the machine. Nothing restates the camera constants.
- **The controls own the camera only at the establishing shot.**
  `flyToScreen` switches them off, `depart` switches them back on, and
  `orbitAllowed()` also refuses while `signed-in` is on the body.
  `applyFly` has the pose everywhere else, so the spline, the overlay
  matrix and the frustum are all untouched.
- **The input surface is the canvas, not a new overlay.** `#scene` is
  `pointer-events: none` for the rest of the site's life so the Win95
  chrome stays clickable; `body.orbit-live` turns that on, and that
  class is only ever present before the sign-in with the camera parked
  — exactly the window in which there is no chrome to click. `#screen`
  goes `pointer-events: none` for the same stretch, so a drag starting
  over the live login rotates like any other. It keeps its `click`
  handler, which is both the programmatic route the review scripts use
  and the only way in without a pointer.

**A press is a click if it travelled less than `CLICK_SLOP` (5px);
past that the camera has already answered it by turning.** Both halves
of the decision are recorded on `pointerdown` — the position *and*
whether the raycast hit the machine — because by the time the pointer
comes up the camera has moved and the raycast would be asking about a
different frame. The target is the whole machine (`computer.root`), the
same thing hover highlights, not just the glass. OrbitControls captures
the pointer on the canvas, so the `pointerup` arrives there however far
the drag went.

**The walk home is a GSAP tween, `IDLE_MS` (3s) after the last release.**
It writes the camera directly through `setOrbitAngles` and `tickOrbit`
stands `controls.update()` down for its duration: `update()` derives its
angles from the camera position every call, so there is nothing to keep
in sync and nothing to fight. It starts by spending the damping glide in
one undamped `update()` — left running, the residue keeps being applied
underneath the tween and the walk lands a fraction of a degree short.
The next drag kills it.

**Reduced motion keeps the rotation and loses the inertia.** Damping is
what a visitor who asked for less motion is asking not to be given — the
camera should stop when their pointer does — and there is no walk home
at all. Both fall out of one fact: under reduced motion there is no
render loop, so `tickOrbit` never runs; with damping off, OrbitControls'
own handlers call `update()` themselves, and the `change` listener draws
the frame.

**`cameraMoving()` is what `updateScreenOverlay` snaps `--scan` and
`--blur` against**, not `fly.dir` — an orbit changes the screen's
on-screen scale just as a flight does, and every distinct value of those
two costs a raster. It covers the flight, the drag, the damping glide
(`ORBIT_SETTLE_MS` after the last change) and the walk home, and
resolves exactly at rest.

**The overlay comes off the glass once the screen is edge-on**, which
at a ±90° leash is a working part rather than a guard. `screenFacing()`
is the screen's own normal against the camera's *view direction* — the
direction, not the position vector, because this camera is orthographic
— and `FACE_MIN` is 0.17, about 80° off the normal. Two reasons, and the
leash reaches both: past 90° the plane is seen from behind and projects
to a *mirrored* quad, so the matrix would fold the login inside out
rather than hide it; and well before that it stops being a picture at
all — at 80° the glass draws about a fifth of its square-on width while
the box behind it is still 1200px being blurred and gradient-filled to
produce that sliver, and the 3D texture underneath carries the same tube
at the same angle. Because it is the angle off the normal, elevation
counts toward it too: at the +10° rise the azimuth cutoff comes in a
degree or so earlier, which is correct. It and the still share
`syncScreenVisibility`, so neither can clear the other's hiding.

**The flight starts from wherever the camera is** (`FLY_FROM`). Only the
spline's *first knot* moves: pan is off and zoom is off, so an orbit
changes nothing but the camera's place on a fixed-radius sphere, and the
target and frustum at that knot are still the establishing shot's. The
start is therefore stored as a pair of angles (`flyStart`), not a
position — which is what lets a mid-flight resize re-derive the whole
curve from the new viewport instead of carrying a stale frustum into it.
`depart` puts the home knot back; the camera stays where the flight left
it and the idle walk brings it in. The alternative, `FLY_FROM = "home"`,
walks the camera back over `RETURN_FAST_S` first and then runs the
art-directed arc untouched — it was built and compared, and it loses:
the correction runs the wrong way, pulling back toward the room before
coming in, and puts 0.45s of it in front of the click. `_flyfrom.mjs`
shoots both on one clock.

**The hint** (`#orbit-hint`) is unhidden by `initOrbit`, so it never
appears without WebGL, and is dismissed for good by `orbit-used` on the
first `change` — on `start` it would also be dismissed by a press that
turned out to be a click, which is not a visitor who has found the
gesture. It is `aria-hidden`: it describes a pointer gesture with no
keyboard or assistive equivalent, and the thing it decorates is reached
by pressing the monitor either way.

What the leash passes through, in order, swinging from one clamp to the
other: a profile of the vented flank, the three-quarter view home sits
in, a dead-on front elevation at azimuth 0 (side vents gone, floor type
barely foreshortened), and a profile of the other flank. Only the two
clamps hide the login. Nothing in the scene breaks anywhere along it —
the floor plane and the shadow box both stay out of frame, because the
frustum never changes and so the visible patch of floor is the same
size at every azimuth, just rotated.

`spendGlide()` is a detail that matters twice. Anything that *takes* the
camera somewhere — the walk home, `window.__orbit` — has to finish the
damping glide first with one undamped `update()`, or the residue keeps
being applied underneath and the move lands short of where it was aimed.
On a machine holding 60fps the residue three seconds after a release is
~1e-10 and it is a no-op. It is only visible under a renderer slow
enough that the glide has barely been spent — which is exactly what
`_orbit.mjs` runs on, so a result there that looks like drift usually is
not.

`window.__orbit(swing, rise)` poses the camera in degrees relative to
home and draws it, or reports where it is and what the leash allows;
`window.__flyFrom(mode)` switches the start-pose mode on a live page;
`window.__enter()` is the flight exactly as a press on the machine
starts it, refit or walk home included. `_orbit.mjs` is the pass that
covers all of it.

### The sign-in gate

**The Win98 desktop is behind the login, not beside it.** Its chrome —
icons, windows, taskbar, Start menu — is `opacity: 0` and
`pointer-events: none` until `signed-in` lands on the body, which the
login form's submit handler in `main.js` does. That covers the two
states it used to be visibly wrong in: overlaid on the establishing shot
of the 3D room, and showing through the login once the camera had
arrived. It replaces the old rule that hid the chrome for the length of
`screen-active`.

Signing in is a pure DOM hand-over, not another camera move: the camera
is already parked at the screen and the canvas already faded out, so
`#screen` and its back button go to `display: none` (not opacity — it is
a 1200px box under a `matrix()` and would keep taking the clicks) and
the teal desktop behind them is what is left. Start ▸ Log Off reverses
it, which is also what makes the state testable.

Two consequences elsewhere:

- **`#desktop` is `100vh` until the sign-in**, because the taskbar that
  the usual `100vh - 40px` reserves for is not there yet; at the old
  height the strip showed bare body under the floor. The `--scene-fade`
  hand-over for that strip still earns its keep, but only at the very
  end of the flight, where the canvas has faded and the login box has
  not quite reached the frame.
- **No WebGL now has a way in.** The monitor was the only route to the
  login, so a visitor without WebGL would have reached nothing at all.
  `initWithoutScene` adds `no-scene` to the body and unhides `#screen`,
  and the CSS drops its matrix and lets it fill the viewport: the same
  login with no room around it, and the same sign-in to the same
  desktop. The CRT variables go to their "arrived" values there, so
  there are no scanlines on a tube that is not in the picture.

`window.__flyTo(t)` parks the flight at a point of the **timeline** and
draws it — the way to tune the head-on framing without trying to catch
it mid-animation. It seeks the real timeline rather than posing the
camera itself, so what it shows is what the flight shows there: the
login bitmap on the glass, the crossfade, the body classes and all.
Note it takes timeline progress now, not the old geometric parameter;
the two differ by `power3.inOut`. The arrival logs its position, target
and frustum height to the console.

`_scene-shot.mjs` renders the scene with the Win95 chrome hidden, for looking at
the 3D on its own. Note `.git/info/exclude` holds `_*.mjs`, so all of these helper
scripts are local-only and never committed.

`src/main.js` is imperative DOM code keyed off `id="window-<name>"` and `data-window` /
`data-drag` / `data-target` attributes, with a `WINDOWS` registry object at the top.
Add a window by adding markup in `index.html` **and** an entry in that registry.

### The windows, and the drag/focus pass

Five of the six windows are static markup. The two added last are worth
a note each:

- **Resume** is the only place `--font-mono` is spent. Everything on
  this desktop is chrome (`--font`) or copy (`--font-body`); a resume is
  a *document*, and Departure Mono is what separates it from both. The
  dates sit opposite the titles in a `flex` row that wraps rather than
  collides, so the entries hold together once the window is clamped to a
  phone.
- **Recycle Bin** is the one window carrying state. It is a detail view
  — Name / Original Location / Date Deleted, laid out on a `grid` so the
  header and the rows cannot drift apart — and the two right-hand
  columns drop out below 560px rather than squeezing the name to one
  character a line. **Emptying it really empties it**: dead chrome is
  worse than no chrome. The rows go `hidden` rather than being removed,
  so `logOff` can refill them, which is what makes the state testable
  more than once per load. The listing uses `--font`, not the body face:
  a file list is a UI, not reading matter.

The drag and focus pass that came with them:

- **Drag is on pointer events with `setPointerCapture`**, not
  mouse-move-on-`document`. That is what makes a finger work at all, and
  the capture is what keeps a fast drag from being dropped when the
  pointer outruns the title bar. `touch-action: none` on
  `.window-titlebar` is required with it, or the browser claims the
  gesture as a scroll and the `pointermove` stream stops dead.
  `pointercancel` has to clear `dragState` too: left set, the window
  follows the next pointer that moves.
- **Bounds are measured off `#desktop`**, which is the window's own
  containing block, so `left`/`top` and the limits are in the same
  coordinates — and the answer stays right before the sign-in, when
  `#desktop` is the whole viewport because there is no taskbar yet. The
  old code subtracted a hard-coded 40 from `innerHeight` and was wrong
  in exactly that state. `toggleMaximize` is `height: 100%` for the same
  reason.
- **Windows open sized and centred against the viewport.** The widths
  and positions in `index.html` are 1995 figures: 480px of About Me at
  `left:130` is a postage stamp in the corner of a 1567px display, with
  the rest bare teal. `placeWindow` makes the authored width a *floor*
  (`OPEN_FRAC` of the desktop, capped at `OPEN_MAX` — past which a line
  of body copy is too long to read) and centres the result, a little
  above the middle (`OPEN_RISE`, because the taskbar has already taken
  the bottom and dead centre reads as low). A height floor goes with it,
  and is not optional: these windows are sized by their content, so
  scaling width alone made About Me arrive 784x233 — bigger than before
  and *worse*, a letterbox slot with two sentences adrift in it. The
  floor is the smaller of a share of the frame's height and a
  proportion of the window's own width, and it is only a floor, so the
  Resume keeps its taller natural height. Each window after the first
  steps `CASCADE` down-right so the second lands beside the first
  rather than exactly on it.
  Placement happens on the **first** open only (`dataset.placed`), so a
  window reopens where it was dragged to — a visitor who put it there
  meant it, which is also why the resize handler only clamps. Signing
  out clears the flags and the computed height, so a new session starts
  centred. `dataset.baseWidth` remembers the authored width, since after
  the first placement `style.width` holds the computed one and scaling
  that again each session would walk the window steadily wider.
- **Every window is clamped into view as it opens**, and again on
  resize. The inline positions in `index.html` are desktop figures:
  Contact opens at `left:310px`, which on a 390px phone is almost
  entirely off-stage. `.window` carries `max-width`/`max-height: 100%`
  as the other half of that — the clamp can only resolve to 0 if the
  window is bigger than the frame, so the two together always fit. The
  body is the flex child that gives, so it scrolls and the chrome stays
  whole. Clamping has to happen *after* the unhide: a `display: none`
  window measures 0 and would clamp itself into the corner.
- **`focusWindow` leaves early if the window is already on top.** Every
  `pointerdown` inside a window arrives there, and it rebuilds the
  taskbar's DOM — without the guard, clicking into a text field rebuilt
  the taskbar under it on every click.
- **Closing or minimizing hands focus down** to the topmost window left
  (`focusTopmost`, off the inline `zIndex`), and **clicking bare desktop
  drops it** (`blurWindows`). Windows live inside `#desktop`, so their
  clicks bubble to that handler and have to be filtered out; the taskbar
  and Start menu are outside it, which is why clicking those correctly
  does nothing.

### Touch, and why a phone gets a different interaction model

Measured on a 390x844 phone, the desktop metaphor had already stopped
paying for itself: the icon column is 72x395, the first window opened
390x525 at y=40, and that left **24px of one icon** visible and none of
the five whole. A window is the full width of the frame there whatever
you do — `max-width` clamps it and `left` can then only resolve to 0 —
so what the floating model actually bought was a window that covered
the icons *and* left a dead strip under itself.

So below `PHONE` (`max-width: 560px`) **windows open maximized**, and
the taskbar is the switcher. The implementation detail that matters is
`dataset.autoMax`: it marks a window maximized *by the viewport* rather
than by someone pressing the button, so crossing the breakpoint back to
a desktop width un-maximizes exactly those and leaves a deliberate press
alone. `toggleMaximize` deletes the flag — a press owns the state from
then on. `fitWindow` is the one place that decides, and both `openWindow`
and the resize handler go through it.

Crossing back to a desktop width runs `restore` and then
`placeWindow`, in that order, so a window first opened on a phone — one
that was never placed — is centred rather than dropped back onto its
authored 1995 corner. `maximize`/`restore` carry `prevHeight` along with
the position for the same reason: placement may have set a height, and
`height: ''` would quietly drop it.

Two consequences fall out, both intended: a maximized window does not
drag (the `pointerdown` handler returns early), so on a phone the title
bar is a label rather than a handle; and the Resume gets the full 804px
instead of scrolling inside a 525px box.

The touch affordances that came with it:

- **`.win-btn` goes to 28x26 under `(pointer: coarse)`.** At 16x14 the
  close button is authentic and unhittable with a thumb — and on a phone
  it is the first thing a visitor reaches for when they want the desktop
  back, so it is the one control that must not be a near miss. Keyed off
  the *pointer*, not the viewport: a 1280px tablet needs it and a 500px
  desktop browser window does not.
- **Desktop icons open on one tap.** Double-tap is a desktop idiom —
  there is no hover to preview with, so the first tap has nothing else to
  mean. The decision reads `e.pointerType` off the last `pointerdown`
  rather than a media query, because a laptop with a touchscreen answers
  yes to `(pointer: coarse)` and is still being driven by a mouse; what
  matters is which input is in use right now.
- **`touch-action: manipulation` on every control.** It kills
  double-tap-to-zoom, which otherwise both collides with the icon
  gesture and adds the ~300ms click delay everywhere else.
  `manipulation`, not `none` — panning and pinch stay.

**Testing any of this needs `hasTouch` *and* `isMobile` on the Playwright
context.** `(pointer: coarse)` describes the input, not the viewport, so
a plain 390px context still reports a fine pointer and none of the touch
rules apply — the run looks green while testing nothing. `_step3.mjs`
reads the facts back (`coarse`, the computed button size, `touch-action`)
rather than trusting the stylesheet, for exactly that reason.

### Visual checks

`_review.mjs` is the one to use: `npm run preview` in one shell, `node _review.mjs` in
another. It shoots desktop / mobile / light / reduced-motion / no-WebGL variants into
`.impeccable/review/` and prints a per-variant probe plus a console-error tally. The
no-WebGL pass stubs `getContext('webgl*')` to `null`; `scene: "fallback"` there and
`scene: "live WxH"` elsewhere is the expected result.

`_review.mjs` does not exercise the fly-in. `_flysteps.mjs` walks
`window.__flyTo` through the run and shoots each stop; `_flycheck.mjs` clicks the
screen for real, fills the form and clicks back, on mobile and under reduced
motion. Both are `_`-prefixed, so local-only.

`_orbit.mjs` covers the camera leash, on desktop / mobile / reduced
motion. It drags with real pointer events so everything goes through
OrbitControls, and reads the results back off `window.__orbit` rather
than trusting the constants: that azimuth clamps at ±90° off the
monitor's front (−127/+53 off home) and the rise at −4/+10, that the
login comes off the glass at both clamps and is back well inside them,
that a drag on the monitor rotates and a 3px press flies in, that the
camera walks home and does *not* under reduced motion, that the hint
goes on first use, and that the controls are off during the flight and
after the sign-in and back on after flying out.

Two things about it. The walk home is **polled, not slept on**: GSAP's
`lagSmoothing` counts a frame longer than 250ms as 250ms, so on a
renderer giving the desktop variant about a frame a second a 1.1s tween
takes several seconds of wall clock — the documented trade, not
something to measure here. And `window.__orbit(swing, rise)` takes
degrees relative to **home** (so `__orbit(0, 0)` is the opening framing)
while reporting azimuth in both frames, because the two halves of the
leash live in different ones.

`_flyfrom.mjs` shoots the two `FLY_FROM` modes side by side from the
same off-home pose. Both legs are *posed* rather than played, because
SwiftShader cannot render a 1.6s flight in 1.6s: the flight is seeked
through the real timeline (whose progress is linear in time) and the
walk home is reproduced from its ease, so both strips sit on one clock.

`_step3.mjs` covers the desktop itself, and the two variants are
deliberately *different runs*, because the two viewports are now
different interaction models — mouse / double-click / floating windows
against touch / one tap / maximized. Shared: open both windows, empty
the bin, close the active one and check focus fell to the next, cross
the `PHONE` breakpoint in both directions and check the maximize undid
itself, log off and check the bin refilled. Desktop-only: raise the
window behind, drag it, drag it far past the corner and check it
clamped, click bare desktop and check focus dropped. Mobile-only: open
by a single `tap`, check the window is `MAX(auto)`, and check the title
bar is inert.

Two things about it are worth knowing before editing it. The mobile
context needs `hasTouch` and `isMobile` (see the touch section above).
And the Recycle Bin is reached with `focusBin`, not a bare taskbar
click: the taskbar button is a **toggle**, so pressing it on the window
that already has the focus minimizes it — correct behaviour that reads
as a test failure.

`_perfcheck.mjs` is the frame-rate probe: `npm run dev` in one shell,
`node _perfcheck.mjs` in another (optionally with a url and
`desktop`/`mobile` to limit it). It flies in and out for real and prints
median / p95 / worst frame time and a count of frames over 33.4ms for
each leg. It needs a **dev** build, since the meter only exists there.
Three things about it are deliberate:

- **It runs headed.** Headless chromium falls back to SwiftShader, and
  software-rasterised numbers say nothing about the real thing.
- **One browser per variant**, because two live WebGL contexts in a
  single headed chromium reliably takes the renderer down.
- **Every leg parks the page first and retries if it did not animate.**
  A headed window on macOS intermittently receives a real OS click just
  after it opens (`isTrusted: true`, always around the middle of the
  viewport), which lands on the glass and starts the fly-in before the
  probe is ready. This is the harness, not the page — it does not happen
  headless.

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
left. Against the camera azimuth that lands on a three-quarter view after
`crt-computer-full.jpeg`, front and one side both in play — and it is what
brings the side vents into shot. The view is weighted toward the front rather
than even, because the camera was swung 8° off the symmetric 45° (see the scene
notes); the machine itself has not turned.

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

Hover is raycast from `window` rather than the canvas, because the canvas
only takes events while `orbit-live` is on the body and a move over the
chrome still has to be able to turn the hover off; events over a window
or the taskbar are ignored. One raycast per move feeds two things — the
hover value and the canvas's cursor, which says what a press will do:
`pointer` over the machine, `grab` over the room, `grabbing` mid-drag. The easing is time-based, not per-frame, so the
picture settles at the same speed regardless of frame rate.

**Hover happens on the screen, not in world space.** (The live HTML
overlay now covers the picture, so what the crossfade below actually
drives is the glow spilling onto the bezel; hover switches off entirely
once the fly-in starts.) The machine used to lift and
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

### Frame rate, and what holds it at 60

`src/perf.js` is a stats.js panel plus a rolling log of frame deltas
tagged with `fly.value`, exposed as `window.__perf` for `_perfcheck.mjs`
to read. `scene.js` reaches it only through a dynamic `import()` behind
`import.meta.env.DEV`; Vite folds that to `false` when building, so
rollup drops the branch and stats.js with it. **Verify after touching
it:** `npm run build && grep -r showPanel dist/` must find nothing.

The baseline before any of this, measured on a real GPU at DPR 1: the
zoom-out ran at a **33ms median on desktop and 57ms on a phone-sized
viewport**, with half the frames over two frame-times. It is now a flat
16.7ms median on both, worst frame 17.8ms, zero janky frames in either
direction. Re-measured after the orbit went in, unchanged: desktop
16.7 / 20.6 worst / 0 janky, mobile 16.7 / 18.6 / 0. What got it there,
in order of how much each was worth:

1. **The live HTML coming off the glass** — see "the still" above. This
   was nearly all of it.
2. **The shadow map is rendered once and frozen.** Nothing in the scene
   ever casts a different shadow: the light is fixed and the machine
   does not move. `renderer.shadowMap.autoUpdate = false` plus one
   `needsUpdate = true` saves re-rendering a 2048² VSM depth pass with
   16 blur samples on every frame. **If anything is ever animated back
   into the scene, this is what has to be reverted.** The orbit is not
   that: it moves the *camera*, and a shadow map is in the light's
   space, not the camera's.
3. **`MAX_DPR` is 1.5, not 2.** The scene shades through GTAO on a
   full-screen composite, so cost goes with the square of this; on a 2x
   display the difference is not visible on matt plastic and a blurred
   tube.
4. **`--scan` and `--blur` are snapped to a coarse grid mid-flight** —
   again, see above. Snapped while the camera is *orbiting* too, for
   the same reason: see `cameraMoving` under "Looking around".

`_perfcheck.mjs` measures the flight only. The orbit itself is not in
those numbers — it adds one `controls.update()` and one overlay matrix
per moving frame, which is small against what the flight does, but it
has not been measured.

The font is preloaded from `index.html` off `public/fonts/`. Playfair is
drawn into the floor texture with canvas 2D, so the face has to be
resident before the first 3D frame; discovering it through the lazy
scene chunk's stylesheet is far too late. That is why it is declared in
`src/style.css` (the entry stylesheet) and vendored to a stable path
rather than imported from `@fontsource` — a preload needs a URL that
does not move, and Vite hashes what it emits. Latin only; the wordmark
is ASCII. `crossorigin` on the preload link is required even same-origin
or the file is fetched twice.

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
  rule and needs an OFL substitute. The vendored 98.css falls back to the same
  `--font`, so fixing it fixes the login screen too — there is one knob, not two.
  An OFL pixel face was fitted here and reverted on request; see "Typography" for
  what fitting one costs.
- The scene chunk is ~195 kB gzipped plus a 128 kB HDRI, all lazy-loaded after
  the desktop paints. The entry chunk is still ~3.8 kB gzipped. GSAP accounts
  for ~26 kB of the scene chunk; importing `gsap/gsap-core` rather than `gsap`
  keeps CSSPlugin out and saves ~7 kB of that. OrbitControls is ~8 kB of it.
- No tests, no linter, no README. Don't assume a test command exists.
- `/favicon.ico` 404s — there isn't one. Pre-existing; the review scripts
  filter it out.
- `npm audit` reports pre-existing advisories in the Vite 5 dependency tree (esbuild,
  rollup, postcss, nanoid). Clearing them fully means Vite 8 — a deliberate upgrade, not
  a drive-by.
- `playwright` is a devDependency, so CI installs it; browsers are not downloaded by
  `npm install` (that needs `npx playwright install`), so the deploy is unaffected.
- `.github/copilot-instructions.md` is now just a pointer to this file.
- `design-references/` is gitignored — it holds third-party reference imagery
  (one is a watermarked stock photo) and must not ship.
- Work happens on theme branches (`theme/windows98`); only `main` deploys.
