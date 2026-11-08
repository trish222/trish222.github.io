# The room, and the window in its left wall

Read this when touching `src/room.js` or `src/nightwindow.js` — the
setting the furniture stands in.

## A room corner, not a diorama

The corner of a room — plank floor, two walls, wainscot, skirting, crown
and a rug — standing in a flat `#1C1A2A` void that is only seen past the
open sides. It replaced `src/floor.js`, whose job was the opposite: an
effectively endless grey plane whose edges were hidden by fog in its own
colour.

**It was a dollhouse diorama until the walls grew.** The walls were 19
units tall and the slab 32 x 28, both deliberately cropped by the frame
so the model read as a cut-away. They are 34 and 76 x 66 now, sized so
no top and no end edge is in shot at any pose the leash allows — the
frame cuts the walls rather than the walls ending inside the frame. The
lighting did not change with them; see "The frozen casting silhouette"
below. **Nothing here is typeset**:
the wordmark that used to tile the floor, and the one version of it set
on the rug, are both gone on request. Playfair is still loaded, but for
the CRT's greeting — see [computer.md](computer.md).

Why only two walls: the camera may not leave the room, so the two walls
it would have to pass through to see a third are exactly the two that
set its leash — see [camera-and-orbit.md](camera-and-orbit.md). Only the
walls behind the desk at the home framing are built. There is no ceiling
and there are no near walls, so nothing is ever between the visitor and
the desk, and the open sides are what the fog is for.

**Local space is the desk's and the computer's**: origin on the floor at
the desk's centre in plan, +Z toward the viewer, +X screen right at the
home camera. So the plan figures read directly against desk.js's
`DESK_W` (19) and `DESK_D` (12.6).

## The plan

The desk spans x -9.5..9.5 and z -6.3..6.3. The corner it stands in has
not moved — `X0` and `Z0` are where they were, so the window, the moon's
aim and the lighting calibration all read against the same two faces:

```
X0 -13.0  left wall's inner face      Z0  -9.0  right wall's inner face
X1  66.0  open right edge             Z1  56.0  open front edge
```

**The open pair is what moved, and a long way.** For the floor to run
off the picture rather than end in it, both have to clear the near edge
of the frame at the flattest pose the leash allows — the widest-seeing
one. The eye drops to y ≈9.7 on desktop and ≈11 on a phone, the bottom
of the frame is then 12° below the horizon, and it meets the floor some
45 units (desktop) to 52 (phone, where the camera stands 115 out rather
than 75) ahead of the camera. Projected onto the plan that is floor
wanted out to x ≈57 and z ≈53 at the frame's corners, on a portrait
viewport at either azimuth clamp.

**`X1` went 62 → 66 when the azimuth leash lost its old cap.** The leash
is both wall planes now and nothing else, so the camera reaches ~+88°
off the monitor's front instead of stopping at +60° — nearly over the +X
axis, looking back along the room — and from there a portrait frame's
bottom corner landed 1.4 units past x 62. 66 puts it 0.1 inside. `Z1` is
untouched and keeps the one exposure it had: on a phone at the flattest
elevation near the *near* clamp, the frame's bottom edge reaches about 7
units past the front edge of the floor.

**The floor runs under both walls**, from `FLOOR_X0` / `FLOOR_Z0` —
`X0 - WALL_T` and `Z0 - WALL_T` — so each panel's cut edge stands on
boards instead of on a seam. The right wall spans the whole floor width
(the left wall's thickness included) and the left wall the whole depth,
so neither ends anywhere the frame can see.

One world unit is about 3.2 inches here (`DESK_TOP_Y` is 9 for a 29-inch
desk), so every elevation figure reads low against a tape measure and
right against the furniture.

**`WALL_H` 34 is a ceiling height, and the phone set it.** For no top to
be in shot it has to clear the top of the frame at the back corner, and
that is a different number per viewport because the portrait frustum is
1.54x the landscape one. Solving "this point lies exactly on the top
edge" at the back corner gives y **17.6** at the home desktop framing,
**24.8** on a phone at home and **29.4** on a phone at the flattest
elevation. 34 is that worst case with a few units over, and reads as a
9ft ceiling at this scale.

**The pose that used to defeat this is now unreachable.** That figure
was set against the −60° azimuth clamp, where the camera stood outside a
faded left wall and the frame looked lengthwise down the right one.
There is no fade and no such clamp: the leash is the two wall planes, so
the camera cannot get outside either, and the lengthwise view down a
wall went with them.

What is left is the *steep* end, and no height fixes it. At the +10°
rise the eye stands at y 44 on desktop and 64 on a phone — above these
wall tops either way — so from near an azimuth clamp a wide frame's top
corner can look over one of them into the void. It is symmetric (the
left wall at the near clamp, the right at the far one), wants an aspect
past about 2:1 to show at all, and a taller wall only moves the aspect
at which it starts: the camera is above the top edge, not below it. On a
16:9 desktop frame nothing is uncovered anywhere on the leash.
`FOG_SPAN`'s 55 is what keeps the far reaches of both walls dark rather
than a silhouette.

**The mouldings are four pairs now**, each stepping further off the wall
field as it goes up (`BASE_OUT` … `CROWN_OUT`): a band that is only a
different colour reads as paint, one that is proud of its neighbour
reads as a board. Skirting plus its cap bead at the floor — two bands
rather than the one 1.2-unit board this was, because at the flat end of
the orbit the floor line runs most of the width of the frame and a
single dark stripe reads as the floor not quite meeting the wall. Then
the wainscot, whose cap rail sits at 7.88, *below* the 9-unit desk top.
Then the crown and its fillet at the ceiling line, which is the wall's
own top edge — **so the crown is off the top of the frame at the home
framing on both viewports**, which is exactly the requirement the height
was set to. It is a detail of the flat end of the orbit and of the
portrait viewport, not of the hero shot; putting it where it could be
seen at home would mean bare wall above a ceiling line.

**Which wall is which is stated in screen terms**, because that is the
only way it is checkable. The camera sits in the +X/+Z octant, so the
wall at -Z is seen across screen right and the wall at -X across screen
left. `WALL_RIGHT` is lighter: it is the more square-on of the two at
home (its normal is 0.75 of the view direction against the left wall's
0.57), so it carries the room's value and the left one reads as the turn
into shadow.

**The rug** sits in the open floor in front of the desk, 19 x 10.6 with
a woven field and a drawn border. `RUG_RADIUS` is one number for both
the silhouette and the drawn border band — the texture's border has to
follow the geometry's corners or the two disagree exactly where the eye
goes.

**Textures.** The floor is drawn as *one* non-tiling 2048px texture
rather than a tiled cell, which was affordable at 32 x 28 units and is
still affordable at 76 x 66. It buys what a tile cannot have: butt
joints that fall where they actually fall across the room, and no repeat
to spot. **The texture did not grow with the slab, so the density came
down** — 27 texels per world unit against 64 — which is held
deliberately: the canvas is 2048 x 1778 either way, about 15MB, and 27
texels is still roughly one per screen pixel at the home framing.
Matching the old density meant a 3900px canvas and 53MB, most of it
spent on floor the fog takes to the void. What that does affect is every
figure `drawFloor` writes in pixels: the grain is counted per canvas
pixel (or the loop grows with the room) and measured in world units (or
a stroke that was a third of a board long becomes most of one), so the
scatter is sparser per unit of floor and the streaks are longer — which
is the right way round, since long grain is what wood looks like.
`PLANK` was lifted about 60% and walked toward brown at the same time: a
value set for a lit island in the void reads as a hole in the floor once
a room closes over it. The walls are tiled value noise at
512px; the rug is 1024px. Every texture here is drawn off a cheap
deterministic hash, so a floor whose knots move on refresh cannot
happen.

## The frozen casting silhouette

The left wall is the only thing in the room that casts, and the moon is
aimed through its window — so the wall's top edge and its far end are
*lighting* figures, not merely geometric ones. Light clearing a 19-tall
wall lands on the floor from x 3.6 onward, and that boundary is in the
shot; at 34 it would have walked out to x 13 and taken the lit wedge in
front of the desk with it.

So only `CAST_H` x `CAST_Z1` of the panel casts — **19 and 19, exactly
what `WALL_H` and `Z1` were before the room became a room** — anchored
into the corner, with the opening cut in that piece because a hole in a
non-caster throws no sash stripes. Everything the room grew by is a
non-caster, so the frozen shadow map is the same map and scene.js's
shadow box still fits. The mouldings stopped casting with the change:
the light comes in from behind the wall, so their shadows fell inside
the wall's own, and a casting skirting out past `CAST_Z1` would lay a
shadow on floor that nothing above it is shadowing.

The field is two extrudes, the core and an L around it, both traced in
the panel's local coordinates. `ExtrudeGeometry` writes shape
coordinates into `uv`, so the noise lattice is pinned to local space
rather than to each piece's own 0..1 box — which is what makes the seam
between them invisible, and the same reason the field is an extrude
rather than four boxes around the opening.

## No cutaway

**Both walls are opaque at every pose and nothing here fades.** There
used to be a cutaway: each wall dimmed on the angle between its inner
normal and the view direction (`FADE_OUT` / `FADE_IN` / `FADE_CULL`) and
vanished as the camera came round to see it from behind. What replaced
it is the camera's own leash — scene.js clamps the azimuth off
`ROOM_PLAN.X0` and `ROOM_PLAN.Z0` with a 9° margin, so there is no pose
from which the back of a wall can be seen and nothing left for a fade to
hide. See "The walls are the leash" in
[camera-and-orbit.md](camera-and-orbit.md), which is where the two
figures are now read.

Two things followed the fade out of room.js: the panel materials are
plain opaque `MeshStandardMaterial` again (they were permanently
`transparent: true` so the fade never had to toggle the flag and
re-sort), and the per-wall list of materials and normals the fade walked
is gone with it, along with `updateWallFade`, `wallFades` and
`window.__walls`.

`VOID` is the void's colour, the fog colour, and `--scene-void` in
`src/style.css`, which paints the strip the taskbar vacates during the
fly-in. **The three have to agree exactly**; see `src/tonemap.js` for
what tone mapping does to that promise and how it is kept. `buildFog`
and `setFogRange` live here too, and the range is an offset from the
camera's distance for the same reason `CAM_DIST` is gone. **`FOG_SPAN`
came in from 85 to 55 when the room grew** — 85 was set against a slab
that ended 28 units in front of the desk, where nothing was far enough
away for the far end of the ramp to matter. 55 puts the far end of the
right wall about 90% of the way to the void at both clamps and costs the
back corner at home nine points of fog against six.

## The window on the left wall

`src/nightwindow.js` builds a four-pane sash in a painted casing, with a
night sky behind the glass and rain running down it. Its own module for
the same reason the desk and the treehouse are. `src/room.js` places it
and nothing else in the scene knows it exists.

**Local space is the wall panel's.** x across the opening, 0 at its
centre; y up, **0 at the sill line**; z = 0 the wall's *inner* face, with
the thickness running back to -`WALL_T`. That is exactly the frame
`buildWallPanel` builds in, so room.js only places the group at the
opening's centre and the two cannot disagree about which way the wall
faces.

**The opening is a real hole, and the wall field stopped being a box to
make one.** With a window in it the field is an `ExtrudeGeometry` with a
`Path` hole — the same decision `computer.js` makes for the bezel, and
for the same reason: a panel plus a dark inset cannot make an opening,
only cover one. The alternative was four boxes around the opening, which
is easier to write and wrong in a way that shows: each box carries its
own 0..1 UV, so four pieces of different sizes crop the shared noise
field differently and the lattice breaks at every joint. Extruding puts
the UVs in world units instead, so the grain runs continuously round the
opening — which is why the field's `map.repeat` is `1 / 9` on the
windowed wall against `width / 9` on the plain one. **Both spellings
mean one noise lattice per 9 world units**; they have to, or a wall with
a window reads at a different grain from the one without.

**The size is set by the top of the frame, not by the proportion.** The
opening is 8 x 6.4 with its sill at 9.4. The height came down from 7.0
because at that value the casing's head landed at NDC y **0.95** at home
and **0.97** at the right clamp — in shot, but with 3% of the frame to
spare, which is not a margin. At 6.4 it is 0.88, and the panes lost
nothing worth having. The sill clears the wainscot's cap rail (7.88) and
sits level with the desk top (9), so the opening is the one large bright
area above the desk's left end rather than something half-hidden behind
the machine.

**The placement is set back along -z, and that is a portrait decision.**
Screen-x runs roughly `0.8x - 0.6z` at this azimuth, so moving the
window *back* walks it toward the middle of the frame. `WINDOW_Z` is
-2.0, which is as far as it goes: the opening is 8 wide, the back corner
is at z -9, and the casing, the sill's ears and the back wall's own
thickness have to live in the 3 units that leaves.

**It is cropped on a phone anyway, and that is the same trade the desk's
ends take.** `_winshots.mjs` reports the assembly's NDC box at
**-1.31..-0.57** at home on a 390x844 frame against -0.58..-0.24 on
desktop, so about 58% of it is in shot — the screen-right half.
`FRUSTUM_MOBILE` is 37 against 24, so a tall narrow frame sees far less
world width and the left wall is the first thing it loses. What *was*
fixed is the moon: it sits at pane UV **0.70**, in the upper-right pane,
because the pane's +u runs toward world -z, which is screen right.

**It is a child of the left wall panel**, so room.js places it in the
panel's own local space and the two cannot disagree about which way the
wall faces. That parenthood used to earn it the cutaway for free — its
materials joined the panel's fade list and the panel's `visible` flag
culled glass, rain and joinery together — and that list went when the
fade did.

### The glass

The sky is drawn once into a canvas and used as an **unlit** `map`:
gradient (`#141A33` overhead to `#2B3560` at the horizon), a thinning
scatter of stars, a moon with a wide weak halo and three soft maria,
then two ranks of skyline — a lighter hazed rank behind and a nearly
black one in front carrying the lit windows. A faint diagonal sheen over
the lot is what makes it glass rather than a hole; past about 0.1 alpha
it stops reading as a reflection and starts reading as a smear.

`MeshBasicMaterial`, not `MeshStandard`, and that is the point: the sky
does not dim with the room. It is the brightest thing in the picture and
the only surface here meant to look like a light source. The seeds are
fixed, so the skyline and the stars are identical on every load — a city
that rearranges itself on refresh cannot be art-directed.

**One sheet of sky with bars over it, not four panes.** That is how a
four-pane sash is actually glazed, and it keeps the skyline continuous
across the mullion instead of stepping at it.

### The rain, and why it is a patched material

Streaks are computed in the fragment shader from the pane's own
coordinates: no geometry, no texture, no per-frame upload beyond a
single float. Two layers, near and far, each specified as a column count
across the pane and a run count up it — so the widths are
resolution-independent and the pane can be resized without re-tuning
them.

**It is injected into a `MeshBasicMaterial` through `onBeforeCompile`,
and a raw `ShaderMaterial` would have been wrong.** A ShaderMaterial
gets none of three's fragment epilogue — no `tonemapping_fragment`, no
`colorspace_fragment`, no fog — and this scene has an operator on one
render path and `OutputPass` doing the same job on the other. The rain
would have come out a different colour on desktop than on mobile, and
unfogged on both. Patching a built-in material keeps all of it.

Two details in the injection are deliberate. The pane coordinate is
derived from `position` rather than `uv`, because a `MeshBasicMaterial`
with no maps does not declare the uv attribute and asking for one by
defining `USE_UV` pulls in machinery nothing here uses. And the uniform
object lives at module scope and is handed back on every compile,
because `onBeforeCompile` runs again whenever the program cache key
changes — `window.__tonemap` switching the operator is exactly that.

**Reduced motion has two halves and only the first is load-bearing.**
`scene.js` runs no render loop under `prefers-reduced-motion`, so
`tickRain` is never called and the glass is frozen — which is why the
shader is written to look like rain at `uTime` 0 rather than resolving
into one: every column carries its own phase offset, so the opening
frame is already a scatter. `RAIN_SLOW` (0.12) is the second half, which
applies if a loop ever does run there — a crawl rather than a stop.
`window.__rain()` reports which is in force, and `_winshots.mjs` checks
the clock really does stay at zero.

`window.__rain(speed)` re-tunes the fall on a live page, in cell-runs
per second, which is how the streaks were set without a rebuild per
candidate.

**Frame rate not measured.** It adds about fourteen static draw calls
under the frozen shadow map and one small transparent pass over the
pane, so there is no mechanism by which it should cost anything — but
that is a prediction, not a reading. Run `_perfcheck.mjs` if the number
matters.
