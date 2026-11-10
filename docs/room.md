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
home camera. So the plan figures read directly against src/desks/classic.js's
`DESK_W` (22.8) and `DESK_D` (12.6).

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
*lighting* figures, not merely geometric ones. Light clearing a 23-tall
wall lands on the floor from x 2.8 onward, and that boundary is in the
shot; letting all 34 of it cast would walk that past x 11 and take the
lit wedge in front of the desk with it.

So only `CAST_H` x `CAST_Z1` of the panel casts — **23 and 19**, of
which `CAST_Z1` is exactly what `Z1` was before the room became a room
— anchored
into the corner, with the opening cut in that piece because a hole in a
non-caster throws no sash stripes. Everything the room grew by is a
non-caster, so the frozen shadow map is still rendered once. The
mouldings stopped casting with the change:
the light comes in from behind the wall, so their shadows fell inside
the wall's own, and a casting skirting out past `CAST_Z1` would lay a
shadow on floor that nothing above it is shadowing.

**`CAST_H` had to move when the window grew, and the lighting barely
noticed.** It went 19 -> 23 when the opening's head stood at 22: the
hole has to be inside the core, so 19 would have cut it through the
core's top edge. Raising it changed the light less than the warning
implies, because the beam steepened at the same time — the moon is
aimed from the opening's *centre*, which rose 12.6 -> 16, so the rake
went 36.5° -> 43° below the horizon and light clearing a taller wall at
a steeper angle lands in nearly the same place. The pool did not move
at all; it is pinned at `MOON_AT`.

**And `CAST_H` stayed at 23 when the opening went landscape**, though
the head came down to 18.2. The core still contains the hole with four
units to spare, and this is a lighting figure before it is a geometric
one: lowering it to hug the new head would walk the lit wedge in front
of the desk back out for nothing.

What the landscape opening *did* move is the aim, because the centre
dropped to 14.1 and came forward to z 0: the rake eased 43° -> **42.2°**
and the azimuth turned about 5°, from `atan2(13, 11)` to a dead 45°.
The azimuth is the half that matters, because it turns the light's own
basis — so **scene.js's shadow box had to be re-measured rather than
reasoned about**. It did not have to change: `_castfit.mjs` puts the
caster at -6.4..13.9 across, -15.0..15.6 up and 13.0..43.4 in depth,
and `window.__shadowfit('desk', 'computer', 'treehouse', 'lamp')` puts
the furniture at -3.7..22.3, -13.1..12.8 and 21.1..49.8. Both sit
inside the existing six faces with margin on every one.

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

`src/nightwindow.js` builds a six-pane sash in a painted casing, with a
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

**The size is set against the desk and capped by the frame, and it is
landscape now.** The opening is **14 x 8.2** with its sill at **10.0**.
A unit is about 3.2 inches here, so the sill is the 3-inch step a
32-inch sill makes over a 29-inch desk, and the glass is a wide
divided light rather than the 26 x 20 hopper it started as or the 9.5 x
12 double-hung it passed through.

**The cap is a diagonal, not a number, and that is the thing to know
before re-tuning either figure.** The wall recedes from the camera, so
the home desktop frame crosses its inner face at world y **17.88 at the
opening's back edge, 18.87 at its centre and 19.86 at its front**
(`_winhead.mjs` prints the sweep). The 18.6 the old notes quote was
only ever the figure at the old centre, z -2.

**Portrait was the wrong read of that cap.** 9.5 x 12 put the casing's
head at 22 — NDC y **1.33** on desktop — so a quarter of the glass, the
head casing and the whole meeting rail were never in the hero framing.
A window reads bigger by filling more of the frame, not by standing
above it. 14 x 8.2 is set against the middle of the diagonal: the glass
head lands at 18.2 and the casing head at 18.85, against the 18.87 the
frame allows at the centre line. What crops is a wedge at the back top
corner — the glass head is above the cut only behind about z -4.75, and
by at most a third of a unit — so **99.7% of the glass is in shot**
against roughly 72% before. The assembly's NDC box is -0.77..-0.21
across and 0.17..**1.08** up.

**It is 61% of the desk's width, where portrait could only be 42%.**
Two-thirds of `DESK_W` is 15.2, and a *portrait* window that wide wants
18 of height — it would stand four units clear of the ceiling and show
its bottom third, which was shot and stops reading as a window at all.
Landscape spends the width without buying any height, so 14 costs
nothing but the z slack the ear needs.

**Six panes, not four.** The light inside the sash is divided into
three equal parts across and two up, and the two vertical bars are
*derived* from that division rather than placed at thirds of `OPEN_W` —
placing them by eye would be wrong by the sash's own width and leave
the outer panes narrower than the middle one, an error that only shows
once the sash stripes land on the floor. A pane is 4.27 x 3.64, which
is the near-square a landscape opening has to be cut into; one pair of
bars would have made four 6.7 x 3.9 letterboxes.

Every joinery member went up by about the 1.3x the opening grew by —
`CASE_W` 0.5 -> 0.65, `SASH_W` 0.28 -> 0.34, `MULL_W` 0.2 -> 0.25, the
sill and apron likewise. The *depths* (`CASE_OUT`, `SASH_D`,
`APRON_OUT`) did not: those are how far a board stands off a wall,
which is a property of the board and not of the hole. The apron hangs
to 9.02, still 1.14 clear of the wainscot's cap rail at 7.88.

**The sill's top stands `SILL_RISE` (0.02) above the opening's bottom
edge, and it has to.** The opening is an `ExtrudeGeometry` hole, which
means it is a real hole with its own side walls through the wall's
thickness — including a horizontal one across the bottom at exactly
local y = 0. The sill's top face was at y = 0 too, and the sill runs
the full thickness, so over the whole footprint of the opening two
upward-facing surfaces sat in the same plane carrying different
colours: the wall field and the casing paint. The depth test picked
between them per pixel and the sill broke up into a shimmering band as
the camera orbited.

**It read as a lighting bug because it only showed with the lamp on.**
The fight needs the two colours to separate, and with no warm source on
that side of the room both crush to within a level or two of the void.
The desk lamp stands in front of this window and below the sill, and
its pool is the only thing here that really lights a face pointing up.
It is neither shadow acne nor VSM bleed — the shadow map is rendered
once and frozen, so nothing it carries can change between frames — and
nothing re-renders it per frame; nor is it the glass or the rain, which
are vertical planes that only ever met the sill's plane along an edge.

Lifting the board buries the reveal inside it and leaves no shared
plane. The figure is about a hundred times the depth buffer's
resolution at this range (`z²/(near·2^24)` is ~2e-4 at a 40-unit
subject and `CAM_NEAR` 0.5) and about a sixteenth of an inch at this
scale. The board grows *upward* by the rise rather than moving, so its
underside stays where the apron meets it. It is also what a real sill
does: bedded over the opening's bottom, with the sash sitting on it.

**The placement wants to be as far back along -z as it can get, and
that is a portrait-viewport decision.** Screen-x runs roughly
`0.8x - 0.6z` at this azimuth, so moving the window *back* walks it
toward the middle of the frame. `WINDOW_Z` is **0.0**, and the back
corner is what set it: the sill's ear reaches half the opening plus the
casing plus the ear, 7 + 0.65 + 0.4 = 8.05, so at 14 across and the old
z -2 it would have come to -10.05, a unit *through* the back wall's
inner face at -9. At z 0 it reaches -8.05 and clears by 0.95 — the same
clearance the 9.5-wide opening had at -2. There is no slack either way:
wider or further back puts the ear through the corner, further forward
walks the window off a portrait frame.

**It is cropped on a phone anyway, and that is the same trade the desk's
ends take.** The assembly's NDC box is **-1.71..-0.49** at home on a
390x844 frame against -0.77..-0.21 on desktop, so about 40% of it is in
shot — the screen-right part. `FRUSTUM_MOBILE` is 37 against 24, so a
tall narrow frame sees far less world width and the left wall is the
first thing it loses. The moon is placed for that half: it sits toward
screen right, because local +x runs toward world -z, which is screen
right at this azimuth.

**It is a child of the left wall panel**, so room.js places it in the
panel's own local space and the two cannot disagree about which way the
wall faces. That parenthood used to earn it the cutaway for free — its
materials joined the panel's fade list and the panel's `visible` flag
culled glass, rain and joinery together — and that list went when the
fade did.

### The night outside: a stack of planes, not a picture

**The view is six quads behind the wall now, and it parallaxes.** It
used to be one texture on the glass — sky, stars, skyline and sheen
baked into a single map — and a single textured pane is a sticker:
orbit the room and the city turns with the window, because it *is* the
window. The opening is a real hole, so there is nothing stopping real
depth going in behind it.

| layer | z | size | what is on it |
|---|---|---|---|
| `sky` | -9.0 | 76 x 43 | gradient, the warm city glow on the horizon, thin cloud |
| moon | -8.95 | 8 x 8 | disc, three maria, a wide weak halo |
| `cityFar` | -6.5 | 59 x 34 | the tall distant rank, lightest and haziest |
| `cityMid` | -4.2 | 44 x 26 | |
| `cityNear` | -2.4 | 32 x 19 | low foreground roofs, nearly black |
| `rainFar` | -1.5 | 26 x 16 | the thin slow streaks |
| glass | -0.33 | the opening | tint, the lamp's warm bloom, one diagonal reflection, beads |
| rain | -0.31 | the opening | the fat fast streaks |

All unlit `MeshBasicMaterial`, no depth write, nothing cast or received
— a backdrop that cast would fill the hole it is seen through. They are
drawn in an explicit `ORDER` rather than sorted: three would sort them
by the distance to each plane's *centre*, and those centres are tens of
units apart along the wall, which is not the order they stack in from
the window. The joinery stays at the default `renderOrder` 0 and draws
over the lot; `depthTest` is left on, so the wall still occludes
everything everywhere the hole is not.

**The sizes are measured.** A plane only has to cover what can be seen
of it *through the opening*, which is a question about where the hole's
four corners project onto its plane from every pose the leash allows.
`_parallaxfit.mjs` casts those rays on both viewports and prints the
union; the table is its figures with about a unit of margin. It also
excludes poses where the window is off screen entirely — at the left
clamp on a phone its NDC box is -1.58..-1.21, and sizing a backdrop for
a pose nobody can see it from is what produced 180-unit planes on the
first pass. Each plane is **offset along local x rather than centred on
the opening** for the same reason: the oblique poses all skew the
footprint one way, and a centred plane would have to be twice as wide.

**Every figure in the table was re-read when the opening went
landscape, and the stack did not simply grow.** A hole 14 across and
8.2 tall shows more of each plane sideways and less of it vertically,
so the widths went up three to six units and the heights came *down*
three to five. The centres moved further than either — the vertical
ones by as much as 3.4 — because a wider hole skews the oblique
footprints further along the wall and further down. Keeping the old
heights would have brought each plane's bottom edge into view at the
high end of the leash.

**Nothing goes deeper than 9, and that is a wall-height limit.** These
planes live outside the building, so the only way to see one other than
through the window is over a wall top — and the walls are 34 tall. At
depth 9 the footprint reaches world y 24.8 and the plane's own top edge
sits at 25.8, nine clear of the wall; a deeper plane needs a taller
footprint, and the sky would clear the wall at the steep end of the
leash.

**Every painter works in the window's local space, not in canvas
fractions**, and skipping that is what made the first layered build a
flat wash: the planes are not centred on the opening, so the middle of
each canvas is nowhere near the part of it the window shows. The city
went below the sill and the moon went behind the wall. `frame(layer,
canvas)` converts, and every figure in the painters is then a world-ish
length — a building three units wide, a horizon a unit under the sill.
`_layerview.mjs` prints the patch of each plane the opening actually
shows, per pose, per viewport; that is the frame the art is composed in.

Two things that had to be got right and were not, first time:

- **`SKY_RISE`.** The gradient has to reach `SKY_TOP` at about the top
  of what the window shows. The sky plane is five times the opening's
  height, and spending the gradient over 18 units left everything in
  shot within a few points of `SKY_HORIZON` — one flat slate. It came
  down 13 -> **9** with the opening: the landscape hole shows 9.5 units
  of this plane where the portrait one showed 14. The cloud band came
  down with it, 4..16 -> **0.5..7**, for the same reason — two-thirds
  of the old weather was above the frame.
- **The ranks are vertical gradients, not values.** Haze collects at
  the horizon, so a distant building is nearly the sky's colour at its
  foot and its own by a few storeys up. Flat fills got the top
  backwards: the sky darkens with height, so a far tower painted one
  value came out *lighter* than the sky behind its own roof — one pale
  block standing next to the moon.

The far rank is the **tall** one, which looks wrong written down and is
right in the picture: the walk lays blocks edge to edge with no gaps, so
each rank is a solid mass and the only thing visible of the rank behind
is whatever stands above its roofline. Ranks that shrank with distance
would hide each other completely and the three planes would be one
silhouette. Lit windows are sparse — it is well after midnight —
mostly dim warm with a `COOL_SHARE` of 0.16 that is somebody still at
an off-white screen, and fewest on the far rank, which has the least
contrast to spend. Their brightness is varied per window (`globalAlpha`
0.25..0.85) because a rank all at one value reads as a texture rather
than a city. Seeds are fixed: a city that rearranges itself on refresh
cannot be art-directed.

**The moon leaves the view at the right clamp, and that is the price of
the parallax, not a defect.** It is on the deepest plane, so it slides
furthest; at the right clamp the sky plane shows local x -3.6..12.1 and
the moon sits at 14. Keeping it in shot at both ends would mean putting
it near local x 9, which lands it on a mullion at home and off the left
edge of a phone frame. Home is the hero pose and the camera springs
back to it.

**On the landscape opening the moon's height is cut by the sash, not by
the frame.** 8.2 of opening fits under the home diagonal almost
everywhere, but a landscape light carries its meeting rail across the
middle of the view — so the disc has the top half of 8.2 to sit in
where it used to have the top half of 12. `MOON_AT` went (12, 4.6) ->
**(14, 3.1)**, which lands it at glass (4.2, 5.9) on desktop and
(3.6, 6.6) on a phone: inside the right-hand light on both, about a
unit clear of the rail below and the head above. The three ranks of
roofs came down with it — the same *fractions* of the pane rather than
the same glass heights, which would have stood the far rank two-thirds
of the way up and put a roofline level with the moon.

### The palette: the window is darker than the desk

**The subject is the lamp-lit desk, and the backdrop is pitched below
it.** A window brighter than the room it is set in pulls the eye out of
the picture and leaves the interior reading as the dark part of the
frame — which is what the first night pass did. The darkening pass put
five knobs at the top of the palette block so the whole outside can be
re-pitched without going through the painters:

| constant | now | what it does |
|---|---|---|
| `SKY_TOP` | `#05070f` | near black-navy, at `SKY_RISE` above the horizon |
| `SKY_HORIZON` | `#10141f` | only just lighter, and nearly grey |
| `CITY_GLOW` | `#7a5230` | the warm sodium haze lying on the horizon |
| `LIT_WINDOW_DENSITY` | 0.5 | one multiplier over every rank's own `lit` |
| `RAIN_OPACITY` | 0.3 | peak alpha of a streak's core, both layers |

**The glow is the only warm thing outside, and it is load-bearing.**
Streetlight haze is sodium, not sky, and a near-black roofline is only
a roofline if there is something behind it — the ranks are read
*against* this band, not against the sky. It is a third of the alpha
the old cold blue glow carried. The three ranks are near-black
silhouettes separated by a few points rather than a few tens, nearest
darkest: that is what distance looks like when there is no daylight in
the air to haze with.

**Clouds are lifted where the moon is.** Against a sky this dark a
cloud has nothing to be visible against except the one bright object
in it, so the base alpha is a third of what it was and a cloud within
`CLOUD_MOON_R` of the moon gets up to three times it. The moon itself
shrank (`MOON_R` 0.1 -> 0.075) and its halo reaches further on a third
less alpha — a soft wide falloff reads as scatter through glass where a
tight bright one reads as a bulb. Thin cloud crosses the disc from
`MOON_VEIL`, two soft bands painted on the moon's **own** quad: the
clouds in the sky texture are on the plane behind it and can never pass
in front, which is exactly how a sticker behaves.

### The glass

What is on the pane now, rather than the whole view: a faint cool tint,
**the lamp's own warm bloom**, one wide diagonal band of the room
reflected back, and a scatter of beads that have run and stopped.

**The bloom is what makes it a pane rather than an aperture.** With
only a cool tint and a cool sheen the glass read as a hole with a
filter over it, because every light in the picture was on the far side
of it. `GLASS_LAMP` puts something from *this* side into the sheet: one
soft ellipse plus the faint vertical smear a bright source makes on
glass, placed at (0.28, 0.3) in canvas fractions — the green lamp's
shade is at about world y 13 and z 3, which is local x -3 on this wall
and a third of the way up the glass. Each bead is *darker* in the middle
with a bright crescent low on it — a drop on a window is a lens, so it
carries the dark room behind it with the sky refracted down into view —
and a third of them have a short trail above. Still very low alpha
throughout: past about 0.1 a reflection stops reading as a reflection
and starts reading as a smear, and this is the layer nearest the eye,
so it is where that shows first.

`MeshBasicMaterial`, not `MeshStandard`, throughout the stack, and that
is the point: the view does not dim with the room, so what it is worth
against the lamp is decided in the palette and nowhere else. It used to
be the brightest thing in the picture; it is deliberately not any more.
The rain is part of that — thinner streaks (`wide` halved) at
`RAIN_OPACITY` 0.3 against 0.55, because at the old figure the streaks
were the brightest thing in the lower half of the window and read as
scratches rather than water. Alpha alone would have given faint *fat*
rain, which reads as mist.

**One sheet of glass with bars over it, not six panes.** That is how a
divided-light sash is actually glazed, and it keeps the skyline continuous
across the mullion instead of stepping at it.

### The rain, and why it is a patched material

Streaks are computed in the fragment shader from the quad's own
coordinates: no geometry, no texture, no per-frame upload beyond a
single float.

**Two layers at two depths**, which is a change from two layers on one
plane. It was both passes summed in one shader on one quad at the
glass — depth you could see in the streak widths and not in the
geometry, so the two moved together under the orbit. The far pass is on
`LAYERS.rainFar` now, 1.5 back, so the thin rain slides against the fat
rain as the camera comes round and both slide against the roofs behind
them.

**The densities are per world unit, not per pane**, which they had to
become the moment the layers stopped sharing a quad: the far plane is
20 across where the near one is `OPEN_W`, and a column count quoted
"across the pane" would have thinned the far rain to a drizzle on the
wider one. `cols` and `rows` are per world unit and each material
multiplies by its own quad, so the figures are resolution-independent
and the rain on the glass is the rain that was there.

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

**Frame rate measured, A/B, one machine one sitting.** The backdrop
adds six transparent quads and about 15MB of canvas texture drawn once
at build. Against the flat picture it costs nothing readable:

| | flat picture | layered backdrop |
|---|---|---|
| desktop, median ms | 16.7 / 16.7 | 16.8 / 16.7 |
| mobile, median ms | 16.6 / 16.7 | 16.6 / 16.7 |
| janky frames | 0 | 0 |

(zoom in / zoom out, `_perfcheck.mjs`, 1440x900 and 390x844.) The
reason there is no cost is early-Z: the planes are `depthTest` on and
drawn after the opaque room, so every fragment of them behind the wall
is rejected before it shades, and only what the hole shows is paid for.
