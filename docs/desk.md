# The desk

Read this when touching a desk module — the thing everything else in
the room stands on.

**`src/desks/executive.js` is the one the room ships with**, a bulky
walnut executive desk. `src/desks/classic.js`, the steel tanker desk
that used to be it, is kept, still builds and still satisfies the same
contract; it is reachable with `?desk=classic`.

## The contract

A desk module exports:

| | |
|---|---|
| `buildDesk()` | returns `{ root, ready }` — origin on the **floor** at the centre of the desk, +Z the front; `ready` settles once any asynchronous map has landed |
| `disposeDesk()` | frees what `buildDesk` tracked |
| `DESK_TOP_Y` | height of the top surface — what everything standing on the desk is placed against |
| `DESK_TOP` | `{ X, Z, W, D }`, the **usable top** in the desk's own local space: the slab's centre and its extent |

`scene.js` calls all of it through one `deskMod` object rather than
bound imports, for the same reason the lamp does. `DESK_TOP` is what
lets a different desk carry the same arrangement: `seatToDesk` turns
the scene's seats — authored with x from the slab's centre and z from
its **front** edge — into the loaded desk's frame by a single rigid
translation, so the machine, the lamp, the treehouse and the spare
bricks keep their spacing exactly.

**The frame the seats were authored in stays the classic desk's top**,
even though the classic desk is no longer the default. It is where the
figures were measured and what every argument beside them is stated in;
re-basing it onto the executive top would change what those notes mean
while changing nothing on screen. It is a datum, not the default — so
`classic` still comes out at zero on both deltas, and `executive`, half
a unit deeper and centred the same way, comes out at `SEAT_DX` 0 and
`SEAT_DZ` +0.3.

**That +0.3 is the one thing making executive the default moved**, and
`COMPUTER_Z` with it. Rule 1's "the arrival pose must not move" is
about not moving the glass by *accident* — by re-centring the kit, by
nudging the desk — and `SCREEN_TARGET` is read off the screen mesh's
world matrix precisely so a deliberate move of the desk carries the
fly-in's destination with it instead of stranding it. A different desk
is the one change allowed to move it, and it moved it exactly once.

**`?desk=<name>` swaps the desk in the real room, and it is dev only** —
`src/desks/<name>.js`, behind `import.meta.env.DEV` like `?lamp=`, so
rollup drops the branch and every module only it reaches. Today that
means **`classic.js` is absent from production**, not executive. Verify
it the way the perf meter is verified: `npm run build`, then grep
`dist/` for a marker only that module has (`0xc2b79e`, the tanker
desk's cream enamel — a wood tint will not do, both modules carry
walnut).


## executive: the walnut executive desk, the one the room ships with

`src/desks/executive.js`, reachable with `?desk=executive`. A
traditional double-pedestal executive desk after the reference
photograph: a heavy moulded top with a crossbanded border, reeded
pilasters at every front corner, a raised-panel cabinet door under a
drawer on each pedestal, a stepped moulded plinth, and the pull-out
writing slide left half out over the knee hole.

- **Two figures are not its own.** `DESK_W` is the tanker desk's 22.8
  to the unit — that width is set by the left wall, and the brief asks
  for about the same anyway — and `DESK_TOP_Y` stays 9.0 for the reason
  above. All the extra bulk is in the plan and in the weight of the
  mouldings: `DESK_D` is 13.2 and the pedestals are 6.1 across against
  5.2, which takes the knee hole from 11.3 to 9.5. `DESK_TOP` is
  `{ X: 0, Z: 0, W: 22.8, D: 13.2 }`, so the arrangement on top moves
  0.3 forward with the front edge and keeps its spacing exactly.
- **The top edge is three bands, not a rounded slab.** A bullnose cap
  at full size, a thin cove set back furthest, and a fascia nearly
  flush below it. What reads is the shadow line the cove leaves.
- **The grain direction is a per-part decision**, which is why `wood()`
  takes a rotation and works the repeat out from it. The scan's grain
  runs up the file; a quarter turn puts it along the part's width. One
  material for the whole carcase would run the grain the same way
  through members at right angles — the look of a thing veneered from
  one sheet rather than built.
- **One scan, many parts.** The two jpgs load once and every material
  takes `Texture.clone()`s with their own repeat, so the pair still
  uploads once. The catch is that a clone made before the image lands
  carries its own `version` and three will not re-upload it: hence
  `pendingClones`, which the load callback bumps. Without it the first
  frame uploads an empty texture and nothing replaces it — and under
  reduced motion that first frame is the only one.
- **Reeds, not flutes**, on the pilasters. A groove this shallow fills
  with its own shadow under a key that rakes in almost horizontally
  and reads as three dark lines; a bead catches the lamp along its
  crown, and a highlight survives a dark room.
- **The mouldings are applied strips standing proud**, not grooves cut
  into the panel. A reveal narrower than a shadow-map texel is not
  there; a strip 0.09 proud casts its own line at any map resolution,
  and still reads at the azimuth clamps where the face is near
  edge-on. The two long strips run full width and the short ones butt
  between them — a mitre is under a pixel here and costs four
  non-axis-aligned parts per door.
- **The brass is antique, not the reference's near-black bronze.** At
  this metalness there is no diffuse term to carry a dark fitting, and
  in a night room a bronze pull is a pull-shaped hole.
- **The plinth needs its painted contact shadow more than the tanker
  desk's feet do, not less.** The tanker desk paints one because a
  texel never resolves the gap under a 0.55-unit foot; here there is no
  gap at all, and a solid mass meeting the floor with no darkening at
  the joint is the clearest tell that a thing was drawn onto a picture.
- The knee hole's ceiling is the top's own underside plate, which
  already spans the whole footprint. A second plate there would be two
  coplanar boxes fighting for the same depth.

## classic: the steel tanker desk, no longer the default

Kept because it satisfies the same contract and is the A/B for
anything the executive desk does differently.

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

### The paint, and the wood

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

## The nameplate

`src/nameplate.js` — a dark walnut wedge with a brushed brass plate on
its sloped front face, the name engraved into the brass. It stands on
the **left of the top, just in front of the lamp**, at
`NAMEPLATE_X` / `NAMEPLATE_Z` in scene.js (-6.8, 0.9 in the seat
frame, so (-6.8, 1.2) in the world),
turned `AZIMUTH * 0.26` — square to the desk is where someone sitting
at it would set one down, and a quarter of the way toward the lens is
what buys back some of the legibility 37° off-normal costs without it
reading as aimed at the viewer. The rest of that is bought by the
face's own lean rather than by more yaw; see below.

Scale is the real thing at the room's own: 3.25 x 0.78 x 0.9 units is
an 8 x 2 x 2¼-inch nameplate, set against the keyboard's 6.9-unit
17-inch width rather than against the desk, because the keyboard is
what the eye reads scale from. The clearances it was placed by, as the
yawed solid's own box measures them — the keyboard's painted contact
shadow at 1.01, the walnut's left edge at 2.91, its front edge at
4.66, the lamp's own box at 0.46 and its contact shadow at 0.37 — are
written out beside the constants.

**The lamp is what it is placed against now, and in front of it is
where the light is.** The beam lands at (-8.05, -0.92) and spreads
forward, so walking the plate back toward the base walks it into the
pool: the brass measures a median 57 of 255 across its own face at
z 4.8, 78 at 3.6, 95 at 1.8, 99 at 1.2, 100 at 0.95 and 105 at 0.75,
and `_platesweep.mjs` is that walk kept runnable.

The curve flattens long before the walk has to stop, so the seat is
chosen on the **gap** rather than on the light: 1.2 leaves 0.46 to
the fixture's box and 0.37 to its contact shadow, which is a strip of
lit walnut you can see between them; 0.95 leaves 0.12 and the two read
as one object; 0.75 has reached the fixture and crossed into its
shadow. Behind the base is the one place on this half of the desk the
shade's own shadow falls, which is the other half of why the plate
goes in front of it rather than beside or behind. It stood at 5.4,
then 4.5, then 1.8, all of which left it out on the front half of the
desk with the lamp behind it.

It is still not pickable, but it now stands in front of something
that is: 31 of 169 points over its *projected box* — the top of the
box, which is mostly the lamp's base seen above and behind the
wedge — come back `lamp` from `window.__pick` (`_platepick.mjs`),
where the same grid gave 20 at z 1.8. That is one press doing one
thing, which is the rule; it is the number to watch if the plate goes
back any further, because the share of it that is really *the plate*
with the lamp behind grows with every unit.

Three things worth knowing before touching it:

- **It is not pressable and cannot become so by accident.**
  `pickTarget` raycasts the lamp's root and the computer's, so an
  object in neither can never take a press (rule 2). Its meshes also
  carry a no-op `raycast`, which is belt and braces for anything that
  ever raycasts the whole scene.
- **The brass reflects the lamp's room, but it is not the lamp's
  finish.** `brassKit` in `src/lamps/greenlamp.js` hands back the
  colour, the roughness, the grain and — the part that matters, and
  the part that is still shared — the same drawn equirect, so a patch
  moved in `brassEnvironment` moves on both objects. It takes a
  `register` callback because everything else in that module is freed
  by `disposeLamp`, which would be the wrong owner here twice over:
  the nameplate outlives no lamp swap, and under `?lamp=lamp` that
  module's `disposeLamp` is never called at all. The plate then
  re-finishes the material it was handed — `PLATE_BRASS`,
  `PLATE_ROUGH` 0.45, `PLATE_METAL` 0.76 and a horizontal brush in
  the roughness map. A near-mirror at 0.27 reflected one thing from
  this pose, the unlit end of the room, and measured 5..12 of 255
  across its whole face with the lamp on: it was black. Brushed and
  with a diffuse quarter it measures 40..70 lit and 20..35 with the
  lamp off, which is the "clearly readable lit, faintly legible dark"
  the plate is for. Re-finishing cannot reach the fixture — `brassKit`
  builds a fresh material per call and the lamp makes its own.
- **The plate is two meshes, and the split is about UVs.**
  `ExtrudeGeometry` generates UVs from world position, so there is no
  0..1 face on the bevelled sheet to centre a line of type in. The
  sheet carries the bevel and the plain brass; a plane a hair proud of
  it carries the engraving on a proper 0..1 UV, with a clone of the
  same material so the environment, grain and roughness cannot drift.

The engraving is a pair of 1024-wide canvases drawn in one pass: the
colour, and a height field used as a `bumpMap`. The colour carries a
lit lower lip two pixels below the letters, a thin burnished rim
stroked round them, and the near-black cut over both; the height field
carries the same rim as white and the same letters as near-black, so
the groove is genuinely recessed and keeps reading as a groove from
poses the painted rim was not drawn for. The rim is a stroke rather
than the blurred halo it replaced — a blur that wide lifted the field
around the name and cost the letters their contrast once the brass
went gold.
The field is deliberately below white (`FIELD`, 0.84) so the halo has
headroom above it, and the face material's colour is lifted by the same
figure **converted to the working space** — 0.84 sRGB is 0.68 linear,
and compensating by the sRGB figure would leave the plate a fifth dark.
Playfair is the face, the same one the CRT's greeting is set in;
`loadScreenFont` is awaited before `buildScene`, which is the only
reason it is not quietly engraved in Georgia.

**It darkens with the lamp**, which the lamp's own brass does not need
to: that fixture is a hand's width from the bulb and its speculars
carry the switch, while this is eight units away and `metalness: 1`
has no diffuse term — lit by a drawn environment alone it would be the
one object in the room that did not notice the light go out. So
`applyLampLevel` scales its `envMapIntensity` between `ENV_OFF` and 1.
Two uniform writes, no recompile, and nothing moves: the frozen shadow
map stays valid (rule 3). The wedge needs none of it — it is a
dielectric lit by the lamp itself.

The wedge casts and receives; it is built inside `buildScene`, so the
single shadow pass that follows and freezes the map is the one that
renders it.
