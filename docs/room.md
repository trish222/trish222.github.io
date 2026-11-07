# The room, and the window in its left wall

Read this when touching `src/room.js` or `src/nightwindow.js` — the
setting the furniture stands in.

## A diorama, not a room

A finite dollhouse diorama — plank floor, two walls, wainscot, trim and
a rug — floating in a flat `#1C1A2A` void. It replaced `src/floor.js`,
whose job was the opposite: an effectively endless grey plane whose
edges were hidden by fog in its own colour. **Nothing here is typeset**:
the wordmark that used to tile the floor, and the one version of it set
on the rug, are both gone on request. Playfair is still loaded, but for
the CRT's greeting — see [computer.md](computer.md).

Why a diorama rather than a room: the camera swings 60° either side of
the monitor's front, so any wall the camera can get *behind* has to go.
Only the two walls behind the desk at the home framing are built, and
the near one fades out as the camera comes round to see it from the
back. There is no ceiling and there are no near walls, so nothing is
ever between the visitor and the desk.

**Local space is the desk's and the computer's**: origin on the floor at
the desk's centre in plan, +Z toward the viewer, +X screen right at the
home camera. So the plan figures read directly against desk.js's
`DESK_W` (19) and `DESK_D` (12.6).

## The plan

The desk spans x -9.5..9.5 and z -6.3..6.3. The floor slab is sized
around it with breathing room behind and to the left, where the walls
are, and a long run of open floor in front for the rug:

```
X0 -13.0  left wall's inner face      Z0  -9.0  right wall's inner face
X1  19.0  open right edge             Z1  19.0  open front edge
```

**The slab's own edges are deliberately in frame** — that is what makes
it a diorama rather than a room with the walls cropped off. The home
framing reads about 77 world units of floor depth, so a 28-deep slab has
void beyond it at the bottom of the picture by design.

One world unit is about 3.2 inches here (`DESK_TOP_Y` is 9 for a 29-inch
desk), so every elevation figure reads low against a tape measure and
right against the furniture.

**`WALL_H` 19 is a cut line, not a ceiling height.** At the home framing
the frame reads about 30 world units of height at the back wall's depth,
so a wall tall enough to be a real room (26-30 units at this scale)
fills the top of the picture and the diorama stops floating in anything.
19 leaves a few units of void above the wall tops, which is the whole
dollhouse read: walls that have been *cut off*. It is also why there is
no crown moulding — a crown implies a ceiling to meet. `WALL_T` is 0.6
rather than zero because the cut edge shows it.

The wainscot's cap rail sits at 7.88, *below* the 9-unit desk top.
`BASE_OUT` / `WAINSCOT_OUT` / `CAP_OUT` are how far each moulding stands
off the wall field; the cap rail is the proudest because it is the one
the light catches.

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
rather than a tiled cell, which is only affordable because the slab is
32 x 28 units rather than the 1700 the old plane was. It buys what a
tile cannot have: butt joints that fall where they actually fall across
the room, and no repeat to spot. The walls are tiled value noise at
512px; the rug is 1024px. Every texture here is drawn off a cheap
deterministic hash, so a floor whose knots move on refresh cannot
happen.

## The cutaway

Each wall fades on the angle between its inner normal and the camera's
view **direction** — direction rather than the vector to the camera, so
the fade is about which face is turned toward the lens rather than which
side of an infinite plane the eye is on. The walls are finite panels,
and past about 20° off the front the eye is already outside the left
wall's plane while the panel itself is nowhere near the line of sight.

`facing` is `-dot(normal, viewDir)`: 1 square on, 0 edge on, negative
seen from behind. `FADE_OUT` 0.05 / `FADE_IN` 0.3 are set so the left
wall is solid through the whole right-hand half of the leash, is gone
before the camera reaches the monitor's front, and never catches the
right wall — whose facing bottoms out at 0.47 at either clamp. **That
headroom is exactly what tightening the azimuth leash to ±60° bought**;
see [camera-and-orbit.md](camera-and-orbit.md). Below `FADE_CULL` a wall
is skipped outright rather than drawn at zero alpha — a transparent draw
still costs sorting and a full raster.

`VOID` is the void's colour, the fog colour, and `--scene-void` in
`src/style.css`, which paints the strip the taskbar vacates during the
fly-in. **The three have to agree exactly**; see `src/tonemap.js` for
what tone mapping does to that promise and how it is kept. `buildFog`
and `setFogRange` live here too, and the range is an offset from the
camera's distance for the same reason `CAM_DIST` is gone.

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

**It fades with its wall and the cutaway was not told about it.** The
window is a child of the left wall panel and its materials join that
panel's list, so `updateWallFade` dims it and the group's `visible` flag
culls it — glass, rain and joinery together. Nothing in room.js's fade
code mentions the window.

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
unfogged on both. Patching a built-in material keeps all of it, and
`opacity` stays the plain uniform the cutaway writes, which is what
makes the fade free.

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
