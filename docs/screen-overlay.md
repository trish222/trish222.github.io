# The screen: the live page on the glass, the fly-in, the sign-in

Read this when touching the CRT's picture, the overlay transform, the
fly-in timeline, or the hand-over into the Win98 desktop.

## The live page on the glass

**The CRT's picture is real HTML, not a texture.** `#screen` in
`index.html` is a plain DOM box holding a Windows 98 login dialog
(98.css, see [desktop-ui.md](desktop-ui.md), over `--desktop` teal);
`updateScreenOverlay` in `scene.js` lays it onto the screen plane with a
CSS transform every frame.

**The camera is a pinhole, so the image of that plane is a
homography.** The quad keystones, and the three projected corners that
used to determine the transform exactly no longer do. All four are
projected and the 3x3 that maps the box onto them is solved in closed
form (Heckbert's construction for the unit square — for a *rectangular*
source the unknowns separate), then written as a `matrix3d` carrying the
perspective row.

`quadTransform` collapses to the old 2D `matrix()` whenever the quad is
a parallelogram, and takes that branch deliberately rather than letting
the w row sit at floating-point noise: head-on and centred is the one
framing where the perspective camera and the orthographic one agree, so
the transform at rest on the login is the same string this wrote before
the camera changed, down to the digits.

`projectCorner` returns false for a corner at or behind the eye —
`project()` divides by w, so such a corner comes back as a large finite
number rather than as an error. Nothing on the leash puts the glass that
close, but the failure mode is a login smeared across the viewport.

Three other things there are less obvious than they look:

- **The box is sized from JS, not CSS.** `SCREEN_BASE_W` (1200) and the
  height derived from it are the denominators of the transform, and
  `offsetHeight` rounds to whole pixels. The base width also sets how
  big the dialog lands once the page has the viewport: at 1200 it is
  near its natural size on a desktop viewport, so the arrival does not
  read as a blown-up screenshot.
- **It is mapped inside the overscan, not onto the whole panel.** The
  bezel lip overhangs the glass by more than the opening's lateral
  clearance, so at the isometric camera it clips about 1.5% off the left
  edge — enough for the overlay to spill onto the plastic. `OVERSCAN` in
  `computer.js` is the black border `drawPicture` already draws; sitting
  inside it keeps the live HTML clear of the lip *and* lets the real
  tube's overscan frame it.
- **Scanline pitch and blur are divided by the current scale.** They are
  authored in the box's own pixels but want to be constant in device
  pixels; at the isometric framing the box draws five times smaller than
  it is. The blur is the same point `screenTexture` makes — a crisp
  bitmap on the glass looks like a screenshot pasted onto a render. Both
  fade out as the camera arrives, along with the vignette and the recess
  shadow in `.crt-fx`.

**`screenFacing()` takes the overlay off the glass when it is edge-on.**
It is the screen's own normal against the line of sight *to the glass* —
the camera's position against the screen's centre, not the view
direction, which was the right question only for an orthographic camera
(with a pinhole the two differ by up to half the FOV, and it is the ray
that actually reaches the glass that decides). `FACE_MIN` is 0.17, about
80° off the normal: past 90° the plane projects to a *mirrored* quad and
the matrix would fold the login inside out. **The leash reaches this
now**, which it did not while a ±60° cap off the monitor's front stood in
front of it: the azimuth is clamped off the room's walls, so the
right-hand end of the swing is the -Z wall at about +88° and the glass
goes edge-on around +80°. The last few degrees of that swing therefore
hand the picture to the baked still, which is a working part rather than
a guard. It and the still share `syncScreenVisibility`, so neither can
clear the other's hiding.

## The fly-in

**It is one parameter.** `fly.value` is 0 at the establishing shot and 1
with the page filling the viewport, and `applyFly` derives the entire
camera pose from it — so a resize part-way through re-derives the
framing instead of losing it. `applyFly(0)` reproduces the isometric
pose exactly; that is the only definition of it. `applyFly` is
**linear** in its parameter: the easing lives on the timeline, so
`__flyTo` and the spline both work in geometry rather than in time.

**What drives it is one paused GSAP timeline**, built once by
`buildFlyTimeline`. `play()` flies in, `reverse()` flies out along the
identical eased curve — so the back animation *is* the forward one run
backwards rather than a second implementation that can drift. It carries
two tweens, both on a plain proxy object read in `onUpdate` rather than
GSAP writing camera properties directly:

- **the move**, 1.6s on `power3.inOut`;
- **the crossfade**, 0.3s on `power1.inOut`, starting at 1.3s so it
  overlaps the tail of the move. It fades the canvas out, fades the live
  HTML overlay in, and scales the page the last 1.5% up to its resting
  size, so the arrival settles rather than popping.

GSAP owns the timing; `applyFly` owns the pose. Keep it that way: the
curved path means position is sampled off a spline rather than
interpolated between two values, and a mid-flight resize has to be able
to re-derive everything from `fly.value`.

`gsap.ticker.lagSmoothing(250, 250)` is set deliberately. GSAP's default
(500ms counted as 33ms) protects the animation at the cost of wall-clock
time — on a software renderer it stretched this 1.6s flight past 30
seconds. 250/250 reproduces the `Math.min(dt, 0.25)` cap the old
hand-rolled loop used: a machine that cannot hold 4fps should arrive
promptly rather than sit through a long flight.

**The camera follows a CatmullRomCurve3, not a two-phase blend.**
`buildFlyPath` fits three curves — position, look-at target, and
log-frustum — through four poses sampled off the old two-phase path at
`FLY_KNOTS`, so the arc it was art-directed into survives the rebuild.
`samplePose` is that old path, kept solely as the knot source.

All three curves share one parameterisation, which is what keeps
position, target and zoom locked to each other. The frustum is a curve
too, carrying `log(height)` in `x` — reusing three's Catmull-Rom for it
guarantees identical parameterisation where a separate scalar easing
would drift, and log space matters because the frustum height *is* the
zoom, so lerping it linearly lurches. It is clamped to its endpoints: a
frustum that dips below the final height and comes back reads as a
bounce. `screenFrustum` uses `min`, not `max`: the screen is 4:3-ish and
the viewport rarely is, so "fills the viewport" means cropping the other
axis rather than letterboxing it.

`FLY_TENSION` is 0.42 rather than three's default 0.5 — slacker, so the
curve bows a little more gently through the knots.

**The three poses the path is built from all moved when the machine went
up onto the desk, and none needed hand-editing.** The establishing shot
is `ISO_TARGET`; `MONITOR_TARGET` is written as `DESK_TOP_Y + MON_Y` at
`COMPUTER_Z`, because `MON_Y` is in the machine's own space; and the
arrival is `SCREEN_TARGET`, read off the screen mesh's world matrix.
Nothing in the spline, the timeline or the overlay transform is aware
the desk exists.

Three things have to be given up along the way:

- **GTAO fades out over the first 30%.** Its radius is in world units,
  tuned against a frame that sees 18 of them; six times closer in it
  blotches the bezel instead of sampling creases.
- **The canvas stops at the taskbar**, so the 40px the taskbar vacates
  would show the bare teal WebGL-fallback `body` against the room.
  `body.screen-active` carries `--scene-void` through there instead and
  crosses to teal on `--scene-fade`. `--scene-void` has to match `VOID`
  in `src/room.js`. That hand-over tracks the **zoom**, not the
  crossfade, and is held until `fly.value` passes 0.7: the floor is out
  of shot long before the canvas starts to dissolve, and mixing on the
  crossfade leaves a visibly lighter band under a screen that has
  already gone teal. It is snapped to 5% so most frames rewrite the same
  string and cost no style invalidation.
- **The live HTML comes off the glass for the length of the move** — see
  below.

## The still, and why the live overlay stands down mid-flight

The picture during the flight is a **bitmap of the login drawn into the
3D screen texture** (`setStill` / `clearStill` in `computer.js`), not the
live DOM overlay. The overlay is hidden — `visibility: hidden`, set
inline, because an element at `opacity: 0` is still painted — and fades
back in over the crossfade. Both show the same login at the same place,
so the hand-over has nothing to give away.

This is purely about raster cost, and it is the single largest win in
the whole animation. `#screen-page` carries a blur filter and `.crt-fx`
three gradients plus an inset box-shadow; the CSS transform rescales the
box every frame, and the compositor cannot reuse a raster across a scale
change. Measured: **~57ms a frame flying out on a 390x844 viewport**.
Moving the picture into the texture takes the move to a flat 60fps in
both directions on both viewports. Two things that did **not** work, so
they need not be tried again: replacing the subtree with a single `<img>`
of the same bitmap (~45ms frames — an `<img>` with a filter still forms
its own render surface), and dropping the filter and the box-shadow (no
measurable change).

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
  onto the wrapper**, since the SVG renders as an image with no access
  to the parent document or the network, and `:root` inside it is the
  `<svg>` rather than the `<html>` the selectors expect. Styles are
  collected from `document.styleSheets` rather than imported, so it
  keeps working whatever Vite does to the CSS between dev and build.
  **Fonts cannot be fetched from in there either**, so the dialog
  renders in the local fallback of `--font` — fine only because `--font`
  is itself a local stack. Give the chrome a webfont and the still and
  the live overlay set the same dialog in two different typefaces,
  swapping at the exact moment the still exists to paper over; the fix
  is to fetch the face once and append it as a `data:` URI `@font-face`
  after the collected CSS, and to copy `word-spacing` and
  `-webkit-font-smoothing` onto the wrapper.

It is drawn in idle time after init and refreshed on `input` (and on
`depart`, since the form may have been typed into), never on the click —
a few milliseconds of rasterising is a visible hitch if it lands on the
first frame of the move. Every failure path leaves `stillCanvas` null
and the flight then shows the abstract desktop picture instead, with the
login arriving on the crossfade. `canvas.toDataURL` is called purely to
detect tainting early, where it would otherwise surface later as a WebGL
security error on upload.

`--scan` and `--blur` are still written on `#screen`, but **snapped to a
coarse grid while the camera moves** (`BLUR_STEP`, `SCAN_STEP`). They
feed a filter and three gradients, so every distinct value costs a
raster; the steps are invisible under motion and resolve exactly at
rest. `--zoom` stays per-frame — it only drives opacity on a layer
promoted with `will-change`.

Body classes carry the state to CSS: `screen-active` for the whole trip,
`screen-zooming` only while the camera moves, `screen-focused` once it
has arrived. `prefers-reduced-motion` gets the destination without the
journey.

## The sign-in gate

**The Win98 desktop is behind the login, not beside it.** Its chrome —
icons, windows, taskbar, Start menu — is `opacity: 0` and
`pointer-events: none` until `signed-in` lands on the body, which the
login form's submit handler in `main.js` does. That covers the two
states it used to be visibly wrong in: overlaid on the establishing shot
of the 3D room, and showing through the login once the camera had
arrived.

Signing in is a pure DOM hand-over, not another camera move: the camera
is already parked at the screen and the canvas already faded out, so
`#screen` and its back button go to `display: none` (not opacity — it is
a 1200px box under a transform and would keep taking the clicks) and the
teal desktop behind them is what is left. Start ▸ Log Off reverses it,
which is also what makes the state testable.

Two consequences elsewhere:

- **`#desktop` is `100vh` until the sign-in**, because the taskbar that
  the usual `100vh - 40px` reserves for is not there yet; at the old
  height the strip showed bare body under the room.
- **No WebGL has a way in.** The monitor was the only route to the
  login, so a visitor without WebGL would have reached nothing at all.
  `initWithoutScene` adds `no-scene` to the body and unhides `#screen`,
  and the CSS drops its transform and lets it fill the viewport: the
  same login with no room around it, and the same sign-in to the same
  desktop. The CRT variables go to their "arrived" values there, so
  there are no scanlines on a tube that is not in the picture.

## Handles

`window.__flyTo(t)` parks the flight at a point of the **timeline** and
draws it — the way to tune the head-on framing without trying to catch
it mid-animation. It seeks the real timeline, so what it shows is what
the flight shows there: the login bitmap on the glass, the crossfade,
the body classes and all. It takes timeline progress, not the geometric
parameter; the two differ by `power3.inOut`. The arrival logs its
position, target and frustum height.
