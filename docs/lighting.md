# The night lighting

Read this when touching the moon, the fill, the tube's spill, the
shadow box, or the tone mapping.

**Four sources and nothing else.** There is no `AmbientLight`: an
ambient is a flat lift with no direction in it, which is exactly what a
night room must not have — it is what makes a dark scene read as a grey
scene. Intensities read ~3x high because three's physical lighting
divides by PI.

| | colour | intensity | what it does |
|---|---|---|---|
| moon | `#8FA3D8` | 5.5 | the only thing with a direction; casts |
| hemisphere | `#3A3560` sky / `#1C1A2A` ground | 30 | the bounce, and the only light on most surfaces |
| CRT spill | `#5FE3D4` | 8.5 × picture brightness | the keyboard and the walnut in front of it |
| desk lamp | `#FFB866` | point + spot × lamp level | the pool on the walnut, the shade, the keyboard's left end |

The lamp's two figures live in the lamp module rather than beside the
other three, next to the geometry that sets them, and are written as
`base * LAMP_SCALE ** decay` so the pool stays the same brightness as
the fixture is re-scaled — see [lamps.md](lamps.md). Every figure in the
table is calibrated with the lamp **on**, because that is the state the
page opens in.

These were set against the picture, through `window.__lights`, which
moves all four knobs on one page load: four numbers that only mean
anything against each other cannot be bisected one build at a time.

## Aiming the moon through the window

A `DirectionalLight` has no position, only a direction, but "coming
through the window" is a statement about a **line**. Both ends are
derived: the opening's centre comes off `ROOM_PLAN.window`, which
room.js writes from the same two constants it cuts the hole with, so
moving the window re-aims the light instead of leaving it shining at a
wall. `MOON_AT` is where the beam is pointed.

**`MOON_AT` was searched for rather than tuned**, and the search is
worth keeping because the answer is not obvious. The window's centre is
at y 12.6 and the desk top is at 9 only 3.2 units in from the wall, so:

- a beam shallow enough to run the length of the room is already below
  the desk top before it has left the wall — it lights the pedestal's
  left flank and nothing else;
- a beam steep enough to land inside the room lands *on* the desk, and
  the desk's own shadow then covers every piece of floor beyond it.

Six aims were shot and five lit no floor at all. The one that works goes
mostly **forward in +z rather than across in +x**: by the time it
reaches the desk's near edge it is already past it in depth, so it
crosses the desk top, clears the front edge and lands on the floor and
the rug. That is the pool in the shot. `_lightshots.mjs sweep` re-runs
all six. The elevation that falls out is **28°**, much steeper than the
old daylight key's 13°, which is consistent rather than a compromise:
the moon is drawn high in the window's own sky texture.

## The window wall casts, and only the window wall

Nothing else in the room casts — a dollhouse's light comes through its
missing walls. The exception is the left wall, and it is what turns the
beam into a window-shaped pool **striped by the sash and the two
mullions**: the field around the opening is a real hole and the joinery
casts too. It is the single thing that makes the light read as coming
from somewhere.

The right wall still does not cast and would wreck it if it did: the
light travels toward +z, so the -z wall is upstream of everything and
would shadow the whole room. It is a receiver — the far wall the beam
lands on.

Two consequences:

- **The frozen shadow map is load-bearing in a new way.**
  `shadowMap.autoUpdate` is off and the map is rendered once, at the
  home framing, where the cutaway has the left wall visible. If it were
  re-rendered while the camera had swung round far enough to cull that
  wall, the room would flood with moonlight. `window.__lights({ at })`
  sets `needsUpdate` deliberately — it is a dev handle, and the only
  thing in the file that does.
- **The large pool on the floor at the flat end of the orbit is light
  passing *over* the wall, not through the window.** The wall is 19 tall
  and the beam descends at 28°, so everything past the point where the
  beam clears the wall top is lit over it. That is the dollhouse cutaway
  being what it says it is, and it is load-bearing for "not pitch
  black".

## The shadow box, and the bias

`bias` stays **0** and must. VSM does not compare depths, it compares a
depth against a variance-bounded estimate; a constant offset there
shifts the whole distribution and shows up as light leaking out from
under contacts, not as the acne it would cure under PCF. What does the
work is **`normalBias`, 0.035**, which walks the sample along the
surface normal by a distance in *world* units — so the right figure is a
function of how much world a texel covers.

`window.__shadowfit()` projects the room, the desk, the machine and the
treehouse into the light's own basis and prints the union against the
camera. The union is **-14.0..29.3 across, -13.8..27.0 up, 15.0..60.8
deep**, and the box clears it by about 1.5 on every face:

```
left -16  right 31   bottom -15.5  top 28.5   near 13  far 64
```

**Deliberately asymmetric** — the light comes in over one corner of a
room that is not square to it, so a box centred on the axis would spend
half its texels on empty space. 47 × 44 over a 2048² map is a texel of
**0.023 world units**, against 0.078 at the old ±80. `normalBias` 0.035
is about a texel and a half: under one the acne comes back at the
shallow end of the orbit, past about three the contact under the
monitor's base visibly detaches. That finer texel is why the drawer
fronts — 0.03-unit overlay steps — are clean under a light raking in at
28°. `shadow.radius` is 4 and `blurSamples` 16; the radius is a blur
width in *texels*, so it was raised when the box shrank.

**A receiver outside this box is no longer merely unshadowed.** The wall
casts, so it is a patch of floor flooded with moonlight that should be
dark. **Re-run `__shadowfit` after anything that moves the window, the
aim or the furniture**: the basis turns with the light, so those six
numbers do not survive a re-aim.

## The exposure is a lighting control

**`TONE_EXPOSURE` is 1.3**, and it is not interchangeable with raising
the lights. The lights lift the bright albedos as fast as the dark ones
— and this room has exactly one bright albedo, the desk's enamel, which
goes white long before the floor comes up. The exposure lifts the bottom
of the curve, where everything dark actually lives. At the 0.95 it was
set to under the old daylight rig the room's median pixel read 4/255 and
over half of it sat under 8: the walls and floor were being crushed into
the backdrop, so the diorama had no edges. Both knobs were swept
together; `_lightshots.mjs sweep` has the grid, including the two
single-knob rows that show neither alone gets there.

AgX is the honest alternative and was measured beside it: at 0.95 it
lands within a couple of levels of ACES at 1.9 everywhere, its toe being
gentler by about that much. ACES is what the restyle asked for, so ACES
is what is set and the exposure is what pays for its toe.
`window.__tonemap('agx')` switches on a live page, and the void's
pre-image follows the exposure because it is solved numerically rather
than baked — see `src/tonemap.js` for the asymmetry between the two
render paths and why the background clear needs a pre-image on one of
them.

The lamp moves the exposure a little, **upward as it goes out** — see
[lamps.md](lamps.md). `window.__lights({ exposure })` sets the *base*,
not the live value, or the loop would revert it on the next toggle.

## The HDRI is off

`ENV_INTENSITY` is 0, `loadEnvironment` returns before fetching, and the
128 kB HDRI is no longer requested at all. It was first left at 0.1 "for
the highlights", on the assumption that so small a number could only be
a reflection; the A/B caught that it was still doubling the median room
pixel (4 → 8) and lifting the walls from 3 to 7 — a fourth light quietly
doing a third of the fill, in a brief that says the room reads on three.
The hemisphere was re-tuned afterwards to make up the difference
honestly.

What it costs is measurable and small: the desk's chrome pulls go from 79
to 54 and the CRT's glass from 127 to 107, so both still read as
highlights, just duller. The asset stays vendored in `public/env/` with
its licence; restoring it is one constant.
`window.__lights({ env })` only does anything if `ENV_INTENSITY` was
non-zero at build, since otherwise there is no map to scale.

## The tube, and its spill

The screen material's `emissive` is a **pale** teal (`#B8F2EA`) rather
than the spill's own `#5FE3D4`, and that was measured against the fly-in
rather than chosen by eye: the same map carries the bitmap of the real
login for the length of the flight, and at full saturation the dialog,
its title bar and its text all went teal — a monochrome terminal, three
seconds before the live HTML arrives in colour. `emissiveIntensity` is
1.9: the tube is one of three lights in the room, not a bright object in
a lit one.

The `PointLight` in front of it has three unphysical-looking figures,
and two are deliberate:

- **`decay` is 1.25, not 2.** A tube is a 5×4-unit area source and this
  is a point; inverse-square put 75× more light on the bezel than on the
  keyboard 5.2 units away, so the bezel blew out before the keys saw
  anything. At 1.25 the ratio is about 8:1, roughly what the real area
  source would give.
- **The range is 11**, short where it matters: it dies about a unit
  before the desk's +x edge and never reaches the floor or either wall.
  It does graze the treehouse, which is correct — same desk, two units
  nearer than the edge.
- **It sits 0.9 in front of the glass, on the screen's own axis.**
  Dropping it toward the desk lit the keys harder but made the bezel
  glow asymmetric, and `recessShadowTexture` already describes where the
  lip shades the picture — two accounts of the same thing, disagreeing.

**scene.js owns what it runs at, computer.js owns where it is and how it
falls off.** The loop writes `SCREEN_GLOW × picture brightness` every
frame, but there is no loop under reduced motion and none before the
first tick, so `buildScene` writes it once as well. Left to
computer.js's constructed value the two paths would disagree the moment
`SCREEN_GLOW` moved, and the symptom would be a dim tube for exactly the
visitors who get a single static frame.

## The walnut is the only asynchronous asset

`TextureLoader.load` is fire-and-forget, so on any path that draws a
single frame and stops — reduced motion — nothing noticed the three
512px jpgs arriving and the desk top rendered in its base colour and
stayed there. That used to be covered *by accident*: `loadEnvironment`
resolved after the HDRI, well after the jpgs, and re-rendered. Turning
the HDRI off took the re-render with it.

`buildDesk` returns a `ready` promise alongside its root, settled (on
error as well as on load) when the three files have landed, and scene.js
draws one more frame on it. The reduced-motion variant is not a
formality: it is the only path with no loop to paper over a late asset.

## What "moody but not pitch black" is, as a number

`window.__histogram()` reads the framebuffer back after a draw and
buckets the luma of every pixel that is **not the void** — the only
honest denominator, since most of a desktop frame is backdrop and
counting it would let any scene pass by being mostly empty. At home on
1440×900 the night rig lands around: median room pixel **10-11**, p95
**~125-140**, share under luma 8 **~32%**, back wall **9**, desk enamel
**168**, and the keyboard **~90-150 lit against ~57 unlit** depending on
the fixture's throw.

The room's own statistics barely move when the lamp is switched, which
is the point: the lamp is a *local* light and a whole-frame histogram
cannot see one. What moves is the surface the beam is aimed at.

`window.__probes()` is the per-surface companion and `window.__pixel(u,
v)` reads one pixel by screen fraction — which is the one to use when the
question is "is that part of the *picture* black", because a world point
can quietly land on the wrong surface and report something true about
somewhere else.
