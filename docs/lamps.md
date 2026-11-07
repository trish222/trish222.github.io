# The desk lamp

Read this when touching the fixture on the desk's back-left corner, the
lamp switch, or the press precedence between the lamp and the monitor.

**The lamp is a swappable module, and `src/lamps/greenlamp.js` is the
one the room ships with** — a green glass banker's lamp. `src/lamp.js`,
the cone fixture that used to be it, is kept, still builds and still
satisfies the contract; it is reachable with `?lamp=lamp`.

It is **the only object in the scene a visitor can change**: pressing it
toggles the light, and so does a visually hidden button in `index.html`
for anyone without a pointer.

## The contract

A lamp module exports:

| | |
|---|---|
| `buildLamp()` | returns `{ root, shade, point, spot }`; origin on the **desk top** at the centre of the base, +Z the front, unyawed |
| `setLamp(level)` | 0..1 → every brightness the fixture has. **Linear in the level** — the easing lives in scene.js's loop, so the curve can be re-cut without changing what a lamp at 0.3 looks like |
| `aimLamp(...)` | re-aims and reports the pool, read off the **world matrices** rather than restated from the angles |
| `lampLevels(next)` | the dev readout `window.__lamp` drives |
| `disposeLamp()` | frees what `buildLamp` tracked |
| `LAMP_SCALE`, `LAMP_COLOUR` | the group scale and the warm tint |
| `LAMP_X`, `LAMP_Z` | **optional.** A module that names its own seat gets it; one that does not falls back on scene.js's constants. greenlamp names its own, because a different fixture is a different size and the x and z it has to stand at to clear the walnut's edges are its own facts |

scene.js calls all of it through one `lampMod` object rather than bound
imports. **That indirection *is* the interchangeability**: a call site
reaching past it would be the one place that quietly was not swappable.

**`?lamp=<name>` swaps the fixture in the real room, and it is dev
only.** The resolver sits behind `import.meta.env.DEV`, which Vite folds
to `false` at build, so rollup drops the branch and every module only it
reaches. Today that means **`src/lamp.js` is absent from production**,
not greenlamp. Verify it the way the perf meter is verified:
`npm run build`, then grep `dist/` for a marker only that module has
(`0x3d5a4e`, the cone's shade green — `lamp-shade` will not do, both
modules use it).

```
?lamp=lamp        the cone lamp (src/lamp.js)
?lamp=<name>      src/lamps/<name>.js
```

Because the flag is dev-only, anything exercising it runs against
`npm run dev`, not `npm run preview`. The `_*.mjs` lamp scripts take a
`SCENE_URL` env var for that.

**`lamp-lab.html` is the harness for one fixture on its own**, under the
room's night rig, without the desktop, the fly-in or the rest of the
scene: `lamp-lab.html?lamp=<name>&view=<view>`. Views are `home` (the
room's own 20-down / 37-round), `front`, `side` and `under` — the last
framing the shell's interior, which the other three cannot see into.
`&helpers=1` draws the spot's cone, the point's position and the
**shadow camera's frustum**, that last being the only way to see where
the near plane sits. It is not a `vite build` input, so none of it
reaches `dist/`.

The rig in it is **copied from scene.js, not imported** — importing
would drag in the computer, the desk, the treehouse and GSAP, and the
lab would be measuring all of them. Four numbers and an operator; if the
room is re-graded they have to be re-copied.

Readouts it adds that a screenshot cannot give: `window.__pool(y01)`
(on/off luma transect across a framebuffer row),
`window.__poolWorld(axis)` (the pool's width in **world** units along a
line through the beam's own aim point — read the `"x"` figure; the `"z"`
line runs under the base and its peak is the lit base, not the pool),
`window.__fit()`, `window.__aim(...)`.

## greenlamp: the green banker's lamp

A brass base, a turned lathe column, a short brass J-arm carrying a
shade rod, and a green glass trough clipped onto it. Local space matches
the desk's, the computer's and the treehouse's.

- **It tilts about its own long axis, where the cone lamp leans off its
  pole.** The shade is a horizontal trough: the long axis runs side to
  side parallel to the desk's front edge, the convex side up, the mouth
  down, and `SHADE_TILT` (12°, down from 20°) rolls it toward the front
  so the light goes where a banker's lamp's goes. The yoke it turns on
  is a child of `root`, not of `shade`, and the pivot is the centroid of
  the end-cap face.
- **Both ends are closed**, green outside and cream in, as a real cased
  shade's are. The open-ended trough the first version built showed its
  own lining end-on at the home framing, which reads as a cut pipe.
- **The shade is one 2D profile swept along the length**, with a
  curvature floor on the section so no point is sharper than the rest
  can carry, and the lip's pale line is banded into the `map` rather
  than the emissive: the rim is thick glass catching light, not thin
  glass passing it.
- **The glass glows green, not amber** (`GLASS_EMISSIVE`), modulated by
  a gradient map rather than applied flat. A warm lamp behind green
  cased glass comes out a warm yellow-green. A constant emissive over a
  whole shade is the one thing that reliably makes cased glass read as
  painted card.
- **The brass is `metalness: 1`, so its base colour is F0 rather than an
  albedo.** The earlier olive-browns were the right *apparent* colour at
  0.8, where a fifth of what you see is a diffuse term; at 1 there is no
  diffuse term and the olive would have given dark bronze. The brass
  carries **its own small drawn equirect `envMap`** — the scene's HDRI
  is off (see [lighting.md](lighting.md)), and a polished metal with
  nothing to reflect is black.
- **Proportions:** this shade spans **4.7 world units** against the cone
  shade's 3.5, and the whole fixture measures **5.9 tall against the
  cone lamp's conservative 8.1** on the same `Box3` bound. It is square
  to its own axes, so 5.9 is very nearly the true figure — which means
  it clears the CRT's 6.60 and does not break the rule that nothing on
  this desk may come up level with the thing a visitor has to press.
- **`LAMP_SCALE` is 1.4875**, a group scale on the root about its own
  origin, so the base stays flat on the walnut and the caller's
  placement does not have to know the scale exists.
- **`LAMP_X` / `LAMP_Z` are (-6.75, -4.35), and z did the work.** At
  scene.js's -7.0 the adjuster knob — solid brass, not a painted shadow
  — hung 0.16 past the walnut's -x edge. The obvious correction was +x,
  and swept against occlusion it made things *worse*: +x walks the
  fixture screen-right, toward the machine, and at the left clamp this
  lamp is tall enough to graze the CRT's silhouette. Moving it **back**
  is what clears it — over a 4x4 sweep the occlusion count fell to zero
  at every x once z passed about -4.2. So the seat is a small +x for the
  desk edge and a larger -z for the clamp, and the back edge pays:
  **-x edge 0.09, back edge 0.08**, both positive and both thin. There
  is no slack left in either.
- **The gap `_lampbig.mjs` prints to the computer kit is not a clearance
  and should not be optimised against.** It is a pure x-interval
  comparison, and the kit's -x extreme is the *keyboard's* painted
  contact shadow at the desk's front; this lamp lives around z
  -6.8..-1.9 and the two do not overlap in z at all. The real nearest
  thing in the lamp's own band is the CRT's bezel at x -3.25.

### Why there are two lights in one fixture

The brief asks for a warm `PointLight` under the shade **with soft
shadows**, and three 0.186 cannot give both at once: `WebGLShadowMap`
refuses VSM shadows for point lights outright and `continue`s, so
`castShadow` on one is a dead flag plus a console warning — and this
scene is on `VSMShadowMap` for the moon's penumbra. So:

- **the point light carries most of it**, not the spot. A trough shade
  is open along its whole underside *and* at both ends, so the honest
  shape for its light is a sphere with the top bitten out. It is what
  spills out of the two ends and lights the column, the arm and the desk
  either side.
- **the spot** adds the downward throw and the one soft cast shadow. It
  is wide and fully penumbral (74°, `penumbra` at its ceiling), so there
  is no hard edge anywhere in it, and it is cut to an oval by a drawn
  `SpotLight.map` cookie — a trough's pool is not round.

Both are `decay` well under 2 (1.35 / 1.25), for the same reason the
CRT's spill is: a lit shade is an area source and these are points, so
inverse-square blows the shade's own plastic out before anything a
hand's width away sees light.

**The intensities carry the falloff compensation explicitly** —
`15.0 * LAMP_SCALE ** POINT_DECAY` and `26.0 * LAMP_SCALE ** SPOT_DECAY`
— because a group scale moves the bulb further from the walnut and the
pool arrives dimmer by exactly that factor. The base figures are what
the pair was calibrated at; the exponent is what keeps the pool the same
brightness as the fixture is re-scaled. That compensation is also what
keeps the night rig honest: every figure in
[lighting.md](lighting.md)'s table is calibrated at `lampLevel === 1`.

A group scale reaches geometry and transforms and nothing else, so three
world-unit figures are multiplied explicitly: `distance` on both lights,
the spot's `shadow.camera.near`, and its `shadow.normalBias`.
`shadow.radius` is deliberately **not** scaled — it is a blur width in
texels, and a texel covers more world at a longer throw, so the penumbra
grows on its own.

## src/lamp.js: the cone fixture, no longer the default

Base, pole and an open-ended cone shade. Kept because it satisfies the
same contract and is the A/B for anything the green lamp does
differently.

- **`LAMP_SCALE` is 1.75**, `LAMP_X` / `LAMP_Z` come from scene.js's own
  constants at **(-7.0, -3.6)**.
- **The shade leans** — `SHADE_TILT` 50° forward and `SHADE_SWING` 24°
  toward +X — because the camera looks *down* at 20°, so a shade hanging
  mouth-down shows nothing but its outside and the emissive inner wall
  and bulb, which are most of what says the lamp is lit, would never be
  in shot. The pair was swept through `window.__lamp({ tilt, swing })`
  off one page load, because the two decide three things at once (how
  much of the lit inside the camera sees, where the pool falls, and
  whether anything stands in the beam). Past about 55° the pool is a
  broad wash in the middle of the desk and stops reading as *this
  lamp's*.
- **The spot sits 0.06 past the shade's mouth, not at the bulb**, and
  that one offset is what lets every part of the lamp cast for the moon.
  A light inside the shade has the shade's own inner wall in front of
  it, so either the shade casts and the pool is entirely shadowed, or
  the shade does not cast and loses its moon shadow too — `castShadow`
  is per object, not per light.
- **The bulb is hotter than the wall behind it** (5.5 against 1.7); at
  4.5/2.2 the mouth was one flat white blob with no filament in it. The
  outer shade's emissive is **0.07**: at the left clamp the mouth faces
  away and nothing else reaches the back of the cone, so that term was
  the *only* one on those fragments and the shade read as a flat tan
  kite cut out of paper.
- **It breaks the height rule.** The conservative `Box3` bound is 8.10
  above the desk top; the shade is a cone yawed 45°, so the true top is
  near **6.8** — still past the CRT's 6.60. It does not *occlude* the
  machine from anywhere on the leash, so what is at stake is competition
  for attention. About `LAMP_SCALE` 1.60 brings the true top back under
  6.25, the figure the treehouse is held to. This is the main thing the
  green lamp fixes.

## The switch

The state and the fade live in `scene.js`; the lamp module owns only the
curve from a 0..1 level to its brightnesses, and `setLamp` is **linear**
in that level. Same division the fly-in draws between GSAP and
`applyFly`, and for the same reason.

- **The fade is 0.4s and the two directions get different shapes.** On
  is `1-(1-p)²` — fast off the mark, settling into the last few percent,
  which is how a filament behaves. Off is `p²` — most of the way
  immediately, then a tail, which is a filament cooling. Both are linear
  in time, so the fade really is 0.4s rather than an exponential that
  never arrives.
- **There is no strike.** The flicker-on staircase was removed on
  request. It was the only non-monotonic term in the level, so
  `window.__lamp().curve` should now climb monotonically from 0 to 1 —
  which makes a dip in it a bug rather than a feature. Putting one back
  means multiplying `applyLampLevel`'s argument again, not re-shaping
  either ease.
- **The exposure moves a little with the lamp, upward as it goes out.**
  With the lamp off the room loses its one warm source and ACES's toe
  takes the walls and floor back toward the void. Lifting the exposure
  0.1 over a base of 1.3 as the lamp dies is dark adaptation. It is
  snapped to 0.02 before being written, because the void's pre-image has
  to be re-solved whenever it moves (`applyVoidColor`) and a Newton
  solve per frame for 0.4s buys nothing.
- **The frozen shadow map is not broken by any of this.** Switching the
  lamp changes an *intensity*, and a shadow map carries occlusion, not
  brightness.

## One press never does two things

`pickTarget` raycasts the lamp and the machine in **one** call and takes
the nearest hit, with the lamp listed first so it wins a tie.
`window.__pick(x, y)` is the handle onto it. Testing the lamp first and
returning would toggle it *through* the monitor from the azimuths where
it sits behind the machine; taking the nearest means a press can only
ever be one of the two, which is the property that actually matters. The
decision is recorded on `pointerdown` as `press.target` — "lamp",
"machine" or null — because by the time the pointer comes up the camera
has moved.

Only the machine takes the screen's hover brightness. The cursor says
`pointer` over either, `grab` over the room. The lamp's painted contact
shadow is `raycast = () => {}`: left pickable it would make a patch of
empty walnut twice the fixture's own footprint toggle the light.

**Nothing occludes the monitor, and that is checked on rays rather than
on boxes** — see `_lampbig.mjs` in [scripts.md](scripts.md). The NDC
boxes *do* overlap at every azimuth and always did, which is why the box
test was not the one to trust.

## The hidden button

`#lamp-toggle` in `index.html` is the keyboard and screen-reader route
to the same `setLampOn`, so the two can never disagree; `aria-pressed`
is the state and is written on every toggle whichever route took it.

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

## Frame rate

**Not measured.** The lamp adds one static fixture and one more frozen
shadow map (1024², rendered once), and the fade writes a handful of
numbers for 0.4s per press — so there is no mechanism by which it should
cost anything per frame. But that is a prediction, not a reading, and
the rule on this branch is that a frame time without its A/B beside it
is worth nothing.
