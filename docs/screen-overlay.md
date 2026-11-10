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

- **The box is sized from JS, not CSS.** `SCREEN_BASE_W` (900) and the
  height derived from it (688) are the denominators of the transform,
  and `offsetHeight` rounds to whole pixels. The base width is **the
  machine's resolution**: what the login is set at, what the whole
  desktop is laid out at, what the still is rasterised at, and the one
  knob for how big any of it reads. Smaller is bigger, because the box
  is scaled onto the glass — it came down from 1200, which magnifies
  everything by a third and lands the box within a tenth of 1:1
  against the pixels it occupies at the arrival (~981 wide on a
  1440x900 viewport), which is as sharp as a scaled box gets.
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
sitting at the machine, and `applyFly` derives the entire
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
  overlaps the tail of the move. It fades the live HTML overlay in over
  the still beneath it and scales the page the last 1.5% up to its
  resting size, so the arrival settles rather than popping. It used to
  dissolve the canvas too; it no longer touches it — see "what the
  arrival frames" below.

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
bounce.

### What the arrival frames

**The flight stops with the monitor still in shot.** `screenFrustum` is
the frame height at the glass, and it is `ARRIVE_PAD` (1.2) times the
height needed to *contain* the glass — so the login keeps about 83% of
the frame's height and the bezel, plus a little of the case and the
wall behind it, sits around it. It used to be `min` of the two fits,
which is "cover the viewport": the panel was cropped on all four sides
and the arrival read as a page rather than as a machine.

Two things follow from that, and they are the whole of the change:

- **The canvas is no longer faded out by the crossfade.** It is the
  only thing drawing the bezel, so dissolving it would leave the login
  on bare teal — the exact framing the pull-back exists to avoid. The
  hand-over is still a crossfade, of the picture on the glass alone:
  the still underneath and the live overlay on top are the same login
  at the same place. The canvas does not go out at the sign-in either
  any more — the desktop arrives *on the glass*, so the monitor has to
  stay in shot around it. The one place it still fades is the narrow
  viewport's break-out, on a CSS transition off `body.signed-in`, which
  is why nothing writes its opacity inline.
- **A frame parked at the screen is a frame that must stay valid.** The
  rAF loop still stops drawing at `fly.value === 1` — nothing in shot
  moves, and that is most of what the arrival costs — so whatever
  invalidates that frame while the login is up has to draw one itself.
  `onResize` is the case that exists: `setSize` reallocates the drawing
  buffer, and before this the blank frame that left was invisible.

**Narrow viewports keep nearly all of it.** A portrait frame containing
a 4:3 panel's width would leave the glass about a third of the frame,
and the login with it, so there the *height* alone is fitted and padded
by `ARRIVE_PAD_MOBILE` (1.06): a sliver of bezel top and bottom, the
sides of the panel off frame. The glass keeps ~94% of the height.

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

**The Win98 desktop is behind the login and on the same glass.** Its
chrome — `#screen-shell`, holding the icons, the windows, the taskbar
and the Start menu — is a sibling of `#screen-page` inside the overlay
box, `opacity: 0` and `pointer-events: none` until `signed-in` lands on
the body, which the login form's submit handler in `main.js` does. That
covers the two states it used to be visibly wrong in: overlaid on the
establishing shot of the 3D room, and showing through the login once
the camera had arrived.

**Signing in moves nothing.** The camera is already parked at the
screen and stays there for the whole session: the desktop comes up in
the screen rectangle, at the arrival's framing, with the bezel and a
little of the case around it — the login's framing exactly, because it
*is* the login's framing. The stylesheet crosses the shell over the
dialog in 0.45s and takes the dialog's `visibility` away on a delay
behind it, so the form leaves the tab order once it is out of sight.
`#scene` keeps drawing the room the whole time; it is the only thing
drawing the monitor the desktop is sitting in. Start ▸ Log Off reverses
it, which is also what makes the state testable.

That replaces a second camera move. The sign-in used to push in from
the bezel framing until the glass covered the viewport (`dive`,
`coverFrustum`, ~0.9s) and then hand over to a desktop that took the
whole page. Everything it needed is gone: `applyPose` is `applyFly`
again, `cameraMoving` has one parameter to watch, the still is only
ever the flight's, and `CAM_NEAR` has nothing closer than the arrival
to clear.

Three consequences elsewhere:

- **The desktop is laid out at the box's size, not the viewport's.**
  `#desktop` is `SCREEN_BASE_W` wide and 40px of taskbar short of
  `SCREEN_BASE_H` — 900 x 648 — and the window manager's every figure
  is a percentage of that. It is live DOM under a matrix, not a scaled
  bitmap: the browser lays the desktop out at 900 and rasters it
  *through* the transform, which is why `body.screen-focused #screen`
  drops the `will-change: transform` the flight needs. Promoted, the
  subtree would be rastered at its own scale and resampled by the
  compositor, which the box being slightly magnified now would show.
- **A drag is the one interaction that needs the transform spelled
  out.** Hit-testing, hover, focus, wheel and caret placement all go
  through a CSS transform on their own; a drag reads `clientX`/
  `clientY`, so `glassPoint` in main.js divides the travel by the box's
  current scale. See [desktop-ui.md](desktop-ui.md).
- **Under `MOBILE_BP` the desktop breaks out of the glass.** There the
  arrival fits the glass's *height* alone (`ARRIVE_PAD_MOBILE`) and the
  4:3 panel runs off frame sideways, so a desktop mapped onto it would
  be two thirds off screen. On those viewports the sign-in gives it the
  page instead and fades the canvas out behind it — `glass-cropped` on
  the body, written from `isMobile` on every resize, with
  `screenBrokenOut` standing the matrix down so `inset: 0` means
  something. The camera still does not move, and Log Off puts the
  desktop back on the glass.

And one that did not change: **no WebGL has a way in.** The monitor was
the only route to the login, so a visitor without WebGL would have
reached nothing at all. `initWithoutScene` adds `no-scene` to the body
and unhides `#screen`, and the CSS drops its transform and lets it fill
the viewport: the same login with no room around it, the same sign-in,
and the same desktop — which, with the box over the whole page, is the
break-out's layout arrived at from the other direction. The CRT
variables go to their "arrived" values there, so there are no scanlines
on a tube that is not in the picture.

## The way back to the room

**Three routes out, one move.** All of them call `flyFromScreen`, which
reverses the flight's own timeline — so the way back is the way in run
backwards, with the same still on the glass and the same crossfade, and
reduced motion gets `jumpFly(0)` instead.

- **A click on the room around the screen.** The canvas takes pointer
  events while `screen-focused` (and only then, and never on the
  phone's full-page desktop), so "outside the screen" needs no geometry
  of its own: `#screen` is painted over the canvas and takes its own
  clicks first, and what reaches the canvas is by definition the bezel,
  the case, the desk, the lamp or the wall. The press goes through the
  **same** `initCanvasPress` handler the fly-in does, with the same
  `CLICK_SLOP`: both ends of the gesture outside the glass, no more
  than 5px apart. A drag anywhere is not a click, and a drag that
  starts inside the desktop — pulling a window past the screen edge —
  never reaches the canvas at all, because the title bar captured the
  pointer on the way down. The canvas captures the room press for the
  same reason, since OrbitControls is disabled here and takes no
  capture of its own; `overScreen` then rejects a release that drifted
  onto the glass.
- **Escape**, unless something on the desktop is open: `dismissChrome`
  in main.js closes the Start menu and reports that it took the press,
  which is the 98 behaviour and the same rule a click follows —
  `canLeaveScreen` refuses while `menu-open` is on the body.
- **The "Back to the room" button**, `#screen-back-bar`, fixed in the
  top-left corner outside `#screen` and on screen for as long as
  `screen-focused` is. It is the only one of the three a keyboard or a
  screen reader can reach, which is why it is there; on the phone's
  full-page desktop it and Escape are the only two that exist.

**The session survives the trip.** Nothing about leaving logs anyone
out: `signed-in` stays on the body, the desktop stays on the glass with
its windows where they were, and pressing the monitor again lands back
on it rather than on the login (`arrive` leaves the focus alone when
someone is signed in — there is no field to put it in and a desktop
they left open is not ours to re-focus). Ending a session is
Start ▸ Log Off, which is a thing you mean rather than a thing you
escape. `orbitAllowed` is `fly.value === 0` and nothing else for the
same reason: a signed-in visitor can stand back and swing the camera
around the room with their desktop glowing on the monitor.

The still follows all of this. `stillLayer` rasterises whichever of the
two layers is up, so the bitmap on the tube during the flight out is
the *desktop* when the desktop is what is showing — and because a
`<foreignObject>` can reach the network no more than it can fetch a
font, every icon in it is inlined as a `data:` URI first and cached by
URL. What keeps it current is a `MutationObserver` on `#screen-shell`,
debounced by `STILL_SETTLE_MS` so that dragging a window costs one
raster rather than one a frame, and deliberately deaf to the clock.

## Handles

`window.__flyTo(t)` parks the flight at a point of the **timeline** and
draws it — the way to tune the head-on framing without trying to catch
it mid-animation. It seeks the real timeline, so what it shows is what
the flight shows there: the login bitmap on the glass, the crossfade,
the body classes and all. It takes timeline progress, not the geometric
parameter; the two differ by `power3.inOut`. The arrival logs its
position, target and frustum height.
