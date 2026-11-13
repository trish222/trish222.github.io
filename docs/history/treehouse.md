# The treehouse

Read this when touching `src/treehouse.js` — the brick-built cherry
blossom treehouse on the desk to the right of the monitor, and the spare
bricks in front of it.

Original model, built from boxes and round studs. No logos on the studs,
no minifigures, nothing imported. Local space matches the desk's and the
computer's — +Z is the front — with the origin on the **desk top**, so
`scene.js` only lifts the group by `DESK_TOP_Y`.

It follows `design-references/cherryblossom.png`: a bonsai cherry with a
flared root ball, a strong S-curved trunk exposed for the lower half,
two bare low branches with a puff of blossom apiece, and one broad
asymmetric cloud above.

## The two rules that bound everything

**`STUD` is 0.3, which is double scale, and that is the decision
everything hangs off.** A desk unit here is a shade over two inches, so
a true-scale brick would have a 0.15 pitch — and at the home framing
that is a five-pixel stud. The model would read as a speckled blob. At
0.3 a stud is about ten pixels and a course can be counted. The model
has been taken down three times and the pitch has not moved on any of
them: every figure that is a **count** of bricks comes down instead.
Same bricks, fewer of them. **Shrinking the pitch is the one change this
model cannot afford** — which also bounds `TREEHOUSE_SCALE` from below,
since a group scale takes the stud with it.

**The whole model is sized against the monitor, not the desk.** The
machine stands 6.60 above the desk top. A model level with it reads as a
second object competing with the thing a visitor is meant to press; the
ceiling is the **6.25** that once did. With `TREEHOUSE_SCALE` (1.1733)
the top of the tree is **4.62**, about 70% of the machine.
`_canopyfit.mjs` prints the figure.

## Reading as a build, not as a plant

Three passes over the whole kit, and together they are what separate
this from a sculpt that happens to be made of boxes.

- **`GLOSS` multiplies every roughness the kit is asked for**, rather
  than each call site being retuned, so the relative spread stays —
  bark duller than petal, grass between them — and the model moves
  together. 0.55 takes the kit's 0.42 default to 0.23, which is a hard
  small highlight on a 0.3-unit face. `BRICK_ENV` goes to 0.55 against
  the furniture's 0.34 for the other half of it: on a matt surface an
  ambient env only flattens, while on a glossy one it is what puts a
  sheen on the faces the key never reaches.
- **`BEVEL` is 0.09**, about a pixel and a half of lit edge per seam at
  the home framing. That is the entire mechanism by which a stack of
  same-coloured bricks reads as a stack; without it two pieces share one
  unbroken face. Much past 0.09 and a 1x1 starts to read as a pebble.
- **Orientation is quantised** — see the trunk.

## The trunk

**It is a curve, not a stack of courses.** Three bonded courses can lean
and twist but cannot bend back: a stack of axis-aligned footprints has
no way to make the reference's S, where the trunk goes out one way low
down, crosses back through its own axis and leans the other way under
the crown. So `TRUNK_SPINE` is six points, `TRUNK_CURVE` a Catmull-Rom
through them, and the bricks are stepped along it the way a branch's
are, each turned so its own up axis runs along the tangent.

- **The taper is in the footprints** (`TRUNK_SIZES`: 4x4 at the foot,
  then 3x3, 3x2, 2x2 at the fork), not in a scale. A scaled brick is not
  a brick.
- **The twist per piece does the work the bond used to do.** Stacked
  courses got their knuckles from alternating the long axis; a swept
  trunk gets them from rolling each piece further round, so the corners
  stagger down the silhouette instead of lining up into four long edges.
- **A brick-built limb cannot point a brick anywhere it likes.** Turning
  each piece to the exact tangent draws a perfectly smooth tube out of
  boxes: correct as geometry and wrong as a model, because the one thing
  a build does that a sculpt does not is *step*. `steppedQuat` snaps both
  the tilt and the roll. The two steps are deliberately different sizes:
  `TILT_STEP` is the coarser at 18° because it is the one the silhouette
  shows, and `ROLL_STEP` is 22.5°, a little over three of `twist`, so
  corners stagger down a trunk in threes instead of spiralling.
- **The overlap is tighter than a branch's** — 1.14 of the step against
  1.26 — because the trunk wants its course lines to read where a branch
  wants its bends closed up. **Less overlap is the point rather than a
  saving**: the less one piece buries the next, the more of the seam
  between them the bevel gets to draw. Both are options on
  `buildBranch`, which is curve-driven (`step`, `overlap`, `twist`,
  `bands`, `shade`).
- **`TRUNK_TOP_Y` is 2.35**, which is what makes "exposed for the lower
  half" true: the tree tops out at 3.73 above the lawn.

**The roots are short branches, not a plinth**, and they have to leave
the trunk *part way up it* — what makes a root ball read is wood coming
**down** out of the trunk to meet the plate, not a ring of planks lying
on the grass. They leave between y 0.24 and 0.46 (`ROOT_PLAN`) at five
uneven angles and reaches, and the flare itself is the trunk's own 4x4
bottom piece, whose outline the roots break up.

**The S's upper extreme lives in Z rather than X, and that is not
cosmetic.** Screen-x is roughly `0.8x - 0.6z` at this camera, so +x and
-z both go screen right: the spine reads the same either way, while
keeping the trunk inside the house's footprint instead of bursting out
of a wall or a roof slope.

**The two low branches are bare and are not a mirrored pair.** The -X
one leaves lower (`t` 0.30) and dips at its tip, the +X one leaves
higher (0.54) and lifts; a matched pair reads as a crossbar through the
trunk. `lowBranchCurve(i, lawnY)` is the single source for each, the way
`limbCurve` is for a canopy limb: the swing hangs off the +X one and a
blossom cluster off both, and neither may hold a private copy of where
the branch went.

## The house

Three studs square, two wall courses, deck at y 0.80 and ridge at 2.29 —
under the canopy floor at 2.42, with the trunk running on past it to the
fork. 1.49 tall from the deck, which is what let it move off the fork
and onto the exposed trunk.

- **The door is one stud wide, not two.** On a three-stud wall a
  two-stud door leaves half a stud either side and reads as a missing
  panel; 0.3 x 0.72 is a door's own proportion.
- **The round window is applied to the flank, not punched through it.**
  At a one-stud plan the opening is 0.3 by 0.36, whose diagonal is
  bigger than any frame small enough to suit a house this size — so a
  hole shows notches at its corners. The ring standing proud still
  throws the shadow line, which was the only thing the hole was for.
- **The rail is two newel posts with plate caps.** A one-stud porch has
  no run between post and wall for a side rail.
- Every literal `2` in `buildHouse` was a statement about a five-stud
  plan, so the wall lines are derived: `WALL_X`, `WALL_Z`,
  `DECK_FRONT`. The bond, the doorway, the gable, the rail and the strut
  feet all read off them.

**The house straddles the trunk, and that was forced rather than
chosen.** A 0.9-wide house cannot clear a 0.9-wide trunk on a 2.68 lawn:
every "beside the trunk" placement puts the deck or the ladder's foot
off the plate. So the house sits on the trunk and the trunk rises behind
its back wall, which the Z-shifted S is what makes possible. No notch is
needed; checked from front, flank and back.

## The canopy

**One broad, layered cloud above the house: 1.3 tall against about 3.5
wide, leaning back-right, with one end reaching far out and the other
drooping low.**

**It is laid on the stud grid, and that is the change that makes it a
build.** `markClump` resolves the sub-lobe volumes onto a grid (`CELL`
in plan, one plate in height, counted up from the lawn) and `bakeCanopy`
turns the marked cells into pieces. The shape is resolved onto the grid
before anything is emitted, so its outline can only ever come out a
staircase — there is no stage at which a smooth surface is approximated,
because the cells *are* the model.

`bakeCanopy` is four passes, and the order of the first two is the whole
performance story:

1. **Colour**, from `tintFor` — but the draw is a hash of the cell's
   *patch* (two cells square, three layers deep, which is one brick
   course) rather than of the cell. That is both what a builder's bag of
   parts looks like and what lets the next pass merge anything at all:
   per-cell colour would make every run one plate long.
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
   the draw takes a flower the stud is not drawn at all. `TOP_BLOOM` /
   `EDGE_BLOOM` are those shares. `SIDE_BLOOM` adds a few on
   outward-facing vertical faces, axis-aligned — the crown is seen from
   the side as much as from above, and a bare plate wall there reads as
   a wall. Flowers point the way their stud does; `SIDE_BLOOM` is what
   fills the role facing-outward used to.

Two figures carry a rasterisation fact rather than an aesthetic one: **a
voxelised lobe finishes about half a cell short of its nominal radius**,
because only cells whose *centres* fall inside are kept, and the
shortfall is taken off each sub-lobe separately — so a clump of four
first came out as four islands with grid gaps between them.
`LOBE_SUB_R` went up (0.58-0.92) and `LOBE_SUB_OFF` came in
(0.20-0.46), which closes the gaps while the clump's own extent stays
put, since the two pull opposite ways. `LOBE_SUBS` is 3-5 for the same
reason.

Two things made the cloud a cloud:

- **Every clump is an oblate spheroid, not a ball** (`LOBE_SQUASH`,
  0.58). A cloud assembled out of spheres is at least one sphere tall
  everywhere, so widening the limb reaches only ever gave a wider dome.
  The squash scales the y of every offset inside a clump — the
  sub-lobes' displacement *and* the sphere each one is rasterised into
  — so it cannot be applied twice to some offsets and not at all to
  others.
- **Every leader off the trunk is more reach than rise.** A leader that
  climbs carries a ball; a leader that runs out carries a cloud.
  `LIMB_PLAN` is five of them (W, N, E, S, and C — the one short stem
  that goes up), eleven second-generation limbs that are where the width
  comes from, and seven twigs whose tips sit at six different heights.
  **A top edge is bumpy because the wood under it is**, not because the
  blossom on it is noisy.

**The asymmetry is deliberate and its direction is not arbitrary.** The
long reach is N1 and its twig, out to z -2.54 with barely any rise — and
it goes mostly in **-z** rather than +x because -z is screen-right too
and costs almost nothing in world x, which is the figure
`_canopyfit.mjs` watches against the desk's near edge. The droop is W2,
out and forward and *down* to y 2.22 with its flowers hanging to 1.98,
on the -x/+z side. A second, smaller droop (E3) keeps the first from
looking like a mistake.

**The palette is mostly white and pale pink with a scatter of coral**,
after the reference, which reads white from across the room. Four tints:
`PETAL_WHITE`, `PETAL_PALE` (barely pink — the second dominant),
`PETAL_PINK` (a minority) and `PETAL_CORAL`.

**The coral is drawn flat, not against depth, and that is the trick.**
In the reference it falls in small patches all through the crown — on
the skyline, in the shade, out on the twigs alike — so grading it the
way the pinks are graded would collect it somewhere and read as a stain.
Everything else *is* graded by depth: pink deep inside, white out on the
lit surface.

There are **two coral shares, because a plate is not a flower**.
`CORAL_SHARE` is 0.08 for the flowers, and past about 0.15 the crown
turns orange. The *structure* runs at `CORAL_PLATE`, a quarter of it: a
patch of plates covers roughly ten times what a flower does, so the same
share came back as slabs of orange and the crown read as a maple.
`PLATE_LIFT` is the same arithmetic applied to the pinks — the three
graded tints were balanced against flowers, so the structure's draw is
pushed toward the white end.

**The pip is a warm cream** (`BLOSSOM_EYE`) at `STUD * 0.125`. Against a
mostly-white canopy a saturated yellow dot reads as a daisy, and a
thousand of them as a field of them.

**The tips are what keep the outline from being a rim.** Without them
every clump ends at its own lobes, and a dozen clumps ending at their
own lobes is a dozen arcs — the same moulded edge, just stepped. `TIP_N`
single cells per clump, marked out to `TIP_REACH` times the radius and
biased away from `CANOPY_HEART`, are the whole difference between an
outline you can see the sky through and one you cannot. Each comes out
as a 1x1 plate with a flower clipped to it. A tip always loses to mass,
so one stepped off a clump that lands inside the next is simply
absorbed.

**One small cluster hangs on each low branch** (`LOW_LOBE_R`,
`LOW_LOBE_FLOOR`). They are most of what says the crown is a cloud
*above* a tree rather than the whole tree, and they need their own floor
— `CANOPY_FLOOR` is 2.42 and these hang at 0.8 to 1.5. On the +X branch
the cluster sits past both of the swing's ties, so the ropes and the
seat stay clear.

**The keep-out follows the roof; it is not a box over it.** A point is
inside the house only if it is under the slope's own height at its own x
(`roofTopAt`), plus a clearance that tapers from nothing at the eave to
`RIDGE_CLEAR` at the ridge. With no clearance the blossom lies on the
roof everywhere and, since the camera looks down at 20°, the whole roof
goes under — *nestled* becomes *buried*. With the taper, blossom laps
the lower slopes and the eaves while the ridge stays clear. **A clear
void over the porch** (`inPorchVoid`) is the only place the canopy is
told to stay away outright: it covers the doorway, the rail and the
ladder.

## Placement, and the batching

Placement is `TREEHOUSE_X` / `TREEHOUSE_Z` in `scene.js`, at
**(8.1, -2.1)** — x moved +1.2 when the desk went 20% wider, z did
not — set against what is already on that half of the desk
rather than by eye: the mouse's painted contact shadow runs x 3.5..5.7
over z 2.0..4.6 and its cord crosses x 1.5..4.5 over z 0.4..2.6. The
depth is the less obvious half — screen x is roughly `0.8x - 0.6z` and
depth toward the camera is `0.57x + 0.75z`, so a model placed level with
the monitor sits screen-right of it *and in front of it*, and the canopy
crosses the bezel. `TREEHOUSE_FACING` is `AZIMUTH - 0.50`: AZIMUTH is
the yaw at which the model's +Z looks straight down the lens, so the
offset *is* the three-quarter angle. At 0.14 it was a front elevation and
the round window was edge-on.

**`TREEHOUSE_SCALE` is 1.1733, a group scale rather than a rebuild**,
applied about the model's own origin — on the desk top at the base
plate's centre — so the model grows and shrinks in place and the base
plate stays where it was set down. Re-run `_canopyfit.mjs` **and**
`_tightfit.mjs` after touching it, the first because it fails safe and
the second because it is the truth.

**Everything goes through a batching kit**, keyed by shape *and* colour,
and nothing reaches the scene until `bake`. Repeated pieces come out as
one `InstancedMesh` per batch — the base plate's studs alone are about
120 instances in one draw call, and the canopy's ~1,030 flowers are
eight meshes, four petal tints plus their pips. The whole model is **~790
instances in 64 meshes**, which `_canopyfit.mjs` prints. Two
consequences: footprints are canonicalised, so a 4x2 brick and a 2x4
brick are one geometry and a right angle; and studs are not part of a
brick, so every stud of a given colour in the whole model is one batch
whatever it sits on. **Scale lives in the instance matrix, not in the
batch key** — a large blossom and a small one are the same geometry —
which is what lets the canopy vary freely in size without splitting a
draw call.

`limbCurve(i, lawnY)` is the single source for a canopy limb's path and
`lowBranchCurve(i, lawnY)` for a low branch's; `buildBranches`, the
swing and the canopy all call them, so re-aiming a limb carries what
hangs off it. `LIMB_PTS` resolves the whole table once at module scope,
and a gen-0 limb's start comes off the spine by its `tt` rather than
being written down, so re-shaping the S carries the whole crown.

## The spare bricks

Four loose pieces on the desk in front of the model, as if left over
from building it — a 2x4 in `PLANK`, a 2x2 in `PETAL_PINK`, a 1x2 in
`GRASS` and a two-brick stack (`PLANK_ALT` under a crossed
`PETAL_PALE`), at four different yaws. They are the one thing on this
desk that says somebody put the tree together rather than bought it.
`SPARE_PLAN` is the table; `buildSpareBricks` is the only other export
`treehouse.js` has.

- **They are their own group, not part of the model**, added by
  `scene.js` as a sibling named `spares`. That is a tooling decision as
  much as a modelling one: `_canopyfit.mjs` measures the model's world
  box against the desk's, and a brick dropped two units in front of the
  tree would quietly move the front-edge margin it reports.
  `__fit("spares")` reads this one.
- **Their frame is the desk's, not the model's**, with the origin on the
  desk top at the desk's own centre, so `scene.js` lifts them by
  `DESK_TOP_Y`, shifts them by `SPARES_X` and applies no yaw. Every
  clearance they have to hold is stated in the desk's frame. Measured
  with `_spares.mjs`: **2.18 clear in x of the computer kit's +x
  extent** (the mouse's painted contact shadow), 1.48 to the desk's +x
  edge and 3.32 to its front; the cord never comes near. The gap
  `_tightfit.mjs` prints against the treehouse is **+0.42**.
- **`SPARES_X` is 1.2, and it is the same +1.2 the model took** when
  the desk went 20% wider — a *group translation*, not an edit to
  `SPARE_PLAN`, so the plan's four x figures stay the numbers they were
  measured as. Moving the two together by one delta is what preserves
  the clearances above: the canopy's +z overhang and the desk's +x edge are
  relative to the model and so untouched by construction, and the
  mouse clearance is the one that *improves* (0.98 -> 2.18), since the
  mouse does not move and the bricks walk 1.2 away from it. Note this
  is the one thing `SPARE_SCALE`'s note warns against doing at the
  group — but that warning is about *scaling* there, which would walk
  the pieces back toward the mouse. A translation has no such effect.

  Those four clearances are the budget `SPARE_SCALE` spends, and the
  treehouse is the binding one — `_spares.mjs` reads the *conservative*
  box there, so watch for it going negative while the true gap is still
  positive.
- **`SPARE_SCALE` is 0.7784, carried in each piece's own matrix rather
  than on the group.** The group's origin is the desk's centre, so
  scaling there would walk all four bricks a share of seven units back
  toward the mouse — a move dressed up as a resize. In the matrix the
  batch key is untouched, so these still share geometry with the build's
  own bricks. The stud offsets take the scale in the brick's own space,
  before the pose; left on the full-size grid they would walk off the
  ends of a resized brick.
  **The number to compare it against is not 1.** The model carries
  `TREEHOUSE_SCALE` as a group scale and these carry none, so what
  decides whether a loose piece reads as the same part as the ones in
  the build is the *ratio* — currently ~66%, a brick that belongs to the
  build while sitting a little smaller than one in it. **If
  `TREEHOUSE_SCALE` moves, this ratio moves with it** and nothing
  recomputes it; the two constants are independent and only this note
  ties them together.
- **One is tipped onto its side.** Three bricks lying flat at three
  angles still reads as an arrangement; a brick resting on a long face
  is the one that reads as dropped. `tip` rolls it a quarter turn about
  its own length, which puts its studs out sideways and its resting
  height at half its width. Its footprint is kept w <= d so the
  canonicalising quarter turn in `looseBrick` never lands on top of the
  roll.
- **They cast for real.** Everything else small on this desk is grounded
  with a painted contact shadow, because a shadow-map texel cannot
  resolve the hairline under a base plate. A brick is a different case:
  it stands a third of a unit tall, so it throws a visible soft shadow
  across the walnut.

`looseBrick` is what places them: the kit's own `brick` is y-up and
yaw-only, since it puts a piece on top of whatever is already there,
which is what building *is*. A piece lying where it fell needs a full
quaternion. It canonicalises footprints the same way and multiplies the
quarter turn on the **right**, so it happens in the brick's own frame
before the pose does — which is what keeps it correct for a piece that
is also rolled onto its side.

## Current figures

Top of tree **4.62** above the desk top, **70% of the monitor's 6.60**.
Every margin is positive on the true box:

| | `_canopyfit.mjs` | `_tightfit.mjs` (true) |
|---|---|---|
| margin to the desk's +x edge | -0.00 | **+0.53** |
| margin to the desk's back edge | +0.84 | **+1.05** |
| clearance to the live overlay @1440x900 | +25px | **+45px** |
| gap from the spare bricks in z | — | **+0.51** |

**The +x edge is the one with no slack, and the two columns disagree
about it on purpose.** `Box3.setFromObject` takes the AABB of a
*rotated* AABB for an `InstancedMesh`, and this model is yawed half a
radian, so the conservative figure over-reports that edge by about
0.5-0.76 at this scale. Read it as: the model passes on its real
geometry and has nothing spare on the fail-safe check. **Keep
`_canopyfit.mjs` as the check anyway** — it fails safe, and a
conservative bound that over-warns is worth more than one that can
quietly pass. Read `_tightfit.mjs` beside it before acting, in either
direction.

The free corridor on that half of the desk bounds any future increase:
it runs from the computer kit's +x extent (5.7) to the desk's own edge,
which the 20% widening took from 9.75 to **11.65** — so **5.95 units
wide** where it was 4.05. The model still spans **4.60** of it, and the
+x margin that used to be thin is now comfortable: `_tightfit.mjs`
reports **1.23** against the old 0.53, and the gap from the canopy to
the live glass roughly doubled, 45px to **80px**. That gap is the
figure to watch rather than the margin, because it is what keeps the
monitor the obvious thing to press.

**One framing is still cropped, and it is the portrait one.**
`_finalshots.mjs` reports the model's NDC box at `x1` **1.36** at home on
a phone (1.25 before the +1.2 move), against 0.62 on desktop — so a
sliver of the canopy's right side is outside the frame there, and the
move made that sliver wider: about 60% of the model's projected width
is inside a portrait frame now, against 72% before. That is the price
paid for the desktop clearance above, and it was taken deliberately. Part of that is the
conservative box again, but the picture really is clipped. It is the
same trade the desk's own ends take on a portrait viewport, and the
lever is `TREEHOUSE_X` at the portrait breakpoint, not the scale.
