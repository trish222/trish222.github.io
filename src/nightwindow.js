import * as THREE from "three";

/* ==========================================
   THE WINDOW ON THE LEFT WALL

   A six-pane landscape sash in a painted casing, with a night sky
   behind the glass and rain running down it. Its own module for the same reason
   the desk and the treehouse are: it is a self-contained object with
   its own origin on the surface it is fixed to, and it is the thing
   most likely to be re-tuned next — the night lighting pass still has
   to make this the room's light source rather than merely look like
   it (see "The moonlight" below).

   **Local space.** x is across the opening, 0 at its centre; y is up,
   **0 at the sill line** (the bottom of the opening); z = 0 is the
   wall's *inner* face, with the wall's thickness running back to
   -thickness. That is exactly the frame src/room.js builds a wall
   panel in, so room.js only has to place this group at the opening's
   centre and the two cannot disagree about which way the wall faces.

   **The opening is a real hole.** room.js cuts it out of the wall
   field with an ExtrudeGeometry hole and reads the size from
   `OPENING` below, so the two are one number rather than two. The
   glass then sits mid-thickness, which leaves a reveal on both sides —
   the room-side one is most of what says the wall has a thickness at
   all.

   Everything here is built from primitives in code, like the rest of
   the scene: boxes for the joinery, two planes for the glass and the
   rain, and two canvases drawn with 2D.
   ========================================== */

/* --- The opening -----------------------------------------
   **Landscape now, and the home frame's top edge is what decided
   it.** It went 8 x 6.4 -> 9.5 x 12 -> this. The portrait figure was
   right about what a window in a nine-foot wall is and wrong about
   what the shot can hold: its head stood at world y 22 against a
   frame that cuts the wall at 18.6 on desktop, so a quarter of the
   glass, the head casing and the whole meeting rail were never in the
   hero framing at all. A window reads bigger by filling more of the
   frame, not by standing above it.

   **The ceiling here is a diagonal, not a number**, which is the one
   thing worth knowing before re-tuning either figure. The wall
   recedes from the camera, so the frame's top edge crosses its inner
   face at world y 17.88 at this opening's back edge, 18.87 at its
   centre and 19.86 at its front (`_winhead.mjs` prints the sweep).
   18.6 was only ever the figure at the *old* centre, z -2.

   14 x 8.2 is set against the middle of that diagonal: the sill stays
   at 10, the glass head lands at 18.2 and the casing head at 18.85,
   level with the 18.87 the frame allows at the centre line. What
   crops is a wedge at the back top corner — the glass head is above
   the cut only behind about z -4.75, and by at most a third of a unit
   — so **99.7% of the glass is in shot** against roughly 72% before.
   It is 61% of desk.js's DESK_W across, against 42%.

   Two things pay for the width. WINDOW_Z in room.js came forward from
   -2 to 0, because at 14 across the sill's ear would otherwise have
   gone through the back corner; and the sash is divided into six
   panes rather than four, which is what keeps a pane near-square
   (4.27 x 3.64) instead of the letterbox a single pair of bars would
   have made of it. `_wincrop.mjs` is the A/B. */
const OPEN_W = 14.0;
const OPEN_H = 8.2;

/* What room.js cuts, and what it places this against. One source. */
export const OPENING = { w: OPEN_W, h: OPEN_H };

/* How far back from the inner face the glass sits. Mid-thickness on a
   0.6 wall, so the reveal reads from both inside and out. */
const GLASS_INSET = 0.33;

/* --- The joinery ------------------------------------------
   Casing (architrave) over the wall face, a sash frame and a pair of
   mullions inside the opening, a sill with ears, and an apron under
   it. The sill is the proudest part and the apron the shyest, which is
   the order a real window stands off a wall in. */
/* **Every member went up with the opening**, by about the 1.3x the
   two sides grew by. Scaling them is not pedantry about joinery: the
   casing, the sash and the mullions are the only things in the
   assembly with a width, so leaving them at the figures that suited a
   hole 8 units across would have made a window half again as big look
   like the same window seen from closer to — thin, flimsy trim around
   a lot of glass. The depths (`CASE_OUT`, `SASH_D`, `APRON_OUT`) did
   *not* move: those are how far a board stands off the wall, which is
   a property of the board and not of the hole. */
const CASE_W = 0.65; // architrave width
const CASE_OUT = 0.26; // how far it stands off the wall field
const SASH_W = 0.34; // the sash frame around the glass
const SASH_D = 0.14;
const MULL_W = 0.25; // the three bars that make six panes of one sheet
const SILL_T = 0.38;
const SILL_PROUD = 0.58; // how far the sill projects into the room
const SILL_EARS = 0.4; // and how far past the casing, each side
const APRON_H = 0.6;
const APRON_OUT = 0.16;

/* The joinery is a half-step lighter than room.js's TRIM (#40395c) and
   that is deliberate rather than an oversight: a window frame with a
   bright sky behind it tends to silhouette, and at this value the
   proud faces still pick up enough ambient for the casing, the sill
   and the mullions to read as separate pieces instead of one dark
   cut-out. The sash is darker than the casing — it is deeper into the
   reveal, where less reaches it. */
const CASE_PAINT = "#4a4269";
const SASH_PAINT = "#3b3556";

/* --- The night outside, in layers ------------------------
   **It was one picture on the glass and it is a set of planes behind
   the wall now.** A single textured pane is a sticker: orbit the room
   and the city turns with the window, because it *is* the window. The
   opening is a real hole in the wall field (room.js cuts it), so
   there is nothing stopping real depth going in behind it — and depth
   is the one thing that makes a view read as a view. Walking the
   camera round from the front to the right clamp now slides the near
   rank of roofs across the far one and the moon the other way, which
   is parallax, and no amount of painting gets it.

   **Every layer is a flat unlit quad with a canvas on it.** No
   lighting, no shadows, no depth write; the whole backdrop is six
   extra draw calls and nothing per frame but the rain's one float.

   `x`, `y` and `z` are the window's own local space — x across the
   opening from its centre, y up from the sill line, z back from the
   wall's inner face — so the whole stack travels with the opening if
   room.js ever moves it.

   **The sizes are measured, not generous.** A backdrop plane only has
   to cover what can be seen of it *through the opening*, which is a
   question about where the four corners of the hole project onto its
   plane from every pose the orbit leash allows. `_parallaxfit.mjs`
   casts exactly those rays on both viewports and prints the union;
   these are its figures with about a unit of margin. That is also why
   each plane is offset along local x rather than centred on the
   opening: the oblique poses all skew the footprint the same way, and
   a plane centred on the hole would have to be twice as wide to cover
   the same ground.

   **Every figure here was re-read when the opening went landscape**,
   and the stack did not simply grow: a hole 14 across and 8.2 tall
   shows more of each plane sideways and less of it vertically, so the
   widths went up by three to six units and the *heights came down* by
   three to five. The centres moved further than either — the vertical
   ones by as much as three and a half — because a wider hole skews
   the oblique footprints further along the wall and further down.
   Sizing the new opening with the old heights would have brought each
   plane's bottom edge into view at the high end of the leash.

   **Nothing goes deeper than 9, and that is a wall-height limit.**
   The planes live outside the building, where the only things between
   them and the camera are the two walls — so the only ways to see one
   other than through the window are over a wall top, and the walls
   are WALL_H 34 tall. At depth 9 the footprint reaches world y 24.8
   and the plane's own top edge sits at 25.8, nine clear of the wall;
   a deeper plane would need a taller footprint and the sky would
   clear the wall at the steep end of the leash. */
const LAYERS = {
  /* Gradient, cloud and the glow over the city. The deepest thing
     here and the only one with no silhouette in it. */
  sky: { x: 33.2, y: -5.7, z: -9.0, w: 76, h: 43, tex: [1024, 580] },
  /* Three ranks of roofs. Each is lighter and hazier than the one in
     front of it — distance reading as the city's own glow in the air
     between, which is the only depth cue a silhouette has. */
  cityFar: { x: 24.0, y: -3.0, z: -6.5, w: 59, h: 34, tex: [1024, 590] },
  cityMid: { x: 15.5, y: -0.5, z: -4.2, w: 44, h: 26, tex: [1024, 606] },
  cityNear: { x: 8.9, y: 1.5, z: -2.4, w: 32, h: 19, tex: [1024, 608] },
  /* The far rain falls outside the glass, between the near roofs and
     the pane. */
  rainFar: { x: 5.6, y: 2.5, z: -1.5, w: 26, h: 16 },
};

/* Drawn in painter's order rather than sorted into one. Every layer
   here is `transparent` with `depthWrite` off, so three would sort
   them by the distance to each plane's *centre* — and these centres
   are tens of units apart along the wall, which is not the order they
   stack in from the window. An explicit `renderOrder` says the order
   outright. The joinery stays at the default 0 and so draws over all
   of it; `depthTest` is left on, so the wall still occludes the lot
   everywhere the hole is not. */
const ORDER = {
  sky: -60,
  moon: -55,
  cityFar: -50,
  cityMid: -40,
  cityNear: -30,
  rainFar: -20,
  glass: -12,
  rainNear: -10,
};

/* --- The palette -----------------------------------------
   **The whole backdrop is pitched below the room now, and that is a
   composition rule rather than a colour preference.** The lamp-lit
   desk is the subject; a window brighter than the thing it is behind
   pulls the eye out of the picture and leaves the interior reading as
   the dark part of the frame. So the sky is near black at the top and
   only a shade lighter at the horizon, the ranks of roofs are
   silhouettes rather than blocks of colour, and everything that used
   to carry saturation carries less of it. What light there is comes
   from two places the eye accepts at this hour: the moon, and the
   city's own glow lying on the horizon.

   **Each rank is still quoted against the one behind it, not
   picked.** A silhouette has no shading to read depth from, so the
   only thing separating three ranks of roofline is how far each has
   been lifted toward the glow in the air in front of it. At these
   values that lift is a few points rather than a few tens — the near
   rank is almost the black of the void and the far one is barely off
   the sky — which is what distance actually looks like when there is
   no daylight in the air to haze with. */
const SKY_TOP = "#05070f"; // near black-navy, and the top of the picture
const SKY_HORIZON = "#10141f"; // only just lighter, and nearly grey
/* The city's light in the air just over the roofs — sodium and
   streetlight haze, so warm orange-brown rather than the blue the
   rest of this is. It is the one warm thing outside, and the only
   reason a near-black roofline reads as a roofline at all: the ranks
   are seen *against* this band, not against the sky. Kept to a third
   of the alpha the old cold glow had. */
const CITY_GLOW = "#7a5230";
const CLOUD = "#1a2030"; // dark grey-blue, and only ever a point or two of alpha
/* **Each rank is a vertical gradient, not a value**, and that is a
   correction rather than a flourish. Haze collects at the horizon, so
   a distant building is nearly the sky's colour where it meets the
   ground and nearly its own by the time it is a few storeys up. Flat
   fills got this backwards at the top: the sky darkens with height,
   so a far tower painted one value came out *lighter* than the sky
   behind its own roof — one pale block standing next to the moon,
   which is exactly where the eye was already looking. The pairs
   below are [foot, head]. */
const CITY_FAR = ["#0e1018", "#080a12"]; // lightest and haziest, and still nearly black
const CITY_MID = ["#080a12", "#05060d"];
const CITY_NEAR = ["#05060c", "#030408"]; // the darkest thing in the view
/* **The lit windows are the only pure light out there, so they are
   the first thing to go wrong.** Warm and dim for most of them — a
   bulb behind a blind, not a bulb — and a few off-white ones that are
   somebody still at a screen. Both are a long way under the old
   #ffd9a0 / #bcd4ff, which read as daylight through a hole at this
   exposure. */
const LIT_WINDOW = "#d8a868"; // most of them: a warm bulb behind a blind
const LIT_COOL = "#dcdcd6"; // and a few that are off-white instead
const COOL_SHARE = 0.16;
/* **How many of them there are, as one multiplier over every rank's
   own `lit`.** Halved: a skyline reads as late at night by how few of
   its windows are on, and the per-rank figures were set when the
   backdrop was lighter all over and a sparse scatter disappeared into
   it. One knob rather than three, because the three are quoted
   against each other. */
const LIT_WINDOW_DENSITY = 0.5;
const MOON = "#dfe4f0"; // not white: the brightest thing outside is still outside

/* The moon gets its own quad rather than a place in the sky texture,
   and the reason is texels. The sky plane is 70 units across; at 1024
   wide that is 15 texels to the unit, and a moon about 0.8 units in
   radius would be a 12-texel smudge with a halo made of bands. Its
   own 384 square over 8 units is 48 to the unit, so the disc is 38
   texels and the halo has somewhere to fall off. It costs one more
   quad and one small texture.

   Hung off the sky plane, and the two figures below place it **in the
   upper-right of what the window shows at home**. Right rather than
   left because that is the half a portrait viewport keeps: local +x
   runs toward world -z, which is screen right at this azimuth, and a
   phone frame crops this wall from the left. High rather than low
   because the roofs are in the bottom half.

   Both figures are read off `_layerview.mjs`, which prints the patch
   of each plane the opening actually shows. At home the sky plane is
   seen through local x 1.0..17.3 and y -3.7..5.8 on desktop, x
   2.2..17.8 and y -4.2..4.9 on a phone — a patch that got wider and
   shorter when the opening did, which is why **both figures moved**,
   (12, 4.6) -> (14, 3.1), rather than only the height.

   Put through that slice, x 14 lands the disc at glass x 4.2 on
   desktop and 3.6 on a phone: inside the right-hand light on both,
   and clear of the right-hand mullion at glass 2.39 by half a unit at
   worst. y 3.1 lands it at glass 5.9 and 6.6 — above the meeting rail
   at 4.23 and below the glass head at 8.2, by about a unit either way
   on either viewport. The disc is 0.69 of a glass unit.

   **The height is the tight figure on this opening too, and for the
   opposite reason.** It is no longer the frame that cuts: 8.2 of
   opening fits under the home frame's diagonal almost everywhere (see
   OPEN_W / OPEN_H). It is the sash. A landscape light carries its
   meeting rail across the middle of the view, so the moon has the top
   half of 8.2 to sit in where it used to have the top half of 12 —
   four tenths higher and the halo touches the head, four tenths lower
   and the rail crosses the disc. */
const MOON_AT = { x: 14.0, y: 3.1 };
const MOON_SIZE = 8.0; // the quad; the disc is a fraction of it
const MOON_TEX = 384;
/* **Smaller and dimmer than it was**, 0.1 -> 0.075. A moon is a small
   object: at 0.1 of an 8-unit quad the disc was 1.6 units across in a
   pane 8.2 tall, which is nearer a streetlamp than a moon and was the
   brightest thing in the frame by a wide margin — including the lamp
   the shot is supposed to be about. The halo reaches *further* as the
   disc shrank and carries a third less alpha, which is the trade that
   keeps it legible through glass: a soft wide falloff reads as scatter
   where a tight bright one reads as a bulb. */
const MOON_R = 0.075; // the disc, as a share of the quad
const MOON_HALO = 0.52; // and how far the glow reaches, likewise
/* A thin veil drawn on the moon's own quad, over the disc. The clouds
   in the sky texture are on the plane *behind* this one and can never
   cross it, so without this the moon is the one object out there that
   nothing can pass in front of — which is exactly how a sticker
   behaves. Two soft bands at a few points of alpha is enough: the
   disc dims where they cross it and the edge stays hard elsewhere. */
const MOON_VEIL = 0.14;

/* --- The rain --------------------------------------------
   One extra draw call over the pane: streaks are computed in the
   fragment shader from the pane's own coordinates, so there is no
   geometry, no texture and no per-frame upload beyond a single float.

   Injected into a MeshBasicMaterial through `onBeforeCompile` rather
   than written as a ShaderMaterial, and that is not a style
   preference. A raw ShaderMaterial gets none of three's fragment
   epilogue — no `tonemapping_fragment`, no `colorspace_fragment`, no
   fog — and this scene has an operator on one render path and
   `OutputPass` doing the same job on the other (see src/tonemap.js).
   The rain would have come out a different colour on desktop than on
   mobile, and unfogged on both. Patching a built-in material keeps all
   of that, and `opacity` stays the plain uniform the wall cutaway in
   room.js writes — so the rain fades with the wall it is set in
   without the fade code knowing it exists.

   **Two layers at two depths, which is a change from two layers on
   one plane.** It was both passes summed in a single shader on a
   single quad at the glass — depth you could see in the streak widths
   and not in the geometry, so the two moved together under the orbit.
   The far pass is on its own quad 1.5 back now (LAYERS.rainFar), so
   the thin rain slides against the fat rain as the camera comes
   round, and both slide against the roofs behind them.

   **The densities are per world unit, not per pane**, which they had
   to become the moment the two layers stopped sharing a quad: the far
   plane is 20 across where the near one is OPEN_W, and a column count
   quoted "across the pane" would have thinned the far rain to a
   drizzle on the wider one. `cols` and `rows` below are columns and
   cell-runs per world unit; each material multiplies them by its own
   quad. The figures are the old per-pane counts divided by the pane
   they were set against (11 and 1.9 over 9.5 x 12, 23 and 3.4 over
   the same), so the rain on the glass is the rain that was there. */
const RAIN = {
  near: { cols: 1.158, rows: 0.158, speed: 1.0, gain: 0.85 },
  far: { cols: 2.421, rows: 0.283, speed: 0.62, gain: 0.45 },
};
const RAIN_COLOUR = "#8e9ab8"; // moonlight caught on water, and not much of it
/* **Peak alpha of a streak's core, and the one knob over both
   layers.** 0.55 -> 0.3. Rain on a dark pane is something you notice
   at the second look; at the old figure the streaks were the
   brightest thing in the lower half of the window and they read as
   scratches on the glass rather than water running down it. The
   streaks got thinner at the same time (see `wide` in RAIN_HEAD) —
   alpha alone makes faint fat rain, which reads as mist. */
const RAIN_OPACITY = 0.3;
const RAIN_SPEED = 0.55; // cell-runs per second at `speed` 1

/* **Reduced motion.** There are two halves to this and only the first
   is load-bearing: scene.js runs no render loop at all under
   `prefers-reduced-motion`, so nothing ever calls `tickRain` and the
   glass is simply frozen — which is why the shader is written to look
   like rain at uTime 0 rather than resolving into one (each column
   carries its own phase offset, so the opening frame is already a
   scatter). The second half is this factor, which applies if a loop
   ever does run under reduced motion: a crawl rather than a stop, so
   the glass still reads as wet without anything streaking across it.
   `window.__rain()` reports which of the two is in force. */
const RAIN_SLOW = 0.12;

/* --- State ----------------------------------------------- */
let disposables = [];
/* Shared with the compiled program, so advancing time is one float
   write and no uniform plumbing. Kept at module scope because
   `onBeforeCompile` may run again — a tone-mapping switch changes
   three's program cache key — and must hand back the same object. */
const rainTime = { value: 0 };
let rainSpeed = RAIN_SPEED;
let rainReduced = false;

function track(x) {
  disposables.push(x);
  return x;
}

/* Deterministic, so the skyline and the stars are the same on every
   load. A city that rearranges itself on refresh cannot be
   art-directed. */
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/* ==========================================
   THE LAYERS, DRAWN

   One canvas per plane. Everything is 2D fills and radial gradients —
   no blur filter, because `ctx.filter` is the one part of the canvas
   2D API this scene would be relying on that some browsers still ship
   unevenly, and a soft edge is a gradient anyway.

   Each painter takes the layer's entry from LAYERS so the canvas's
   aspect matches its quad's: these planes are between two and seven
   times as wide as they are tall in places, and a square canvas
   stretched onto one turns every circle into an egg.
   ========================================== */

/* The palette above is hex because that is how a colour is read and
   compared; the painters need it with an alpha on the front. One
   place does the conversion, so a colour is never written twice. */
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/* A texture from a canvas, with the two settings every layer here
   wants: it is artwork in sRGB, and it must not wrap — a layer that
   repeated would put a second moon off the edge of the sky. */
function layerTexture(c, anisotropy) {
  const tex = track(new THREE.CanvasTexture(c));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.anisotropy = anisotropy;
  return tex;
}

function layerCanvas(layer) {
  const c = document.createElement("canvas");
  c.width = layer.tex[0];
  c.height = layer.tex[1];
  return c;
}

/* **Every painter below works in the window's local space, not in
   canvas fractions, and that is the whole reason the first attempt
   showed a flat wash.** These planes are not centred on the opening —
   they are offset tens of units along the wall, because the oblique
   poses skew the footprint that way (see LAYERS) — so the middle of
   each canvas is nowhere near the part of it the window shows. Art
   composed at `w * 0.5` lands off to the side of the view; the city
   went below the sill and the moon went behind the wall.

   `frame` converts: give it a layer and its canvas and it hands back
   x/y in local units and two length converters. Every figure in the
   painters is then a world-ish length — a building three units wide,
   a horizon one unit under the sill — and reads against the opening,
   which is 14 x 8.2 of the same units. */
function frame(layer, c) {
  const x0 = layer.x - layer.w / 2;
  const y0 = layer.y - layer.h / 2;
  return {
    w: c.width,
    h: c.height,
    x: (lx) => ((lx - x0) / layer.w) * c.width,
    y: (ly) => (1 - (ly - y0) / layer.h) * c.height,
    sx: (d) => (d / layer.w) * c.width,
    sy: (d) => (d / layer.h) * c.height,
  };
}

/* --- the sky ---------------------------------------------
   Gradient, a band of the city's own glow sitting on the horizon, and
   a few clouds. No skyline: the roofs are three separate planes in
   front of this one, and no stars — at 15 texels to the world unit a
   star on this plane would be a smear a third of a unit across. What
   reads as depth up here is the glow, which is why it is a band
   rather than the bottom stop of the gradient.

   **The horizon sits just under the nearest roofline**, so the glow
   is behind the city rather than over it: at -2.5 it lands about a
   glass unit below where the near rank tops out. Above it the
   gradient climbs to SKY_TOP over the next nine units; below it
   nothing changes,
   because everything down there is behind a building. */
const HORIZON_Y = -2.5;
/* **How far above the horizon SKY_TOP is reached, and it has to be
   about what the window shows.** The old flat picture put the whole
   gradient inside the pane, top to bottom. Out here the plane is five
   times the opening's height, and the first figure tried (18) spent
   the gradient on sky that is above the frame — what was left in shot
   was all within a few points of SKY_HORIZON, which is why the first
   layered build read as one flat slate wash. It came down from 13 with
   the opening: the landscape hole shows 9.5 units of this plane where
   the portrait one showed 14, and the horizon sits 2.5 below the
   sill, so 9 lands SKY_TOP just over the top of the picture again.
   `_layerview.mjs` prints the slice. */
const SKY_RISE = 9.0;
/* How near the moon a cloud has to be to be worth seeing, in sky-plane
   units. About two moon-quads: close enough that the lifted ones are
   the ones crossing or flanking the disc, far enough that it is a bank
   and not a collar. */
const CLOUD_MOON_R = 16.0;

function drawSkyLayer(layer, anisotropy) {
  const c = layerCanvas(layer);
  const f = frame(layer, c);
  const ctx = c.getContext("2d");
  const rnd = rand(0x5c1d);

  const grad = ctx.createLinearGradient(0, f.y(HORIZON_Y + SKY_RISE), 0, f.y(HORIZON_Y));
  grad.addColorStop(0, SKY_TOP);
  grad.addColorStop(1, SKY_HORIZON);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, f.w, f.h);
  /* Above the top stop and below the horizon the gradient has run
     out, so both ends are closed off flat. */
  ctx.fillStyle = SKY_TOP;
  ctx.fillRect(0, 0, f.w, Math.max(0, f.y(HORIZON_Y + SKY_RISE)));
  ctx.fillStyle = SKY_HORIZON;
  ctx.fillRect(0, f.y(HORIZON_Y), f.w, f.h - f.y(HORIZON_Y));

  /* The glow: a wide, weak ellipse of the city's light sitting on the
     horizon line. Drawn as a radial gradient squashed by the
     transform rather than as a linear one, so it falls off sideways
     as well as upward — a city has edges, and over an orbit that
     sweeps sixty units of this plane the eye would find a band that
     did not.

     It is centred on what the window shows at *home*, and it is wide
     enough (±30 units) that the front and right clamps are still
     inside it.

     **It is warm now, and weaker.** Streetlight haze is sodium, not
     sky, and this is the one thing in the view that says there is a
     city down there rather than a field. The alphas came down with
     the sky — 0.72 over a navy sky was a sunset — and the colour is
     CITY_GLOW rather than three hand-written blues, so the band and
     the constant cannot drift apart. */
  ctx.save();
  ctx.translate(f.x(10), f.y(HORIZON_Y));
  ctx.scale(1, (f.sy(1) / f.sx(1)) * 0.22);
  const glowR = f.sx(34);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
  glow.addColorStop(0, rgba(CITY_GLOW, 0.34));
  glow.addColorStop(0.4, rgba(CITY_GLOW, 0.13));
  glow.addColorStop(1, rgba(CITY_GLOW, 0));
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  /* Clouds. Each is a run of overlapping soft discs along a shallow
     line, which is the cheapest thing that does not read as a disc:
     one radial gradient looks like a smudge, six along a line with
     varying radii looks like weather. Kept dim, and kept between half a
     unit and seven units above the sill — a bank down on the horizon
     would cover the glow that is doing all the depth work, and one
     any higher is above everything the opening shows. **That band was
     4..16 and had to come down with the opening**: the landscape hole
     shows this plane only up to local y 5.8 at home, so two-thirds of
     the old weather was above the frame and what was left in shot was
     the thin bottom of it.

     **They are barely there, and they are lifted where the moon is.**
     A cloud is only visible against something, and against a sky this
     dark there is nothing to be visible against anywhere except the
     one bright object in it. So the base alpha is a third of what it
     was — enough to break the gradient and not enough to find — and a
     cloud within CLOUD_MOON_R of the moon gets up to three times it,
     which is what puts thin cloud across the disc without putting
     weather all over an empty sky.

     Scattered across the whole -4..60 of local x the orbit can reach,
     not just the patch home sees, so the sky does not run out of
     weather as the camera comes round — which is also why there are
     thirty-four of them for a view that shows four or five: the
     opening sees about a sixth of this plane at a time. */
  for (let i = 0; i < 34; i++) {
    const cx = -4 + rnd() * 64;
    const cy = 0.5 + rnd() * 6.5;
    const len = 4 + rnd() * 9;
    const base = 0.9 + rnd() * 1.1;
    const toMoon = Math.hypot(cx - MOON_AT.x, cy - MOON_AT.y) / CLOUD_MOON_R;
    const lift = 1 + 2.0 * Math.max(0, 1 - toMoon);
    const alpha = (0.028 + rnd() * 0.05) * lift;
    const lean = (rnd() - 0.5) * 0.3;
    for (let j = 0; j < 6; j++) {
      const t = j / 5;
      const r = base * (0.55 + Math.sin(t * Math.PI) * (0.7 + rnd() * 0.5));
      const x = f.x(cx + (t - 0.5) * len);
      const y = f.y(cy + (t - 0.5) * len * lean);
      const rx = f.sx(r);
      const ry = f.sy(r);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, rgba(CLOUD, alpha.toFixed(3)));
      g.addColorStop(0.55, rgba(CLOUD, (alpha * 0.5).toFixed(3)));
      g.addColorStop(1, rgba(CLOUD, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, rx, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return layerTexture(c, anisotropy);
}

/* --- the moon --------------------------------------------
   Halo, disc, and three soft maria so it is a body rather than a dot.
   The halo is wide and weak: it is standing in for the scatter that
   makes a moon legible through glass, and it is most of why the quad
   is nine times the width of the disc. */
function drawMoon(anisotropy) {
  const c = document.createElement("canvas");
  c.width = c.height = MOON_TEX;
  const ctx = c.getContext("2d");
  const m = MOON_TEX / 2;
  const r = MOON_R * MOON_TEX;

  const halo = ctx.createRadialGradient(m, m, r * 0.7, m, m, MOON_HALO * MOON_TEX);
  halo.addColorStop(0, "rgba(176,190,224,0.21)");
  halo.addColorStop(0.32, "rgba(164,178,214,0.075)");
  halo.addColorStop(0.7, "rgba(160,174,210,0.02)");
  halo.addColorStop(1, "rgba(160,174,210,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, MOON_TEX, MOON_TEX);

  ctx.fillStyle = MOON;
  ctx.beginPath();
  ctx.arc(m, m, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#9aa6c8";
  for (const [dx, dy, dr] of [
    [-0.3, -0.22, 0.34],
    [0.26, 0.1, 0.26],
    [-0.08, 0.36, 0.2],
  ]) {
    ctx.beginPath();
    ctx.arc(m + dx * r, m + dy * r, dr * r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  /* The veil: two shallow bands across the quad, each a gradient that
     is only solid through its middle, so the disc passes behind them
     rather than being capped by them. Drawn last, over disc and
     halo alike — thin cloud dims the glow as well as the body. */
  for (const [cy, h, a] of [
    [0.44, 0.11, MOON_VEIL],
    [0.63, 0.07, MOON_VEIL * 0.6],
  ]) {
    const band = ctx.createLinearGradient(0, (cy - h) * MOON_TEX, 0, (cy + h) * MOON_TEX);
    band.addColorStop(0, rgba(CLOUD, 0));
    band.addColorStop(0.5, rgba(CLOUD, a));
    band.addColorStop(1, rgba(CLOUD, 0));
    ctx.fillStyle = band;
    ctx.fillRect(0, (cy - h) * MOON_TEX, MOON_TEX, 2 * h * MOON_TEX);
  }

  return layerTexture(c, anisotropy);
}

/* --- the ranks of roofs ----------------------------------
   One rank per plane, drawn as a walk along the wall so the roofline
   is uneven without any of it being placed by hand.

   **Each block is filled from its roof to the bottom of the canvas**,
   which is what lets there be no street line anywhere in the view: at
   the flat end of the orbit the opening looks down and would find
   one. A city at this hour is a roofline and a darkness under it.

   `lo`/`hi` are roof heights in local units above the sill. They do
   not read directly against the opening's own 0..8.2, because each
   plane is at a different depth and the opening shows a different
   slice of each: `_layerview.mjs` prints the slice, and the figures
   below are glass heights put back through it — the near rank tops
   out around glass 2.0, the mid around 3.1, the far around 3.7.

   **Those three were glass 3, 4.6 and 5.4 while the opening was 12
   tall, and what carried over is the fraction of the pane rather than
   the height.** Keeping the heights would have stood the far rank
   two-thirds of the way up a pane that is now 8.2 — a roofline level
   with the moon, in a view whose whole composition is roofs below and
   sky above.

   **The far rank is the tall one, and that is not a mistake.** The
   walk below lays blocks edge to edge with no gaps, so each rank is a
   solid mass and the only thing visible of the rank behind it is
   whatever stands above its roofline. Ranks that got shorter with
   distance would hide each other completely and the three planes
   would be one silhouette. Low roofs near, towers far is also what a
   city actually looks like from a window two storeys up.

   **`lit` is a density, and it is small.** It is well after midnight
   in here. Most of the lights left on are warm — a bulb behind a
   blind — and a few are cool, which is somebody still at a screen;
   that one share is most of what stops a lit facade reading as a
   texture swatch. The far rank gets the fewest — it is the lightest
   and haziest, and a lit window on it has the least contrast to
   spend. */
function drawCity(layer, spec, anisotropy) {
  const c = layerCanvas(layer);
  const f = frame(layer, c);
  const ctx = c.getContext("2d");
  const r = rand(spec.seed);
  const bottom = layer.y - layer.h / 2;

  /* One gradient for the whole rank. Canvas gradients are in canvas
     space, not in the shape being filled, so every block can share
     this and the haze stays continuous across the roofline instead of
     restarting in each building. */
  const haze = ctx.createLinearGradient(0, f.y(HORIZON_Y + spec.haze), 0, f.y(HORIZON_Y));
  haze.addColorStop(0, spec.colour[1]);
  haze.addColorStop(1, spec.colour[0]);

  /* The walk runs the whole plane, which is wider than any one pose
     sees — the orbit slides this rank across sixty units of local x
     and every one of them has to have a city on it. */
  let lx = layer.x - layer.w / 2 - spec.step * r();
  while (lx < layer.x + layer.w / 2) {
    const bw = spec.step * (0.55 + r() * 0.9);
    const top = spec.lo + r() * (spec.hi - spec.lo);
    const px = f.x(lx);
    const pw = Math.ceil(f.sx(bw)) + 1;
    const py = f.y(top);
    ctx.fillStyle = haze;
    ctx.fillRect(Math.round(px), Math.round(py), pw, Math.ceil(f.y(bottom) - py) + 2);
    /* A water tank or a lift overrun on some of the taller ones — one
       rectangle, and it is most of what makes a block read as a
       building rather than a bar on a chart. */
    if (top > spec.lo + (spec.hi - spec.lo) * 0.6 && r() > 0.45) {
      const tw = bw * (0.18 + r() * 0.16);
      /* Against the building's own height above the horizon, not
         against the plane's — the plane runs twenty units below the
         street and quoting the tank off that gave every roof a
         block-house on it a full world unit tall. */
      const th = (top - HORIZON_Y) * (0.05 + r() * 0.05);
      ctx.fillRect(
        Math.round(f.x(lx + bw * 0.2)),
        Math.round(f.y(top + th)),
        Math.ceil(f.sx(tw)) + 1,
        Math.ceil(f.sy(th)) + 1,
      );
    }
    if (spec.lit > 0) {
      /* On a grid inside the block, so they read as floors. The grid
         is in local units — a floor is `spec.floor` tall whatever
         canvas it lands on — which is what keeps the near rank's
         windows larger than the mid rank's rather than merely more
         numerous. */
      const cols = Math.max(1, Math.round(bw / spec.bay));
      /* Floors from the roof down to the horizon — below that the
         building is behind whatever rank is in front of it, or behind
         the sill. */
      const rows = Math.max(1, Math.floor((top - HORIZON_Y) / spec.floor));
      const ww = Math.max(1, f.sx((bw / cols) * 0.42));
      const wh = Math.max(1, f.sy(spec.floor * 0.4));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (r() > spec.lit * LIT_WINDOW_DENSITY) continue;
          /* **Varied, and varied downward.** A rank of windows all at
             one value reads as a texture; the spread is what makes it
             a city. It starts lower than it used to (0.25 against
             0.5) because most of a skyline at this hour is a dim
             window, not a bright one. */
          ctx.globalAlpha = 0.25 + r() * 0.6;
          ctx.fillStyle = r() < COOL_SHARE ? LIT_COOL : LIT_WINDOW;
          ctx.fillRect(
            f.x(lx + (bw / cols) * (i + 0.3)),
            f.y(top - spec.floor * (j + 0.65)),
            ww,
            wh,
          );
        }
      }
      ctx.globalAlpha = 1;
    }
    lx += bw;
  }

  return layerTexture(c, anisotropy);
}

/* The three ranks, in local units above the sill. `step` is the
   average frontage and `bay` the spacing of the lit windows across
   it; `floor` is a storey. The near rank's roofs stop at 1.15 for one
   specific reason — the moon sits at glass y 5.9, which is local 5.2
   on this plane, and a tower past about 4.4 would stand in front of
   it. Three units of clearance is what a skyline composed into the
   bottom half of a landscape light leaves. */
const CITY = {
  cityFar: { colour: CITY_FAR, haze: 7.0, seed: 0x31b7, lo: -0.85, hi: 1.45, step: 3.0, lit: 0.03, bay: 0.75, floor: 0.38 },
  cityMid: { colour: CITY_MID, haze: 6.0, seed: 0x8f23, lo: -0.2, hi: 1.7, step: 4.0, lit: 0.055, bay: 0.9, floor: 0.44 },
  cityNear: { colour: CITY_NEAR, haze: 5.0, seed: 0x4d51, lo: -0.1, hi: 1.15, step: 5.5, lit: 0.07, bay: 1.05, floor: 0.5 },
};

/* --- the glass -------------------------------------------
   What is actually *on* the pane, as opposed to seen through it: a
   faint tint, the lamp's own warm bloom, one wide diagonal band of
   the room reflected back, and a scatter of beads that have run and
   stopped.

   Very low alpha throughout. Past about 0.1 a reflection stops
   reading as a reflection and starts reading as a smear on the
   texture — and this is the layer nearest the eye, so it is the one
   where that shows first. */
const GLASS_TEX_W = 512;
const DROPS = 26;
/* **The lamp, reflected.** The one thing that was missing from the
   pane: with only a cool tint and a cool sheen on it the glass read
   as a hole with a filter over it, because every light in the picture
   was on the far side of it. A warm bloom low on the sheet puts
   something from *this* side of the window into it, and that is what
   makes it a pane rather than an aperture.

   Placed rather than derived, and `_wincrop.mjs` is how it was
   checked. The green lamp's shade sits at about world y 13 and world
   z 3, which is local x -3 on this wall and a little over a third of
   the way up the glass — so the bloom goes at (0.28, 0.3) in canvas
   fractions, measuring y from the bottom. It is warm because the
   lamp's glass is, and it is under a tenth of alpha because
   everything on this sheet is: past about 0.1 a reflection stops
   reading as a reflection and starts reading as a smear. */
const GLASS_LAMP = "#ffc478";
const GLASS_LAMP_AT = [0.28, 0.3];
const GLASS_LAMP_ALPHA = 0.075;

function drawGlass(anisotropy) {
  const c = document.createElement("canvas");
  const w = (c.width = GLASS_TEX_W);
  const h = (c.height = Math.round((GLASS_TEX_W * OPEN_H) / OPEN_W));
  const ctx = c.getContext("2d");
  const rnd = rand(0x2b7f);

  /* The tint: the whole sheet, cool and barely there. It is what
     keeps the view from looking like a hole with no glass in it. */
  ctx.fillStyle = "rgba(132,150,198,0.03)";
  ctx.fillRect(0, 0, w, h);

  const sheen = ctx.createLinearGradient(0, h, w * 0.75, 0);
  sheen.addColorStop(0, "rgba(255,255,255,0)");
  sheen.addColorStop(0.62, "rgba(190,202,234,0.035)");
  sheen.addColorStop(0.78, "rgba(190,202,234,0.055)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, w, h);

  /* The lamp's own reflection: one soft ellipse, wider than it is
     tall because the pane is, plus the faint vertical smear a bright
     source makes on glass. Both in GLASS_LAMP, both well under a
     tenth. */
  const lx = GLASS_LAMP_AT[0] * w;
  const ly = (1 - GLASS_LAMP_AT[1]) * h;
  ctx.save();
  ctx.translate(lx, ly);
  ctx.scale(1, 0.62);
  const bloomR = w * 0.26;
  const bloom = ctx.createRadialGradient(0, 0, 0, 0, 0, bloomR);
  bloom.addColorStop(0, rgba(GLASS_LAMP, GLASS_LAMP_ALPHA));
  bloom.addColorStop(0.45, rgba(GLASS_LAMP, GLASS_LAMP_ALPHA * 0.35));
  bloom.addColorStop(1, rgba(GLASS_LAMP, 0));
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(0, 0, bloomR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const smear = ctx.createLinearGradient(0, ly - h * 0.22, 0, ly + h * 0.3);
  smear.addColorStop(0, rgba(GLASS_LAMP, 0));
  smear.addColorStop(0.5, rgba(GLASS_LAMP, GLASS_LAMP_ALPHA * 0.5));
  smear.addColorStop(1, rgba(GLASS_LAMP, 0));
  ctx.fillStyle = smear;
  ctx.fillRect(lx - w * 0.035, ly - h * 0.22, w * 0.07, h * 0.52);

  /* Beads. Each is a disc that is *darker* in the middle and bright
     at its lower edge, which is what a drop on a window actually
     looks like against a bright sky: it is a lens, so it carries the
     dark room behind it, with the sky refracted into a crescent. The
     highlight sits low because the sky above the drop is what it
     bends down into view. */
  for (let i = 0; i < DROPS; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 1.6 + rnd() * 3.6;
    const g = ctx.createRadialGradient(x, y - r * 0.25, 0, x, y, r);
    g.addColorStop(0, "rgba(14,17,33,0.18)");
    g.addColorStop(0.62, "rgba(22,28,52,0.12)");
    g.addColorStop(1, "rgba(22,28,52,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.26 + rnd() * 0.18;
    ctx.fillStyle = "rgba(186,200,232,1)";
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.42, r * 0.5, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    /* A third of them have run a little way and stopped, leaving the
       trail that says the drop is on glass and not in the air. */
    if (rnd() < 0.34) {
      const tl = r * (2.5 + rnd() * 5);
      const t = ctx.createLinearGradient(x, y - tl, x, y);
      t.addColorStop(0, "rgba(22,28,52,0)");
      t.addColorStop(1, "rgba(22,28,52,0.095)");
      ctx.fillStyle = t;
      ctx.fillRect(x - r * 0.28, y - tl, r * 0.56, tl);
    }
  }

  return layerTexture(c, anisotropy);
}

/* ==========================================
   THE RAIN SHADER

   `rainLayer` is one pass of streaks. The pane is divided into
   `cols` columns and `rows` runs; each column gets its own fall speed
   and lane from a hash of its index, and each (column, run) cell
   either carries a streak or does not. So the whole layer is two
   hashes and a pair of smoothsteps per fragment, with no loop and no
   texture read.

   Falling: a feature sits at constant `g.y + uTime * v`, so as time
   advances its `g.y` decreases — down the pane, which is what the
   plane's local +Y being up makes correct.
   ========================================== */
/* One pass, for one quad. `cols` and `rows` arrive per world unit and
   are multiplied by the quad here, so the same layer spec gives the
   same rain whatever size plane it is put on — which is the whole
   point of having split the two layers onto two quads. */
function rainChunk(key, w, h) {
  const L = RAIN[key];
  const cols = (L.cols * w).toFixed(1);
  const rows = (L.rows * h).toFixed(1);
  const seed = key === "near" ? "1.0" : "5.0";
  return `
	float rainStreaks = clamp(rainLayer(vRainUv, ${cols}, ${rows}, ${L.speed.toFixed(2)}, ${seed}) * ${L.gain.toFixed(2)}, 0.0, 1.0);
	diffuseColor.a *= rainStreaks * ${RAIN_OPACITY.toFixed(3)};
`;
}

const RAIN_HEAD = /* glsl */ `
uniform float uTime;
varying vec2 vRainUv;

float rainHash(vec2 p) {
	return fract(sin(dot(p, vec2(41.37, 289.13))) * 43758.5453);
}

float rainLayer(vec2 uv, float cols, float rows, float speed, float seed) {
	vec2 g = uv * vec2(cols, rows);
	float col = floor(g.x);
	float fx = fract(g.x);
	/* Per-column: how fast this file of drops falls, and which lane of
	   its column it runs down. */
	float h = rainHash(vec2(col, seed));
	float v = speed * (0.65 + 0.7 * h);
	float lane = 0.18 + 0.64 * rainHash(vec2(col, seed + 3.0));
	float y = g.y + uTime * v + h * 13.0;
	float cell = floor(y);
	float fy = fract(y);
	/* Per-cell: whether there is a drop at all, and how long it is. */
	float r = rainHash(vec2(col, cell + seed * 7.0));
	float on = step(0.42, r);
	float len = 0.18 + 0.30 * r;
	/* Thin: a drop seen at this distance is a hair, not a rod. Halved
	   from 0.055 + 0.03, which was wide enough that two streaks in
	   neighbouring lanes touched. */
	float wide = 0.030 + 0.016 * r;
	/* The lean is what stops the streaks reading as a comb: a drop
	   drifts across its lane as it falls. */
	float dx = abs(fx - lane - fy * 0.09);
	float body = smoothstep(wide, 0.0, dx)
		* smoothstep(len, 0.0, fy)
		* smoothstep(0.0, 0.015, fy);
	return body * on;
}
`;

function rainMaterial(key, w, h) {
  const m = track(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(RAIN_COLOUR),
      transparent: true,
      /* Nothing in the backdrop writes depth — the stack is drawn in
         the order ORDER gives and depth-tested against the room, not
         against itself. For the rain specifically it also keeps a
         sort flip from ever occluding the mullions. */
      depthWrite: false,
      opacity: 1,
      side: THREE.FrontSide,
    }),
  );
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = rainTime;
    shader.vertexShader =
      `varying vec2 vRainUv;\n` +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        /* The quad's own coordinates, off `position` rather than off
           `uv` — a MeshBasicMaterial with no maps on it does not
           declare the uv attribute, and asking for one by setting
           USE_UV would pull in machinery nothing here uses. The two
           divisors are this quad's size, so this is the 0..1 box `uv`
           would have given. */
        `#include <begin_vertex>
	vRainUv = position.xy / vec2(${w.toFixed(4)}, ${h.toFixed(4)}) + 0.5;`,
      );
    shader.fragmentShader =
      RAIN_HEAD +
      shader.fragmentShader.replace(
        /* `diffuseColor.a` already carries `opacity`, which is what
           room.js's cutaway writes — so the rain fades out with its
           wall for free. Everything after this point in the built-in
           shader (tone mapping, the colour-space conversion, fog) is
           left alone, which is the whole reason this is a patched
           material rather than a ShaderMaterial. */
        "#include <alphamap_fragment>",
        `#include <alphamap_fragment>\n${rainChunk(key, w, h)}`,
      );
  };
  return m;
}

/* ==========================================
   BUILD
   ========================================== */
export function buildNightWindow({
  noise = null,
  thickness = 0.6,
  anisotropy = 1,
  reduced = false,
} = {}) {
  const group = new THREE.Group();
  group.name = "wall-window";
  rainReduced = !!reduced;
  rainSpeed = RAIN_SPEED * (rainReduced ? RAIN_SLOW : 1);
  rainTime.value = 0;

  /* The joinery takes the wall's own noise map so the paint does not
     read as a flat fill beside a wall that is not one. `map`
     multiplies `color`, so one near-white field tints every part from
     its own base colour — the same trick room.js plays across the
     wainscot and the trim. Each part tiles it at its own rate so the
     lattice does not line up across a mitre. */
  const paint = (colour, tiles) => {
    const m = track(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(colour),
        roughness: 0.78,
        metalness: 0,
        /* Always transparent, never toggled — see room.js: the flag
           changes how three sorts the object, so the cutaway moves
           `opacity` and nothing else. */
        transparent: true,
        opacity: 1,
      }),
    );
    if (noise) {
      m.map = track(noise.clone());
      m.map.needsUpdate = true;
      m.map.repeat.set(tiles[0], tiles[1]);
      m.map.anisotropy = anisotropy;
    }
    return m;
  };

  const casing = paint(CASE_PAINT, [1 / 3, 1 / 3]);
  const sash = paint(SASH_PAINT, [1 / 2, 1 / 2]);
  const materials = [casing, sash];

  const box = (w, h, d, x, y, z, mat) => {
    const mesh = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, d)), mat);
    mesh.position.set(x, y, z);
    /* **The joinery casts, and it is the reason the pool reads as a
       window rather than as a rectangle of light.** The moon is aimed
       through this opening and the wall around it casts (see
       room.js), so the sash and its three bars stripe the beam into
       six panes on the floor and the desk. The glass and the rain do
       not cast — a transparent caster in a VSM map is an opaque one,
       and they would have filled the hole straight back in. */
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  const hw = OPEN_W / 2;

  /* --- the backdrop ---
     **A second group, not a child of the first, and that is a
     measuring decision rather than a structural one.** The review
     scripts ask "is the window in frame" with
     `window.__fit("wall-window")`, which is `Box3.setFromObject` over
     the whole subtree — and these planes run seventy units along the
     wall and forty below the floor. Hung under the window they would
     turn that box into the backdrop's box and the one number that
     says the window is in shot would stop meaning anything. So the
     stack goes in its own group, named for itself, and room.js places
     the two at the same point.

     Every plane here is unlit, writes no depth, and is sorted by
     ORDER rather than by distance. None of them cast or receive: a
     backdrop that cast would fill the hole it is seen through, and
     one that received would be a surface in a room it is not in. */
  const backdrop = new THREE.Group();
  backdrop.name = "window-backdrop";

  const plane = (name, layer, material, order) => {
    const mesh = new THREE.Mesh(
      track(new THREE.PlaneGeometry(layer.w, layer.h)),
      material,
    );
    mesh.name = name;
    mesh.position.set(layer.x, layer.y, layer.z);
    mesh.renderOrder = order;
    mesh.castShadow = mesh.receiveShadow = false;
    backdrop.add(mesh);
    materials.push(material);
    return mesh;
  };

  const flat = (map) =>
    track(
      new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        depthWrite: false,
        opacity: 1,
      }),
    );

  plane("window-sky", LAYERS.sky, flat(drawSkyLayer(LAYERS.sky, anisotropy)), ORDER.sky);

  /* The moon rides just in front of the sky on the same plane's
     depth, so it parallaxes with the farthest thing out there — which
     is what a moon does. */
  const moon = new THREE.Mesh(
    track(new THREE.PlaneGeometry(MOON_SIZE, MOON_SIZE)),
    track(
      new THREE.MeshBasicMaterial({
        map: drawMoon(anisotropy),
        transparent: true,
        depthWrite: false,
        opacity: 1,
      }),
    ),
  );
  moon.name = "window-moon";
  moon.position.set(MOON_AT.x, MOON_AT.y, LAYERS.sky.z + 0.05);
  moon.renderOrder = ORDER.moon;
  moon.castShadow = moon.receiveShadow = false;
  backdrop.add(moon);
  materials.push(moon.material);

  for (const key of ["cityFar", "cityMid", "cityNear"]) {
    plane(
      `window-${key}`,
      LAYERS[key],
      flat(drawCity(LAYERS[key], CITY[key], anisotropy)),
      ORDER[key],
    );
  }

  /* The far rain, on its own quad out past the glass. */
  const rainFar = new THREE.Mesh(
    track(new THREE.PlaneGeometry(LAYERS.rainFar.w, LAYERS.rainFar.h)),
    rainMaterial("far", LAYERS.rainFar.w, LAYERS.rainFar.h),
  );
  rainFar.name = "window-rain-far";
  rainFar.position.set(LAYERS.rainFar.x, LAYERS.rainFar.y, LAYERS.rainFar.z);
  rainFar.renderOrder = ORDER.rainFar;
  rainFar.castShadow = rainFar.receiveShadow = false;
  backdrop.add(rainFar);
  materials.push(rainFar.material);

  /* --- the glass ---
     **What is on the pane, not what is behind it.** This used to be
     the whole view — sky, skyline and sheen baked into one map — and
     it is now the tint, the reflection and the beads, with the view
     itself out in the backdrop above. Unlit, like everything here, so
     it keeps its value while the room sits three stops down. */
  const glass = new THREE.Mesh(
    track(new THREE.PlaneGeometry(OPEN_W, OPEN_H)),
    track(
      new THREE.MeshBasicMaterial({
        map: drawGlass(anisotropy),
        transparent: true,
        depthWrite: false,
        opacity: 1,
      }),
    ),
  );
  glass.name = "window-glass";
  glass.position.set(0, OPEN_H / 2, -GLASS_INSET);
  glass.renderOrder = ORDER.glass;
  glass.castShadow = glass.receiveShadow = false;
  group.add(glass);
  materials.push(glass.material);

  /* --- the near rain ---
     A hair in front of the glass and a hair behind the sash, so the
     streaks are on the sheet and the bars are in front of them. */
  const rain = new THREE.Mesh(
    track(new THREE.PlaneGeometry(OPEN_W, OPEN_H)),
    rainMaterial("near", OPEN_W, OPEN_H),
  );
  rain.name = "window-rain";
  rain.position.set(0, OPEN_H / 2, -GLASS_INSET + 0.02);
  rain.renderOrder = ORDER.rainNear;
  rain.castShadow = rain.receiveShadow = false;
  group.add(rain);
  materials.push(rain.material);

  /* --- the sash, and the three bars that make six panes ---
     One sheet of sky with bars over it, rather than six panes: that
     is both how a divided-light sash is actually glazed and what keeps
     the skyline continuous across each mullion instead of stepping at
     it.

     **The two vertical bars are derived, not placed.** The light
     inside the sash frame is divided into three equal panes, so the
     bars land wherever that puts them — 4.27 across and 4.04 high,
     which is the near-square pane a landscape opening has to be cut
     into. Placing them at thirds of OPEN_W instead would have been
     wrong by the sash's own width and left the outer panes narrower
     than the middle one, which is the kind of error that only shows
     once the sash stripes land on the floor. */
  const sashZ = -GLASS_INSET + 0.02 + SASH_D / 2 + 0.01;
  const light = OPEN_W - 2 * SASH_W;
  const paneW = (light - 2 * MULL_W) / 3;
  const mullX = light / 2 - paneW - MULL_W / 2;
  box(OPEN_W, SASH_W, SASH_D, 0, SASH_W / 2, sashZ, sash);
  box(OPEN_W, SASH_W, SASH_D, 0, OPEN_H - SASH_W / 2, sashZ, sash);
  box(SASH_W, OPEN_H, SASH_D, -hw + SASH_W / 2, OPEN_H / 2, sashZ, sash);
  box(SASH_W, OPEN_H, SASH_D, hw - SASH_W / 2, OPEN_H / 2, sashZ, sash);
  box(MULL_W, OPEN_H, SASH_D, -mullX, OPEN_H / 2, sashZ, sash);
  box(MULL_W, OPEN_H, SASH_D, mullX, OPEN_H / 2, sashZ, sash);
  box(OPEN_W, MULL_W, SASH_D, 0, OPEN_H / 2, sashZ, sash);

  /* --- the casing ---
     Head and two jambs over the wall face; the sill does the bottom. */
  const caseZ = CASE_OUT / 2;
  box(CASE_W, OPEN_H + CASE_W, CASE_OUT, -hw - CASE_W / 2, (OPEN_H + CASE_W) / 2, caseZ, casing);
  box(CASE_W, OPEN_H + CASE_W, CASE_OUT, hw + CASE_W / 2, (OPEN_H + CASE_W) / 2, caseZ, casing);
  box(OPEN_W + 2 * CASE_W, CASE_W, CASE_OUT, 0, OPEN_H + CASE_W / 2, caseZ, casing);

  /* --- the sill, and the apron under it ---
     The sill runs the full thickness of the wall and out past it, so
     it closes the bottom of the reveal as well as projecting — at the
     flat end of the orbit leash (2 degrees above the floor) the
     underside of this is the part of the window the camera can nearly
     see, and a sill that stopped at the wall face would show the
     opening's bottom edge as a gap. */
  const sillW = OPEN_W + 2 * CASE_W + 2 * SILL_EARS;
  box(sillW, SILL_T, thickness + SILL_PROUD, 0, -SILL_T / 2, (SILL_PROUD - thickness) / 2, casing);
  box(OPEN_W + CASE_W, APRON_H, APRON_OUT, 0, -SILL_T - APRON_H / 2, APRON_OUT / 2, casing);

  return { group, backdrop, materials };
}

/* ==========================================
   THE RAIN, PER FRAME

   One float write. Called from scene.js's loop, which does not run
   under reduced motion — see RAIN_SLOW above for what that means and
   what the factor is still for.
   ========================================== */
export function tickRain(dt) {
  rainTime.value += dt * rainSpeed;
  /* Wrapped, so the value never grows large enough for a float to
     lose the fractional precision the streak phases are made of. The
     period is one cell-run, which every layer's `fract` is already
     periodic in. */
  if (rainTime.value > 4096) rainTime.value -= 4096;
}

/* Where the rain stands, for the review scripts and for tuning it on
   a live page. A speed in cell-runs per second, or no argument to
   just report. */
export function rainState(speed) {
  if (speed !== undefined) rainSpeed = speed;
  return {
    time: Number(rainTime.value.toFixed(3)),
    speed: Number(rainSpeed.toFixed(4)),
    reduced: rainReduced,
    layers: RAIN,
  };
}

export function disposeNightWindow() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
  rainTime.value = 0;
  rainSpeed = RAIN_SPEED;
  rainReduced = false;
}
