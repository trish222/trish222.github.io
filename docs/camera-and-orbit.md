# The camera, and looking around

Read this when touching `src/scene.js`'s camera constants, the
establishing shot's framing, or the orbit leash.

`src/scene.js` owns the camera. Everything else in the scene is placed
in world units and knows nothing about it.

## The angle

**Perspective camera on a 20° vertical FOV, 20° down / 37° around.**
The elevation comes from a CAD axis tripod, where the two ground axes
fall ~18-19° below the horizon either side of a vertical z. For an
orthographic camera at a symmetric 45° azimuth that on-screen slope is
`atan(sin(elevation))`, which puts the elevation at 20°. That
derivation is the orthographic limit and is still what the two angles
mean: a narrow FOV reproduces it closely at the target and diverges
either side, which is the point of the change.

The azimuth is 8° off that symmetry, to turn more picture toward the
viewer. The screen looks down world +Z and the camera sits in the
+X/+Z octant, so a *smaller* azimuth walks the camera round toward the
front. The two ground axes are no longer mirror images — +X falls
~11.7° below the horizon and +Z ~24°. Keep any further swing slight:
past ~30° the side vents leave the shot and the view stops reading as
isometric.

## Perspective, and what replaced the frustum

It was orthographic, and the flat end of the orbit leash is why it is
not: an orthographic projection has no vanishing point, so dropping to
2° above the floor gave a flat elevation with no depth in the room at
all.

**A narrow FOV is the whole trick.** Everything is still specified as a
**frustum height at the target** — world units of vertical view at
whatever the camera looks at, which is exactly what the orthographic
frustum was. The camera is then stood far enough back that a cone of
FOV degrees subtends it:

    dist = frustum / (2 * tan(fov / 2))      // distFor()

So `FRUSTUM`, `FRUSTUM_MOBILE`, `monitorFrustum`, `screenFrustum` and
the fly-in's log-space zoom curve all keep their old values and
meanings. What stopped being a constant is the *distance*: `CAM_DIST`
is gone and the radius is derived from the framing. At 20° the
establishing shot stands 68 units out where the orthographic one stood
at 60.

Narrower is more isometric, and the trade is legible across the
subject: the desk spans about ±12 units of view depth, so its near and
far ends differ in size by ~1.30x at 15°, ~1.43x at 20°, ~1.57x at 25°.
`window.__fov(deg)` switches it on a live page; `_persp.mjs` shoots the
candidates.

Three things that were true only of the orthographic camera are now
wrong, and all three are handled where they live:

- **The screen overlay is a homography, not an affine matrix** — see
  [screen-overlay.md](screen-overlay.md).
- **`near` is positive again.** A perspective frustum is a pyramid in
  front of the eye, so the flat view's bottom edge is floor some 40
  units *ahead* of the camera rather than behind it.
- **A low view has a horizon.** With the room it no longer matters: the
  ground is a finite slab that ends inside the frame and what is beyond
  it is the void. The fog survives as a depth cue on the diorama's far
  corner — see [room.md](room.md).

## What the frame holds

**`FRUSTUM` is 24 (portrait: 37), and the desk is why.** The machine
used to stand on the floor, so the frame only had to hold 6.5 units of
monitor; it now stands on a 9-unit desk and the assembly reaches ~20.6
units from the desk's near-bottom corner to the top of the tube. That
is the *only* camera constant the desk moved — both angles and the
whole leash are untouched, so the home framing is the same shot from
further back. `ISO_TARGET` rose with it to `(0, 7.05, 0)`; at the
origin the assembly sat in the top half of the frame with bare floor
underneath.

Portrait deliberately **crops the desk's ends**: a 19-unit desk across
a 390px frame would want a frustum near 50 and leave the CRT a tenth of
the picture. 37 is the point at which the far pedestal's drawer front is
still in shot, and is as far as this should go — every unit of it costs
the machine, which is the thing a visitor has to find and press.

The room needs no re-tuning when either moves: it is fixed geometry in
world units, so a change of frustum only changes how much is in shot.

**Both are scaled by `HOME_ZOOM`, 1.10** — the one knob for how much air
there is around the furniture. At 1.0 the desk's near foot sat 2% off
the bottom edge; at 1.10 that margin is 12%. It multiplies the
*frustum*, not the distance (under a perspective camera those are the
same zoom only because `distFor` derives one from the other), and
nothing else moves with it: the fly-in's destination is `SCREEN_TARGET`
and `screenFrustum`, both read off the screen mesh, and the leash's
limits are angular offsets from home.

`window.__fit()` reports where the furniture lands in the frame, in NDC,
and is what those numbers are set against: "does the desk fit" is a
question about eight projected corners, not something to judge off a
screenshot. `_deskfit.mjs` reads it on both viewports;
`_zoomshots.mjs` reads it against the `HOME_ZOOM` candidates.

`PROJ_X` / `PROJ_Z` are the *orthographic* foreshortening factors,
deliberately: under a perspective camera the screen extent per world
unit varies with depth, so these are the pair that holds at the target.

## Looking around the establishing shot

**The camera is the visitor's at `fly.value === 0`, and nobody else's.**
`OrbitControls` (three/addons, MIT) hang off `camera` and the canvas. No
pan, no wheel zoom (with `enableZoom` off, OrbitControls returns before
it would `preventDefault`, so the page still scrolls), and both angles
clamped — but the two clamps are expressed in **different frames**:

- **Azimuth is measured off the monitor's front.** `ORBIT_SWING` is
  **±60°** of it, and the front is azimuth `FACING`. Home is 37° round
  from the front, so the swing runs −97° one way and +23° the other.
  Nothing recenters it; the far side of the machine is simply further
  away than the near side.
- **Elevation is measured off home**, where `ORBIT_UP` / `ORBIT_DOWN`
  give 10° steeper and **18° flatter** — home is 20°, so the flat end is
  2° above the floor. That is the desk's own height: the eye lands at
  y ≈ 9.1 against a 9.0 desk top, the framing where the screen and the
  drawer fronts are both seen square on. Steeper than +10° walks toward
  a plan view of a desk.

**The swing came down from 90° to 60° when the room went in, and the
room is the reason.** The diorama has two walls, each fading out as the
camera comes round behind it. What sets the leash is the wall that must
*not* fade: the -Z wall's facing bottoms out at
`cos(elevation) * cos(swing)`, which at ±60° is 0.47, comfortably above
the 0.30 at which fading starts. At ±90° it reached 0, so both walls
would have gone and the extremes would have shown a bare floor slab
adrift in the void.

One consequence: at ±60° the glass is never near edge-on at the clamps —
`screenFacing()` bottoms out around 0.43 against `FACE_MIN`'s 0.17 — so
the overlay no longer comes off the glass at the ends of the swing.
`FACE_MIN` is a guard again rather than a working part. **`_orbit.mjs`
still asserts the old ±90° behaviour and will fail until updated.**

Three things keep the leash from fighting the rest of the file:

- **`applyFly(0)` is still the only definition of home.** `initOrbit`
  seeds `orbitHome` from the pose it produced, and the elevation limits
  are offsets from *those* angles. The azimuth half follows `FACING`, so
  it moves with the machine. Nothing restates the camera constants.
- **The controls own the camera only at the establishing shot.**
  `flyToScreen` switches them off, `depart` switches them back on, and
  `orbitAllowed()` also refuses while `signed-in` is on the body.
- **The input surface is the canvas, not a new overlay.** `#scene` is
  `pointer-events: none` for the rest of the site's life so the Win95
  chrome stays clickable; `body.orbit-live` turns that on, and that
  class is only present before the sign-in with the camera parked —
  exactly the window in which there is no chrome to click. `#screen`
  goes `pointer-events: none` for the same stretch, so a drag starting
  over the live login rotates like any other. It keeps its `click`
  handler, which is both the programmatic route the review scripts use
  and the only way in without a pointer.

## Press vs drag, and the walk home

**A press is a click if it travelled less than `CLICK_SLOP` (5px); past
that the camera has already answered it by turning.** Both halves of the
decision are recorded on `pointerdown` — the position *and* what the
raycast hit — because by the time the pointer comes up the camera has
moved and the raycast would be asking about a different frame. See
[lamps.md](lamps.md) for `pickTarget`, which decides between the lamp
and the machine in one raycast.

**The walk home is a GSAP tween, `IDLE_MS` (3s) after the last
release.** It writes the camera through `setOrbitAngles` and `tickOrbit`
stands `controls.update()` down for its duration: `update()` derives its
angles from the camera position every call, so there is nothing to keep
in sync and nothing to fight. It starts by spending the damping glide in
one undamped `update()` — left running, the residue keeps being applied
underneath the tween and the walk lands a fraction of a degree short.
The next drag kills it.

`spendGlide()` matters twice: anything that *takes* the camera somewhere
— the walk home, `window.__orbit` — has to finish the glide first or the
move lands short of where it was aimed. On a machine holding 60fps the
residue three seconds after a release is ~1e-10 and it is a no-op; it is
only visible under a renderer slow enough that the glide has barely been
spent, which is exactly what `_orbit.mjs` runs on.

**Reduced motion keeps the rotation and loses the inertia.** Damping is
what a visitor who asked for less motion is asking not to be given, and
there is no walk home at all. Both fall out of one fact: under reduced
motion there is no render loop, so `tickOrbit` never runs; with damping
off, OrbitControls' own handlers call `update()` themselves and the
`change` listener draws the frame.

**`cameraMoving()` is what `updateScreenOverlay` snaps `--scan` and
`--blur` against**, not `fly.dir` — an orbit changes the screen's
on-screen scale just as a flight does, and every distinct value of those
two costs a raster. It covers the flight, the drag, the damping glide
(`ORBIT_SETTLE_MS` after the last change) and the walk home, and
resolves exactly at rest.

**The flight starts from wherever the camera is** (`FLY_FROM =
"current"`). Only the spline's *first knot* moves: pan and zoom are off,
so an orbit changes nothing but the camera's place on a fixed-radius
sphere. The start is stored as a pair of angles (`flyStart`), not a
position — which is what lets a mid-flight resize re-derive the curve
from the new viewport instead of carrying a stale frustum into it.
`depart` puts the home knot back. The alternative,
`FLY_FROM = "home"`, walks the camera back over `RETURN_FAST_S` first
and then runs the art-directed arc untouched; it loses, because the
correction runs the wrong way and puts 0.45s in front of the click.
`_flyfrom.mjs` shoots both on one clock.

**The hint** (`#orbit-hint`) is unhidden by `initOrbit`, so it never
appears without WebGL, and is dismissed for good by `orbit-used` on the
first `change` — on `start` it would also be dismissed by a press that
turned out to be a click. It is `aria-hidden`: it describes a pointer
gesture with no keyboard equivalent, and the thing it decorates is
reached by pressing the monitor either way.

## Handles

`window.__orbit(swing, rise)` poses the camera in degrees relative to
home and draws it, or reports where it is and what the leash allows;
`window.__flyFrom(mode)` switches the start-pose mode;
`window.__enter()` is the flight exactly as a press on the machine
starts it. `_orbit.mjs` covers all of it.
