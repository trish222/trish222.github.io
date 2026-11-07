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
- **`BACK_D` is 2.73, 35% shorter than the 4.2 it was built at**, on
  request: at a side view the machine ran nearly the whole depth of the
  desk with no walnut visible behind it. It is shortened **from the back
  only** — `FUNNEL_FRONT_Z` is an offset from the bezel rather than a
  fraction of the funnel's own depth, so the bezel, the glass and
  `SCREEN_TARGET` do not move. That was checked rather than assumed:
  `#screen`'s client rect at the home framing *is* the projection of the
  screen plane's corners, and it is identical to three decimals at both
  depths. The gain is 1.47 of clear desk behind the monitor.

## What carries the realism

The silhouette was already right; what was missing was everything a real
desk has that a clean render does not.

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
- **The screen is on.** `screenTexture()` draws an abstract desktop —
  teal ground, one window, a taskbar — into an offscreen canvas, then
  composites it through `blur(1.5px)` plus a wide low-alpha pass for
  phosphor bleed, and lays scanlines over it. The blur matters: a crisp
  bitmap on the glass looks like a screenshot pasted onto a render.
  Scanline pitch is 5px in a 576px texture so the lines survive being
  drawn at ~200px across — finer pitches average away to nothing. A
  small `PointLight` in front of the tube spills onto its own bezel; see
  [lighting.md](lighting.md) for what it runs at and why its decay is
  unphysical.
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
  noise field comes out as two textures: a wide-range roughness/bump
  map, and a near-white albedo map with a few percent of value swing.
  Roughness alone was invisible — on a surface this matt the sheen
  barely moves, so the shell read as one flat colour whatever the
  roughness did. Both maps share a field on purpose: on real plastic the
  duller patches are also the darker ones. Scale matters as much as
  amplitude — at 512px tiled twice across the shell a texel is about a
  device pixel, and the blotches sit at a tenth of a tile; 256px tiled
  six times averages away to flat vinyl at the size the machine actually
  renders.
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
