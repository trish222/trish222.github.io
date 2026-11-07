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

The desk lamp added no dependency and no asset either — a shade is an
open-ended cone and a base is a disc.

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
npm, `public/env/studio-small-09-256.hdr` — "Studio Small 09" by Sergej
Majboroda via Poly Haven, CC0 (see `public/env/LICENSE.txt`), and
`public/textures/desk-wood-*.jpg` — "Wood Table 001" by Rob Tuytel via
Poly Haven, CC0, the desk's walnut top (see `public/textures/LICENSE.txt`
for what was done to it). Desktop icons are
our own pixel art, drawn from primitives by `scripts/make-icons.mjs` — not
Microsoft artwork, and no longer emoji either. Every 3D object is built from
primitives in code; nothing is an imported model — the brick-built
treehouse on the desk added no dependency and no asset at all, since
a stud is a cylinder and a brick is a bevelled box.

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
src/scene.js      camera, lighting, env map, AO, hover, the orbit, the fly-in
src/floor.js      the ground: its colour, its size, its fog, the wordmark on it
src/computer.js   the CRT machine, built from primitives
src/desk.js       the steel tanker desk it stands on, likewise
src/treehouse.js  the brick-built cherry treehouse, and the spare bricks beside it
src/nightwindow.js  the window in the left wall: joinery, the night sky on the glass, the rain
src/lamp.js       the desk lamp on the back-left corner, and what "on" means for each of its parts
public/env/       CC0 studio HDRI — vendored, no longer loaded (see "The night lighting")
public/textures/  CC0 walnut scan for the desk top, vendored and relit
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

`src/scene.js`, `src/computer.js`, `src/desk.js`, `src/treehouse.js`,
`src/room.js`, `src/nightwindow.js` and `src/lamp.js` are the
only modules that import three. Perspective camera on a **20° vertical FOV**, **20° down / 37°
around** — see "Perspective, and what it replaced" below; it was orthographic
until the orbit leash reached 2°. The elevation comes from a CAD
axis tripod, where the two ground axes fall ~18-19° below the horizon either
side of a vertical z. For an orthographic camera at a symmetric 45° azimuth
(which is where this started, after `design-references/isometric-angle.webp`)
that on-screen slope is `atan(sin(elevation))`, which puts the elevation at 20°
— much flatter than the 35° it began at. That derivation is the orthographic
limit and is still what the two angles mean: a narrow FOV reproduces it closely
at the target and diverges either side, which is the whole point of the change.

The azimuth then came off that symmetry by 8°, on request, to turn more picture
toward the viewer. The screen looks down world +Z and the camera sits in the
+X/+Z octant, so a *smaller* azimuth walks the camera round toward the front.
The two ground axes are no longer mirror images — +X now falls ~11.7° below the
horizon and +Z ~24° — so the floor type lies flatter and stacks more steeply.
Both fall straight out of `PROJ_X` / `PROJ_Z`, so the type resized and re-rowed
itself; nothing was hand-retuned. Keep any further swing slight: past ~30° the
side vents leave the shot and the view stops reading as isometric.

Flattening the camera is not a one-line change, because three things are sized
against how much floor the frame sees. Under the orthographic camera that was
`frustum / sin(elevation)` — 2.9 world units of depth per unit of screen height
at 20° against 1.7 at 35°; under a perspective one the frame reaches the
horizon instead and the fog is what ends the ground, so the first of these is
far less delicate than it was:

- **`FLOOR_SIZE`** — at 70 the plane's far edge came into frame across the top
  corners, showing scene background either side of it. 160 held at 20°; it is
  now **1700**, which is what the orbit's 2° floor needs — see "An endless
  floor" below.
- **The key light's shadow camera** — outside its box a surface simply has no
  shadow, so at ±42 the cast shadow stopped dead on a straight line mid-frame.
  Now ±80, with `shadow.radius` down from 5 to 3 since the same map now covers
  nearly four times the ground. It has not had to grow since, and the reason
  is in "An endless floor".
- **`FILL_DEPTH`** — see below; the old value left the type a band across the top
  with bare floor under it.

**`FRUSTUM` is 24 (portrait: 37), and the desk is why.** The machine used to
stand on the floor, so the frame only had to hold 6.5 units of monitor; it now
stands on a 9-unit desk and the assembly reaches ~20.6 units from the desk's
near-bottom corner to the top of the tube. That is the *only* camera constant
the desk moved — both angles and the whole orbit leash are untouched, so the
home framing is the same shot from further back. (`CAM_DIST` was the third such
constant and is gone: the distance is derived from the frustum now. See
"Perspective, and what it replaced".) `ISO_TARGET`
rose with it, from the origin to `(0, 7.05, 0)`: at the origin the assembly sat
in the top half of the frame with bare floor underneath.

Nothing about the floor wordmark needed re-tuning for that, and this is worth
knowing before touching either number — `LINE_FILL` sizes the type as a share
of the *viewport* and `FILL_DEPTH` sets the row count as a share of the visible
floor depth, so both scale with the frustum and the type lands at the same size
in the frame as it did at 18.

Portrait deliberately **crops the desk's ends** rather than framing the whole
of it: a 19-unit desk across a 390px frame would want a frustum near 50 and
leave the CRT a tenth of the picture. 37 is the point at which the far
pedestal's drawer front is still in shot, and is as far as this should go —
every unit of it costs the machine, which is the thing a visitor has to find
and press.

**Both are then scaled by `HOME_ZOOM`, which is 1.10.** It is the one
knob for how much air there is around the furniture, and it exists
because at 1.0 the desk's near foot sat 2% off the bottom edge on a
desktop frame — the assembly filled the shot rather than standing in a
room. At 1.10 that margin is 12%, at 1.15 it is 16%; both were shot and
either is defensible, so the constant is a single number to change
rather than two. It multiplies the *frustum*, not the distance: under a
perspective camera those are the same zoom only because `distFor`
derives one from the other.

Nothing else moves with it, and that is checked rather than assumed —
the fly-in's destination is `SCREEN_TARGET` and `screenFrustum`, both
read off the screen mesh, and the leash's limits are angular offsets
from home. At 1.00, 1.10 and 1.15 the arrival pose is identical to four
decimal places and all three limit pairs are unchanged, on both
viewports.

`window.__fit()` reports where the furniture lands in the frame, in NDC, and is
what those two numbers are set against: "does the desk fit" is a question about
eight projected corners, not something to judge off a screenshot.
`_deskfit.mjs` is the pass that reads it on both viewports, and
`_zoomshots.mjs` is the one that reads it against the `HOME_ZOOM`
candidates.

**The floor is its own module, `src/floor.js`.** Its colour, its size, the
fog that ends it and the wordmark drawn across it all live there; `scene.js`
asks for a mesh, hands `fitFloor` the viewport facts the type is sized against
(frustum, aspect, `PROJ_X`, `PROJ_Z`, which resolution tier), and disposes it.
That hand-over is the point: the floor knows nothing about the camera and the
camera knows nothing about the type, so swapping the name for a different
ground means rewriting `drawFloorTexture` and `layoutFor` and nothing else.
Two of its exports do reach back into `scene.js` — `CREAM`, which is also the
scene background and must match `--scene-floor` in `src/style.css`, and
`FLOOR_SIZE`, which the camera's near and far planes are derived from.

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

**The daylight rig this paragraph used to describe is gone** — a warm
key ~13° above the floor at ±80 of shadow box, an ambient, a
hemisphere and a studio HDRI, calibrated so the lit ground landed
exactly on the old `CREAM`. All five are replaced; see "The night
lighting" below for the three that replaced them. The one thing worth
carrying forward is the unit: **light intensities look ~3x too high
because three's physical lighting divides them by PI.**

### An endless floor, and what the 2° view costs

The orbit can be dropped to **2° above the floor** (see "Looking around"),
and the frame reads `frustum / sin(elevation)` of floor depth: ~690 world
units on a desktop frame at 2°, ~1060 on a portrait one, against the 70 the
establishing shot sees. Four things were sized for that, and only the first
is the one people expect:

- **`FLOOR_SIZE` is 1700.** Big enough that the plane's own edge is off-frame
  at the flattest view on the deepest viewport. It costs two triangles and
  nothing per frame; the text is unaffected, because the texture's UV
  derivative per world unit is `repeat / FLOOR_SIZE`, which does not move
  when both do.
- **`scene.fog` is linear fog in `CREAM`** — the floor's own colour, which
  is also the background's — built by `buildFog()` in `floor.js`, 140 to 460.
  The far reaches of the plane dissolve into the backdrop instead of ending
  at a line. Both halves are needed: the plane alone would have to be
  enormous for every future camera, and fog alone leaves a real edge in frame
  on a tall viewport that only *happens* to be invisible because the two
  colours match. `FOG_NEAR` sits well past the furniture — the camera is
  always `CAM_DIST` from what it looks at — so nothing on the desk is ever
  inside the fade, at any point of the orbit or the flight. There is no tone
  mapping on either render path, so a fully-fogged fragment resolves to
  exactly the clear colour.
- **The camera's `near` is negative.** This is the one that is easy to miss.
  For an orthographic camera the view volume is a box and `near` is just
  where its front face sits along the view axis; nothing requires it to be in
  front of the eye. At 2° the eye is ~9 units off the ground looking 2° down,
  so the bottom of the frame is floor *behind* the camera — 270 units of it
  on a portrait viewport. At the old `near = 0.1` that floor was clipped and
  the bottom of the frame showed bare background. `far` reaches the far edge
  of the plane for the same reason at the other end. Ortho depth is linear,
  so spending ~1950 units on the range costs ~1.2e-4 of precision per unit,
  nothing against GTAO's 1.15-unit radius.
- **The key light's shadow camera did *not* have to grow**, and that is worth
  writing down because the number it was first set against was the wrong one.
  A shadow map lives in the *light's* space, and the light never moves — so
  dropping the camera does not reach for the box's edges however much more
  floor comes into frame. What the box has to cover is the desk, the machine
  and where they land on the ground along the light direction. Measured
  against the two world boxes, that union occupies **±9.7 of light-space
  lateral and 21 to 123 of light-space depth**; at ±80 / 1..220 the box
  clears it by about 8x laterally. Widening it anyway is not free — it
  spreads the same 2048² map over more ground, and the drawer-front contacts
  are already at the resolution where a 0.03-unit step produced acne. Outside
  the box three's shadow lookup returns "lit" rather than clamping the map's
  border, so the far reaches of the plane simply have no shadow, which is
  correct, because no shadow reaches them.

One thing the 2° view does cost, and it is inherent: **the wordmark aliases
at a grazing angle.** The type is a high-contrast serif drawn into a texture,
and looking along the ground at 2° minifies it along one axis far harder than
mipmaps plus 16x anisotropy can resolve — on a portrait viewport it breaks up
into speckle. Nothing is misconfigured (the texture has mipmaps,
`LinearMipmapLinear` and the driver's maximum anisotropy); it is what drawing
text on a floor and then lying down on it looks like. The row count is
deliberately *not* re-derived from the live elevation either — `FILL_DEPTH`
is read against the home framing, because no row count covers 690 units of
depth and redrawing the texture mid-drag to chase it would only make a
larger band of edge-on type.

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

**The three poses the path is built from all moved when the machine went
up onto the desk, and none of them needed hand-editing to.** The
establishing shot is `ISO_TARGET`, which rose with the frame (see "The
scene"); `MONITOR_TARGET` is written as `DESK_TOP_Y + MON_Y` at
`COMPUTER_Z`, because `MON_Y` is in the machine's own space and that
space now starts at the desk top; and the arrival is `SCREEN_TARGET`,
which has always been read off the screen mesh's world matrix and so
followed the machine on its own. Nothing in the spline, the timeline or
the overlay matrix is aware the desk exists.

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
  give 10° steeper and **18° flatter** — home is 20°, so the flat end is
  2° above the floor. That is the desk's own height: the eye lands at
  y ≈ 9.1 against a 9.0 desk top, which is the framing where the screen
  and the drawer fronts are both seen square on. It is still asymmetric,
  but no longer because flat is expensive — the frame reads
  `frustum / sin(elevation)` of floor depth, ~690 units at 2°, and the
  plane, the fog and the camera's near and far planes are all sized for
  that now. See "An endless floor" for what each of them had to become,
  and for why the shadow box was not one of them. Steeper than +10° is
  simply not interesting: it walks toward a plan view of a desk.

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

`_deskfit.mjs` answers "does the desk fit in frame", by reading
`window.__fit` on both viewports rather than by looking at a
screenshot: it prints the NDC box of the desk, the machine and the two
together, where ±1 is the frame edge. It is what `FRUSTUM`,
`FRUSTUM_MOBILE` and `ISO_TARGET` are set against. `_deskshots.mjs`
shoots the room with the Win95 chrome hidden from the three framings
worth looking at — home, and the two ends of the leash, which (because
the azimuth clamp is ±90° off the monitor's *front*) are profiles of
the desk's two flanks. **Shoot both of those after moving anything on
the desk**: the first version's monitor overhung the back edge, and
only a side view showed it.

`_zoomshots.mjs` shoots the establishing shot at each `HOME_ZOOM`
candidate on both viewports, chrome hidden, printing `window.__fit`'s
NDC box and a frame margin beside each — which is the number the
candidates are actually being compared on. It shoots the flat clamp at
each as well, because pulling the camera back is the one change that
could put the floor plane's own far edge into a 2° view. It drives
`window.__zoom(f)`, so all the candidates come off one page rather than
one build each.

`_lowshots.mjs` shoots the room from straight in front of the monitor at
four elevations — 2° (the flat clamp), 10°, 20° (home) and 30° (the steep
clamp) — plus the flat clamp at the home azimuth, on both viewports, with
the Win95 chrome hidden. It prints `window.__fit`'s NDC box beside each, so
"does it still fit" is answered off the eight projected corners rather than
off the picture. Shoot it after touching anything the flat view can see: the
floor's size or fog, the camera's near and far planes, or the desk's
undersides. The front-on swing is −37 because home is 37° round from the
front.

`_lightshots.mjs` covers the night rig, on desktop and mobile. Three
jobs plus an optional fourth, and the first two are what a dark
screenshot cannot do: whether the picture is moody rather than black
(`window.__histogram` over the non-void pixels, plus `__probes` and
`__pixel`); whether the shadow box still covers what casts and what
receives (`window.__shadowfit`, where a negative margin now means a
patch of floor flooded with moonlight rather than merely unshadowed);
and crops of the three places acne would show — the desk's drawer
fronts, the contact under the monitor's base, and the window's sash
inside its reveal. `node _lightshots.mjs sweep` re-runs the two
searches the rig was set by — the six moon aims and the
hemisphere/exposure/env grid — off one page load through
`window.__lights`. It is the method, kept runnable, not a test.

`_winshots.mjs` covers the window on the left wall, on desktop /
mobile / reduced motion. Four jobs, and the first two are the ones a
screenshot cannot do: whether the assembly lands in frame
(`window.__fit("wall-window")`, the eight projected corners of casing,
sill and all — the portrait figure is the one to watch); whether the
rain is actually running (`window.__rain()`, and under reduced motion
whether its clock stays at zero while the shot still shows streaks);
whether it fades with its wall at the front and the left clamp; and a
crop of the window taken off its own NDC box, so the crop follows it
as it is re-tuned.

`_lampshots.mjs` covers the desk lamp, on desktop / mobile / reduced
motion. Six jobs, and the first three are the ones a screenshot cannot do: whether
it fits (`window.__fit("lamp")`, plus the margins to the walnut's -x
and back edges and the gap to the computer kit — note the `kit ndc`
figure is against the whole kit, contact shadows included, so it goes
negative and that is fine); whether the moon's shadow box still covers
it (`window.__shadowfit()`, where a negative margin means a patch of
floor flooded with moonlight); whether it reads as a light source
(`window.__probes()` and `window.__histogram()` with the lamp on and
off — the local delta on the pool is the number, and the room's median
barely moving is the exposure lift doing its job); the interaction (a
real pointer press on the shade toggles and does *not* fly in, a press
on the monitor flies in and does *not* toggle, the hidden button
carries `aria-pressed`); the shots, including a crop taken off the
lamp's own NDC box; and **reduced motion**, which is the only path with
no render loop — so the fade has nothing to advance it and the toggle
has to land on the endpoint and draw once, exercised through focus +
Enter on the hidden button rather than a programmatic click.

`node _lampshots.mjs aim` adds the sweep the shade's two tilts were set
by, plus the `castShadow` A/B — the method, kept runnable, not a test.

Two things about it. **Read the `curve` row, not the `live` one, for
the fade** — SwiftShader gives these runs about a frame a second, so
the whole 0.4s ramp lands between two samples; `curve` is the same ease
the loop uses, read off the page, and shows the shape on any renderer.
Since the strike was removed it should climb monotonically, so a dip in
either row is now a bug rather than the feature it used to be. And the
height it prints is the conservative `Box3` figure — see "Where it
stands" above.

`_lampbig.mjs` is the one that answers **"does the bigger lamp get in
front of the monitor"**, and it is a separate script because it asks a
different kind of question: not where the fixture is, but what is on
the ray. It walks a 15x15 grid over the glass (the live overlay's
client rect *is* the screen plane's on-screen quad), over the kit's
projected box and over the lamp's own, at home and at **both azimuth
clamps**, and asks `window.__pick` what a press at each point would
hit.

**The grid is walked twice and that is the whole point.** A point
coming back "lamp" only says the lamp is nearest on that ray — over
bare walnut or an empty corner of a projected box that is simply where
the lamp is, and most of a projected box is empty space around a yawed
object. Occlusion is the *conjunction*: this point picks the lamp **and
would have picked the machine with the fixture out of the way**. So the
second pass moves the lamp's meshes to layer 1, which `pickTarget`'s
raycaster does not test, and the script reports where the two passes
disagree. An NDC-box overlap would have called this wrong in both
directions — the two boxes already overlap at every azimuth and
nothing is in front.

`_pool.mjs` is the lighting half of the same question: a transect of
on/off luma deltas along two **fixed** world lines across the desk top,
through `window.__probes`. Fixed, because the beam moves when the
fixture is re-scaled or re-aimed, and a line through the beam's own
centre then measures two different places at the two scales — a pool
that has *moved* reads as one that has dimmed. It prints the aim beside
the rows so the two can be told apart. This is what the falloff
compensation in `LAMP_SCALE` was set by.

`_orbit.mjs` covers the camera leash, on desktop / mobile / reduced
motion. It drags with real pointer events so everything goes through
OrbitControls, and reads the results back off `window.__orbit` rather
than trusting the constants: that azimuth clamps at ±90° off the
monitor's front (−127/+53 off home) and the rise at −18/+10, that the
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

`_thshot.mjs` shoots the treehouse at the home framing plus a crop of
just the model, taken off its own NDC box so the crop follows it as it
grows, and prints `window.__fit` for the model, the machine and the
desk. `_thdebug.mjs` is the magnifier, and it exists because the home
framing cannot do this job: the model is a tenth of that frame at a
fixed three-quarter angle, so a wall that is *missing* and a wall that
is merely *in shadow* look identical. It parks the model at the
camera's own target, winds the frustum to the orbit's minimum, hides
the desk and the machine, and turns it face by face. It leaves the page
mangled, which is fine — every run reloads.

`_finalshots.mjs` shoots the four framings the finished model has to
hold up in — home, eye level (the flat clamp, 2° above the floor), and
a profile of each flank — on both viewports, with `window.__fit` beside
each. Note the model's NDC box runs past the frame edge on a phone at
home — `x1` **1.25**, against 0.57 on desktop. Part of that is the
**contact shadow's** rotated corner, which is transparent, and part of
it is the conservative box `_canopyfit.mjs` also reads (see below) —
but since the canopy went lopsided to the back-right, the picture
really is cropped there by a little. The desk's own ends are cropped on
a portrait frame by design; this is the same trade, and it is the price
of the asymmetry. Shrinking the model to 1.1733 improved it and did not
remove it, which is the evidence it is a framing problem rather than a
size one: `FRUSTUM_MOBILE` is 37 against 24, so a tall narrow frame
sees far less world width. The lever is `TREEHOUSE_X` at the portrait
breakpoint, if it is ever worth pulling.

`_canopyfit.mjs` answers the two questions the canopy can quietly get
wrong, and answers both off numbers rather than off a picture: **does
it stay on the desk** (the model's world box against the desk's, with
a margin printed per edge — the +x edge is the one that binds, at
0.58) and **does it stay off the glass** (the live overlay's client
rect *is* the screen plane's on-screen quad, so its right edge against
the model's NDC box is the real answer; 47px clear at 1440x900). Note
the world box it reads is `Box3.setFromObject`, which for an
`InstancedMesh` takes the AABB of a *rotated* AABB — so with the model
yawed 8.4 degrees the figure is conservative by about 0.4 on the +x
edge. Treat it as the check rather than the truth: it is the one the
model has to pass, and it fails safe. It
also prints the top of the tree as a height above the desk top, which
is what the three-quarters figure is checked against, and the instance
and mesh counts. Run it after anything that moves the canopy outward or
upward.

`_tightfit.mjs` prints the **true** world box of the treehouse and the
spares, instance by instance, and the clearance to the glass off the
same corners. It exists because `Box3.setFromObject` takes the AABB of
a rotated AABB for an `InstancedMesh`, which on a model yawed half a
radian over-reports the +x edge by about half a unit — enough, at
`TREEHOUSE_SCALE`, for `_canopyfit.mjs` to call the model off the desk
while every brick is still on it. It transforms each instance's own box
corners instead. Run it beside `_canopyfit.mjs`, never instead of it:
the conservative bound is the one that fails safe. It uses
`window.__camera`, which is exposed next to `window.__scene` for
exactly this — a script that wants to project its own points rather
than the box `__fit` chose.

`_spares.mjs` prints the world boxes of the spare bricks, the
treehouse, the computer kit and the desk, and the four gaps between
them that the bricks have to hold — the mouse, the base plate, and the
desk's +x and front edges. Run it after moving anything in
`SPARE_PLAN`; "do they clear the mouse" is a question about two boxes,
not about a screenshot.

`_treeshot.mjs` shoots **the tree with the house hidden**, which the
home framing cannot do: the trunk's S runs up behind exactly where the
house hangs, so while the two are being reshaped there is no camera
angle that shows the wood. It hides every mesh whose material is one
of the house's seven colours. Colour is a sound handle rather than a
hack — the kit batches by shape *and* colour, so the planks, trim,
glass and shingle are already their own meshes and nothing else in the
model uses them.

`_probe.mjs` builds the treehouse in plain node with a stubbed
`document` and prints the throw. It is the fastest way to find a build
error in the model, and it earned its place: a refactor deleted a
function from `treehouse.js`, the scene threw, and `main.js` was
swallowing that in `.catch(initWithoutScene)` — so the page silently
became the no-WebGL fallback, which looks exactly like a machine
without WebGL. That catch now logs the error before falling back.
`_err.mjs` is the browser-side half: page errors, unhandled rejections,
and whether `window.__fit` ever appeared.

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
  leaves them floating off the surface. **Their depth is a share of `BACK_D`**
  for a second reason: a vent panel is flat and the flank it sits on slopes, so
  the two only agree over a limited run of z, and how far the ends drift is set
  by a slope that steepens as the funnel is shortened. Scaling the panel with
  the funnel keeps the slats as flush as they ever were. Only the gap behind
  the bezel's rear wall is absolute, because that wall does not move.
- **`BACK_D` is 2.73, 35% shorter than the 4.2 it was built at**, on request:
  at a side view the machine ran nearly the whole depth of the desk and there
  was no walnut visible behind it. It is shortened **from the back only** —
  `FUNNEL_FRONT_Z` is an offset from the bezel rather than a fraction of the
  funnel's own depth, so the bezel, the glass and `SCREEN_TARGET` do not move.
  That was checked rather than assumed: `#screen`'s client rect at the home
  framing *is* the projection of the screen plane's corners, and it is identical
  to three decimals at both depths. The gain is 1.47 of clear desk behind the
  monitor — 0.89 before, 2.36 after.

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

### The desk

`src/desk.js` builds a 1950s-60s double-pedestal steel "tanker" desk from
primitives, after `design-references/desk.png`. Taken from the reference: the
cream enamel carcase and drawer fronts with the paint worn through here and
there, the curved chrome pulls, the shallow locking centre drawer bridging the
knee hole, and the short feet. The desk in the photograph has a dark linoleum
top; this one gets a thick walnut slab instead, overhanging the steel on three
sides.

Local space matches the computer's — **+Z is the front**, origin on the floor at
the centre of the desk — and `DESK_TOP_Y` is exported because it is what
everything standing on the desk is placed against.

**Which pedestal is which is stated in screen terms, not the desk's own.** The
camera is in the +X/+Z octant, so +X is screen right; the reference's left
pedestal (the single deep file drawer) is therefore at -X and its right
pedestal (the stack of three) at +X, which also puts the more interesting of
the two on the near corner rather than behind the monitor.

Four things there are less obvious than they look.

- **The plan is set by what stands on it, and the depth was measured rather than
  estimated.** The CRT's funnel ran 4.8 units back from the stand and the
  keyboard 2.6 forward of it, so the kit occupied very nearly 12 units of depth.
  The first pass used a guess of 3 for the funnel and made the desk 10.5 deep;
  the monitor then hung over the back edge, which was invisible at the home
  framing and obvious the moment the camera swung to a side view. `KIT_Z_MAX`
  in `scene.js` carries the figure `window.__fit("computer")` reports, and it
  is not the keyboard's front edge (6.2) but the front of its painted *contact
  shadow* — a quad lying on the desk, which would otherwise hang off it in
  mid-air.
- **The kit is placed by that front figure, not by centring it**, and the
  difference is what the shorter funnel bought. Centring is where the number
  came from — at the old 4.2 funnel depth the kit ran -4.77..7.2 and sat square
  on the desk at `COMPUTER_Z` -1.215. The funnel now ends at -3.31, and
  re-centring the shorter kit would walk the machine 0.73 back, taking
  `SCREEN_TARGET` and the fly-in's arrival with it. So `KIT_FRONT_Z` is held
  where it was and the whole 1.47 becomes clear walnut behind the monitor.
  **Do not restore the `-(KIT_Z_MIN + KIT_Z_MAX) / 2` form**: it looks tidier
  and it moves the one thing the flight cannot have move.
- **`DESK_TOP_Y` is 9, and true to scale it would be about 11.4.** A real
  29-inch desk under a 17-inch CRT is nearly two-thirds desk, and at that ratio
  the machine is a detail on top of a cabinet — and the frame would have to pull
  back far enough to shrink the CRT, the thing a visitor is meant to click, by
  about a fifth.
- **The drawer fronts are overlay fronts and the pedestal carcase stops short of
  the front to make room for them**, with a dark panel closing it. That is what
  makes a reveal a gap you can see into. The first version stood the fronts 0.05
  off a full-depth shell and it failed twice: the reveals showed cream, so a
  stack read as one panel with scratches on it; and a front 0.03 clear of the
  face behind it is far inside one texel of a shadow map spread over 160 world
  units, so the contact came back as a dotted line of acne down every edge.
- **The knee hole is a hole.** There is floor visible under the modesty panel,
  and that gap is most of what says the desk stands on the ground rather than
  being drawn onto it. The first version filled the opening with a solid panel
  and it read as a block of grey between two cabinets. What closes it is the
  modesty panel at the back and the apron at the top; the pedestals' inner walls
  are already there and only need skinning in `INTERIOR`, which is far darker
  than it "should" be as paint — the key never reaches in there, but ambient
  plus hemisphere fill still lift a cream interior to within a shade of the lit
  outside.

**Every painted part is a plain `BoxGeometry`.** `RoundedBoxGeometry` gives a
fillet whose UVs collapse to a sliver, so a texture carrying per-texel noise is
minified to nothing across it, and what comes out of the anisotropic filter is a
regular bead of highlights running down every corner — the desk looked riveted.
Nothing here is round enough at the size it renders for the fillet to be worth
that. The wood slab is the exception and keeps its `RoundedBoxGeometry`: its
edges are genuinely soft, and its map is a photograph with no white noise in it
to alias.

#### The paint, and the wood

**The wear needs two textures because it is two different problems.** The shells
want a *tiling* field so a large flat panel is not one dead colour; the drawer
fronts want a *per-face* one, because wear on a sixty-year-old desk collects
where hands and chair arms reach — along the edges, around the pull, along the
bottom lip — and a tiling texture cannot know where its edges are. Both come out
of one draw as an albedo/roughness pair, the same trick `plasticTextures` plays
in `computer.js` and for the same reason: on real paint the chipped patches are
also the duller ones, and roughness alone is invisible on a surface this matt.

Three figures in there were found the hard way and are easy to get wrong again:

- **Chips are sized against how big the face renders, not how big the texture
  is.** A drawer front is about ninety screen pixels across at the establishing
  shot, so a chip two texels wide is a fifth of a pixel. The first pass drew them
  at r = 1.6-4.8 and they were invisible; the second overcorrected to 4.5-9.5 and
  several per face, which read as mould. Two or three at four-ish texels is the
  band where they are legible and still small.
- **Scuffs are banded by height but not by width.** Weighting them toward the two
  ends as well put a column of short strokes down each vertical edge, and once a
  stroke ran off the texture the clipped remains read as a dotted seam — like
  stitching down the side of every drawer.
- **Repeat is a trade and both ends have been seen.** Tile the shell field often
  and each lattice cell lands small but the *tile* repeats visibly — at six
  across a pedestal end it read as a quilted diamond grid. Tile it rarely and one
  cell spreads into a damp patch. Two tiles over ten world units, ten cells in
  each.

**The shells get their chips as decals**, not in their texture, for the reason
above: "near the edges and the handles" is a statement about where a panel ends.
A handful of small quads on the faces the camera sees, biased to the perimeter.
`size` there is in world units and the default is not a guess — the chip fills a
little under half its texture, so a quad much under a third of a unit lands at
two or three screen pixels and is simply not there.

**`ENAMEL` is darker than it needs to be at the home framing, because of the ends
of the orbit leash.** A pedestal end is a large flat panel whose normal points
along -X and the key rakes in from almost exactly there, so it takes about four
times the direct light the floor does (N·L of 0.88 against sin 13°). At the
brighter value the whole panel clipped to white at the left clamp and lost every
chip and scuff on it.

The top is Poly Haven's CC0 "Wood Table 001", vendored to `public/textures/` at
512 with its provenance beside it — the same reasoning as the HDRI and the
fonts. The scan is a dark stained walnut and the brief asked for a warm *medium*
tone, so it carries a per-channel gamma lift baked in at vendor time, which puts
the channel means on roughly `#6b4a33`. In the material, the grain runs *up* the
file, so the UVs are turned a quarter turn to put it along the desk's length as
a solid slab's would be; and the repeat is set from the desk's own dimensions
rather than left at 1, so the grain keeps the same physical scale on the top,
the edges and the ends instead of stretching to fit whichever face it lands on.
`roughness` is 1.9 because it *multiplies* the map, whose own range sits around
0.24 — the product is a satin 0.4-0.55.

**Two dark plates finish what the flat end of the orbit leash can nearly
see.** At 2° above the floor the eye sits at y ≈ 9.1 — a seventh of a unit
above this desk's own surface — so the slab's underside and the pedestals'
box bottoms are still (just) turned away, and neither plate is visible at the
clamp itself. They are there because a seventh of a unit is not a margin:
move `ISO_TARGET`, `CAM_DIST` or `ORBIT_DOWN` at all and the eye goes under
the slab, and what it would find is lit walnut and a cream box bottom, the
two surfaces on this desk that were never meant to be looked at. Both are
plates rather than re-modelled parts — inset 0.04 from the silhouette so they
change nothing at any framing that was already right, and thin enough that at
a grazing view they read as the shadow line under an overhang, which is what
a slab on a steel carcase actually has. The slab's plate also closes the one
real gap in the knee hole's ceiling, between the back of the apron and the
apron face.

The desk is grounded with painted contact shadows under each pedestal, for
exactly the reason the computer's are: the key's shadow map covers ±80 world
units, so a texel is ~0.08 across and the gap under a 0.55-unit foot never lands
on one.

### The treehouse

`src/treehouse.js` builds an original brick-built cherry blossom
treehouse standing on the desk to the right of the monitor, from boxes
and round studs. No logos on the studs, no minifigures, nothing
imported. Local space matches the desk's and the computer's — +Z is the
front — with the origin on the **desk top**, so `scene.js` only lifts
the group by `DESK_TOP_Y`.

The model was rebuilt against `design-references/cherryblossom.png` —
a bonsai cherry: a flared root ball, a strong S-curved trunk exposed
for the lower half, two bare low branches with a puff of blossom
apiece, and one broad asymmetric cloud above. What survived the
rebuild is the brick kit, the batching, the clump machinery and the
house; what changed is the trunk, the house's size and seat, and the
whole shape and palette of the crown.

**`STUD` is 0.3, which is double scale, and that is the decision
everything else hangs off.** A desk unit here is a shade over two
inches, so a true-scale brick would have a 0.15 pitch — and at the home
framing that is a five-pixel stud and a five-pixel 1x1. The model would
read as a speckled blob. At 0.3 a stud is about ten pixels and a course
can be counted. The model has been taken down three times and the pitch
has not moved on any of them: every figure that is a **count** of bricks
comes down instead — the trunk from nine courses to seven, then four,
then three; its root from 4x4 studs to 3x3; the house from five studs
square to four and then to three; the branch sections one size each,
the reaches scaled with them. Same bricks, fewer of them. Keep it that
way; shrinking the pitch is the one change this model cannot afford.

**The whole model is sized against the monitor, not the desk.** The
machine stands 6.60 above the desk top. The model reached 6.25 of that
once — level with it, which read as a second object competing with the
thing a visitor is meant to press — then 4.75, and a flat 15% pass took
it to 3.95, about 60%, which is where it still builds itself. With
`TREEHOUSE_SCALE` on top it stands at **4.62, about 70%**.
`_canopyfit.mjs` prints the figure and it is the one number to hold:
the ceiling is the 6.25 that read as a rival, not the 6.60 itself —
and at 4.62 the model is clear of both. It was briefly 6.93 (105%),
past the machine it stands beside; see "Placement" for what that cost
and what the two-thirds pass bought back.

#### Reading as a build, not as a plant

Three passes over the whole kit, and together they are what separate
this from a sculpt that happens to be made of boxes.

- **`GLOSS` multiplies every roughness the kit is asked for**, rather
  than each call site being retuned, so the relative spread stays —
  bark duller than petal, grass between them — and the model moves
  together. 0.55 takes the kit's 0.42 default to 0.23, which is a hard
  small highlight on a 0.3-unit face. `BRICK_ENV` goes to 0.55 against
  the furniture's 0.34 for the other half of it: the HDRI is ambient
  from every direction, so on a matt surface it only flattens, while on
  a glossy one it is what puts a sheen on the faces the key never
  reaches — most of the underside of a canopy.
- **`BEVEL` went from `STUD * 0.055` to `0.09`**, about a pixel and a
  half of lit edge per seam at the home framing. That is the entire
  mechanism by which a stack of same-coloured bricks reads as a stack;
  without it two pieces share one unbroken face. Much past 0.09 and a
  1x1 starts to read as a pebble.
- **Orientation is quantised** — see the trunk below.

#### The trunk

**It is a curve, not a stack of courses**, and that is the change the
rebuild hangs off. Three bonded courses with a yaw per course can lean
and can twist, but cannot bend back: a stack of axis-aligned footprints
has no way to make the reference's S, where the trunk goes out one way
low down, crosses back through its own axis and leans the other way
under the crown. So `TRUNK_SPINE` is six points, `TRUNK_CURVE` a
Catmull-Rom through them, and the bricks are stepped along it the way a
branch's are — each turned so its own up axis runs along the tangent.

- **The taper is in the footprints** (`TRUNK_SIZES`: 4x4 at the foot,
  then 3x3, 3x2, 2x2 at the fork), not in a scale. A scaled brick is
  not a brick.
- **The twist per piece does the work the bond used to do.** Stacked
  courses got their knuckles from alternating the long axis; a swept
  trunk gets them from rolling each piece further round, so the corners
  stagger down the silhouette instead of lining up into four long
  edges.
- **A brick-built limb cannot point a brick anywhere it likes.** The
  first version turned each piece to the exact tangent, which draws a
  perfectly smooth tube out of boxes: correct as geometry and wrong as
  a model, because the one thing a build does that a sculpt does not is
  *step*. `steppedQuat` snaps both the tilt and the roll, so a run of
  pieces shares an angle and then visibly breaks to the next. The two
  steps are deliberately different sizes: `TILT_STEP` is the coarser at
  18 degrees because it is the one the silhouette shows, and
  `ROLL_STEP` is 22.5, a little over three of `twist`, so corners
  stagger down a trunk in threes instead of spiralling.
- **The overlap is tighter than a branch's** — 1.14 of the step against
  1.26 — because the trunk wants its course lines to read where a
  branch wants its bends closed up. Both figures came down when the
  orientation was quantised: a smooth tube needed 1.3 to keep its bends
  from opening, where a stepped one breaks in 18-degree jumps and only
  has to cover the wedge that leaves. **Less overlap is the point
  rather than a saving** — the less one piece buries the next, the more
  of the seam between them the bevel gets to draw. Both are options on
  `buildBranch`, which is curve-driven (`step`, `overlap`, `twist`,
  `bands`, `shade`).
- **`TRUNK_TOP_Y` is 2.35**, and it is what makes the brief's "exposed
  for the lower half" true: the tree tops out at 3.73 above the lawn,
  so a fork there leaves the trunk the lower half and the crown the
  upper.

**The roots are short branches, not a plinth**, and they have to leave
the trunk *part way up it*. The first pass started all five at the lawn
and ran them outward along the ground, which is a ring of planks lying
on the grass; what makes a root ball read is wood coming **down** out
of the trunk to meet the plate. They leave between y 0.24 and 0.46
(`ROOT_PLAN`) at five uneven angles and reaches, and the flare itself
is the trunk's own 4x4 bottom piece — the roots break its outline up.

**The S moved out of X and into Z up top, and that is not cosmetic.**
Screen-x is roughly `0.8x - 0.6z` at this camera, so +x and -z both go
screen right: the spine's upper extreme reads identically at (0.26,
-0.52) as it did at (0.44, -0.22) — travel 0.97 on screen against 0.94
— while the trunk now stays inside the house's footprint instead of
bursting out of a wall or a roof slope. See the house below for why
that mattered.

**The two low branches are bare and are not a mirrored pair.** The -X
one leaves lower (`t` 0.30) and dips at its tip, the +X one leaves
higher (0.54) and lifts. A matched pair reads as a crossbar through the
trunk. `lowBranchCurve(i, lawnY)` is the single source for each, the
same way `limbCurve` is for a canopy limb: the swing hangs off the +X
one and a blossom cluster off both, and neither may hold a private copy
of where the branch went.

#### The house

Three studs square, two wall courses, deck at y 0.80 and ridge at 2.29
— under the canopy floor at 2.42, with the trunk running on past it to
the fork. It came down from four studs and three courses (2.15 tall
from the deck) to **1.49**, which is what let it move off the fork and
onto the exposed trunk.

- **The door is one stud wide, not two.** On a three-stud wall a
  two-stud door leaves half a stud either side and reads as a missing
  panel; 0.3 x 0.72 is a door's own proportion.
- **The round window is applied to the flank, not punched through it.**
  At a one-stud plan the opening is 0.3 by 0.36, whose diagonal is
  bigger than any frame small enough to suit a house this size — so a
  hole shows notches at its corners. The ring standing proud still
  throws the shadow line, which was the only thing the hole was ever
  for.
- **The rail is two newel posts with plate caps.** A one-stud porch has
  no run between post and wall for a side rail.
- Every literal `2` in `buildHouse` was a statement about a five-stud
  plan, so the wall lines are derived: `WALL_X`, `WALL_Z`,
  `DECK_FRONT`. The bond, the doorway, the gable, the rail and the
  strut feet all read off them.

**The house straddles the trunk, and that was forced rather than
chosen.** A 0.9-wide house cannot clear a 0.9-wide trunk on a 2.68
lawn: every "beside the trunk" placement was worked out — both pockets
of the S, on either low branch, in front of it in +Z — and each one
puts the deck or the ladder's foot off the plate. So the house sits on
the trunk and the trunk rises behind its back wall, which the Z-shifted
S is what makes possible. No notch is needed; checked from front, flank
and back.

#### The canopy

**One broad, layered cloud above the house: 1.3 tall against about 3.5
wide, leaning back-right, with one end reaching far out and the other
drooping low.** It replaced a crown that was 2.0 tall against 3.3 and
read as a ball.

**It is laid on the stud grid, and that is the change that makes it a
build.** The crown used to be several hundred flowers scattered on
spherical shells, each at its own position and its own free rotation —
which is a cloud of petals, not a model anybody could assemble. Now
`markClump` resolves the same sub-lobe volumes onto a grid (`CELL` in
plan, one plate in height, counted up from the lawn) and `bakeCanopy`
turns the marked cells into pieces. **The mass and the silhouette are
the same shape they were**: nothing about the limb table or the lobe
geometry moved. What changed is that the shape is resolved onto the
grid before anything is emitted, so its outline can only ever come out
a staircase — there is no stage at which a smooth surface is
approximated, because the cells *are* the model.

`bakeCanopy` is four passes, and the order of the first two is the
whole performance story:

1. **Colour**, from `tintFor` as before — but the draw is a hash of the
   cell's *patch* (two cells square, three layers deep, which is one
   brick course) rather than of the cell. That is both what a builder's
   bag of parts looks like and what lets the next pass merge anything
   at all: per-cell colour would make every run one plate long.
2. **Cull the interior.** A cell with all six neighbours occupied can
   never be seen, and a crown this size is mostly interior. The
   neighbour test runs against the *full* set, not the surviving shell,
   so a surface cell under a culled one still knows it is covered and
   does not sprout a stud into solid blossom.
3. **Merge runs** along x, within a layer, same colour, capped at
   `RUN_MAX` — a flat top comes out as a few long plates and a stepped
   flank as a stack of short ones. The cap is a batching figure as much
   as a modelling one: each footprint is its own geometry, so an
   uncapped run would mint a 1x11 nobody can see the far end of.
4. **Studs and flowers.** A flower is clipped to an exposed stud and
   hides it, so the two are **alternatives rather than stacked**: where
   the draw takes a flower the stud is not drawn at all, and where it
   does not the bare stud is what puts studs on the upward-facing
   surfaces. `TOP_BLOOM` / `EDGE_BLOOM` are those shares. `SIDE_BLOOM`
   adds a few on outward-facing vertical faces, axis-aligned — the
   crown is seen from the side as much as from above, and a bare plate
   wall there reads as a wall.

The flowers no longer face outward. They used to be turned by a blend
of the sub-lobe's own normal and the direction away from
`CANOPY_HEART`; a flower is clipped to a stud now, so it points the way
the stud does, and `SIDE_BLOOM` is what fills the role that facing
played — blossom visible from under and beside the crown, not only from
above.

Two figures moved for one reason, and it is a rasterisation fact rather
than an aesthetic one: **a voxelised lobe finishes about half a cell
short of its nominal radius**, because only cells whose *centres* fall
inside are kept, and the shortfall is taken off each sub-lobe
separately — so a clump of four first came out as four islands with
grid gaps between them. `LOBE_SUB_R` went up (0.58-0.92) and
`LOBE_SUB_OFF` came in (0.20-0.46), which closes the gaps while the
clump's own extent stays put, since the two pull opposite ways.
`LOBE_SUBS` is 3-5 for the same reason.

Two things made the difference, and the first is the one that could not
have been got from the limb table:

- **Every clump is an oblate spheroid, not a ball** (`LOBE_SQUASH`,
  0.58). A cloud assembled out of spheres is at least one sphere tall
  everywhere, so widening the limb reaches only ever gave a wider
  dome. The squash scales the y of every offset inside a clump — the
  sub-lobes' displacement and the sphere each one is rasterised into
  — so it cannot be applied twice to some offsets and not at all to
  others.
- **Every leader off the trunk is more reach than rise.** A leader that
  climbs carries a ball; a leader that runs out carries a cloud.
  `LIMB_PLAN` is five of them (W, N, E, S, and C — the one short stem
  that goes up), eleven second-generation limbs that are where the
  width comes from, and seven twigs whose tips sit at six different
  heights. **A top edge is bumpy because the wood under it is**, not
  because the blossom on it is noisy.

**The asymmetry is deliberate and its direction is not arbitrary.** The
long reach is N1 and its twig, out to z -2.54 with barely any rise —
and it goes mostly in **-z** rather than +x because -z is screen-right
too and costs almost nothing in world x, which is the figure
`_canopyfit.mjs` watches against the desk's near edge. The droop is W2,
out and forward and *down* to y 2.22 with its flowers hanging to 1.98,
on the -x/+z side. A second, smaller droop (E3) keeps the first from
looking like a mistake.

**The palette is mostly white and pale pink with a scatter of coral**,
after the reference, which reads white from across the room. The old
three-pinks-and-a-rose read as one pink mass however it was graded.
Four tints now: `PETAL_WHITE`, `PETAL_PALE` (barely pink — the second
dominant), `PETAL_PINK` (a minority) and `PETAL_CORAL`.

**The coral is drawn flat, not against depth, and that is the trick.**
In the reference it falls in small patches all through the crown — on
the skyline, in the shade, out on the twigs alike — so grading it the
way the pinks are graded would collect it somewhere and read as a
stain. Everything else *is* graded by depth: pink deep inside, white
out on the lit surface.

There are now **two coral shares, because a plate is not a flower**.
`CORAL_SHARE` is still 0.08 for the flowers, and past about 0.15 the
crown turns orange. The *structure* runs at `CORAL_PLATE`, a quarter of
it: a patch of plates covers roughly ten times what a flower does, so
the same share came back as slabs of orange and the crown read as a
maple. `PLATE_LIFT` is the same arithmetic applied to the pinks — the
three graded tints were balanced against flowers, so the structure's
draw is pushed toward the white end to get back the crown that reads
white from across the room.

**The pip was a strong yellow and is now a warm cream** (`BLOSSOM_EYE`),
at `STUD * 0.125` rather than 0.17. Against three pinks the yellow was
fine; against a mostly-white canopy a thousand saturated yellow dots
read as a field of daisies.

**The tips are what keep the outline from being a rim.** Without them
every clump ends at its own lobes, and a dozen clumps ending at their
own lobes is a dozen arcs — the same moulded edge, just stepped. `TIP_N`
single cells per clump, marked out to `TIP_REACH` times the radius and
biased away from `CANOPY_HEART`, are the whole difference between an
outline you can see the sky through and one you cannot. Each comes out
as a 1x1 plate with a flower clipped to it — which is what separates
them from the scattered fringe they replaced: same job, done on the
grid like the rest of the model. A tip always loses to mass, so one
stepped off a clump that lands inside the next is simply absorbed.

**One small cluster hangs on each low branch** (`LOW_LOBE_R`,
`LOW_LOBE_FLOOR`). They are most of what says the crown is a cloud
*above* a tree rather than the whole tree, and they need their own
floor — `CANOPY_FLOOR` is 2.42 and these hang at 0.8 to 1.5. On the +X
branch the cluster sits past both of the swing's ties, so the ropes and
the seat stay clear.

**The keep-out follows the roof; it is not a box over it.** A point is
inside the house only if it is under the slope's own height at its own
x (`roofTopAt`), plus a clearance that tapers from nothing at the eave
to `RIDGE_CLEAR` at the ridge. With no clearance the blossom lay on the
roof everywhere and, since the camera looks down at 20 degrees, the
whole roof went under — *nestled* became *buried*. With the taper,
blossom laps the lower slopes and the eaves while the ridge stays
clear. **A clear void over the porch** (`inPorchVoid`) is the only
place the canopy is told to stay away outright: it covers the doorway,
the rail and the ladder.

#### Placement, and the batching

Placement is `TREEHOUSE_X` / `TREEHOUSE_Z` in `scene.js`, at (6.9,
-2.1), unchanged through both shrinks and the rebuild, and both are set
against what is already on that half of the desk rather than by eye:
the mouse's painted contact shadow runs x 3.5..5.7 over z 2.0..4.6 and
its cord crosses x 1.5..4.5 over z 0.4..2.6. The depth is the less
obvious half — screen x is roughly `0.8x - 0.6z` at this azimuth and
depth toward the camera is `0.57x + 0.75z`, so a model placed level
with the monitor sits screen-right of it *and in front of it*, and the
canopy crosses the bezel. `TREEHOUSE_FACING` is `AZIMUTH - 0.50`:
AZIMUTH is the yaw at which the model's +Z looks straight down the
lens, so the offset *is* the three-quarter angle. At 0.14 — the first
value — it was a front elevation and the round window was edge-on.

**`TREEHOUSE_SCALE` is 1.1733, and it is a group scale rather than a
rebuild.** It was 1.76, and at that value the model **overhanged the
desk on two edges and crossed the monitor**; two-thirds of it is what
brought every one of those margins back positive — see the figures at
the end of this section before changing anything near it.

Scaling the group is safe in **either** direction only so far, and the
limit is the same rule either way. `STUD` must never come *down*,
because under about eight pixels a stud stops reading and the build
stops being a build — and a group scale takes the stud with it. At
1.1733 a stud renders at ~0.35 world units against the 0.30 the model
builds itself at, so there is still headroom, but not much: below
about 1.0 the pitch itself is what is being cut, and the answer then
is fewer bricks, not smaller ones, exactly as it was on the three
rebuilds above.

It is applied about the model's own origin — on the desk top at the
base plate's centre — so the model grows and shrinks in place rather
than drifting, and the base plate stays where it was set down. All of
it is measured: re-run `_canopyfit.mjs` **and** `_tightfit.mjs` after
touching it, the first because it fails safe and the second because it
is the truth.

**Everything goes through a batching kit**, keyed by shape *and*
colour, and nothing reaches the scene until `bake`. Repeated pieces
come out as one `InstancedMesh` per batch — the base plate's studs
alone are about 120 instances in one draw call, and the canopy's ~1,030
flowers are eight meshes, four petal tints plus their pips. The whole
model is **~790 instances in 64 meshes**, which `_canopyfit.mjs`
prints. Two consequences worth knowing: footprints are canonicalised,
so a 4x2 brick and a 2x4 brick are one geometry and a right angle; and
studs are not part of a brick, so every stud of a given colour in the
whole model is one batch whatever it sits on. **Scale lives in the
instance matrix, not in the batch key** — a large blossom and a small
one are the same geometry — which is what lets the canopy vary freely
in size without splitting a draw call.

`limbCurve(i, lawnY)` is the single source for a canopy limb's path and
`lowBranchCurve(i, lawnY)` for a low branch's; `buildBranches`, the
swing and the canopy all call them, so re-aiming a limb carries what
hangs off it rather than leaving a swing adrift from a remembered copy
of the maths. `LIMB_PTS` resolves the whole table once at module scope,
and a gen-0 limb's start comes off the spine by its `tt` rather than
being written down, so re-shaping the S carries the whole crown.

#### The spare bricks

Four loose pieces on the desk in front of the model, as if left over
from building it — a 2x4 in `PLANK`, a 2x2 in `PETAL_PINK`, a 1x2 in
`GRASS` and a two-brick stack (`PLANK_ALT` under a crossed
`PETAL_PALE`), at four different yaws. They are the one thing on this
desk that says somebody put the tree together rather than bought it.
`SPARE_PLAN` is the table; `buildSpareBricks` is the only other export
`treehouse.js` has, and `disposeTreehouse` frees it along with the
model.

Four things about them:

- **They are their own group, not part of the model**, added by
  `scene.js` as a sibling named `spares`. That is a tooling decision as
  much as a modelling one: `_canopyfit.mjs` measures the model's world
  box against the desk's, and a brick dropped two units in front of the
  tree would quietly move the front-edge margin it reports and stop the
  number meaning what it says. The separation costs a handful of draw
  calls — these are single pieces, so nothing instances — and keeps
  `__fit("treehouse")` honest. `__fit("spares")` reads this one.
- **Their frame is the desk's, not the model's**, with the origin on
  the desk top at the desk's own centre, so `scene.js` only lifts them
  by `DESK_TOP_Y` and applies no yaw. The treehouse is turned by
  `TREEHOUSE_FACING`, but every clearance these have to hold is stated
  in the desk's frame — so sitting in it means the plan is those
  coordinates directly rather than the same figures rotated by half a
  radian. Measured with `_spares.mjs`: **0.98 clear in x of the
  computer kit's +x extent** (which is the mouse's painted contact
  shadow — note the z figures quoted beside `TREEHOUSE_Z` are in the
  *computer's* local frame and the x figures are not), 0.78 to the
  desk's +x edge and 3.32 to its front. The cord never comes near: it
  runs x 1.5..4.5. The gap `_tightfit.mjs` prints against the
  *treehouse* is **+0.42**, so the bricks sit in the open in front of
  the canopy, which is where they were placed.

  **These four figures are the budget `SPARE_SCALE` spends.** The
  binding one is the treehouse, and it is the one to watch because
  `_spares.mjs` reads the *conservative* box there: at 0.973 it
  printed **-0.01** — essentially touching — against a true +0.34,
  and nothing intersected even then, since the canopy's +z reach at
  that point is two units above the desk and the bricks are under one
  tall. At 0.7784 it prints **+0.07**, so both readings are positive
  and the fail-safe one has slack again. Past about 0.95 that stops
  being true.

  The z gap went to -0.57 while `TREEHOUSE_SCALE` was 1.76, which put
  the bricks in the canopy's shade rather than in front of it.
  Shrinking the model bought it back.
- **`SPARE_SCALE` is 0.7784, carried in each piece's own matrix rather
  than on the group.** The group's origin is the desk's centre, so
  scaling there would walk all four bricks a share of seven units back
  toward the mouse — a move dressed up as a resize. In the matrix the
  batch key is untouched, so these still share geometry with the
  build's own bricks and are simply instanced at their own size. The
  stud offsets take the scale in the brick's own space, before the
  pose; left on the full-size grid they would walk off the ends of a
  resized brick.

  **The number to compare it against is not 1.** The model carries
  `TREEHOUSE_SCALE` as a group scale and these carry none, so what
  decides whether a loose piece reads as the same part as the ones in
  the build is the *ratio*. It has been 0.556 against 1.76 (~32%,
  where a leftover was a third the size of what it was left over
  from), 0.973 against 1.1733 (~83%), and is now 0.7784 against
  1.1733 — **~66%**, a brick that belongs to the build while sitting
  a little smaller than one in it. **If `TREEHOUSE_SCALE` moves again
  this ratio moves with it** and nothing recomputes it; the two
  constants are independent and only this note ties them together.
- **One is tipped onto its side.** Three bricks lying flat at three
  angles still reads as an arrangement; a brick resting on a long face
  is the one that reads as dropped. `tip` rolls it a quarter turn about
  its own length, which puts its studs out sideways and its resting
  height at half its width. Its footprint is kept w <= d so the
  canonicalising quarter turn in `looseBrick` never lands on top of the
  roll.
- **They cast for real.** Everything else small on this desk is
  grounded with a painted contact shadow, because the key's shadow map
  spreads 2048 texels over +/-80 world units and the hairline under a
  base plate never lands on one. A brick is a different case: it stands
  a third of a unit tall under a key raking in at 13 degrees, so it
  throws about a unit and a half of shadow across the walnut — twenty
  texels of it, soft but unmistakably there.

`looseBrick` is what places them: the kit's own `brick` is y-up and
yaw-only, since it puts a piece on top of whatever is already there,
which is what building *is*. A piece lying where it fell needs a full
quaternion. It canonicalises footprints the same way and multiplies the
quarter turn on the **right**, so it happens in the brick's own frame
before the pose does — which is what keeps it correct for a piece that
is also rolled onto its side. The batch keys are the kit's, so a loose
2x4 in a colour the build already uses reuses that geometry.

**Current figures, and the model fits the desk.** Top of tree **4.62**
above the desk top, which is **70% of the monitor's 6.60** — back
under the 6.25 that once read as a rival to the thing a visitor is
meant to press. Every margin is positive on the true box:

| | `_canopyfit.mjs` | `_tightfit.mjs` (true) |
|---|---|---|
| margin to the desk's +x edge | -0.00 | **+0.53** |
| margin to the desk's back edge | +0.84 | **+1.05** |
| clearance to the live overlay @1440x900 | +25px | **+45px** |
| gap from the spare bricks in z | — | **+0.51** |

**The +x edge is the one with no slack, and the two columns disagree
about it on purpose.** The conservative box lands exactly on the
desk's edge while the true box is half a unit clear — which is the
`Box3.setFromObject` over-report described below, not a disagreement
about where the bricks are. Read it as: the model passes on its real
geometry and has nothing spare on the fail-safe check. Anything that
moves the canopy outward on that side wants both scripts run again.

The spares gap flipping positive is the second thing the pass bought
back. At 1.76 it was **-0.57** — the canopy's +z overhang passed two
units above the front brick, so nothing touched, but the bricks sat in
its shade rather than in front of it, which is not where they were
placed. They are back in the open.

**What this replaced.** The scale was 1.76, which was asked for after
the height ceiling had been flagged and was recorded rather than
quietly corrected: at that value the true-box margins were **-0.64**
and **-0.81** with the crown **-11px** over the glass, blossom hung
past the walnut into empty air on the right and the back, and the
crown crossed in front of the CRT's right flank. Re-placing could not
have rescued it, and the arithmetic is worth keeping because it bounds
any future increase: the free corridor on that half of the desk runs
from the computer kit's +x extent (5.7 — the mouse's painted contact
shadow) to the desk's own edge at 9.75, so **4.05 units wide**. The
model at 1.76 spanned 6.55 of that, too wide whatever `TREEHOUSE_X`
was set to, and moving it inboard only drove it further over the
glass. At 1.1733 it spans **4.60** — still wider than the corridor,
which is why the +x margin is thin rather than comfortable, but it now
fits because the canopy's overhang clears the desk's edge in y rather
than in x.

**One framing is still cropped, and it is the portrait one.**
`_finalshots.mjs` reports the model's NDC box at `x1` **1.25** at home
on a phone and 1.23 at eye level, against 0.57 on desktop — so a
sliver of the canopy's right side is outside the frame there. Part of
that is the conservative box again, but the picture really is clipped.
It is the same trade the desk's own ends take on a portrait viewport
and for the same reason — `FRUSTUM_MOBILE` is 37 against 24, so a tall
narrow frame sees far less world width — and it is better than it was
at 1.76, not gone. Fixing it properly is a `TREEHOUSE_X` question on
the portrait breakpoint, not a scale one.

**`_canopyfit.mjs` over-reports the +x edge by about half a unit at
built size**, and proportionally more as the model scales, because it
reads `Box3.setFromObject` — which for an `InstancedMesh` takes the
AABB of a *rotated* AABB, and this model is yawed half a radian. That
is why its figure and `_tightfit.mjs`'s disagree by 0.76 here. **Keep
it as the check anyway**: it fails safe, and a conservative bound that
over-warns is worth more than one that can quietly pass. Just read
`_tightfit.mjs` beside it before acting, in either direction.

### The window on the left wall

`src/nightwindow.js` builds a four-pane sash in a painted casing, with
a night sky behind the glass and rain running down it. Its own module
for the same reason the desk and the treehouse are: it is a
self-contained object with its own origin on the surface it is fixed
to. `src/room.js` places it and nothing else in the scene knows it
exists.

**Local space is the wall panel's.** x across the opening, 0 at its
centre; y up, **0 at the sill line**; z = 0 the wall's *inner* face,
with the thickness running back to -`WALL_T`. That is exactly the
frame `buildWallPanel` builds in, so room.js only has to place the
group at the opening's centre and the two cannot disagree about which
way the wall faces.

**The opening is a real hole, and the wall field stopped being a
box to make it one.** With a window in it the field is an
`ExtrudeGeometry` with a `Path` hole — the same decision
`computer.js` makes for the bezel, and for the same reason: a panel
plus a dark inset cannot make an opening, it can only cover one. The
alternative was four boxes around the opening, which is easier to
write and wrong in a way that shows: each box carries its own 0..1
UV, so four pieces of different sizes crop the shared noise field
differently and the lattice breaks at every joint. Extruding puts the
UVs in world units instead, so the grain runs continuously round the
opening — which is why the field's `map.repeat` is `1 / 9` on the
windowed wall against `width / 9` on the plain one. **Both spellings
mean one noise lattice per 9 world units**; they have to, or a wall
with a window reads at a different grain from the one without.

**The size is set by the top of the frame, not by the proportion.**
The opening is 8 x 6.4 with its sill at 9.4, and the height came down
from 7.0 because at that value the casing's head landed at NDC y
**0.95** at home and **0.97** at the right clamp — in shot, but with
3% of the frame to spare, which is not a margin. At 6.4 it is 0.88,
and the panes lost nothing worth having (3.86 x 3.06 against
3.86 x 3.36). The sill clears the wainscot's cap rail (7.88) and sits
level with the desk top (9), so the opening is the one large bright
area above the desk's left end rather than something half-hidden
behind the machine.

**The placement is set back along -z, and that is a portrait
decision.** Screen-x runs roughly `0.8x - 0.6z` at this azimuth, so
moving the window *back* walks it toward the middle of the frame.
`WINDOW_Z` is -2.0, which is as far as it goes: the opening is 8 wide,
the back corner is at z -9, and the casing, the sill's ears and the
back wall's own thickness have to live in the 3 units that leaves.

**It is cropped on a phone anyway, and that is the same trade the
desk's ends take.** `_winshots.mjs` reports the assembly's NDC box at
**-1.31..-0.57** at home on a 390x844 frame, against -0.58..-0.24 on
desktop — so about 58% of it is in shot there, the screen-right half.
`FRUSTUM_MOBILE` is 37 against 24, so a tall narrow frame sees far
less world width and the left wall is the first thing it loses. What
*was* fixed is the moon: it sits at pane UV **0.70**, in the
upper-right pane, because the pane's +u runs toward world -z, which
is screen right. At 0.30 it was whole on desktop and cut off on a
phone.

**It fades with its wall and the cutaway was not told about it.** The
window is a child of the left wall panel and its materials join that
panel's list, so `updateWallFade` dims it and the group's `visible`
flag culls it — glass, rain and joinery together — when the camera
comes round behind the wall. Nothing in room.js's fade code mentions
the window.

#### The glass

The sky is drawn once into a canvas and used as an **unlit** `map`:
gradient (`#141A33` overhead to `#2B3560` at the horizon), a thinning
scatter of stars, a moon with a wide weak halo and three soft maria,
then two ranks of skyline — a lighter hazed rank behind and a nearly
black one in front carrying the lit windows. A faint diagonal sheen
over the lot is what makes it glass rather than a hole; past about
0.1 alpha it stops reading as a reflection and starts reading as a
smear.

`MeshBasicMaterial`, not `MeshStandard`, and that is the point: the
sky does not dim with the room. It is the brightest thing in the
picture and the only surface here meant to look like a light source.
The seeds are fixed, so the skyline and the stars are identical on
every load — a city that rearranges itself on refresh cannot be
art-directed.

**One sheet of sky with bars over it, not four panes.** That is how a
four-pane sash is actually glazed, and it is what keeps the skyline
continuous across the mullion instead of stepping at it.

#### The rain, and why it is a patched material rather than a shader

Streaks are computed in the fragment shader from the pane's own
coordinates: no geometry, no texture, no per-frame upload beyond a
single float. Two layers, near and far, each specified as a column
count across the pane and a run count up it — so the widths are
resolution-independent and the pane can be resized without re-tuning
them.

**It is injected into a `MeshBasicMaterial` through
`onBeforeCompile`, and a raw `ShaderMaterial` would have been
wrong.** A ShaderMaterial gets none of three's fragment epilogue — no
`tonemapping_fragment`, no `colorspace_fragment`, no fog — and this
scene has an operator on one render path and `OutputPass` doing the
same job on the other (see `src/tonemap.js`). The rain would have
come out a different colour on desktop than on mobile, and unfogged
on both. Patching a built-in material keeps all of it, and `opacity`
stays the plain uniform the cutaway writes, which is what makes the
fade free.

Two details in the injection are deliberate. The pane coordinate is
derived from `position` rather than `uv`, because a
`MeshBasicMaterial` with no maps on it does not declare the uv
attribute and asking for one by defining `USE_UV` pulls in machinery
nothing here uses. And the uniform object lives at module scope and
is handed back on every compile, because `onBeforeCompile` runs again
whenever the program cache key changes — `window.__tonemap` switching
the operator is exactly that.

**Reduced motion has two halves and only the first is load-bearing.**
`scene.js` runs no render loop under `prefers-reduced-motion`, so
`tickRain` is never called and the glass is simply frozen — which is
why the shader is written to look like rain at `uTime` 0 rather than
resolving into one: every column carries its own phase offset, so the
opening frame is already a scatter. `RAIN_SLOW` is the second half, a
0.12 factor that applies if a loop ever does run there — a crawl
rather than a stop, so the glass still reads as wet without anything
streaking across it. `window.__rain()` reports which is in force, and
`_winshots.mjs` checks the clock really does stay at zero.

`window.__rain(speed)` re-tunes the fall on a live page, in cell-runs
per second, which is how the streaks were set without a rebuild per
candidate.

**Not measured for frame rate.** It adds about fourteen static draw
calls under the frozen shadow map and one small transparent pass over
the pane, so there is no mechanism by which it should cost anything —
but that is a prediction, not a reading, and the rule on this branch
is that a frame time without its A/B beside it is worth nothing. Run
`_perfcheck.mjs` if the number matters.

### The desk lamp

`src/lamp.js` builds a base, a pole and a cone shade from primitives
and stands them on the back-left corner of the desk. It is **the only
object in the scene a visitor can change**: pressing it toggles the
light, and so does a visually hidden button in `index.html` for anyone
without a pointer.

Local space matches the desk's, the computer's and the treehouse's —
+Z is the front, origin on the **desk top** at the centre of the base —
so `scene.js` only lifts it by `DESK_TOP_Y`. It is **not yawed**: the
shade's own two tilts are what point it, and a group rotation on top
would make "forward" mean two different things.

#### How big it is, and the three things a group scale cannot reach

**`LAMP_SCALE` is 1.75**, applied as a group scale on the root rather
than by rebuilding the proportions — so the constants in the file stay
at the sizes the shape was art-directed at (`SHADE_H` still reads as "a
1.1-unit cone") and the arithmetic in the comments still checks out.
It is applied about the root's **own origin**, which sits on the desk
top at the centre of the base, so the fixture grows in place, the base
stays flat on the walnut at `DESK_TOP_Y`, and `scene.js`'s placement
does not have to know the scale exists. Same decision, and the same
reason, as `TREEHOUSE_SCALE`.

**A group scale reaches geometry and transforms and nothing else**, and
four things here live outside it. Three are stated in world units, so
each is multiplied explicitly or the fixture grows while its light
stays the size it was:

- **`distance` on both lights** — the range at which each dies.
- **the spot's `shadow.camera.near`**. Its `far` is *not* set here in
  any load-bearing way: `SpotLightShadow.updateMatrices` overwrites it
  from `light.distance` on every pass, so scaling the distance carries
  it. The line in the file only keeps the two agreeing before the
  first shadow pass.
- **the spot's `shadow.normalBias`**, which walks a sample along the
  normal by a distance in world units. The shadow frustum's *angle*
  does not change, so at 1.75x the throw a texel covers 1.75x more
  world and the bias has to grow with it or the acne comes back under
  the base.

`shadow.radius` is deliberately **not** scaled: it is a blur width in
texels, and a texel is now wider in world terms, so the penumbra grows
on its own — which is what a bigger mouth should give.

**The fourth is the falloff, and it was measured rather than
predicted.** The bulb is now 1.75x further from the walnut, so at these
decays the pool arrives dimmer by `LAMP_SCALE ** decay`. That is not a
rounding error: `_pool.mjs`'s transect put the peak on/off delta at
**88 against 181** before, a factor of 2.06 against the 1.75^1.3 = 2.11
the spot's decay predicts. The footprint had grown and flattened
exactly as it should; the light had halved. So both intensities carry
`* LAMP_SCALE ** decay`, written as the exponent rather than
pre-multiplied so that re-scaling the fixture carries the brightness
with it. Compensated, the same transect reads **peak 130 over a wider
lit span** (x -7.6..-0.6 against -7.6..-1.3) — a broader, flatter pool
rather than the small lamp's hot spot, which is what a bigger shade
further from the surface does.

That compensation is also what keeps the night rig honest: every figure
in "The night lighting" is calibrated at `lampLevel === 1`, so halving
the lamp's contribution would have quietly moved the calibration.

**What the scale costs is height**, and it is the one figure that now
breaks a rule this file states twice. See "Where it stands".

#### Why there are two lights in one fixture

The brief asks for a warm `PointLight` under the shade **with soft
shadows**, and three 0.186 cannot give one both at once:
`WebGLShadowMap` refuses VSM shadows for point lights outright
("VSM shadow maps are not supported for PointLights") and `continue`s,
so `castShadow` on one is a dead flag plus a console warning — and this
scene is on `VSMShadowMap` for the moon's penumbra. So the fixture
carries two:

- **the point light** is the lamp's light. It sits *inside* the shade
  at the bulb and casts nothing, which is exactly what lets it light
  the shade's own outside, the pole and the wall behind — a shade
  really does glow. Short range (4.6), so it stays a bloom around the
  fixture rather than a second pool.
- **the spot light** carries the throw and the soft cast shadow. A cone
  shade *is* a cone of light, so it is also the right shape.

Both are `decay` well under 2, for the same reason the CRT's spill is:
a lit shade is an area source and these are points, so inverse-square
blows the shade's own plastic out before anything a hand's width away
sees light.

**The spot sits 0.06 past the shade's mouth, not at the bulb**, and
that one offset is what lets every part of the lamp cast for the moon.
A light inside the shade has the shade's own inner wall in front of it,
so either the shade casts and the pool is entirely shadowed, or the
shade does not cast and loses its moon shadow too — `castShadow` is per
object, not per light. Outside the rim the whole fixture is *behind*
the light and neither trade has to be made.

The spot's `bias` is 0 and `normalBias` 0.015, for the reason the
moon's is: VSM compares a depth against a variance-bounded estimate, so
a constant offset leaks light out from under contacts. 51° over 1024
texels at a ~3-unit throw is a texel of ~0.007, and this is two of
them.

**What that shadow actually falls on is the desk top**, and the A/B
is worth knowing because the first guess was that it falls on nothing.
`node _lampshots.mjs aim` flips `castShadow` and shoots the pair:
without it the lamp lights the **centre drawer front and the apron**
through six-tenths of a unit of solid walnut. The whole-frame
histogram moves by one level either way — a shadow is a local thing and
that statistic cannot see it — so the shot pair is the evidence, not
the number.

#### The shade is tilted, and that is a visibility decision

The camera looks **down** at 20°, so a shade hanging mouth-down shows
nothing but its outside — the emissive inner wall and the bulb, which
are most of what says the lamp is lit, would never be in shot. The
shade therefore leans, forward toward +Z and toward +X.

**The two angles were swept, not chosen**, through
`window.__lamp({ tilt, swing })` off one page load — they decide three
things at once (how much of the lit inside the camera sees, where the
pool falls, and whether anything stands in the beam), so they could not
be set one at a time. `node _lampshots.mjs aim` re-runs it.

At the first pair, **45° / 18°**, the beam landed at world (-5.95, 1) —
bare walnut three units short of the keyboard, with the keyboard
picking up only 21 levels. At the shipped **50° / 24°** it lands at
(-5.11, 0.69), so the pool runs from the fixture to the keyboard's left
end (58 unlit to 92), and the mouth turns far enough toward the camera
to show the bulb inside it. Past about 55° the pool is a broad wash in
the middle of the desk and stops reading as *this lamp's*.

Three figures were moved once after looking at the fixture from the
**ends of the orbit leash** rather than only from home, and the second
is the one that would not have been found any other way:

- **the bulb is hotter than the wall behind it** (5.5 against 1.7). At
  4.5/2.2 the mouth was one flat white blob with no filament in it.
- **the outer shade's emissive is 0.07, down from 0.18.** At the left
  clamp the mouth faces away and nothing else reaches the back of the
  cone, so that term was the *only* one on those fragments and the
  shade read as a flat tan kite cut out of paper.
- **the fitter stands entirely above the cap**, rather than straddling
  it. At a 45° tilt the mouth shows a good deal of the shade's own
  ceiling, and a collar hanging through it read as a dark bar across
  the lit inside.

`aimLamp` in lamp.js is that handle. It re-poses the shade and reports
where the beam meets the plane the lamp stands on — which it finds from
the lamp's **own origin's** world y, so it never has to be told how
tall the desk is. Moving the light is the one change in this scene that
invalidates the frozen shadow map, and `window.__lamp` is the only
place outside `window.__lights` that sets `needsUpdate`.

#### Where it stands

`LAMP_X` / `LAMP_Z` are **(-7.0, -3.6)**, and the depth is the figure
that was tuned. Screen x runs roughly `0.8x - 0.6z` at this azimuth, so
pushing an object *back* walks it screen-**right** — the opposite of
what "back left" suggests, and the reason the depth is the interesting
half.

**`LAMP_X` was -7.6 and moved +0.6 for `LAMP_SCALE`**, which is worth
understanding before moving it again, because the thing that forced it
is not geometry. At 1.75 the fixture's world box ran x -9.99..-5.21
against a walnut edge at -9.75 — **0.24 over the edge**. The part
hanging off was the **painted contact shadow**, a square of
`BASE_R * 3.1` that scales with the group, not any part of the lamp:
the base disc itself was still 1.1 clear. But a contact blob off the
edge of the desk is a grey patch in mid-air, which is the exact defect
painted shadows exist to avoid, so it binds. At -7.0 the margin is
**+0.36**.

The move is +x, which walks the fixture screen-*right*, toward the
machine — so it was the direction that had to be checked rather than
assumed, and `_lampbig.mjs` is what checked it. There is no cheaper
direction: both +x and -z go screen-right at this azimuth, and -x is
the edge that was already over.

Measured at 1.75 with `_lampshots.mjs` and `_lampbig.mjs`: **0.36 clear
of the walnut's -x edge, 0.89 of the back edge, and 0.51 in x from the
computer kit's own box** (against 0.79 / 1.92 / 2.14 at the old size).
The kit figure is the slackest of the three despite being the smallest
number — the kit's x extent is the mouse's painted shadow, which sits
at the desk's *front*, while the lamp is at the back, so the two are
separated in z and never meet.

**Nothing occludes the monitor, and that is checked on rays rather than
on boxes.** `_lampbig.mjs` walks a 15x15 grid over the glass, the kit's
projected box and the lamp's own, at home and at **both azimuth
clamps**, on both viewports, asking `window.__pick` twice per point —
once with the fixture present and once with its meshes on a layer the
raycaster does not test. Points where the two disagree are the
occluding ones. There are **zero** at every framing, and the glass
comes back "machine" at all 225 points of all six grids. The NDC boxes
*do* overlap at every azimuth and always did, which is why the box test
was not the one to trust.

**The pick precedence is unchanged and was re-checked at the new
size**: the centre of the glass picks `machine`, the upper shade picks
`lamp`, and a real pointer press on each does the one thing it should —
the shade toggles without flying in, the monitor flies in without
toggling.

It also stands **in front of the window, below the sill**, so the shade
is silhouetted against the night sky and the moon throws it across the
desk. **The moon's shadow box did not have to grow for the taller
fixture**, which was measured rather than assumed because the window
wall casts and a receiver outside the box is a patch of floor flooded
with moonlight: `window.__shadowfit()` now puts the lamp at lat
1.84..8.98, up -3.32..7.48, depth 20.57..31.18, and the union still
clears the camera by **1.53 or more on every face**.

The `kit ndc` figure `_lampshots.mjs` prints goes **negative**, and
that is expected rather than a failure: `__fit("computer")` is the
whole kit — keyboard, mouse and their painted contact shadows — and
those run far further screen-left than the CRT itself does.

#### Two figures the scale leaves outstanding

Both are reported rather than fixed, because fixing either means
changing something that was asked for.

- **It is now the tallest thing on the desk, which breaks the rule
  this file states for the treehouse.** `_lampshots.mjs` prints
  **8.10** above the desk top; that is the conservative
  `Box3.setFromObject` bound and the shade is a cone yawed 45°, so the
  fixture really tops out near **6.8** — still past the CRT's **6.60**.
  The rule was "nothing else on this desk may come up level with the
  thing a visitor has to find and press", and the lamp now does. It
  does not *occlude* the machine from anywhere on the leash (above),
  so what is at stake is competition for attention rather than a
  blocked target. The lever is `LAMP_SCALE`: about **1.60** brings the
  true top back under 6.25, the figure the treehouse was held to.
- **It reaches NDC y 0.91 at home and 0.92 at the right clamp** on a
  desktop frame, against 0.65/0.67 before. In shot, but with 8% of
  the frame to spare — and the precedent in this file is against that:
  the window's opening came *down* from 7.0 to 6.4 because its head
  landed at 0.95/0.97 and "3% is not a margin". On a phone the left
  clamp crops it, x0 **-1.13** against -1.00 before, which is the same
  trade the desk's own ends and the window take on a portrait
  viewport.

#### The switch

The state and the fade live in `scene.js`; lamp.js owns only the curve
from a 0..1 level to five brightnesses (two intensities and three
emissives), and `setLamp` is **linear** in that level. Same division
the fly-in draws between GSAP and `applyFly`, and for the same reason:
the easing can be re-shaped without touching what a lamp at 0.3 looks
like. It is also what let the strike below come back out without
touching lamp.js at all.

- **The fade is 0.4s and the two directions get different shapes.** On
  is `1-(1-p)²` — fast off the mark, settling into the last few
  percent, which is how a filament behaves. Off is `p²` — most of the
  way immediately, then a tail, which is a filament cooling. Both are
  linear in time, so the fade really is 0.4s rather than an exponential
  that never arrives.
- **There is no strike.** The lamp used to flicker on: a staircase of
  held multipliers over the on-ramp — up, out, up brighter, one hitch,
  full — multiplying the ease rather than replacing it, so the 0.4s
  arrival was unchanged and the flicker was a stutter *in the rise*.
  It was **removed on request**, and the one thing worth knowing is
  that it was the only non-monotonic term in the level: with it gone
  the two eases above are the whole story in both directions, and
  `window.__lamp().curve` is the ease alone — which is now also the
  check, since it should climb monotonically from 0 to 1. Putting one
  back means multiplying `applyLampLevel`'s argument again, not
  re-shaping either ease.
- **The exposure moves a little with the lamp, upward as it goes out.**
  With the lamp off the room loses its one warm source and ACES's toe
  takes the walls and floor back toward the void — the thing
  `TONE_EXPOSURE` exists to stop. Lifting the exposure 0.1 over a base
  of 1.3 as the lamp dies is dark adaptation. It is snapped to 0.02
  before being written, because the void's pre-image has to be
  re-solved whenever it moves (`applyVoidColor`) and a Newton solve per
  frame for 0.4s buys nothing. Five distinct values across the fade.

  `window.__lights({ exposure })` now sets the **base**, not the live
  value, or the loop would silently revert it the next time the lamp
  was switched.

- **The frozen shadow map is not broken by any of this.** Switching the
  lamp changes an *intensity*, and a shadow map carries occlusion, not
  brightness, so the lamp's frozen map is as correct at level 0 as at
  level 1.

#### One press never does two things

`pickTarget` raycasts the lamp and the machine in **one** call and
takes the nearest hit, with the lamp listed first so it wins a tie.
`window.__pick(x, y)` is the handle onto it, and `_lampbig.mjs` is what
reads the precedence off a grid rather than off two sample points.
Testing the lamp first and returning would toggle it *through* the
monitor from the azimuths where it sits behind the machine; taking the
nearest means a press can only ever be one of the two, which is the
property that actually matters. The decision is recorded on
`pointerdown` as `press.target` — "lamp", "machine" or null — for the
same reason the hit always was: by the time the pointer comes up the
camera has moved.

Only the machine takes the screen's hover brightness. The cursor says
`pointer` over either, `grab` over the room. The lamp's painted contact
shadow is `raycast = () => {}`: left pickable it would make a patch of
empty walnut twice the fixture's own footprint toggle the light.

#### The hidden button

`#lamp-toggle` in `index.html` is the keyboard and screen-reader route
to the same `setLampOn`, so the two can never disagree; `aria-pressed`
is the state and is written on every toggle whichever route took it.
Three things about it:

- **It is outside `#desktop`.** The desktop chrome is `opacity: 0;
  pointer-events: none` until the sign-in, so a control in there would
  be unreachable for exactly the stretch in which the lamp is the only
  thing on the page to press.
- **It is `hidden` until scene.js unhides it**, like the drag hint:
  without WebGL there is no lamp, so there must be no switch for one.
- **`.visually-hidden` is the clip-rect form**, not `display: none`
  (which leaves the control out of the accessibility tree) and not
  `left: -9999px` (which scrolls the viewport sideways on focus in some
  browsers). It is hidden at every moment, including focus — that is
  what was asked for, and it means a sighted keyboard user gets an
  invisible tab stop.

#### Frame rate

**Not measured.** The lamp adds one static fixture and one more frozen
shadow map (1024², rendered once), and the fade writes five numbers for
0.4s per press — so there is no mechanism by which it should cost
anything per frame. `LAMP_SCALE` does not change that: a group scale
changes one matrix, and the geometry, the mesh count and the frozen
shadow map are all exactly what they were. Removing the strike takes
work *out* of the fade. But all of that is a prediction, not a reading,
and the rule on this branch is that a frame time without its A/B beside
it is worth nothing. Run `_perfcheck.mjs` if the number matters.

### The night lighting

**Four sources and nothing else**, and the fourth has a switch. The
daylight rig had five — a warm key, an `AmbientLight`, a hemisphere, a
studio HDRI and the tube — and the first two are *gone* rather than
dimmed. An ambient light is a flat lift with no direction in it, which
is exactly what a night room must not have: it is what makes a dark
scene read as a grey scene.

| | colour | intensity | what it does |
|---|---|---|---|
| moon | `#8FA3D8` | 5.5 | the only thing with a direction; casts |
| hemisphere | `#3A3560` sky / `#1C1A2A` ground | 30 | the bounce, and the only light on most surfaces |
| CRT spill | `#5FE3D4` | 8.5 × picture brightness | the keyboard and the walnut in front of it |
| desk lamp | `#FFB866` | 30.6 point + 95.2 spot × lamp level | the pool on the walnut, the shade, the keyboard's left end |

The lamp's two figures live in `src/lamp.js` rather than beside the
other three, next to the fixture whose geometry sets them — and they
are written there as `14.0 * LAMP_SCALE ** POINT_DECAY` and
`46.0 * LAMP_SCALE ** SPOT_DECAY`, not as the products above: the 14
and the 46 are what the pair was calibrated at, and the exponent is
what keeps the pool the same brightness as the fixture is re-scaled.
See "How big it is" for the measurement behind that — see "The
desk lamp" below for why there are two of them. Every figure in the
table is calibrated with the lamp **on**, because that is the state
the page opens in.

Intensities still read ~3x high because three divides by PI. What does
*not* carry over from the daylight rig is the target: those numbers were
set so lit ground landed on the old cream with its shadow at 0.72 of it.
There is no cream. These were set against the picture, through
`window.__lights`, which moves all four knobs on one page — four numbers
that only mean anything against each other cannot be bisected one build
at a time.

#### Aiming the moon through the window

A `DirectionalLight` has no position, only a direction, but "coming
through the window" is a statement about a **line**. Both ends are
derived: the opening's centre comes off `ROOM_PLAN.window`, which
room.js writes from the same two constants it cuts the hole with, so
moving the window re-aims the light instead of leaving it shining at a
wall; `MOON_AT` is where the beam is pointed.

**`MOON_AT` is the one figure here that was searched for rather than
tuned**, and the search is worth keeping because the answer is not
obvious. The window's centre is at y 12.6 and the desk top is at 9 only
3.2 units in from the wall, so:

- a beam shallow enough to run the length of a 32-unit room is already
  below the desk top before it has left the wall — it lights the
  pedestal's left flank and nothing else;
- a beam steep enough to land inside the room lands *on* the desk,
  and the desk's own shadow then covers every piece of floor beyond it.

Six aims were shot. Five lit no floor at all. The one that works goes
mostly **forward in +z rather than across in +x**: by the time it
reaches the desk's near edge it is already past it in depth, so it
crosses the desk top, clears the front edge and lands on the floor and
the rug. That is the pool in the shot. `_lightshots.mjs sweep` re-runs
all six.

The elevation that falls out is **36.5°**, much steeper than the
daylight key's 13°, and that is consistent rather than a compromise:
the moon is drawn high in the window's own sky texture.

#### The window wall casts, and only the window wall

room.js used to say *nothing in the room casts* — the key raked in from
outside the left wall, so a casting wall would have put the whole desk
in shadow, and "a dollhouse's light comes through its missing walls"
was the convention that bought the way out.

The night rig makes the opposite choice for exactly one panel. The
field around the opening is a real hole and the joinery casts too, so
letting the window wall cast is what turns the beam into a
window-shaped pool **striped by the sash and the two mullions**. It is
the single thing that makes the light read as coming from somewhere.

The right wall still does not cast and would wreck it if it did: the
light travels toward +z, so the -z wall is upstream of everything and
would shadow the whole room. It is a receiver — the far wall the beam
lands on.

Two consequences to know:

- **The frozen shadow map is now load-bearing in a new way.**
  `shadowMap.autoUpdate` is off and the map is rendered once, at the
  home framing, where the cutaway has the left wall visible. If it were
  ever re-rendered while the camera had swung round far enough to cull
  that wall, the room would flood with moonlight. `window.__lights({ at })`
  sets `needsUpdate` deliberately — it is a dev handle, and the only
  thing in the file that does.
- **The large pool on the floor at the flat end of the orbit is light
  passing *over* the wall, not through the window.** The wall is 19
  tall and the beam descends at 36.5°, so everything past x ≈ 12.7 is
  lit over the top of it. That is the dollhouse cut-away being exactly
  what it says it is, and it is load-bearing for "not pitch black" —
  it is most of the lit floor in the frame.

#### The shadow box, and the bias the brief asked for

`bias` stays **0** and must. VSM does not compare depths, it compares a
depth against a variance-bounded estimate; a constant offset there
shifts the whole distribution and shows up as light leaking out from
under contacts, not as the acne it would cure under PCF. What does the
work is **`normalBias`, 0.035**, which walks the sample along the
surface normal by a distance in *world* units — so the right figure is a
function of how much world a texel covers.

That changed, because the box did. `window.__shadowfit()` projects the
room, the desk, the machine and the treehouse into the light's own
basis and prints the union against the camera. The union is
**-14.0..29.3 across, -13.8..27.0 up, 15.0..60.8 deep**, and the box
clears it by about 1.5 on every face:

```
left -16  right 31   bottom -15.5  top 28.5   near 13  far 64
```

**Deliberately asymmetric** — the light comes in over one corner of a
room that is not square to it, so a box centred on the axis would spend
half its texels on empty space. 47 × 44 over a 2048² map is a texel of
**0.023 world units**, against 0.078 at the old ±80. `normalBias` 0.035
is about a texel and a half: under one the acne comes back at the
shallow end of the orbit, past about three the contact under the
monitor's base visibly detaches. That finer texel is why the drawer
fronts — 0.03-unit overlay steps, the surface that produced acne at 13°
— are clean under a light raking in at 36.5°.

A receiver outside this box is no longer merely unshadowed. The wall
casts, so it is a patch of floor flooded with moonlight that should be
dark. **Re-run `__shadowfit` after anything that moves the window, the
aim or the furniture**: the basis turns with the light, so those six
numbers do not survive a re-aim.

#### The exposure is a lighting control now

It was 0.95, set under the daylight rig as "a trim rather than a
correction", with a note that ACES's toe was the thing to watch when the
night lighting landed. It landed, and the toe is what had to be
answered: at 0.95 the room's median pixel read **4/255** and over half
of it sat under 8 — the walls and the floor were being crushed into the
backdrop, so the diorama had no edges.

**`TONE_EXPOSURE` is 1.3**, and it is not interchangeable with raising
the lights. The lights lift the bright albedos as fast as the dark ones
— and this room has exactly one bright albedo, the desk's enamel, which
goes white long before the floor comes up. The exposure lifts the bottom
of the curve, where everything dark actually lives. Both were swept
together; `_lightshots.mjs sweep` has the grid, including the two
single-knob rows that show neither alone gets there.

AgX is the honest alternative and was measured beside it: at 0.95 it
lands within a couple of levels of ACES at 1.9 everywhere, its toe being
gentler by about that much. ACES is what the restyle asked for, so ACES
is what is set and the exposure is what pays for its toe.
`window.__tonemap('agx')` still switches on a live page, and the void's
pre-image follows the exposure because it is solved numerically rather
than baked — `_roomshots.mjs` still reports err 0 on both paths at 1.3.

#### The HDRI is not one of the three, so it is off

`ENV_INTENSITY` is 0. It was first left at **0.1** "for the highlights",
on the assumption that so small a number could only be a reflection.
**That was wrong and the A/B caught it**: at 0.1 the studio HDRI was
still doubling the median room pixel (4 → 8) and lifting the walls from
3 to 7 — a fourth light quietly doing a third of the fill, in a brief
that says the room reads on three. So it is 0, `loadEnvironment` returns
before fetching, and the hemisphere was re-tuned afterwards to make up
the difference honestly.

What that costs is measurable and small: the desk's chrome pulls go from
79 to 54 and the CRT's glass from 127 to 107, so both still read as
highlights, just duller. `window.__lights({ env })` puts it back on a
live page — note it only does anything if `ENV_INTENSITY` was non-zero
at build, since otherwise there is no map to scale.

#### The tube, and its spill

The screen material's `emissive` is a **pale** teal (`#B8F2EA`) rather
than the spill's own `#5FE3D4`, and that was measured against the
fly-in rather than chosen by eye: the same map carries the bitmap of
the real login screen for the length of the flight, and at full
saturation the dialog, its title bar and its text all went teal — a
monochrome terminal, three seconds before the live HTML arrives in
colour. At this value the picture keeps its own hues and the whole tube
still reads teal. `emissiveIntensity` is up from 1.25 to 1.9: the tube
is one of three lights in the room now, not a bright object in a lit
one.

The `PointLight` in front of it used to warm the bezel and nothing else
— 2.1 over a 5.5 range at `decay` 2, which put the keyboard, 5.2 units
away, past the cutoff entirely. Three figures changed, and two are
deliberately unphysical:

- **`decay` is 1.25, not 2.** A tube is a 5×4-unit area source and this
  is a point; inverse-square put 75× more light on the bezel than on
  the keys, so the bezel blew out before the keys saw anything. At 1.25
  the ratio is about 8:1, roughly what the real area source would give.
- **The range is 11**, short where it matters: it dies about a unit
  before the desk's +x edge and never reaches the floor or either wall.
  It does graze the treehouse, which is correct — same desk, two units
  nearer than the edge.
- **It sits 0.9 in front of the glass, on the screen's own axis.**
  Dropping it toward the desk lit the keys harder but made the bezel
  glow asymmetric, and `recessShadowTexture` already describes where
  the lip shades the picture — two accounts of the same thing,
  disagreeing.

**scene.js owns what it runs at, computer.js owns where it is and how it
falls off.** The loop writes `SCREEN_GLOW × picture brightness` every
frame, but there is no loop under reduced motion and none before the
first tick, so `buildScene` writes it once as well. Left to computer.js's
constructed value the two paths would disagree the moment `SCREEN_GLOW`
moved, and the symptom would be a dim tube for exactly the visitors who
get a single static frame.

#### One thing turning the HDRI off broke

**The walnut is now the only asynchronous asset in the scene**, and
`TextureLoader.load` is fire-and-forget. On any path that draws a
single frame and stops — reduced motion — nothing noticed the three
512px jpgs arriving, and the desk top rendered in its base colour and
stayed there. That used to be covered *by accident*: `loadEnvironment`
resolved after a 128 kB HDRI, well after the jpgs, and re-rendered.
Turning the HDRI off took the re-render with it.

`buildDesk` now returns a `ready` promise alongside its root, settled
(on error as well as on load) when the three files have landed, and
scene.js draws one more frame on it. `_winshots.mjs`'s reduced pass is
what caught it — a reminder that the reduced-motion variant is not a
formality: it is the only path with no loop to paper over a late
asset.

#### What "moody but not pitch black" is, as a number

`window.__histogram()` reads the framebuffer back after a draw and
buckets the luma of every pixel that is **not the void** — the only
honest denominator, since most of a desktop frame is backdrop and
counting it would let any scene pass by being mostly empty. Shipped, at
home on 1440×900:

| | was (daylight trim) | night rig | at LAMP_SCALE 1.75 |
|---|---|---|---|
| median room pixel | 4 | 10 | **11** |
| p95 | 47 | 123 | **139** |
| share under luma 8 | 80% | 33% | **32%** |
| back wall | 0 | 9 | **9** |
| desk enamel | 95 | 168 | **168** |
| the keyboard, on vs off | — | 92 / 58 | **148 / 57** |

The third column is the bigger lamp with its falloff compensated (see
"How big it is"). The room's own statistics barely move, which is the
point: the lamp is a *local* light and a whole-frame histogram cannot
see one. What moved is the keyboard — the surface the beam is aimed
at — from a 34-level lift to a **91**-level one, because a longer throw
spreads the pool across more of it.

`window.__probes()` is the per-surface companion and `window.__pixel(u, v)`
reads one pixel by screen fraction — which is the one to use when the
question is "is that part of the *picture* black", because a world point
can quietly land on the wrong surface and report something true about
somewhere else. That mistake cost two rounds here.

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
16.7 / 20.6 worst / 0 janky, mobile 16.7 / 18.6 / 0. Re-measured again
after the desk went in, unchanged once more: desktop 16.7 / 19.2 / 0,
mobile 16.7 / 18.3 / 0. The desk is static geometry under a frozen
shadow map, so it costs one shadow pass at startup and nothing per
frame.

**After the treehouse, mobile is still a flat 16.7 median with zero
janky frames. Desktop is not, and the treehouse is not why** — this is
worth stating carefully because the obvious reading is wrong. Measured
A/B on one machine in one sitting (`_perfcheck.mjs ... desktop notree`
hides the model and re-measures), the treehouse costs about **1 ms a
frame**: 26.4 ms median flying in with it against 25.3 without. But
*both* arms sit far off the 16.7 above, and so does the current `main`
code with no treehouse in it at all — 24.0 / 22.7 at HEAD on the same
run. So the desktop regression is **pre-existing on this branch**, it
arrived with something between the desk and this work (the perspective
camera is the obvious suspect: it is the change that put a floor
running to the horizon in front of a full-screen GTAO pass), and it
wants its own investigation. Do not compare a frame time against a
figure written down weeks ago and call it a regression; the `notree`
A/B exists so the attribution can be made on one machine in one
sitting.

**That desktop regression did not reproduce after the model was
shrunk and the canopy rebuilt, and the paragraph above is left standing
anyway** — because the point it makes is about method, not about a
number. On the sitting that measured the new canopy, desktop ran 16.7 /
16.6 median (in / out) with the treehouse and 16.7 / 16.7 with
`notree`: zero janky frames either way, and the model is now inside
the noise rather than costing the ~1 ms it used to, despite carrying
roughly twice the blossom. Mobile is unchanged at a flat 16.7. Both
arms sitting at 16.7 on a machine where they previously sat at 25 is
itself the evidence that the earlier figure was the machine and not the
scene.

**Re-measured at `TREEHOUSE_SCALE` 1.76, and the `notree` A/B is what
the answer rests on.** Desktop **16.7 / 16.7**, mobile **16.7 / 16.7**,
zero janky frames in either direction on either viewport. The model was
free at 1.76; it has been free at every scale it has been given, which
is what a static model under a frozen shadow map costs.

**The scale is 1.1733 now and that figure has *not* been re-measured.**
It is left unmeasured deliberately rather than assumed away: a group
scale changes the instance matrices and nothing else — same 789
instances, same 64 meshes, same geometry, same frozen shadow map — so
there is no mechanism by which it could cost anything, and a *smaller*
model shades fewer fragments if it differs at all. But that is a
prediction, not a reading, and the rule on this branch is that a frame
time without its A/B beside it is worth nothing. If the number matters,
run `_perfcheck.mjs` with and without `notree` in one sitting.

That reading took two sittings and the first one is the lesson. At
1.21 the desktop arm measured **21.3 / 20.6 with 4 and 6 janky**, which
looks exactly like a regression — until `notree` in the same sitting
came back **21.3 / 21.2 with 3 and 6**, identical, and the whole scene
measured 16.6 again an hour later with a *larger* model in it. The
machine was busy. This is the second time that trap has been walked
into on this branch: **never read a frame time without the A/B beside
it**, because a number compared against one written down earlier
compares two machines as much as two scenes.

**Measured after the model was rebuilt as a brick build** — the canopy
voxelised onto the stud grid, the limbs stepped, the spare bricks added
— and it was free then too: **desktop 16.8 / 16.8 median (in / out),
mobile 16.7 / 16.7, zero janky frames either direction on either
viewport**, worst frame 27.4ms. Instance count came *down* with the
rebuild, from ~2,050 to ~790, because the canopy's interior cull more
than pays for the extra plate footprints; mesh count went up 51 to 64
for the same reason, and 64 static draw calls under a frozen shadow map
cost nothing per frame. One mobile zoom-out leg showed a single 321ms
outlier that did not reproduce on a second run — which is the harness,
the same way the headed-click hitch below is.

**Re-measured after the canopy was rebuilt as clumps on a fork tree,
and again after the whole model was rebuilt against the cherry-blossom
reference, and it was free then too.** The fork-tree rebuild roughly
doubled the blossom — ~1,380 flowers against ~700 — and came back 16.7
/ 16.7 median (in / out) with the model and the same with `notree`.
The reference rebuild — curve-driven trunk and roots, a three-stud
house, a flat cloud of ~1,030 flowers, ~2,050 instances in 53 meshes —
measured **desktop 16.6 / 16.7 median and mobile 16.6 / 16.7, zero
janky frames in either direction on either viewport**, worst frame
22.2ms.

Why more blossom is not more frame time: the canopy is ~1,030 flowers
in eight batches, so it adds instances rather than draw calls, and it
is static geometry under a frozen shadow map — one shadow pass at
startup and nothing per frame. The curve-built trunk and roots are the
same story: more pieces, but they land in the same handful of
`branch|WxD|colour` batches the limbs already use.

What got it to 16.7 in the first place,
in order of how much each was worth:

1. **The live HTML coming off the glass** — see "the still" above. This
   was nearly all of it.
2. **The shadow map is rendered once and frozen.** Nothing in the scene
   ever casts a different shadow: the light is fixed and nothing that
   casts one moves. `renderer.shadowMap.autoUpdate = false` plus one
   `needsUpdate = true` saves re-rendering a 2048² VSM depth pass with
   16 blur samples on every frame. **Anything animated back into the
   scene has to either not cast, or this has to be reverted.** Two
   thing already lives inside that rule: the orbit moves the *camera*,
   and a shadow map is in the light's space, not the camera's. The
   treehouse once had drifting petals, which were kept out of the
   shadow pass with `castShadow = false` for exactly this reason; they
   were removed, and the model is static geometry again.
3. **`MAX_DPR` is 1.5, not 2.** The scene shades through GTAO on a
   full-screen composite, so cost goes with the square of this; on a 2x
   display the difference is not visible on matt plastic and a blurred
   tube.
4. **`--scan` and `--blur` are snapped to a coarse grid mid-flight** —
   again, see above. Snapped while the camera is *orbiting* too, for
   the same reason: see `cameraMoving` under "Looking around".

A fourth thing: **`notree` as an extra argument hides the treehouse
before measuring.** An A/B on one machine in one sitting is the only
way to attribute a frame-time change to it — see "Frame rate" above for
why comparing against a figure written down weeks ago compares two
machines as much as two scenes.

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
- The environment map is an ambient light source, which is why it is
  now **off**: `ENV_INTENSITY` is 0 and `loadEnvironment` returns
  before fetching when it is, so the 128 kB HDRI is no longer
  requested at all. See "The night lighting" for the measurement that
  decided it — at the 0.1 it was first left at "for the highlights" it
  was still doubling the median room pixel. The asset stays vendored
  in `public/env/` with its licence; restoring it is one constant.
- GTAO runs through an `EffectComposer`, **desktop only** — it is the most
  expensive thing in the scene. `OutputPass` takes over the colour-space
  conversion the renderer would otherwise do, so the lighting calibration below
  holds on both paths.

`window.__scene`, `window.__camera`, `window.__composer`, `window.__fit`
and `window.__pick` are debug handles for the review scripts.
`__pick(x, y)` takes canvas CSS pixels and runs the **real**
`pickTarget` — so what it reports is the live precedence rather than a
restatement of it, which is what lets "does anything stand in front of
the monitor" be answered on rays. See `_lampbig.mjs`.

## Notes / known rough edges

- **Rule violation still outstanding:** `--font` in `src/style.css` asks for
  `'MS Sans Serif'` and `'Trebuchet MS'`, both Microsoft fonts. Nothing is bundled
  (it only resolves if the visitor already has them), but it breaks the no-MS-fonts
  rule and needs an OFL substitute. The vendored 98.css falls back to the same
  `--font`, so fixing it fixes the login screen too — there is one knob, not two.
  An OFL pixel face was fitted here and reverted on request; see "Typography" for
  what fitting one costs.
- The scene chunk is ~215 kB gzipped plus ~106 kB of walnut
  for the desk top, all lazy-loaded after the desktop paints. The entry chunk is still ~3.9 kB gzipped. The treehouse is ~8 kB of the scene chunk and no asset at all. GSAP accounts
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
