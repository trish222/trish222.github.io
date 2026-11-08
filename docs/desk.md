# The desk

Read this when touching `src/desk.js` — the steel tanker desk everything
else on the desk stands on.

A 1950s-60s double-pedestal steel "tanker" desk built from primitives,
after `design-references/desk.png`. Taken from the reference: the cream
enamel carcase and drawer fronts with the paint worn through here and
there, the curved chrome pulls, the shallow locking centre drawer
bridging the knee hole, and the short feet. The desk in the photograph
has a dark linoleum top; this one gets a thick walnut slab instead,
overhanging the steel on three sides.

Local space matches the computer's — **+Z is the front**, origin on the
floor at the centre of the desk — and `DESK_TOP_Y` (9.0) is exported
because it is what everything standing on the desk is placed against.
`DESK_W` is 22.8, `DESK_D` 12.6 — the width went up 20% from 19.0 on
request, and only the width. `BASE_W`, `KNEE_W` and `CENTRE_W` are all
written against `DESK_W`, so the pedestals stay hung at the two ends
and the knee hole absorbs the whole of the extra length. The slab's
ends reach x +/-11.4, which clears the left wall's inner face
(`ROOM_PLAN.X0`, -13.0) by 1.6 and its skirting bead by 1.22.

**Which pedestal is which is stated in screen terms, not the desk's
own.** The camera is in the +X/+Z octant, so +X is screen right; the
reference's left pedestal (the single deep file drawer) is therefore at
-X and its right pedestal (the stack of three) at +X, which also puts
the more interesting of the two on the near corner rather than behind
the monitor.

Four things are less obvious than they look.

- **The plan is set by what stands on it, and the depth was measured
  rather than estimated.** The CRT's funnel ran 4.8 units back from the
  stand and the keyboard 2.6 forward of it, so the kit occupied very
  nearly 12 units of depth. A guess of 3 for the funnel made an earlier
  desk 10.5 deep and the monitor then hung over the back edge —
  invisible at the home framing and obvious the moment the camera swung
  to a side view. `KIT_Z_MAX` in `scene.js` carries the figure
  `window.__fit("computer")` reports, and it is not the keyboard's front
  edge (6.2) but the front of its painted *contact shadow* — a quad
  lying on the desk, which would otherwise hang off it in mid-air.
- **The kit is placed by that front figure, not by centring it.**
  `KIT_FRONT_Z` is held where it was when the funnel was deeper, and the
  1.47 units the shorter funnel freed became clear walnut behind the
  monitor. **Do not restore the `-(KIT_Z_MIN + KIT_Z_MAX) / 2` form**:
  it looks tidier, and it moves `SCREEN_TARGET` — the one thing the
  fly-in cannot have move.
- **`DESK_TOP_Y` is 9, and true to scale it would be about 11.4.** A
  real 29-inch desk under a 17-inch CRT is nearly two-thirds desk, and
  at that ratio the machine is a detail on top of a cabinet — and the
  frame would have to pull back far enough to shrink the CRT, the thing
  a visitor is meant to click, by about a fifth.
- **The drawer fronts are overlay fronts and the pedestal carcase stops
  short of the front to make room for them**, with a dark panel closing
  it. That is what makes a reveal a gap you can see into. Standing the
  fronts 0.05 off a full-depth shell fails twice: the reveals show cream,
  so a stack reads as one panel with scratches on it; and a front 0.03
  clear of the face behind it is far inside one texel of a shadow map
  spread over a large box, so the contact comes back as a dotted line of
  acne down every edge. (It is clean under the current moon rig's finer
  texel — see [lighting.md](lighting.md).)
- **The knee hole is a hole.** There is floor visible under the modesty
  panel, and that gap is most of what says the desk stands on the ground
  rather than being drawn onto it. Filling the opening with a solid
  panel reads as a block of grey between two cabinets. What closes it is
  the modesty panel at the back and the apron at the top; the pedestals'
  inner walls are already there and only need skinning in `INTERIOR`,
  which is far darker than it "should" be as paint — the key never
  reaches in there, but the fill still lifts a cream interior to within
  a shade of the lit outside.

**Every painted part is a plain `BoxGeometry`.** `RoundedBoxGeometry`
gives a fillet whose UVs collapse to a sliver, so a texture carrying
per-texel noise is minified to nothing across it, and what comes out of
the anisotropic filter is a regular bead of highlights running down
every corner — the desk looked riveted. Nothing here is round enough at
the size it renders for the fillet to be worth that. The wood slab is
the exception and keeps its `RoundedBoxGeometry`: its edges are
genuinely soft, and its map is a photograph with no white noise in it to
alias.

## The paint, and the wood

**The wear needs two textures because it is two different problems.**
The shells want a *tiling* field so a large flat panel is not one dead
colour; the drawer fronts want a *per-face* one, because wear on a
sixty-year-old desk collects where hands and chair arms reach — along
the edges, around the pull, along the bottom lip — and a tiling texture
cannot know where its edges are. Both come out of one draw as an
albedo/roughness pair, the same trick `plasticTextures` plays in
`computer.js`: on real paint the chipped patches are also the duller
ones, and roughness alone is invisible on a surface this matt.

Three figures were found the hard way and are easy to get wrong again:

- **Chips are sized against how big the face renders, not how big the
  texture is.** A drawer front is about ninety screen pixels across at
  the establishing shot, so a chip two texels wide is a fifth of a
  pixel. At r = 1.6-4.8 they are invisible; at 4.5-9.5 and several per
  face they read as mould. Two or three at four-ish texels is the band
  where they are legible and still small.
- **Scuffs are banded by height but not by width.** Weighting them
  toward the two ends as well puts a column of short strokes down each
  vertical edge, and once a stroke runs off the texture the clipped
  remains read as stitching down the side of every drawer.
- **Repeat is a trade and both ends have been seen.** Tile the shell
  field often and each lattice cell lands small but the *tile* repeats
  visibly — at six across a pedestal end it reads as a quilted diamond
  grid. Tile it rarely and one cell spreads into a damp patch. Two tiles
  over ten world units, ten cells in each.

**The shells get their chips as decals**, not in their texture, for the
reason above: "near the edges and the handles" is a statement about
where a panel ends. A handful of small quads on the faces the camera
sees, biased to the perimeter. `size` there is in world units and the
default is not a guess — the chip fills a little under half its texture,
so a quad much under a third of a unit lands at two or three screen
pixels and is simply not there.

**`ENAMEL` is darker than it needs to be at the home framing, because of
the ends of the orbit leash.** A pedestal end is a large flat panel
whose normal points along -X, so at a light raking in from near that
direction it takes about four times the direct light the floor does. At
a brighter value the whole panel clipped to white at the left clamp and
lost every chip and scuff on it.

The top is Poly Haven's CC0 "Wood Table 001", vendored to
`public/textures/` at 512 with its provenance beside it. The scan is a
dark stained walnut and the brief asked for a warm *medium* tone, so it
carries a per-channel gamma lift baked in at vendor time, which puts the
channel means on roughly `#6b4a33`. In the material, the grain runs *up*
the file, so the UVs are turned a quarter turn to put it along the
desk's length as a solid slab's would be; and the repeat is set from the
desk's own dimensions rather than left at 1, so the grain keeps the same
physical scale on the top, the edges and the ends instead of stretching
to fit whichever face it lands on. `roughness` is 1.9 because it
*multiplies* the map, whose own range sits around 0.24 — the product is
a satin 0.4-0.55.

The three jpgs are **the only asynchronous asset in the scene**, so
`buildDesk` returns a `ready` promise alongside its root — see
[lighting.md](lighting.md) for why that matters under reduced motion.

**Two dark plates finish what the flat end of the orbit leash can nearly
see.** At 2° above the floor the eye sits at y ≈ 9.1 — a seventh of a
unit above this desk's own surface — so the slab's underside and the
pedestals' box bottoms are still just turned away, and neither plate is
visible at the clamp itself. They are there because a seventh of a unit
is not a margin: move `ISO_TARGET` or `ORBIT_DOWN` at all and the eye
goes under the slab, and what it would find is lit walnut and a cream
box bottom, the two surfaces on this desk that were never meant to be
looked at. Both are plates rather than re-modelled parts — inset 0.04
from the silhouette so they change nothing at any framing that was
already right, and thin enough that at a grazing view they read as the
shadow line under an overhang. The slab's plate also closes the one real
gap in the knee hole's ceiling, between the back of the apron and the
apron face.

The desk is grounded with painted contact shadows under each pedestal,
for the same reason the computer's are: a shadow-map texel never resolves
the gap under a 0.55-unit foot.
