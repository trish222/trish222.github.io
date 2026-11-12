# The computer

Read this when touching `src/computer.js` — the CRT, its stand, the
keyboard, the mouse and the picture on the glass.

Built from primitives. Shape comes from `crt-computer.png` (thick bezel,
recessed screen, button panel bottom right, green LED) and
`crt-computer-big.webp` (deep tapered back, side vents, round stand).
Local space: **+Z is the front**, origin on the machine's own ground
plane; `scene.js` lifts the group to `DESK_TOP_Y` and seats it by
`KIT_FRONT_Z`.

`FACING` is 0: the machine is square to the floor grid, so its bezel
edges run parallel to world +X and the screen turns to face left.
Against the camera azimuth that lands on a three-quarter view after
`crt-computer-full.jpeg`, front and one side both in play — and it is
what brings the side vents into shot. The view is weighted toward the
front rather than even because the camera is swung 8° off the symmetric
45°; the machine itself has not turned.

Three things are less obvious than they look:

- **The bezel is an `ExtrudeGeometry` with a hole, not a box.** A solid
  box plus a dark inset panel cannot make a recess — the panel just
  covers the screen, which renders the screen as a grey rectangle. The
  hole sits above centre (`OPEN_CY`) so the bottom bezel is the
  deepest, which is where the button panel and LED go.
- **Vents are slats over a dark cavity**, so the gaps read as the slots.
  Their x position is derived from the funnel's taper at that depth —
  hard-coding it leaves them floating off the surface. **Their depth is
  a share of `BACK_D`** for a second reason: a vent panel is flat and
  the flank it sits on slopes, so the two only agree over a limited run
  of z, and how far the ends drift is set by a slope that steepens as
  the funnel is shortened. Scaling the panel with the funnel keeps the
  slats as flush as they ever were. Only the gap behind the bezel's rear
  wall is absolute, because that wall does not move.
- **The body is tall, with broad shoulders and a smooth tapered rear.**
  `MON_W` is 6.0, `MON_H` is 6.5 and its centre is at `MON_Y` 4.50.
  The picture plane is 4.55 × 3.50, with `OPEN_CY` 0.48 keeping the
  opening above centre. The rear is 4.0 deep and narrows to 0.66 of its
  shoulder dimensions through a smooth profile. The front casing is
  1.55 deep; its broad outline has 0.48 corners and a 0.13 bevel, with
  five bevel segments. The tube sits 0.5 behind the front-face datum,
  inside a sloped reveal rather than on top of a flat bezel.
- **The stand supports the deeper body.** A wider neck and a 2.8 ×
  0.38 × 2.7 saddle carry the tube's centre of mass over the existing
  round foot. The saddle sits behind the front edge of the housing,
  so the swivel joint reads as a support rather than a point of contact.
- **The overlay follows the actual glass.** `scene.js` projects the
  screen mesh's world matrix using the exported screen dimensions, so
  geometry changes carry through to the live HTML overlay automatically.
  The interaction registration check reads the geometry rather than
  obsolete literal screen dimensions.

## What carries the realism

The CRT silhouette uses a tall front, broad moulded edges and a deep rear.
The details below give it the material and everyday character of a real desk.

- **The keyboard is a 101-key layout, not a grid.** `keyLayout()` lays
  the field out in key units (`KU` is the pitch) from rows of widths —
  1.5u Tab, 2.25u Enter, 6.25u space — plus the nav cluster and numpad,
  with the tall `+` and Enter spanning two rows. The ragged right edge
  of the alpha block and the two side clusters are what identify a
  keyboard at a glance; a uniform grid reads as a placeholder.
  Single-unit caps go in one `InstancedMesh`; the wide and tall ones get
  their own geometry so the corner radius is not stretched with them. A
  dark `well` under the caps keeps the gaps between keys from showing
  shell plastic. The whole thing is rotated ~2° off square, because
  nobody aligns a keyboard to their monitor.
- **The screen is on.** `drawPicture()` draws an abstract desktop —
  teal ground, one window, a taskbar — into an offscreen canvas, then
  `compositePicture()` runs it through a soft blur plus a wide low-alpha
  pass for phosphor bleed, and lays scanlines over it. The blur matters:
  a crisp bitmap on the glass looks like a screenshot pasted onto a
  render. A small `PointLight` in front of the tube spills onto its own
  bezel; see [lighting.md](lighting.md) for what it runs at and why its
  decay is unphysical.
- **The picture is authored at 768x576 and rasterised at 1536x1152.**
  Every figure in `drawPicture` is in design units and the context is
  scaled on the way in, so the resolution can move without re-deriving a
  window border. `compositePicture` cannot use the same trick —
  `ctx.filter` blur radii are not reliably transformed — so it takes the
  scale as a multiplier instead. The 2x is **not** for the idle desktop,
  which is ~250px across at the home framing; it is for the fly-in,
  where the same map carries a `SCREEN_BASE_W` bitmap of the real page
  and takes most of the viewport with it (about 68% of the width on a
  1440px frame since the arrival stopped covering it). At 768 that
  bitmap was downsampled to 60% before it was ever drawn. The cost is the one per-frame cost in
  the module: `setMix` redraws the whole canvas during a hover fade, and
  that went from 0.40ms to 1.60ms median — measured, and only on a
  pointer device, and only for the ~0.4s the fade lasts.
- **Scanline pitch is 3.5 design px, finer than the 5 it was.** That is
  only affordable because of the 2x raster and the anisotropy: at 576px
  with isotropic mips a finer pitch averaged away to a flat grey wash,
  which is what the old figure was guarding against. The duty cycle is
  held at 40% dark, so the picture does not darken as the lines get
  finer.
- **The greeting is the one typeset thing left in the scene.** The
  window's body shows `hello` in Playfair, drawn with canvas 2D into the
  texture — so the face has to be *resident* before the first 3D frame.
  `loadScreenFont` is what `initScene` awaits, and the font is preloaded
  from `index.html` off `public/fonts/` for the same reason: discovering
  it through the lazy scene chunk's stylesheet is far too late.
- **Two cables.** At this camera the floor directly behind a body is
  hidden by it — screen-up is world -Z — so a cable run only becomes
  visible once it breaks out sideways past the silhouette. That is why
  the keyboard cord swings left and the mouse cord crosses open floor.
  They ride on `lift` with the things they plug into. `CABLE` is
  deliberately darker than the shells; at shell colour a cord reads as a
  scratch on the floor.
- **The case is not one moulding.** A dark frame standing a hair proud
  of the bezel wall gives the shell seam; the rear shell uses its own
  slightly cooler `PLASTIC_BACK`; the stand gets a moulded step and a
  dark swivel collar; and `plasticTextures()` carries a low-frequency
  value-noise octave under the per-pixel grain, so the plastic ages
  unevenly instead of reading as one uniform surface.
- **The plastic is textured through `map`, not just `roughnessMap`.** One
  noise field comes out as two textures: a roughness/bump map, and a
  near-white albedo map with a few percent of value swing. Roughness
  alone was invisible — on a surface this matt the sheen barely moves,
  so the shell read as one flat colour whatever the roughness did. Both
  maps share a field on purpose: on real plastic the duller patches are
  also the darker ones. Scale matters as much as amplitude — at 512px
  tiled twice across the shell a texel is about a device pixel, and the
  blotches sit at a tenth of a tile; 256px tiled six times averages away
  to flat vinyl at the size the machine actually renders.
  **1024px tiled once was tried and rejected**: it is the *same* texel
  density, because what lands on a surface is `size * repeat` for
  `RoundedBoxGeometry`'s per-face UVs and `ExtrudeGeometry`'s
  object-unit UVs alike — so it bought nothing but a less regular blotch
  field, for 45ms of main-thread loop against 9.4ms and 8MB of texture
  memory. Measured, both figures.
- **The shells are a *yellowed* beige, at about 0.5 roughness.** Every
  tone was pushed toward yellow at roughly constant luminance (blue down
  ~10 points, red up ~6), so the plastic reads as aged without moving
  the value the room's lighting is calibrated against. The roughness
  figure passed to `plasticMaterial` is the one *before* the map
  multiplies it: the band in `plasticTextures` is 0.77..1.0, so a 0.56
  shell lands at about 0.5 with a few hundredths of swing. The old band
  started at 0.54, which spread the same mean over 0.37..0.69 and let
  the duller patches go chalky. `KEY_WELL` is darker again than
  `PLASTIC_DARK`: the gaps between the caps have plastic on four sides
  and nothing but the tube's spill reaching in, so they are the darkest
  beige on the machine.
- **The monitor has broad moulded edges; the peripherals keep small
  chamfers.** The bezel uses a 0.48 outer corner radius, a 0.13 bevel
  size and 0.14 bevel thickness with five bevel segments, giving the
  tall housing a rounded highlight. Its 1.55 total depth runs back from
  the front-face datum, keeping the glass recess explicit. The keycap
  radius remains 0.014, the buttons' 0.016 and the keyboard shell's 0.06,
  so their smaller edges still read crisply. `curveSegments` is 14 to
  keep the bezel outline smooth.
- **Every canvas texture here is built by `canvasTexture`**, which sets
  the renderer's maximum anisotropy — handed to `buildComputer` the way
  `buildRoom` takes it. That is the biggest sharpness win on the
  machine and it is not about resolution: at a three-quarter view the
  bezel, the badge and the picture are foreshortened hard along one
  axis, and isotropic filtering picks the mip level off the *compressed*
  axis, handing back a texture a level or two blurrier than it was drawn
  along both. The mip chain stays on, so the scanlines and the grain
  still average cleanly rather than shimmering.
- **The shell is kept out of the floor's value range**, with
  `envMapIntensity` at 0.34 — the HDRI was ambient from every direction,
  so it filled exactly the faces the key never reaches (the right flank,
  the funnel) and flattened the body. It is moot while
  `ENV_INTENSITY` is 0, and is the figure to restore against if the
  HDRI ever comes back.
- **Three of the monitor's shadows are painted, not cast.** A bezel lip
  or the gap between a monitor and the base it sits on never lands on a
  shadow-map texel, and GTAO is desktop-only, so nothing on a phone
  supplies them either. `recessShadowTexture` is a black alpha frame
  over the picture, heaviest down the left and across the top where the
  lip stands between the glass and the light; `sleeveShadowTexture` is a
  sleeve of shade down the stand's neck, darkest under the collar;
  `baseShadeTexture` darkens the top faces of the foot and the step,
  which look straight up into the underside of the monitor and would
  otherwise be the brightest plastic in the scene instead of the
  darkest. The base gradient is deliberately flatter than the
  contact-shadow one — only a narrow ring of each disc is ever visible,
  and a falloff that has faded by the rim leaves the stand looking lit.
- **The contact shadows come in pairs.** A broad blob is the ambient
  shade a body throws on the surface under it; it falls off over a
  couple of units, so it says "something is above this" rather than
  "this is touching". Inside each one now sits a tight blob —
  `CONTACT_CORE`, flat to 0.78 and then gone, scaled a little wider than
  the foot or the keyboard it sits under so its full strength reaches
  the rim rather than hiding under the body. That pair is what reads as
  weight on the walnut. **Every broad footprint is exactly the one it
  was and every core sits strictly inside one**, which is not cosmetic:
  these quads are children of `root`, so `pickTarget` raycasts them and
  `Box3.setFromObject(computer.root)` measures them — a blob a unit
  wider is a unit more desk that counts as a press on the machine. The
  cores sit 4mm higher, because coplanar would z-fight.
- **GTAO `scale` tops out around 1.15 here.** Pushed to 1.35+ the
  sampling noise shows as blotches on the flat of the bezel — the one
  surface in frame with nothing in the depth or normal buffer for the
  denoiser to lock onto, so widening its kernel only smears the noise
  into larger blobs. 1.15 with `samples: 24` is clean; 12 samples is not
  enough at that scale.
- **The badge says `TRISH T-1500`.** No real brand may appear on the
  bezel, so the model number is ours.

## Hover

Hover is raycast from `window` rather than the canvas, because the
canvas only takes events while `orbit-live` is on the body and a move
over the chrome still has to be able to turn the hover off; events over a
window or the taskbar are ignored. One raycast per move feeds two things
— the hover value and the canvas's cursor, which says what a press will
do: `pointer` over the machine or the lamp, `grab` over the room,
`grabbing` mid-drag. The easing is time-based, not per-frame, so the
picture settles at the same speed regardless of frame rate.

**Hover happens on the screen, not in world space.** The machine does
not move at all. `screenDisplay()` builds *two* composited pictures —
the idle desktop and the same desktop with the greeting in the window
body — and `setScreen(v)` crossfades them into one live `CanvasTexture`,
which `scene.js` drives from `hover.value` alongside the brightness
bump. The two pictures are identical outside the window body, so the
alpha blend only changes what it should. `setScreen` skips the redraw
and the texture re-upload once the mix has settled, so a still hover
costs nothing per frame. The live HTML overlay covers the picture at the
arrival, so what the crossfade drives in practice is the glow spilling
onto the bezel; hover switches off entirely once the fly-in starts.

`buildComputer` returns `lift` — the machine's meshes and the cables
hang off it, while the contact shadows hang off `root` and stay on the
desk. Nothing moves it now, but **if anything ever animates the machine
again it has to move `lift`**: moving `root` takes the contact shadows
up with it and they float as a detached grey blob.

## CRT geometry review

The scoped CRT update passed the production build and `check-build`,
plus five desktop/mobile interaction configurations. Visual review was
**Ship** for the CRT geometry scope. The user attachment was unavailable
for comparison, so these checks establish the implemented silhouette and
interaction behaviour, not exact fidelity to that attachment.

Review captures: [desktop](../references/monitor/desktop.png),
[angled](../references/monitor/angled.png),
[mobile](../references/monitor/mobile.png) and
[focused](../references/monitor/focused.png).
