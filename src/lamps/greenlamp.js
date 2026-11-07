import * as THREE from "three";

/* ==========================================
   THE GREEN BANKER'S LAMP

   A brass base, a turned lathe column, a short brass J-arm carrying a
   shade rod, and a green glass trough clipped onto it, built from primitives like everything else in
   this scene. It is an **alternative** to src/lamp.js rather than a
   replacement: same contract, same local space, same five-handle
   `setLamp` curve, so scene.js could swap one import for the other
   and nothing else would have to know. Nothing imports it yet — it is
   viewed through `lamp-lab.html?lamp=greenlamp`.

   **Local space matches the desk's, the computer's and the
   treehouse's** — +Z is the front, y up, origin on the **desk top** at
   the centre of the base. So the caller only lifts the group by
   `DESK_TOP_Y` and sets x and z; nothing here knows how tall the desk
   is.

   **It tilts about its own long axis, where the cone lamp leans off
   its pole.** src/lamp.js hangs a cone and leans it 50 degrees so the
   camera — which looks *down* at 20 — can see the lit inside at all.
   This shade is a horizontal trough: the long axis runs side to side
   parallel to the desk's front edge, the convex side is up, the mouth
   is down, and SHADE_TILT rolls it about 20 degrees toward the front
   so the light goes where a banker's lamp's goes — onto the desk in
   front of it, and onto whatever is sitting at it.

   **Both ends are closed**, green outside and cream in, as a real
   cased shade's are. The open-ended trough the first version built
   showed its own lining end-on from the home framing, which reads as
   a cut pipe rather than a shade.
   ========================================== */

/* --- Palette ---------------------------------------------
   Antique brass and cased green glass, after the reference. The three
   greens are the point of the fixture: GLASS_OUT is the deep bottle
   green the body reads as unlit, GLASS_RIM the pale line the glass's
   own thickness shows along the rolled lip, and GLASS_IN the
   milk-white casing a real banker's shade is lined with. What makes
   it *glow* is the emissive on the shell and the lining — see
   EMIT_GLASS.

   **GLASS_OUT came down about a half in value**, from 0x1f6b31, when
   the shell went to MeshPhysicalMaterial with a clearcoat. The two
   changes are one decision: a clearcoat puts a sharp specular lobe on
   top of the body colour, so the shade now reads as glass by its
   *highlights* rather than by being a bright green, and at the old
   value those highlights had nothing dark to sit against. Bottle
   glass is dark; what is light on it is the reflection and the glow. */
/* **Warm gold, and a metal's colour is not its albedo.** These ran at
   0x9a7a44 / 0x6a5330, which are olive-browns — the right *apparent*
   colour for a half-rough `metalness: 0.8` surface, because at 0.8 a
   fifth of what you see is a diffuse term that darkens and desaturates
   whatever the base colour is. At `metalness: 1` there is no diffuse
   term at all: the base colour becomes F0, the specular reflectance,
   and it is multiplied by what the metal reflects rather than added to
   it. Keeping the olive would have given dark bronze. Polished brass
   has an F0 up around here, which is why these read as too bright to
   be a paint and are correct as a mirror tint. */
const BRASS = 0xd9b359;
/* The one fitting that is *not* polished — the socket and the stem
   under the bulb, where a mirror ring reads as a second filament. It
   is the same metal, aged and left rough; see BRASS_ROUGH_FITTING. */
const BRASS_DARK = 0x9c7c38;
const GLASS_OUT = 0x123a1e;
/* **The pale line along the bottom edge, and it is albedo rather than
   a glow.** Where a cased shade's lip curls under you are looking
   through the thickness of the casing rather than at one face of it,
   so the green washes out toward the white lining behind it. It is
   applied as a `map` band at the two ends of the profile's u — see
   `glassSkinTexture` — and is deliberately *not* in the emissive map,
   which falls to almost nothing at the same place: the rim is thick
   glass catching light, not thin glass passing it. */
const GLASS_RIM = 0x7fae88;
const GLASS_IN = 0xf6f1e2;
const BULB = 0xfff4de;

/* The lamp's own colour, and the brief's: a warm tungsten, the same
   one the cone lamp uses so the two are interchangeable in the room's
   four-source calibration. Used for both lights and for the bulb and
   lining emissives, so the glow and the pool cannot drift apart. */
export const LAMP_COLOUR = 0xffb866;
const BULB_EMISSIVE = 0xffe3b4; // the filament reads paler than its spill
/* **The glass glows green, not amber**, and that is the one emissive
   here that is *not* LAMP_COLOUR. A warm lamp behind green cased glass
   comes out a warm yellow-green — the light is tungsten, the filter is
   green, and the product is neither. Setting this to LAMP_COLOUR made
   the shade read as amber plastic with a green rim; setting it to
   GLASS_OUT made it a flat green sticker with no lamp behind it.

   **It is modulated by a map rather than applied flat** — see
   `glassGlowTexture`. A constant emissive over a whole shade is the
   one thing that reliably makes cased glass read as painted card:
   real glass is brightest where the bulb is nearest and darkest at
   the rolled lips, and with no gradient at all there is nothing on
   the surface for the eye to read as thickness. */
const GLASS_EMISSIVE = 0x58bf4e;

/* --- Proportions -----------------------------------------
   Art-directed at scale 1 and then scaled by LAMP_SCALE below, the
   same arrangement src/lamp.js uses — so read these as proportions.

   **A banker's lamp is squat where the cone lamp is tall**, so
   "matches the current lamp" is a statement about how much of the
   frame it occupies rather than about height, and the two fixtures
   trade one dimension for the other. Measured in the lab at the same
   LAMP_SCALE: this shade spans **4.7 world units** against the cone
   shade's 3.5, and the whole fixture measures **5.9 tall against the
   cone lamp's 8.1** on the same conservative `Box3` bound — so about
   a quarter shorter and a fifth wider. So it is the wider of the two and the
   shorter — and the shorter end of that is a fix rather than a cost.
   The cone lamp's conservative 8.1 is a cone yawed 45 degrees, so its
   true top is near 6.8, past the CRT's 6.60 and breaking the rule
   nothing on this desk may come up level with the thing a visitor has
   to press (see LAMP_SCALE in src/lamp.js). This fixture is square to
   its own axes — a trough swept along x on a vertical column — so 5.9
   is very nearly the true figure, and it clears the machine. */
const BASE_R = 1.1; // the foot's widest ring
const BASE_H = 0.16;
const PLINTH_R = 0.92; // the step above it
const PLINTH_H = 0.12;
const DOME_R = 0.76; // the moulded dome the column rises out of
const DOME_H = 0.27;

/* **Every convex corner on the turned brass is cut by this**, and it
   is there for the light rather than for the shape.

   A right-angled edge has no area, so it returns no highlight at all:
   under the polished finish the base's steps were reading as a change
   of shading between two flats with a hard line between them. A
   45-degree chamfer of a couple of hundredths gives each step a narrow
   band whose normal points *between* the two faces — which on a turned
   ring is a continuous circle facing part-way up and part-way out, and
   that is precisely the band a moon or a bulb lands a thin bright line
   along. It is the one detail that reads as *machined* brass rather
   than as brass-coloured geometry.

   **Only convex corners get one.** A concave corner — the shoulder
   where a step's top meets the narrower part rising out of it — already
   returns a dark line, which is the right answer there, and chamfering
   it would only cost triangles.

   At LAMP_SCALE this is about 0.042 world units, which at the home
   framing is a little over a pixel. A chamfer is supposed to be a
   line, not a facet; much past this the steps start reading as cones.
   Below about 0.015 it falls inside a pixel and the ring goes back to
   returning nothing. */
const BEVEL = 0.028;

/* Round segments for everything turned on the base. 44 was the foot's
   figure and the whole base is one lathe now, so it is the lathe's —
   and the felt pad's, which has to share the brass's silhouette
   exactly or the seam between them scallops. */
const BASE_SEGS = 44;

/* --- The felt pad ----------------------------------------
   **It is a thin disc at the bottom of the fixture, and the brass's
   underside was lifted to make room for it rather than the fixture
   being raised.** That distinction is the whole implementation: the
   origin sits on the desk top and every height in this file is stated
   against it, so lifting the lamp by the pad's thickness would have
   moved the shade, both lights, the seat solve and SHADE_Y. Instead
   the pad occupies y 0..FELT_H and the brass profile starts its
   underside at FELT_H — so BASE_H still measures to the same place,
   nothing above the foot moves, and what is given up is a sliver of
   brass underside that was flat on the walnut and never visible.

   **It is flush with BASE_R, not inset, and that is forced by the
   camera.** The room looks down at 20 degrees, so tan(20) = 0.36 of
   height is hidden per unit of overhang: a pad inset by even the
   chamfer's own 0.028 would disappear entirely behind the rim above
   it. Flush, nothing overhangs it — the foot *tapers outward* going
   down, so BASE_R is the widest point of the brass and also its
   lowest — and the pad reads as what it is, a thin dark line between
   the metal and the wood. Which is the whole point of it: the thing
   that says a fixture is standing on a surface rather than
   intersecting it is a different material at the join.

   The world box does not move. BASE_R is still the widest radius and
   y still starts at 0, so the +0.36 margin to the walnut's -x edge
   and the contact shadow's BASE_R * 3.1 footprint are both untouched. */
const FELT_H = 0.04;
const FELT = 0x1a1613; // near-black, a touch warm
const COL_R = 0.17; // the nominal radius every section is a ratio of
const COL_BOT = BASE_H + PLINTH_H + DOME_H * 0.7;

/* **One turned profile, revolved — not a cylinder with fittings
   stacked on it.** The column was a plain shaft, sixteen instanced
   flutes, a squashed sphere for a knop and a second cylinder for a
   collar: four meshes and two materials pretending to be one piece
   of spun brass. A `LatheGeometry` through a single profile is what
   the real thing is, and it is also what lets the neck, the bulge
   and the collar be stated as one silhouette rather than as parts
   that have to be kept touching.

   The flutes went with it. They were there because "a plain cylinder
   at this size is a brass straw" — the shape answers that now
   instead: a bulge, a waist and a stepped collar give the shaft
   something to read as, and a classic banker's column is polished
   and plain.

   **Heights are fractions of COL_VIS and radii are ratios of COL_R**,
   so the column can be re-proportioned in one number without the
   bulge sliding off the neck. */
/* **The 40% is measured on the part that shows.** `COL_BOT` is where
   the mesh starts, which is 0.7 of the way up the base dome — buried,
   so there is no seam at the joint. The column only *emerges* at the
   dome's top, and the first pass measured the profile from the mesh
   origin instead: every section slid down by the buried stub, and the
   urn ended up sitting on the dome where it read as part of the base
   rather than as the first turning of the column. It showed 1.245
   before, so it shows 1.743 now. */
const COL_EMERGE = BASE_H + PLINTH_H + DOME_H;
const COL_VIS = 1.743;
const COL_TOP = COL_EMERGE + COL_VIS;
const COL_BURIED = COL_EMERGE - COL_BOT;

const COL_FOOT_R = COL_R * 0.91; // where it leaves the base dome
const COL_NECK_R = COL_R * 0.66; // the short narrow neck
const COL_BULGE_R = COL_R * 1.56; // the urn, at its widest
const COL_SHAFT_R = COL_R * 0.78; // the straight run
const COL_COLLAR_R = COL_R * 1.09; // the capped collar at the top
const COL_LIP_R = COL_R * 0.71; // what the lip rounds in to

/* Where each section begins, as a fraction of the **visible** run. */
const COL_NECK_T = 0.065;
const COL_BULGE_MID = 0.155;
const COL_BULGE_HALF = 0.09;
const COL_SHAFT_T = 0.285;
const COL_COLLAR_B = 0.865;
const COL_COLLAR_T = 0.955;
const COL_LIP_T = 0.992;

/* --- The base, as one lathe ------------------------------
   **Three meshes became one**, and it is cheaper rather than dearer.
   The foot and the plinth were tapered cylinders and the dome a
   SphereGeometry(0.76, 36, 18) whose lower half was buried inside the
   plinth — about 1,630 triangles over three draw calls, most of them
   spent on hemisphere nobody can see. Turned as a single profile at
   BASE_SEGS the whole base comes out around 1,500 triangles in **one**
   draw call, with the chamfers included and the buried half gone.

   That is also the only sane way to get the chamfers: a step cut on a
   `CylinderGeometry` means a second mesh per edge, and the point of a
   lathe is that a corner is two points on a polyline.

   Bottom to top: the underside (lifted clear of the walnut by the felt
   pad), the foot's outward-tapering flank between two chamfers, the
   shoulder in to the plinth, the plinth's flank between two more, the
   short shoulder in to the dome, and the dome itself as an elliptical
   arc closing on the axis. */
const DOME_SEGS = 9;
function baseProfile() {
  const pts = [];
  const at = (r, y) => pts.push(new THREE.Vector2(r, y));

  const footTopR = BASE_R * 0.95;
  const plinthTopR = PLINTH_R * 0.9;
  const plinthTop = BASE_H + PLINTH_H;

  /* The underside. It starts at FELT_H, not 0 — see the felt pad. */
  at(0, FELT_H);
  at(BASE_R - BEVEL, FELT_H);
  at(BASE_R, FELT_H + BEVEL); // out to the widest ring
  at(footTopR, BASE_H - BEVEL); // the flank, tapering inward as it rises
  at(footTopR - BEVEL, BASE_H); // and in over the top

  /* Concave: the step's top running in to the plinth's foot. No
     chamfer — see BEVEL. */
  at(PLINTH_R, BASE_H);
  at(PLINTH_R, BASE_H + BEVEL);
  at(plinthTopR, plinthTop - BEVEL);
  at(plinthTopR - BEVEL, plinthTop);

  /* In to the dome, which is narrower than the plinth's top. */
  at(DOME_R, plinthTop);
  for (let i = 1; i <= DOME_SEGS; i++) {
    const ph = (i / DOME_SEGS) * (Math.PI / 2);
    at(DOME_R * Math.cos(ph), plinthTop + DOME_H * Math.sin(ph));
  }
  return pts;
}

/* **A short collar with both of its outer edges chamfered**, which is
   what the plain `CylinderGeometry` collars were missing — the joint
   where the arm meets the yoke's bar, and the one where the tilt pin
   leaves its cap. Same reasoning as BEVEL: a collar's whole job is to
   read as a separate turned part, and a right-angled ring returns no
   line for the eye to separate it by.

   Turned about its own y and left to the caller to rotate, exactly as
   the cylinders it replaces were. Six profile points, so at 18
   segments it is around 180 triangles — a handful more than the
   cylinder, in the same one draw call. */
function chamferedCollar(r, len, segs = 18) {
  const b = Math.min(BEVEL, r * 0.3, len * 0.3);
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(r - b, 0),
    new THREE.Vector2(r, b),
    new THREE.Vector2(r, len - b),
    new THREE.Vector2(r - b, len),
    new THREE.Vector2(0, len),
  ];
  const g = new THREE.LatheGeometry(pts, segs);
  /* Centred on its own middle, so it drops into the positions the
     cylinders used without re-deriving any of them. */
  g.translate(0, -len / 2, 0);
  return g;
}

/* The profile, bottom to top, as (radius, height). Both ends come
   back to radius 0 so the solid is closed — the foot is buried in
   the base dome and never seen, but an open tube there shows its own
   inside the moment the camera drops to the flat end of an orbit. */
function columnProfile() {
  const H = COL_VIS;
  const b = COL_BURIED; // the stub inside the dome, below every section
  const pts = [];
  const at = (r, y) => pts.push(new THREE.Vector2(r, y));

  at(0, 0);
  at(COL_FOOT_R, 0);
  at(COL_FOOT_R, b); // up through the dome, then the neck starts
  at(COL_NECK_R, b + COL_NECK_T * H);

  /* The bulge as a half-ellipse on the profile: widest at its middle
     and back to the neck's radius at both ends, so it joins the neck
     below and the shaft above without a corner at either. */
  const yc = b + COL_BULGE_MID * H;
  const a = COL_BULGE_HALF * H;
  const BULGE_SEGS = 14;
  for (let i = 1; i <= BULGE_SEGS; i++) {
    const ph = -Math.PI / 2 + (i / BULGE_SEGS) * Math.PI;
    at(
      COL_NECK_R + (COL_BULGE_R - COL_NECK_R) * Math.cos(ph),
      yc + a * Math.sin(ph),
    );
  }

  at(COL_SHAFT_R, b + COL_SHAFT_T * H);
  at(COL_SHAFT_R, b + COL_COLLAR_B * H);
  /* The collar steps out, and the convex corner at the top of that
     flare is chamfered — it is the one edge on the column that faces
     the camera squarely at the home framing, where the base's rings
     are all seen from above. The flare's own foot is concave and is
     left sharp; see BEVEL. */
  at(COL_COLLAR_R - BEVEL, b + (COL_COLLAR_B + 0.021) * H);
  at(COL_COLLAR_R, b + (COL_COLLAR_B + 0.021) * H + BEVEL);
  at(COL_COLLAR_R, b + COL_COLLAR_T * H);

  /* The small rounded lip over the top, then the cap. */
  const LIP_SEGS = 8;
  for (let i = 1; i <= LIP_SEGS; i++) {
    const ph = (i / LIP_SEGS) * (Math.PI / 2);
    at(
      COL_LIP_R + (COL_COLLAR_R - COL_LIP_R) * Math.cos(ph),
      b + COL_COLLAR_T * H + (COL_LIP_T - COL_COLLAR_T) * H * Math.sin(ph),
    );
  }
  at(0, b + H);
  return pts;
}

/* --- The shade -------------------------------------------
   **A horizontal trough, long axis side to side, convex side up, open
   side DOWN.** That sentence is the whole specification, and how it
   is built follows from the second clause.

   **The cross-section is one 2D profile, swept along the length.**
   Everything that has a cross-section here is cut from that single
   outline: the green shell, the cream lining a hair inside it, and
   the two end caps. They cannot disagree about the shape they share,
   because there is only one shape.

   The five constants below are the whole silhouette. They are
   *dimensions*, not the parameters of a curve family — the previous
   version was an angular superellipse whose shape came out of a
   radius, a squash factor, an exponent and an arc length, and
   nothing about "how deep is it" or "where is the ridge" could be
   read off any of them.

   **The profile is a shoulder plus a skirt**, and it needs to be
   both. The shoulder is a superellipse quadrant per flank, which is
   what gives a banker's shade its flat crown and standing sides — an
   ellipse curves everywhere and reads as a pipe. The skirt is the
   near-vertical drop below the widest line, which a single monotone
   quadrant cannot produce: fitted as one curve the best any exponent
   manages is 50% of the height out. Split, `FRONT_CURVE` and
   `BACK_CURVE` of 3.2 reproduce the previous shape to **0.009 world
   units** — which is the old skirt's 2.3-degree inward lean, now
   drawn plumb.

   **Frame:** x along the length, y up, z the depth, +z the front.
   `y = 0` is the widest line, so the crown is at +`SHADE_SHOULDER`
   and the lips at -`SHADE_SKIRT`. `z = 0` is the middle of the
   depth, so the two lips sit at +/-`SHADE_DEPTH / 2` whatever
   `PEAK_POS` does — moving the ridge slides the crown along a
   footprint that stays put, rather than dragging the whole shade. */
const SHADE_LEN = 2.7;

/* Front to back, at the widest line. Down 25% from the 1.882 the
   squarer section used. */
const SHADE_DEPTH = 1.412;
/* Crown down to the **back** lip — the whole section, skirt
   included. */
const SHADE_HEIGHT = 0.913;
/* How much of that height is the near-vertical skirt below the
   widest line. The rest is the shoulder. */
const SHADE_SKIRT = 0.229;
/* How much lower the **front** lip finishes than the back one. The
   section is no longer symmetric top to bottom either: a real
   banker's shade hangs a little further down at the front, which is
   also the side the light is thrown toward. */
const FRONT_DROP = 0.06;
/* Where the ridge sits across the depth: 0 is hard against the back
   lip, 1 hard against the front, 0.5 centred. It splits the depth
   into the two flanks' widths, so at anything but 0.5 the front and
   back shoulders span different distances and the same CURVE on
   each produces different slopes — which is the point of it. At 0.4
   the back flank spans 0.56 and the front 0.85, so the back falls
   at a slope of 1.21 against the front's 0.81. */
const PEAK_POS = 0.4;
/* The superellipse exponent of each flank, independently, and the
   pair that sets where the section sits **between a triangle and a
   half circle**: 1 is a straight cone face, 2 is an ellipse, and
   anything above 2 starts flattening the crown into a box — which
   is where these were (3.2) and is what made the shade read as a
   squared trough rather than a peaked one.

   Both are above 1, which is what keeps the ridge *rounded*: the
   slope of a quadrant at its own peak is zero for any exponent over
   1 and only becomes a corner at exactly 1. So the two flanks meet
   smoothly even though they are different curves.

   The back is nearer the triangle — straighter, and over a shorter
   span, so it drops away steeply. The front is nearer the circle,
   which is the soft outward bulge on the longer slope. */
const BACK_CURVE = 1.4;
const FRONT_CURVE = 1.8;

const SHADE_T = 0.025; // the lining sits this far inside the glass
const PROFILE_SEGS = 48;

/* **How the ends are closed.** They were flat slabs: the section was
   swept straight and capped with a disc, which is a shape no blown
   shade has — and the disc met the wall on a 90-degree rim, a hard
   bright line right round the silhouette.

   The sweep is a **loft** now. The section is carried along the
   length and, over the last stretch, shrunk onto the pivot axis so
   each end closes as a dome. There are no caps; the surface closes
   on itself. Two figures describe it, measuring from opposite sides
   of where the old end plane was:

   - `END_ROUND` — how far **in** from the end the shrinking starts.
   - `END_BULGE` — how far **out** past it the dome reaches.

   So the dome spends `END_ROUND + END_BULGE` of travel going from
   full section to nothing. **The parameter is the angle**, not x and
   not the scale: x moves as `sin` and the section as `cos`, which
   makes an ellipsoidal end — the section's rate of change is zero
   where it leaves the straight run, so there is no crease there, and
   `dx` is zero at the tip, so the surface turns to face along the
   axis and the apex is a smooth dome rather than a cone point.
   Stepping uniformly in x or in scale instead bunches the rings
   where the curve is straight and starves the turn, which shows as
   a flat panel set into a crease at the very end. */
const END_ROUND = 0.3;
const END_BULGE = 0.16;
const END_SEGS = 18;
const MID_SEGS = 8;

/* **The radius every long edge is rounded to** — the bottom rim
   here, and the ridge where the two slopes meet (see `roundRidge`,
   which needs a different mechanism for the same number).

   **How far the bottom rim curls under**, the other hard edge. The
   shell has no thickness, so where it stopped the green met the
   cream lining on a knife edge that ran the whole length of the
   shade — crisp from every angle and the one thing left reading as
   cut rather than moulded.

   The curl goes **inward and up, never lower**. That is the whole
   trick of it: the arc is tangent to the plumb skirt at
   `lip + EDGE_RADIUS` and bottoms out exactly at the lip, so the
   shade's lowest point and its widest depth are both where they
   were. Curling it outward-and-under instead would have dropped the
   rim by this much, and the lip's height is what the rod, the seat
   solve and the 1.6-diameter clearance are all stated against. */
const EDGE_RADIUS = 0.12;
const LIP_SEGS = 5;

/* Derived from the five above; nothing downstream reads the raw
   dimensions, so re-proportioning the shade carries the bulb, the
   lights, the end caps, the chain, the rod and the arm's joint with
   it instead of leaving each at a number that was right before. */
const SHADE_SHOULDER = SHADE_HEIGHT - SHADE_SKIRT; // crown above y = 0
const SHADE_CROWN = SHADE_SHOULDER; // the inside of the top
/* **The back lip, and the shade's lowest point.** Everything that
   hangs off the shade's underside is stated against this one —
   the rod, the lights, the seat solve — so it keeps the bare name.
   That it is still the lowest point once the front drops is a fact
   about the tilt and is checked, not assumed: at 12 degrees forward
   the front lip would have to drop past 0.30 to overtake it, and
   FRONT_DROP is 0.06. */
const SHADE_LIP_Y = -SHADE_SKIRT; // negative: the lips hang below
const FRONT_LIP_Y = SHADE_LIP_Y - FRONT_DROP;
const SHADE_HALF_D = SHADE_DEPTH / 2; // front or back lip, from centre
const PEAK_Z = (PEAK_POS - 0.5) * SHADE_DEPTH; // where the ridge sits
const BACK_W = PEAK_POS * SHADE_DEPTH; // the back flank's span
const FRONT_W = (1 - PEAK_POS) * SHADE_DEPTH; // the front flank's span

/* The shoulder, as height above the widest line at a given depth.
   `w` is that flank's span and `n` its exponent, so the two flanks
   are the same function with different arguments. */
function shoulderAt(dz, w, n) {
  const u = Math.min(Math.abs(dz) / w, 1);
  return SHADE_SHOULDER * (1 - u ** n) ** (1 / n);
}

/* **The side profile, as an ordered point list** — `(z, y)`, running
   from the front lip, up the front skirt, over the crown, down the
   back shoulder and down the back skirt to the back lip. The closing
   chord across the mouth is **not** in the list: the sweep must not
   draw it (it would floor the opening) and `THREE.Shape` adds it
   itself for the caps, which do want it.

   The order is load-bearing. `troughGeometry` takes its outward
   normal from the tangent, and the winding is checked at the crown —
   there the tangent runs -z and the normal must be +y. Reverse this
   list and the shell turns inside out. */
function shadeProfilePoints() {
  const pts = [];
  const R = EDGE_RADIUS;

  /* The front rim, curling up out of its lowest point. `side` is +1
     at the front and -1 at the back; the arc's centre sits one
     radius inboard and one radius above the lip. */
  const rim = (side, lipY, reverse) => {
    const cz = side * (SHADE_HALF_D - R);
    const cy = lipY + R;
    const arc = [];
    for (let i = 0; i <= LIP_SEGS; i++) {
      const a = (i / LIP_SEGS) * (Math.PI / 2);
      /* a = 0 is the bottom of the curl (facing down), a = PI/2 is
         where it meets the plumb skirt (facing out). */
      arc.push(
        new THREE.Vector2(cz + side * R * Math.sin(a), cy - R * Math.cos(a)),
      );
    }
    return reverse ? arc.reverse() : arc;
  };

  pts.push(...rim(1, FRONT_LIP_Y, false));

  const n = PROFILE_SEGS;
  for (let i = 0; i <= n; i++) {
    /* Depth from the front lip round to the back lip. */
    const z = SHADE_HALF_D - (i / n) * SHADE_DEPTH;
    const dz = z - PEAK_Z;
    pts.push(
      new THREE.Vector2(
        z,
        dz >= 0
          ? shoulderAt(dz, FRONT_W, FRONT_CURVE)
          : shoulderAt(dz, BACK_W, BACK_CURVE),
      ),
    );
  }

  pts.push(...rim(-1, SHADE_LIP_Y, true));
  return pts;
}

/* **No point on the section is allowed to be sharper than
   EDGE_RADIUS**, and this is what enforces it on the ridge.

   The rim gets its radius for free — it is built as an arc of
   EDGE_RADIUS directly. The ridge cannot be done that way: both
   flanks arrive at the peak with zero slope, so there is no corner
   to cut and no tangent fillet fits. What makes it read as a crease
   is curvature, not slope.

   So the fix is stated as the property wanted rather than as a
   construction: walk the shoulder, and wherever three consecutive
   samples circumscribe a circle smaller than EDGE_RADIUS, relax the
   middle one toward the chord. Repeat until nothing is too sharp.
   The stopping condition *is* the radius, so the invariant is
   checkable — and it holds whatever PROFILE_SEGS is, which a
   construction keyed to the sample spacing would not.

   **Worth knowing before tuning it: the ridge is already nearly
   this round.** Sampled at PROFILE_SEGS the sharpest point on the
   shoulder measures 0.1014, so at a radius near that this is close
   to a no-op and the visible change is the rim's bead. The crown
   drops only when EDGE_RADIUS is pushed past it. */
function roundRidge(pts) {
  const out = pts.map((v) => v.clone());
  const radius = (a, b, c) => {
    const A = a.distanceTo(b);
    const B = b.distanceTo(c);
    const C = a.distanceTo(c);
    const area2 = Math.abs(
      (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y),
    );
    return area2 < 1e-12 ? Infinity : (A * B * C) / (2 * area2);
  };
  for (let pass = 0; pass < 200; pass++) {
    let moved = false;
    for (let i = 1; i < out.length - 1; i++) {
      if (out[i].y <= 0) continue; // the skirt and the rim are not shoulder
      if (radius(out[i - 1], out[i], out[i + 1]) >= EDGE_RADIUS) continue;
      /* Toward the chord midpoint, under-relaxed so neighbouring
         corrections settle instead of ringing. */
      out[i].lerp(
        out[i - 1].clone().add(out[i + 1]).multiplyScalar(0.5),
        0.35,
      );
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

/* **The level the rim holds and the ends close onto.**

   This was a function of depth, interpolated between the two lip
   heights so each lip held its own exactly. That turned out to be
   the seam: with a *different* y-anchor per profile point, adjacent
   points shrank toward different targets, so the end face kinked
   where the rounded top met the level bottom — and the two lips,
   never converging in y, left the tip as a 0.06 vertical edge
   rather than a point, which is the jog in the rim.

   One constant anchor for the whole section fixes both. At
   `FRONT_LIP_Y` — the lower of the two lips — the front rim is dead
   level for the entire length and the back rim, 0.06 above it,
   sweeps smoothly down to meet it at the tip. The rim is then one
   closed curve with no step anywhere, the ends close on a single
   point, and the error is in the safe direction: the shell only
   ever gains green at the ends, never loses it. */
const RIM_LEVEL = FRONT_LIP_Y;

const SHADE_PROFILE = roundRidge(shadeProfilePoints());

/* **The pivot: the centroid of the end-cap face.** A banker's shade
   is hung from the middle of its ends, not from its bottom edge —
   roughly half way front to back and half way up, which is what the
   area centroid of the side profile *is*. Computing it instead of
   writing it down is what keeps it centred when the section is
   re-proportioned or the lips move: `PEAK_POS`, the two CURVEs and
   `FRONT_DROP` all feed it.

   Standard polygon centroid over the closed outline — the profile
   list plus the chord across the mouth that `THREE.Shape` would add,
   which the `% n` wrap supplies here. The profile is stored as
   `(z, y)`, so `.x` is depth throughout. */
function profileCentroid() {
  const pts = SHADE_PROFILE;
  const n = pts.length;
  let a2 = 0;
  let cz = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % n];
    const cross = p.x * q.y - q.x * p.y;
    a2 += cross;
    cz += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  return new THREE.Vector2(cz / (3 * a2), cy / (3 * a2));
}
const PIVOT = profileCentroid();

/* Read off the rounded section rather than the nominal one: opening
   the ridge lowers the crown by a little under the radius, and the
   bulb is placed as a share of it. */
const SHADE_CROWN_ACTUAL = Math.max(...SHADE_PROFILE.map((v) => v.y));

/* Where along the length the loft puts a ring, and how big the
   section is there. See END_ROUND / END_BULGE.

   **The middle is segmented too**, which it was not: the prismatic
   run between the two domes was a single 2.1-long span against
   0.004 between the tightest dome rings, a 500:1 ratio. A ruled
   span is geometrically exact however coarse, so it was not wrong —
   but it leaves the shell with no vertices anywhere a highlight
   actually travels, and nothing to interpolate a normal across.

   The dome stays stepped in **angle**. Uniform in x would space the
   rings evenly and be worse: the turn is all in the last fraction
   of the length, and that is exactly where the rings need to be. */
function sweepStations() {
  const straight = SHADE_LEN / 2 - END_ROUND;
  const reach = END_ROUND + END_BULGE;
  const out = [];
  const dome = (i, sign) => {
    const a = (i / END_SEGS) * (Math.PI / 2);
    return { x: sign * (straight + reach * Math.sin(a)), scale: Math.cos(a) };
  };
  for (let i = END_SEGS; i >= 0; i--) out.push(dome(i, -1));
  for (let i = 1; i < MID_SEGS; i++)
    out.push({ x: -straight + (2 * straight * i) / MID_SEGS, scale: 1 });
  for (let i = 0; i <= END_SEGS; i++) out.push(dome(i, 1));
  return out;
}

/* **The same outline as a `THREE.Shape`**, which closes itself across
   the mouth — so this is the end cap's face, and `ShapeGeometry` of
   it is the cap. One outline, two uses, no way for them to drift.

   `mirror` negates the depth axis, and it exists because of how the
   caps are placed: each is stood up by `rotation.y = ±90`, and those
   two rotations map the shape's depth axis to **opposite** world z.
   While the section was symmetric that was invisible — a symmetric
   outline does not notice being flipped — but `PEAK_POS` is a knob
   now, and at anything other than 0.5 an unmirrored pair would put
   the ridge toward the front on one end cap and toward the back on
   the other. Mirroring one cancels the rotation's own flip. */
/* **The shell's front face at a given height** — the profile solved
   for z instead of sampled. Anything fixed to the glass from outside
   wants this rather than a fraction of SHADE_HALF_D: a factor tuned
   against one cross-section silently stops landing on the glass when
   the section changes. That is what happened to the pull chain when
   the arc first became a superellipse — `SHADE_HALF_D * 0.84` had
   been on the lip of a circular arc, whose flank curls inward, and
   on a squarer section the same factor left the chain hanging in
   mid-air 0.16 inside the mouth.

   Below the widest line the answer is the front lip's own depth,
   because the front skirt is plumb — it just runs further down than
   the back one now. */
function shellDepthAt(y) {
  const front = PEAK_Z + FRONT_W;
  /* Inside the rim's curl the face is the arc, not the plumb skirt. */
  if (y <= FRONT_LIP_Y) return front - EDGE_RADIUS;
  if (y < FRONT_LIP_Y + EDGE_RADIUS) {
    const dy = FRONT_LIP_Y + EDGE_RADIUS - y;
    return front - EDGE_RADIUS + Math.sqrt(EDGE_RADIUS ** 2 - dy ** 2);
  }
  if (y <= 0) return front;
  if (y >= SHADE_SHOULDER) return PEAK_Z;
  const u = (1 - (y / SHADE_SHOULDER) ** FRONT_CURVE) ** (1 / FRONT_CURVE);
  return PEAK_Z + FRONT_W * u;
}

/* The same inverse the other way: the roof's height at a given depth,
   for hanging things from the inside. */
function shellHeightAt(z) {
  const dz = z - PEAK_Z;
  return dz >= 0
    ? shoulderAt(dz, FRONT_W, FRONT_CURVE)
    : shoulderAt(dz, BACK_W, BACK_CURVE);
}

/* **The forward tilt**, about the shade's own long axis, and the one
   thing that makes the fixture read as aimed rather than parked. The
   mouth's normal goes from straight down to
   `(0, -cos, +sin)` — down and toward +Z, which is where someone
   sitting at the desk is.

   Tipping the mouth forward **drops the back lip and raises the
   front** — the opposite of what "tilted forward" sounds like, and
   the reason the reference photographs show the lit cream interior
   from in front.

   **12 degrees, down from 20**, and the margin moved the safe way.
   The test is the mouth's normal `(0, -cos, sin)` against the
   direction to the home camera (20 up, 37 round): at 20 degrees the
   dot was -0.06, about four degrees on the closed side, and the note
   here used to read "much past 24 and the bare bulb comes into
   shot". At 12 it is -0.18, roughly ten degrees clear — flattening
   the shade tucks the bulb further under its own crown rather than
   exposing it, and the squarer section with its lower lip adds more
   shell again. What is given up is the other half of the trade: less
   of the lit lining shows from home, and the pool lands nearer the
   fixture. */
const SHADE_TILT = THREE.MathUtils.degToRad(12);

/* **How high the shade hangs is stated as the thing that was asked
   for — where its bottom edge lands — and the seat is solved back
   from it.** `SHADE_Y` was a number typed in and nudged; the figure
   anyone actually judges a lamp by is how far the shade clears the
   surface, and on this one that is set against the base's own
   diameter so the proportion survives any change to `LAMP_SCALE`.

   1.6 diameters. The lamp read short at 2.6 of seat (the shade's
   bottom edge sat 0.98 diameters up), and the lever for that is the
   arm rather than the column — see ARM_LEAN below. */
const SHADE_BOTTOM = 1.6 * (BASE_R * 2);
const SHADE_Z = 0.55;

/* --- The holder ------------------------------------------
   **A yoke on the ends, not a rod under the bottom edge.** The shade
   used to be clipped to a rod running the length of its back lip,
   which is a fitting no banker's lamp has: the real one carries the
   shade on two pivots at the centres of its end caps, with a brass
   hoop round the back joining them to the arm.

   The change that matters is not the shape of the brass, it is
   **what the shade turns about**. The pivot axis is now the line
   through the two centroids, so tilting the shade rotates it about
   its own middle instead of swinging it round its bottom edge.

   **The yoke is a child of `root`, not of `shade`.** That is the
   whole point of a pivot: the shade turns and the yoke does not.
   It also keeps the arm honest — the arm ends on the bar, and if
   the bar rotated with the shade then `aimLamp` would tilt the
   shade and leave the arm reaching at nothing. The old rod got this
   for free by sitting exactly on the rotation axis; a hoop behind
   the shade has to be told.

   One consequence to carry: because the yoke does not rotate, every
   clearance it holds is against the **tilted** shell, so the bar's
   seat is solved in the yoke's own frame rather than the shell's. */
const YOKE_R = 0.075; // the hook and bar tube radius
/* How far each hook stands off the end cap before it turns. The
   hooks are outboard of the shade for their whole length, which is
   why only the bar has to hold a clearance. */
const YOKE_OUT = 0.24;
/* The clearance the bar keeps from the green. */
const YOKE_GAP = 0.06;
/* How far below the shade's lowest back point the bar sits. */
const YOKE_DROP = 0.1;

/* The tilt knob: the pivot pin itself, continuing straight out of
   one end cap and past the hook that turns away from it. A plain
   turned pin with a collar where it leaves the cap and a rounded
   end — no ball. Narrower than the hook, so the stretch they share
   reads as the pin passing through the yoke. */
const KNOB_R = 0.05;
const KNOB_OUT = 0.2; // how far it stands proud of the hook
const KNOB_COLLAR_R = 0.095;
const KNOB_COLLAR_LEN = 0.1;

/* --- What is inside the shade -----------------------------
   **The socket is mounted near the back of the trough, not down its
   middle**, which is where a banker's lamp's is: the fitting hides
   up under the rear slope and the tube runs across the shade in
   front of it, so what the mouth shows is lit lining with a bulb
   over it rather than a bulb bisecting it.

   The height is a share of the crown and the depth is checked
   against the profile rather than guessed — at this y the shell runs
   to z +/-0.94, and the socket is the wider of the two at 0.15, so
   -0.55 leaves about 0.24 of clearance behind it and the bulb's top
   sits 0.32 under the roof. Push it much further back and the socket
   starts to foul the rear flank; bring it forward and it comes into
   view through the mouth from the home camera. */
const BULB_Y = SHADE_CROWN_ACTUAL * 0.3;
/* **Derived from the back flank, not written down.** It was -0.55,
   which was comfortably inside a section 1.88 deep and is outside
   one 1.41 deep: at the bulb's own height the back flank now stands
   at z -0.63, so a 0.15-radius socket centred at -0.55 pushed
   through the glass. A fraction of the back flank's span keeps it
   tucked under the rear slope at any depth the section is given. */
const BULB_Z = PEAK_Z - BACK_W * 0.35;
const BULB_R = 0.12;
const BULB_HALF = (SHADE_LEN * 0.4) / 2 + BULB_R;

/* **The socket caps the bulb's end; it does not straddle its
   middle.** Two reasons, and the second is not a styling one.

   A real lampholder is at one end of a tubular lamp, with the tube
   running away from it — which is also the plainest reading of "the
   bulb pointing sideways along the long axis".

   And a collar round the middle *encloses the point light*, which
   sits at the bulb. Nothing here casts, so the socket did not block
   the light — but every one of its own outward normals faced away
   from a source at its centre, so it shaded as unlit and came out a
   flat black blob in the middle of the glowing lining. Moving it to
   the end puts the light outside it, and the collar is lit from
   along the tube the way it would be. */
/* --- The filament ----------------------------------------
   **A bulb is not an emissive capsule, and the fix is to put
   something inside it.** Flat emissive over a tube gives a white bar:
   every fragment returns the same value, so there is no shading left
   and nothing in it to read as either glass or a source. Two things
   together fix that, and neither is expensive.

   The first is this — a thin element down the middle of the tube,
   hotter than the envelope by about a factor of two, with the
   envelope turned *translucent* so it shows through. That is the cue
   the eye actually uses: a bright line with a soft halo around it is
   a filament in glass, and a uniform shape of any brightness is not.
   Six radial segments is plenty, because at the size this renders it
   is two or three pixels wide and will never show a facet.

   The second is the gradient along the envelope — see
   `bulbGlowTexture`.

   It is short of the ends by FILAMENT_IN: a real tubular lamp's
   element stops well inside the pinch, and the gap is what the glass
   has to be seen as glass in. */
const FILAMENT_R = 0.028;
const FILAMENT_IN = 0.3; // the share of the tube's half-length it stops short of

const SOCKET_R = 0.15;
const SOCKET_LEN = 0.34;
const SOCKET_X = -(BULB_HALF - SOCKET_LEN / 2 + 0.01);

/* --- The pull chain ---------------------------------------
   Hung from the **front lip, at the end opposite the adjuster knob**
   — the knob is at -x, so this is +x. 0.36 of the length puts it
   within half a shade-depth of the end cap without crowding it.

   The depth comes off `shellDepthAt` so it is on the glass by
   construction, inset by one bead radius so the beads touch the lip
   rather than straddling it. */
const CHAIN_X = SHADE_LEN * 0.36;
const CHAIN_Y = FRONT_LIP_Y + 0.03;
const BEAD_R = 0.04;
/* Just under a diameter, so consecutive beads overlap very slightly
   and the run reads as a chain. At the old 0.085 against a 0.035
   bead the gaps were wider than the beads and it read as a dotted
   line. */
const BEAD_GAP = 0.072;
const BEAD_N = 14;

/* The shade group's own pose, as data, because three things outside
   the group need to work in its frame: the arm's joint, the pull
   chain's hanging point, and `aimLamp`'s report. Each of them would
   otherwise restate the tilt, and a restated angle is one that can go
   stale. */
const SHADE_ORIENT = new THREE.Euler(-SHADE_TILT, 0, 0);
/* The shell's seat within the shade group — the pivot, negated,
   because the group's origin *is* the pivot axis. */
const SHELL_OFFSET = new THREE.Vector3(0, -PIVOT.y, -PIVOT.x);
/* **Derived, not written down.** The rod sits wherever it has to for
   the shell to land on `SHADE_Y` / `SHADE_Z`, so re-tucking the rod
   under the lip moves the pivot and the arm's joint with it and
   leaves the green exactly where the framing notes say it is. */
/* The shell's seat, solved from `SHADE_BOTTOM`.

   The lowest green is the **back lip**, and that it is the back one
   is a consequence of the forward tilt rather than an assumption:
   the shell's own profile bottoms out at `SHADE_LIP_Y` at both ends,
   and the tilt adds `sin(tilt) * z`, which is most negative at the
   most negative z. So the two lips are the only candidates and the
   back one wins. (The rod hangs a little below it — this is the
   green's edge, not the fixture's.) */
const SHELL_IN_SHADE = SHELL_OFFSET.clone().applyEuler(SHADE_ORIENT);
const BACK_LIP_IN_SHADE = new THREE.Vector3(
  0,
  SHADE_LIP_Y + SHELL_OFFSET.y,
  -(SHADE_HALF_D - EDGE_RADIUS) + SHELL_OFFSET.z,
).applyEuler(SHADE_ORIENT);

/* **Where the bar sits, solved against the tilted shell.**

   The yoke does not rotate, so the shell's profile has to be carried
   into the yoke's frame before anything can be measured against it —
   a clearance written in the shell's own coordinates would be out by
   the tilt. `BAR_Y` is a fixed drop below the shell's lowest point;
   `BAR_Z` is then the *largest* z at which a tube of radius YOKE_R
   still clears every point of the section by YOKE_GAP, which is one
   pass over the profile rather than a number to re-tune whenever the
   shape moves. */
const SHELL_IN_YOKE = SHADE_PROFILE.map((v) =>
  new THREE.Vector3(0, v.y + SHELL_OFFSET.y, v.x + SHELL_OFFSET.z).applyEuler(
    SHADE_ORIENT,
  ),
);
const BAR_Y = Math.min(...SHELL_IN_YOKE.map((v) => v.y)) - YOKE_DROP;
const BAR_Z = Math.min(
  ...SHELL_IN_YOKE.map((v) => {
    const d = YOKE_R + YOKE_GAP;
    const dy = Math.abs(v.y - BAR_Y);
    return dy >= d ? Infinity : v.z - Math.sqrt(d * d - dy * dy);
  }),
);
/* **Where the pivot axis actually leaves the glass**, found rather
   than assumed. It used to be the dome's apex, because the dome
   closed onto the pivot; now it closes onto the rim, so the apex is
   down at rim height and the axis exits lower down the end face.
   Attaching the hooks at the apex would have left them reaching
   past the glass into air.

   Bisect on the dome's angle for the station whose scaled section
   still reaches the pivot's height at the pivot's depth. */
const PIVOT_X = (() => {
  const straight = SHADE_LEN / 2 - END_ROUND;
  const reach = END_ROUND + END_BULGE;
  const topAtPivot = (sc) => {
    if (sc <= 1e-6) return null;
    const z = PEAK_Z + (PIVOT.x - PEAK_Z) / sc;
    if (z > SHADE_HALF_D || z < -SHADE_HALF_D) return null;
    const dz = z - PEAK_Z;
    const yt =
      dz >= 0
        ? shoulderAt(dz, FRONT_W, FRONT_CURVE)
        : shoulderAt(dz, BACK_W, BACK_CURVE);
    return RIM_LEVEL + (yt - RIM_LEVEL) * sc;
  };
  let lo = 0;
  let hi = Math.PI / 2;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const v = topAtPivot(Math.cos(mid));
    if (v === null || v < PIVOT.y) hi = mid;
    else lo = mid;
  }
  return straight + reach * Math.sin(lo);
})();
const BAR_HALF = PIVOT_X + YOKE_OUT;
const SHADE_Y =
  SHADE_BOTTOM + SHELL_IN_SHADE.y - BACK_LIP_IN_SHADE.y;

const SHADE_ORIGIN = new THREE.Vector3(0, SHADE_Y, SHADE_Z).sub(
  SHELL_IN_SHADE,
);
/* Shell frame to lamp frame — through the shell's seat and then the
   tilt, so a point stated against the green comes out right however
   the holder is re-tucked. */
const fromShell = (x, y, z) =>
  new THREE.Vector3(x, y + SHELL_OFFSET.y, z + SHELL_OFFSET.z)
    .applyEuler(SHADE_ORIENT)
    .add(SHADE_ORIGIN);

/* **The whole fixture is scaled by this, as a group scale on the root
   rather than a rebuild** — same decision as src/lamp.js and
   TREEHOUSE_SCALE, applied about the root's own origin so the base
   stays flat on the walnut and the caller's placement does not have to
   know the scale exists.

   1.75 is the cone lamp's figure and this is deliberately the same, so
   the two can be swapped and compared without a second variable moving
   underneath. See the note above BASE_R for what the two fixtures
   then measure.

   **A group scale reaches the geometry and the transforms and nothing
   else.** The same four things are blind to it as in src/lamp.js, and
   three are multiplied here explicitly — `distance` on both lights,
   the spot's `shadow.camera.near`, and its `shadow.normalBias`, which
   walks a sample along the normal by a distance in *world* units. The
   fourth is the falloff, and see POINT_INTENSITY for what this fixture
   does about it. `shadow.radius` is deliberately not scaled: it is a
   blur width in texels, and a texel covers more world at a longer
   throw, so the penumbra grows on its own. */
export const LAMP_SCALE = 1.4875;

/* **Where this fixture stands on the desk, overriding scene.js's own
   LAMP_X / LAMP_Z.** Optional in the contract: scene.js falls back on
   its constants when a module does not export these, so src/lamp.js
   is untouched and the shipped cone lamp keeps the seat it was
   measured into.

   It has to be its own figure because this lamp is a different size
   and shape. At scene.js's -7.0 the adjuster knob — a solid piece of
   brass, not the painted contact shadow — hung 0.16 past the walnut's
   -x edge, which is the defect that forced the cone lamp's own move
   and is worse here because a knob in mid-air is not a soft blob.

   **z did the work, and x alone could not have.** The obvious move
   was +x, to pull the knob back onto the walnut. Swept against
   occlusion it made things *worse*: +x walks the fixture
   screen-right, toward the machine, and at the left clamp this lamp
   is tall enough to graze the CRT's silhouette. Moving it **back**
   is what clears it — over a 4x4 sweep the occlusion count fell to
   zero at every x once z passed about -4.2, and rose steadily as z
   came forward. So the seat is a small +x for the desk edge and a
   larger -z for the clamp, and the back edge is what pays:

       -x edge 0.09    back edge 0.08    (both positive, both thin)

   Those are the two binding margins and there is no slack left in
   either. The -x extreme is the adjuster knob; the back extreme is
   the painted contact shadow, which is why the back figure matters
   as much — a contact blob off the edge of the desk is a grey patch
   in mid-air.

   **The gap `_lampbig.mjs` prints to the computer kit is not a
   clearance and should not be optimised against.** It is a pure
   x-interval comparison, and the kit's -x extreme is the
   **keyboard's painted contact shadow** at z 1.39..5.99 — the desk's
   front. This lamp lives around z -6.8..-1.9 and the two do not
   overlap in z at all. The real nearest thing inside the lamp's own
   z and y band is the CRT's bezel at x -3.25, and the gap to that is
   comfortable. */
export const LAMP_X = -6.75;
export const LAMP_Z = -4.35;

/* --- The lights, and what "spreads all around" costs ------
   The brief: the light spreads **all around and down from under the
   shade**, warm and soft, with no harsh outline. Three decisions come
   out of that, and the first two are the ones that differ from the
   cone lamp.

   - **The point light carries most of it**, not the spot. A trough
     shade is open along its whole underside *and* at both ends, so the
     honest shape for its light is a sphere with the top bitten out,
     not a cone. The point light is what spills out of the two ends and
     lights the column, the arm and the desk either side; the spot only
     adds the downward throw and the one soft cast shadow.
   - **The spot is wide and fully penumbral**, 74 degrees at penumbra
     1.0, and it points **straight down** rather than along a tilted
     shade's axis. At the cone lamp's 51/0.9 the pool has a readable
     edge — correct for a task lamp aimed at a keyboard, wrong for
     this. Fully penumbral there is no edge to see at all, which is
     what "not a harsh lighting outline" asks for.
   - **Neither decay is inverse-square**, for the reason the cone
     lamp's are not and the CRT's spill is not: a lit shade is an area
     source and these are points, so at `decay` 2 the fixture's own
     brass blows out before anything a hand's width away sees light.

   The point light does not cast — it sits inside the shade, and the
   shade's own inner wall would be in front of it. The spot sits just
   below the shade's lower rim for the same reason the cone lamp's
   does: outside the shade the *whole fixture* is behind the light, so
   every part of it can keep `castShadow` on for the moon without the
   lamp shadowing its own pool. */
const POINT_RANGE = 6.2;
const POINT_DECAY = 1.35;

const SPOT_RANGE = 13.0;
const SPOT_DECAY = 1.25;
/* **Derived from the shade, not chosen.** The cone has to clear the
   shade's own footprint by the time it reaches the surface, or the
   pool is narrower than the thing casting it and the fixture looks
   like it is leaking. Half the diagonal of the mouth over the height
   the mouth sits at, plus a margin for the penumbra — which comes out
   near 70 degrees, where the first pass's hand-set 74 was. Writing it
   this way is what keeps it right when the shade is re-proportioned.

   The *shape* of the pool is not this angle's job: a cone is round
   whatever its angle, and the oval comes from the cookie. See
   `beamCookie`. */
const BULB_ABOVE_BASE = fromShell(0, BULB_Y, BULB_Z).y;
const SPOT_ANGLE = Math.min(
  THREE.MathUtils.degToRad(52),
  Math.atan(Math.hypot(SHADE_LEN / 2, SHADE_HALF_D) / BULB_ABOVE_BASE) +
    THREE.MathUtils.degToRad(20),
);
/* **Already at the ceiling.** `penumbra` is a 0..1 share of the cone
   that is falloff rather than core, so 1.0 is as soft as a three
   spot gets and "soften it further" cannot be done here. The two
   knobs that still have room are the cookie's gradient — which is
   what actually shapes this pool, and reaches zero well inside the
   frame — and `shadow.radius`. */
const SPOT_PENUMBRA = 1.0;

/* **The bulb sits lower than the cone lamp's, and the intensities are
   what pays for it.** This fixture's bulb is at y 2.64 local against
   the cone lamp's 3.14, so at the same LAMP_SCALE it is 0.84 of the
   distance from the surface — and at these decays that lands about
   1.25x more light on the walnut for identical numbers. The pool is
   meant to be *softer* than the cone lamp's rather than a quarter
   hotter, so the base figures are set against this fixture's own
   geometry and are not borrowed.

   **Measured rather than predicted.** `window.__pool()` in the lab
   shoots the same framebuffer row twice, lit and unlit, and reports
   the difference; along the row that crosses the slab in front of the
   fixture this lamp reads **peak 119, mean 25, and 20 of the 24
   sampled columns lifted by four levels or more**. The cone lamp in
   the same harness on the same row reads peak 26, mean 3, reach 6 —
   it is aimed forward at a keyboard and most of its pool is out of
   that row, so the two peaks are not comparable, but the *reach* is
   the number the brief asks about and it differs by a factor of
   three.

   The `LAMP_SCALE ** decay` term is the same compensation src/lamp.js
   carries and is here for the same reason: a group scale moves the
   bulb away from the surface, the pool dims by exactly that factor,
   and writing the exponent rather than a pre-multiplied number is what
   keeps re-scaling the fixture from quietly re-grading the room.
   See `window.__pool()` in src/lamp-lab.js. */
const POINT_INTENSITY = 15.0 * LAMP_SCALE ** POINT_DECAY;
const SPOT_INTENSITY = 26.0 * LAMP_SCALE ** SPOT_DECAY;

/* What "fully on" means for each emissive.

   - **the lining is bright but deliberately under the clip** (1.3).
     It is what the mouth and both open ends show, and it is the
     surface the camera reads as "the lamp is lit". It was 2.6, and
     2.6 was too hot to be useful: ACES at TONE_EXPOSURE 1.3 rolls
     anything past about 2 onto the same flat white, so the lining
     and the 5.0 bulb in front of it resolved to the *same* pixel
     value and the mouth read as a blank card with a black socket
     floating on it. At 1.3 the lining lands as cream with shading
     still in it and the bulb reads as the hotter thing, which is the
     whole point of the two numbers being different.

     **It costs nothing at the home framing**, and that is measured
     rather than argued: at 12 degrees of tilt the home camera is on
     the closed side of the mouth plane, so none of the lining is in
     shot, and the two renders at 2.6 and 1.3 are byte-identical.
     Emissive does not illuminate anything in three either, so the
     pool on the desk is untouched — this is purely what the surface
     looks like.
   - **the glass gets a real figure** (1.5 as a ceiling, about 0.8
     once `glassGlowTexture` has modulated it), where the cone lamp's
     outer shade gets 0.07. That is the brief's "you can see light up
     the green in the lampshade": cased glass with a bulb behind it is
     *itself* a light source, and the outer surface cannot be lit by
     the bulb inside it — a FrontSide material with the light behind it
     has N·L below zero and comes out black — so emissive is the only
     term there is. Flat, at 0.4 the shade stayed a dark green object
     in a dark room and at 0.85 it went to a flat lime card with no
     shading left in it — which is what the map is for: the ceiling can
     be higher than either because the lips and the two ends are
     carrying far less of it than the crown.
   - **the bulb is hotter than the lining** (5.0 against 2.6), so the
     filament still reads as the source rather than being swallowed by
     the white it is lighting — the same figure, and the same reason,
     as the cone lamp's. */
const EMIT_BULB = 5.0;
/* **The filament is hotter than the glass around it**, and that ratio
   is the whole reason the bulb stops reading as a bar. See
   FILAMENT_R. */
const EMIT_FILAMENT = 11.0;
const EMIT_LINING = 1.3;
/* **Unchanged when GLASS_OUT was darkened, and that is deliberate.**
   Emissive is additive and takes no notice of the body colour, so the
   shade now puts out exactly the light it did over a green that is
   about half as bright — which reads as *more* glow for the same
   number, and is the right direction: a dark bottle green lit from
   within from behind is what the brief asks for. The two figures in
   the note above (flat 0.4 too dark, flat 0.85 a lime card) were both
   measured against the old lighter green and no longer bound
   anything; the ceiling-plus-map arrangement they argued for still
   does. */
const EMIT_GLASS = 1.5;

let disposables = [];
/* The parts whose brightness `setLamp` writes. Module state rather
   than a closure because the caller drives this once a frame and
   should not have to carry five handles to do it. */
let parts = null;

function track(x) {
  disposables.push(x);
  return x;
}

/* --- The brass finish ------------------------------------
   **Polished: `metalness: 1`, roughness a quarter, and an environment
   map of its own.** The three are one decision and the third is what
   makes the first two possible.

   This used to be a deliberately *un*polished `metalness: 0.8` at
   roughness 0.34-0.46, and the comment here said a true polished metal
   "would have nothing to reflect and would come out black" — because
   `ENV_INTENSITY` is 0 in scene.js and the room has no environment at
   all. That reasoning was sound and the conclusion was the wrong way
   round: the fix for a metal with nothing to reflect is to give it
   something, not to stop it being a metal.

   **So the brass carries its own `envMap` rather than relying on
   `scene.environment`,** and that scoping is the whole reason this is
   safe to do. The room's three-light calibration is why the HDRI was
   switched off: at `scene.environment` an environment is an *ambient
   light*, and at the 0.1 it was first left at it was still doubling
   the median room pixel and doing a third of the fill (see "The night
   lighting" in CLAUDE.md). A per-material map on a `metalness: 1`
   surface cannot do any of that — a metal has no diffuse term, so
   there is no fill for it to contribute to. It reaches six brass parts
   as a reflection and nothing else in the room as anything.

   It also means the lab and the room reflect the same thing, since
   `material.envMap` takes precedence over `scene.environment`. That is
   the property worth having: a finish tuned in the lab is the finish
   that ships.

   **What is no longer lighting it**: at `metalness: 0.8` a fifth of
   the brass was diffuse, and the hemisphere — the room's bounce, and
   the only light most surfaces here get — was lifting it. At 1.0 the
   hemisphere contributes nothing to this material, so the fixture's
   brass is now lit by the env reflection plus the moon's, the lamp's
   own and the tube's speculars. That is physically what polished metal
   in a dark room looks like, and it is a real change in level rather
   than only in finish — worth a `window.__probes()` read next time
   `_lampshots.mjs` is run. */

/* Stated as the maximum, because `roughnessMap` *multiplies* this and
   the grain's mean is about 0.93 — so the surface runs at roughly
   0.25 with its dullest patches near 0.23. */
const BRASS_ROUGH = 0.27;
/* The socket and the stem. Rough enough to stay matt directly under
   the bulb; see BRASS_DARK. */
const BRASS_ROUGH_FITTING = 0.62;

/* **Very subtle, and with no per-pixel grain in it.** The desk's paint
   and the CRT's plastic both put white noise in their roughness maps,
   which is right for a surface whose texture is its own granularity.
   Polished metal has none: what makes real brass read as brass rather
   than as chrome is slow, wide unevenness — where it has been handled,
   where the lacquer has gone — so this is the low-frequency lattice
   alone, and the spread is narrow enough (a 16% band) that nothing on
   it reads as a mark.

   One channel's worth of data, written to all three: three samples
   `roughnessMap.g`. Left as data rather than sRGB, which is what a
   non-colour map has to be. */
const GRAIN_CELLS = 7;
const GRAIN_SIZE = 256;
const GRAIN_FLOOR = 0.84; // the dullest multiplier the field reaches
const GRAIN_REPEAT = 3;
function brassGrain() {
  const n = GRAIN_CELLS;
  const size = GRAIN_SIZE;
  const cell = size / n;
  /* The lattice wraps (`% n` on both axes), so the field tiles and the
     `RepeatWrapping` below cannot show a seam. */
  const lattice = Array.from({ length: n * n }, () => Math.random());
  const at = (i, j) => lattice[(j % n) * n + (i % n)];
  const smooth = (t) => t * t * (3 - 2 * t);

  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = x / cell;
      const fy = y / cell;
      const i = Math.floor(fx);
      const j = Math.floor(fy);
      const tx = smooth(fx - i);
      const ty = smooth(fy - j);
      const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
      const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
      const low = a * (1 - ty) + b * ty;
      const v = (GRAIN_FLOOR + (1 - GRAIN_FLOOR) * low) * 255;
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const t = track(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  /* Every part here is a different primitive with its own 0..1 UV — a
     cylinder, a lathe, a sphere, a tube — so there is no single world
     scale to set this against. A few tiles puts the unevenness at a
     believable size on the two large parts (the foot and the column)
     and leaves the small ones very nearly uniform, which is correct:
     a knob the size of a fingertip has no room for a patch. */
  t.repeat.set(GRAIN_REPEAT, GRAIN_REPEAT);
  return t;
}

/* **The room the brass reflects, drawn rather than fetched.**

   An equirectangular canvas, handed straight to `envMap` — three's
   `WebGLCubeUVMaps` sees the equirect mapping and PMREM-filters it on
   first use, which is the same path `scene.environment = hdr` takes.

   **Why not the HDRI already vendored in `public/env/`:** it is there,
   it is CC0, and it is Poly Haven's "Studio Small 09" — a daylit
   photographic studio. Reflected in a fixture lit by a moon and a
   tungsten bulb it puts white softboxes down the column, which is a
   brighter and more legible lie than this is. The content matters more
   than the provenance here, because at roughness 0.25 the reflection
   is blurred to broad patches of colour and broad patches of colour
   are all this needs to be. Zero bytes, no loader, no async, and it
   cannot arrive late on the reduced-motion path that draws one frame
   and stops — which is a trap this scene has already fallen into once
   (see the walnut's `ready` promise in CLAUDE.md).

   **Oriented to the room it stands in.** three's equirect lookup puts
   `u = atan2(z, x) / 2pi + 0.5`, so -x — the wall the window is in —
   lands on u 0 and 1, and +x on 0.5; `v` runs 0 down to 1 up. So the
   bands are ceiling, wall, walnut from top to bottom, the window's
   cool patch is drawn at both edges so it wraps, and the tube's teal
   sits at u 0.5 because the machine is to the lamp's +x. Get that
   backwards and the brass has a bright window reflected on the side
   facing away from one. */
const ENV_W = 256;
const ENV_H = 128;
function brassEnvironment() {
  const c = document.createElement("canvas");
  c.width = ENV_W;
  c.height = ENV_H;
  const ctx = c.getContext("2d");

  /* Ceiling to walnut. Dark: this is a night room, and the only bright
     things in it are drawn on top as patches. */
  const band = ctx.createLinearGradient(0, 0, 0, ENV_H);
  band.addColorStop(0.0, "#0e0c16"); // straight up, unlit ceiling
  band.addColorStop(0.42, "#232038"); // the walls
  band.addColorStop(0.56, "#2e2a44"); // the horizon, where the fade is
  band.addColorStop(0.78, "#3a2a1b"); // walnut catching the lamp
  band.addColorStop(1.0, "#241810"); // straight down, under the base
  ctx.fillStyle = band;
  ctx.fillRect(0, 0, ENV_W, ENV_H);

  const blob = (u, v, r, colour, alpha) => {
    const x = u * ENV_W;
    const y = (1 - v) * ENV_H; // v is up; canvas y is down
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, colour);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  };

  /* The window and its moon, at -x. Drawn at both edges of u so the
     two halves meet seamlessly under RepeatWrapping — it is one patch
     that happens to straddle the seam, not two windows. */
  for (const u of [0, 1]) {
    blob(u, 0.64, 46, "#aebbe4", 0.85); // the sky through the opening
    blob(u, 0.70, 14, "#e8eeff", 0.9); // the moon itself
  }
  /* The tube, at +x, two units away and the one coloured light in the
     room. Small and weak: it is a 5x4 panel seen nearly edge-on from
     the lamp, so it is a glint rather than a wall. */
  blob(0.5, 0.52, 26, "#2f6f69", 0.55);
  /* The lamp's own pool on the walnut, below and in front. A fixture
     this polished really does reflect the light it is throwing, and
     this is most of what keeps the underside of the shade's arm from
     being a black shape. */
  blob(0.78, 0.2, 52, "#4a2f14", 0.8);

  const t = track(new THREE.CanvasTexture(c));
  t.mapping = THREE.EquirectangularReflectionMapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* `finish` is built once per `buildLamp` and shared by both materials
   rather than memoised at module scope: `disposeLamp` frees everything
   `track` holds, so a module-level singleton would be disposed and
   then handed to the next build. */
function brassMaterial(colour, rough, finish) {
  return track(
    new THREE.MeshStandardMaterial({
      color: colour,
      metalness: 1.0,
      roughness: rough,
      roughnessMap: finish.grain,
      envMap: finish.env,
      /* Full strength, where this was 0.55. At `metalness: 1` the env
         is not one contribution among several — it is the only thing
         lighting the metal between the speculars, so scaling it down
         is scaling the brass down. */
      envMapIntensity: 1.0,
    }),
  );
}

/* The painted contact shadow under the base. Both of this lamp's
   lights can miss it — the spot points straight down from *in front*
   of the base and the moon comes through the window above and behind —
   so the hairline where the foot meets the walnut is not reliably
   drawn by either. Same decision, and the same texture, as the blobs
   under the monitor's stand and the desk's feet. */
function contactShadow() {
  const s = 128;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, "rgba(0,0,0,0.46)");
  g.addColorStop(0.44, "rgba(0,0,0,0.22)");
  g.addColorStop(1.0, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return track(new THREE.CanvasTexture(c));
}

/* **The arm ends on the axis of the yoke's bar.** Not near it: a
   tube whose end face lies on the axis of the bar it joins is fully
   inside that bar, so there is no seam to find at any angle and the
   joint collar has something solid to close over.

   It used to be `SHADE_ORIGIN` itself, because the holder was a rod
   lying on the rotation axis. The bar is behind and below the shade
   now, so the two have parted — and since the yoke does not rotate,
   this stays put when the shade is re-tilted, which is the property
   that mattered about the old arrangement. */
const ARM_END = SHADE_ORIGIN.clone().add(
  new THREE.Vector3(0, BAR_Y, BAR_Z),
);

/* **How far back the arm leans where it leaves the collar**, off
   vertical. It straightens as it rises and arrives vertical at the
   rod, so this is the tangent at one end of the curve and 0 is the
   tangent at the other.

   37 degrees is not free: the arm has to cover exactly `ARM_END.z`
   of backward travel over its rise, and the lean plus the rise is
   what spends it. At this height the two agree — a 37-degree start
   easing to vertical over 1.3 of rise lands within a few hundredths
   of the 0.33 the rod sits back. Lean much harder and the curve has
   to come forward again near the top to reach the rod, which is the
   S this arm is not. */
const ARM_LEAN = THREE.MathUtils.degToRad(37);
/* How much of the backward travel the first handle spends. Under 1,
   so the second control point can only ever be *between* the first
   and the rod in z — which is what makes the curve monotonic in
   depth and so guarantees there is no overshoot-and-return near the
   top, the one wobble a tube this thick would show. */
const ARM_REACH_FRAC = 0.9;

/* **One cubic Bezier, not a Catmull-Rom through four points.**

   The spline was the wrong tool for a brief that names the tangents:
   a Catmull-Rom's tangent at a point is a function of its
   *neighbours*, so "leave at 37 degrees and arrive vertical" could
   only be approached by nudging interior points until the ends
   happened to look right — and it is C1, so its curvature steps at
   every knot. On a tube this thick that reads as a faint crease. A
   single cubic has no interior knots to crease at, and its end
   tangents are exactly the handles: `P1 - P0` is the lean and
   `P3 - P2` is vertical, by construction rather than by tuning.

   The handles are stated in the curve's own terms — the first in
   the backward travel it has to spend, the second as a share of the
   rise — so re-seating the shade re-derives the whole arm instead of
   leaving it aimed at where the joint used to be. */
function armCurve(startY) {
  const rise = ARM_END.y - startY;
  const reach = Math.abs(ARM_END.z);
  const h0 = (ARM_REACH_FRAC * reach) / Math.sin(ARM_LEAN);
  const h1 = 0.5 * rise;
  return new THREE.CubicBezierCurve3(
    new THREE.Vector3(0, startY, 0),
    new THREE.Vector3(
      0,
      startY + h0 * Math.cos(ARM_LEAN),
      -h0 * Math.sin(ARM_LEAN),
    ),
    new THREE.Vector3(0, ARM_END.y - h1, ARM_END.z),
    ARM_END,
  );
}

/* **The trough**, as the profile swept along x.

   Written out rather than reached for, because nothing in three
   sweeps an *open* polyline: `ExtrudeGeometry` takes a closed Shape
   and caps it, which is the one thing this must not do — the two
   ends are separate meshes in two different materials, green facing
   out and cream facing in, and a capped extrusion would put the
   shell's own material on both.

   Normals come off a central difference along the profile and are
   shared by both ends of each rib, which is right because the sweep
   is prismatic: every rib has the same normal all the way along. The
   winding is checked at the crown — there the tangent runs -z and
   the outward normal must be +y, which `(ty, -tz)` gives. */
function troughGeometry() {
  const pts = SHADE_PROFILE;
  const n = pts.length - 1;
  const stations = sweepStations();
  const m = stations.length - 1;

  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= n; i++) {
    const p = pts[i];
    const u = i / n;
    for (let j = 0; j <= m; j++) {
      const st = stations[j];
      /* Depth shrinks toward the ridge line, height toward the rim
         level — one anchor each, both constant across the section,
         so every point of a ring closes on the same place and the
         end face stays one continuous curve. */
      pos.push(
        st.x,
        RIM_LEVEL + (p.y - RIM_LEVEL) * st.scale,
        PEAK_Z + (p.x - PEAK_Z) * st.scale,
      );
      uv.push(u, j / m);
      if (i < n && j < m) {
        const k = i * (m + 1) + j;
        idx.push(k, k + 1, k + m + 2, k, k + m + 2, k + m + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  /* **Computed, not written.** The surface is doubly curved now —
     the section changes along the length as well as round the
     profile — so the closed-form normal the flat sweep used no
     longer holds. The winding fixes the direction, and it is the
     same winding checked at the crown when this was a flat sweep:
     there the tangent runs -z and the normal must come out +y.

     The ring at each tip is degenerate, every vertex sitting on the
     pivot. three tolerates that: those triangles have no area and
     contribute no normal, the vertices keep a zero-length normal
     rather than a NaN, and the ring inboard of them does the
     shading. */
  g.computeVertexNormals();
  /* **The two tip rings take their normals from the ring inboard of
     them.** Every vertex of a tip ring sits on the same point, so
     the triangles reaching it are slivers; averaged per vertex that
     gives each profile index its own answer, and adjacent ones
     disagreed by up to 160 degrees. No amount of tessellation fixes
     it, because the ring is degenerate by construction.

     Forcing them all to the axis — the true normal at the apex of
     an ellipsoidal end — is wrong at the two ends of the profile:
     those vertices are on the *rim*, where the surface is open and
     one-sided, and axial was 78 degrees from where their neighbours
     pointed. Copying the neighbour makes the last band continuous
     by construction, whatever part of the profile it is. The tip
     vertices disagree with each other, which costs nothing: they
     are all the same point and bound no area. */
  const nrm = g.attributes.normal;
  for (let i = 0; i <= n; i++) {
    const row = i * (m + 1);
    nrm.setXYZ(row, nrm.getX(row + 1), nrm.getY(row + 1), nrm.getZ(row + 1));
    nrm.setXYZ(
      row + m,
      nrm.getX(row + m - 1),
      nrm.getY(row + m - 1),
      nrm.getZ(row + m - 1),
    );
  }
  nrm.needsUpdate = true;
  return g;
}

/* **The oval the beam is cut to.** three projects `SpotLight.map`
   across the cone, so painting an ellipse into it is the only way to
   get a pool whose shape is the shade's rather than the cone's — and
   a banker's shade is two and a half times longer than it is deep.

   Drawn as one radial gradient on a squashed transform rather than as
   a scaled image, so the falloff stays circular *in the ellipse's own
   metric* and the edge is equally soft all the way round. The texture
   is a brightness mask multiplying a light that is already fully
   penumbral, so there is no hard edge anywhere in it: it reaches zero
   well before the frame, which also keeps the cone's own circular
   cutoff from ever being the thing that ends the pool.

   `colorSpace` has to be sRGB on it. A projected map is sampled like
   any other texture, and left linear the mid-greys of the falloff
   come through about a stop too bright, which flattens the oval back
   toward the circle it is meant not to be. */
const COOKIE_ASPECT = SHADE_LEN / (SHADE_HALF_D * 2);
function beamCookie() {
  const n = 256;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, n, n);

  ctx.save();
  ctx.translate(n / 2, n / 2);
  ctx.scale(1, 1 / COOKIE_ASPECT);
  /* The ellipse's long half-axis, in texture pixels. 0.46 rather than
     0.5 so the falloff has somewhere to finish inside the frame. */
  const r = n * 0.46;
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
  g.addColorStop(0.0, "#ffffff");
  g.addColorStop(0.45, "#e8e8e8");
  g.addColorStop(0.75, "#8a8a8a");
  g.addColorStop(1.0, "#000000");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const t = track(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* **The gradient the glass glows by.** The trough's UVs run `u` around
   the arc and `v` along the length, so this is drawn in those terms
   directly: brightest over the middle of the length where the tubular
   bulb actually is, falling away at the two open ends; and brightest
   across the crown and the upper flanks, falling to almost nothing at
   the rolled lips, which curve away from the bulb and are the thickest
   glass in a real shade.

   It multiplies `emissive`, so EMIT_GLASS is a *ceiling* rather than
   the value the shade runs at — the mean of this field is about 0.55,
   which is the factor between the two. Drawn rather than imported for
   the same reason the CRT's recess shadow is: it is three gradients
   and a multiply, and a checked-in binary with no source is a dead
   end. */
function glassGlowTexture() {
  const w = 256;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");

  /* Across the arc (u, the canvas x): the lips at both ends of the
     range, the crown in the middle. */
  const arc = ctx.createLinearGradient(0, 0, w, 0);
  arc.addColorStop(0.0, "#1a1a1a");
  arc.addColorStop(0.16, "#6e6e6e");
  arc.addColorStop(0.42, "#f2f2f2");
  arc.addColorStop(0.58, "#ffffff");
  arc.addColorStop(0.84, "#6e6e6e");
  arc.addColorStop(1.0, "#1a1a1a");
  ctx.fillStyle = arc;
  ctx.fillRect(0, 0, w, h);

  /* Along the length (v, the canvas y), multiplied over the top: the
     bulb is a capsule over the middle 60%, so the ends fall off. */
  ctx.globalCompositeOperation = "multiply";
  const len = ctx.createLinearGradient(0, 0, 0, h);
  len.addColorStop(0.0, "#4a4a4a");
  len.addColorStop(0.2, "#dcdcdc");
  len.addColorStop(0.5, "#ffffff");
  len.addColorStop(0.8, "#dcdcdc");
  len.addColorStop(1.0, "#4a4a4a");
  ctx.fillStyle = len;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  const t = track(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* **The gradient the bulb's envelope glows by.**
   `CapsuleGeometry` runs its `v` along its own length, so a vertical
   gradient here is a gradient from one end of the tube to the other —
   and the capsule is laid along x by a quarter turn in the build, so
   this ends up running the length of the shade without the texture
   knowing anything about that.

   Hot over the middle, where the filament is, falling to a dim glass
   at the two ends. It multiplies `emissive`, so EMIT_BULB is a ceiling
   the way EMIT_GLASS is: the envelope's mean comes out around 0.6 of
   it. The ends are dim rather than black — unlit glass next to a lit
   filament still picks up a good deal of it.

   Nothing varies around the circumference, so this is two pixels wide. */
function bulbGlowTexture() {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = 128;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0.0, "#3a3a3a"); // the pinch at one end
  g.addColorStop(0.22, "#c4c4c4");
  g.addColorStop(0.5, "#ffffff"); // over the filament
  g.addColorStop(0.78, "#c4c4c4");
  g.addColorStop(1.0, "#3a3a3a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 128);
  const t = track(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* **The shell's body colour, with the pale rim banded into it.**

   The rim is a `map` rather than a second mesh, and the reason is the
   geometry: `troughGeometry` lays `u` across the profile and the
   profile *starts and ends on the two lips*, so the rolled edge is
   already addressable as the two ends of u. A separate rim mesh would
   mean a second swept strip following a doubly-curved closed curve,
   inset far enough not to z-fight along its whole length — for a band
   that is five profile segments wide.

   **Its width is derived, not written.** `LIP_SEGS` of the profile's
   own segment count is exactly the curl, so re-rounding the lip
   (EDGE_RADIUS / LIP_SEGS) or re-tessellating the section
   (PROFILE_SEGS) carries the band with it instead of leaving it at a
   fraction that was right for a different mesh. The solid part covers
   the outer half of the curl — the part genuinely turned under, where
   the thickness faces the room — and fades out by the time the arc
   meets the plumb skirt.

   `color` is left white and the real colours are baked in here,
   because `map` *multiplies* `color`: a white band over a bottle-green
   base can only ever return bottle green, so there is no way to
   lighten anything from a greyscale mask. The two hexes above are the
   only statement of either colour. */
const RIM_U = LIP_SEGS / (SHADE_PROFILE.length - 1);
const RIM_SOLID = RIM_U * 0.5; // flat pale out to here
const RIM_FADE = RIM_U; // back to bottle green where the curl ends
function glassSkinTexture() {
  const w = 512;
  const h = 2; // nothing varies along the length
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const hex = (n) => "#" + n.toString(16).padStart(6, "0");

  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0.0, hex(GLASS_RIM));
  g.addColorStop(RIM_SOLID, hex(GLASS_RIM));
  g.addColorStop(RIM_FADE, hex(GLASS_OUT));
  g.addColorStop(1 - RIM_FADE, hex(GLASS_OUT));
  g.addColorStop(1 - RIM_SOLID, hex(GLASS_RIM));
  g.addColorStop(1.0, hex(GLASS_RIM));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const t = track(new THREE.CanvasTexture(c));
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildLamp() {
  const root = new THREE.Group();
  root.name = "lamp";
  /* **Scaled about the root's own origin**, which sits on the desk top
     at the centre of the base — so the fixture grows *in place* and
     the caller's placement does not have to know the scale exists. */
  root.scale.setScalar(LAMP_SCALE);

  /* One grain field and one environment, shared by both brass
     materials — see brassMaterial for why they are built here rather
     than at module scope. */
  const finish = { grain: brassGrain(), env: brassEnvironment() };
  const brass = brassMaterial(BRASS, BRASS_ROUGH, finish);
  const brassDark = brassMaterial(BRASS_DARK, BRASS_ROUGH_FITTING, finish);

  /* **MeshPhysical rather than MeshStandard, for the clearcoat.**
     This is the one surface on the fixture where that is worth a
     second specular lobe: fired glass has a hard, tight highlight
     sitting *on top of* its body colour, where the brass's sheen is
     the body colour. Standard has only the one lobe, so the choice
     was between a dull green and a green that looks polished all
     over — neither of which is glass.

     It still is not a mirror (no environment map in this scene — see
     brassMaterial), so the highlights it returns are the moon's, the
     lamp's own point light and the tube's spill. Those are enough,
     because a clearcoat lobe this tight is read as a *shape* — a
     bright line following the ridge — rather than as a reflection of
     anything identifiable.

     `color` is white deliberately: the body green and the pale rim
     both live in the map. See `glassSkinTexture`. */
  const glassMat = track(
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: glassSkinTexture(),
      /* The body under the coat. Lower than the 0.18 this ran at as
         a MeshStandard material, since it is no longer the only thing
         carrying the gloss. */
      roughness: 0.12,
      metalness: 0.0,
      /* Full coat at a near-mirror roughness — glass has no orange
         peel. This pair is what makes the highlight sharp; widening
         clearcoatRoughness past about 0.1 reads as lacquer. */
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      emissive: new THREE.Color(GLASS_EMISSIVE),
      emissiveMap: glassGlowTexture(),
      emissiveIntensity: 0,
      /* The mouth and both ends have to show the lining, and the
         lining is a separate mesh a hair within this one — so this is
         single-sided and that one is BackSide. Two meshes rather than
         DoubleSide because the two faces of a cased shade are not the
         same colour and they glow by different amounts. */
      side: THREE.FrontSide,
    }),
  );
  /* The casing. **Slightly rough rather than matt**: it ran at 0.82,
     which is paper, and opal glass is a sintered white *surface* with
     a sheen on it — enough of one to pick the filament up as a soft
     bloom down the inside of the trough, which is most of what says
     there is a bulb in there from an angle that cannot see the bulb
     itself. Not lower than this: past about 0.3 the lining starts
     returning a second hard highlight and competes with the shell's
     clearcoat for the same job. */
  const liningMat = track(
    new THREE.MeshStandardMaterial({
      color: GLASS_IN,
      roughness: 0.42,
      metalness: 0,
      emissive: new THREE.Color(LAMP_COLOUR),
      emissiveIntensity: 0,
      side: THREE.BackSide,
    }),
  );
  /* The envelope. **Translucent, so the filament inside it shows**,
     and glass-smooth rather than the 0.28 it ran at — it was a
     ceramic tube before.

     `depthWrite: false` because it is a transparent shell with an
     opaque emissive element inside it: the filament is drawn in the
     opaque pass and this blends over it afterwards, which is the
     order that works, and writing depth from a transparent surface
     only risks the shell occluding itself where the capsule's two
     ends overlap in screen space. */
  const bulbMat = track(
    new THREE.MeshStandardMaterial({
      color: BULB,
      roughness: 0.12,
      metalness: 0,
      emissive: new THREE.Color(BULB_EMISSIVE),
      emissiveMap: bulbGlowTexture(),
      emissiveIntensity: 0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  /* The element. No `map` and no gradient: it is a line two or three
     pixels wide, and all of its brightness is emissive. */
  const filamentMat = track(
    new THREE.MeshStandardMaterial({
      color: BULB,
      roughness: 0.4,
      metalness: 0,
      emissive: new THREE.Color(BULB_EMISSIVE),
      emissiveIntensity: 0,
    }),
  );
  /* The pad. Matt and nearly black — it is felt, so it is the one
     surface on the fixture with no specular answer at all, which is
     what makes it read as a different material rather than as brass
     in shadow. */
  const feltMat = track(
    new THREE.MeshStandardMaterial({
      color: FELT,
      roughness: 0.95,
      metalness: 0,
    }),
  );

  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };

  /* --- the base: two steps and a dome, turned as one piece ---
     Chamfered, and in one draw call where it used to be three. See
     `baseProfile`, and BEVEL for what the chamfers are for. The dome
     is still the reference's swell-and-tuck — as an elliptical arc on
     the profile now rather than as a squashed sphere, which is the
     same curve with its buried lower half not built. */
  const base = mesh(
    new THREE.LatheGeometry(baseProfile(), BASE_SEGS),
    brass,
  );
  root.add(base);

  /* The felt pad the brass stands on. It shares BASE_SEGS with the
     lathe above, or the two silhouettes scallop against each other at
     the seam. It neither casts nor receives: it is 0.04 tall and flat
     on the walnut, the painted contact shadow is what grounds the
     fixture, and a 1024-texel map spread over the room has no texel
     for a hairline. */
  const felt = mesh(
    new THREE.CylinderGeometry(BASE_R, BASE_R, FELT_H, BASE_SEGS),
    feltMat,
    false,
  );
  felt.receiveShadow = false;
  felt.position.y = FELT_H / 2;
  root.add(felt);

  /* --- the column ---
     One lathe through `columnProfile`, in the same polished brass as
     the base. 48 segments round: the silhouette is what carries this
     shape and the bulge is the widest thing on the fixture after the
     foot, so a coarse revolve shows as facets along its edge. */
  const column = mesh(
    new THREE.LatheGeometry(columnProfile(), 48),
    brass,
  );
  column.position.y = COL_BOT;
  root.add(column);

  /* Shared by the pull chain below; it was declared with the flutes
     the lathe replaced. */
  const m4 = new THREE.Matrix4();

  /* --- the arm ---
     **It leaves from the middle of the collar's height, not its
     top.** Starting at the top meant the tube's own end face was on
     the surface it emerged from, so the lean opened a sliver between
     the two on the back side; from halfway up, the first 0.2 of the
     curve is inside the collar and the arm comes out of it.

     The second term is a guard and is **dormant now**: the shade's
     seat is solved from SHADE_BOTTOM, which puts the rod well above
     the column, so the first term governs. It earned its place last
     round, when the 40% taller column stood above the rod and taking
     the collar's height literally built a curve that ran downhill.
     Drop SHADE_BOTTOM far enough and it takes over again rather than
     inverting the arm. */
  const ARM_START_Y = Math.min(
    COL_EMERGE + ((COL_COLLAR_B + COL_COLLAR_T) / 2) * COL_VIS,
    ARM_END.y - 0.16,
  );
  const arm = mesh(
    new THREE.TubeGeometry(armCurve(ARM_START_Y), 56, COL_R * 0.52, 12, false),
    brass,
  );
  root.add(arm);

  /* --- the shade ---
     **Two nested groups, and which is which is the whole point.**
     `shade` is the *holder's* frame: its origin is the rod's axis and
     it carries SHADE_TILT, so rolling it is rolling the shade about
     the rod exactly as the adjuster knob does. `shell` is everything
     green plus what lives inside it — the trough, the lining, the end
     caps, the bulb and both lights — seated one `SHELL_OFFSET` up and
     forward of the rod.

     Splitting them is what lets the bulb, the caps and the spot stay
     stated in the shell's own frame (where `y = 0` is the trough's
     axis and `SHADE_LIP_Y` means the lip) while the pivot is
     somewhere else entirely. */
  const shade = new THREE.Group();
  shade.name = "lamp-shade";
  shade.position.copy(SHADE_ORIGIN);
  shade.rotation.copy(SHADE_ORIENT);
  root.add(shade);

  const shell = new THREE.Group();
  shell.name = "lamp-shell";
  shell.position.copy(SHELL_OFFSET);
  shade.add(shell);

  /* The trough: the profile swept along x, built in the shell's own
     frame so it needs no rotation at all. See the SHADE_LEN block
     above for why it is a profile rather than a `CylinderGeometry`
     arc.

     The UV contract is the one `glassGlowTexture` is drawn against —
     `u` across the arc, `v` along the length — so it is kept
     deliberately rather than inherited. */
  const troughGeo = track(troughGeometry());

  const glass = new THREE.Mesh(troughGeo, glassMat);
  glass.castShadow = true;
  glass.receiveShadow = true;
  shell.add(glass);

  /* The same geometry a hair inside, flipped by the lining material's
     BackSide. Sharing it is free — the material is what differs — and
     the inset is what keeps the two from z-fighting along the lips,
     as well as reading as the thickness of the glass where the mouth
     shows it. **A plain uniform scale now does it**: the squash is
     baked into the profile, so there is no longer an axis that has to
     be singled out here and no way for the lining to come out a
     different section from the glass around it. */
  const lining = new THREE.Mesh(troughGeo, liningMat);
  lining.scale.setScalar(1 - SHADE_T);
  lining.castShadow = false; // the glass already casts this silhouette
  lining.receiveShadow = false;
  shell.add(lining);

  /* **There are no end caps.** The loft closes each end on itself
     (see END_ROUND / END_BULGE), so there is no opening to cover and
     no rim where a flat disc would have met the wall. The lining,
     being the same geometry a hair inside, closes with it — which is
     why the cream still reaches right out to the ends. */

  /* --- the yoke ---
     **On `root`, not on `shade`.** The shade turns on the pivots;
     the yoke holds them and stays where the arm left it. See the
     holder note at the top of the file.

     It is placed at the pivot axis and *not* rotated, so its own
     local frame is the lamp's orientation with the pivot as origin
     — which is the frame BAR_Y and BAR_Z are solved in. */
  const yoke = new THREE.Group();
  yoke.name = "lamp-yoke";
  yoke.position.copy(SHADE_ORIGIN);
  root.add(yoke);

  /* Each hook: straight out of the pivot, then one smooth turn back
     and down onto the end of the bar. Catmull-Rom through four
     points rather than a Bezier, because what matters here is that
     it passes through the pivot and lands on the bar — the tangents
     at the ends are hidden inside the cap's collar and inside the
     bar respectively. Centripetal, so the uneven spacing between
     the straight run and the turn does not overshoot. */
  for (const sign of [-1, 1]) {
    /* The apex of the domed end — where the pivot axis comes out of
       the glass now, not the old cap plane. */
    const x0 = sign * PIVOT_X;
    const x1 = sign * BAR_HALF;
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(x0, 0, 0),
        new THREE.Vector3(x1, 0, 0),
        new THREE.Vector3(x1, BAR_Y * 0.45, BAR_Z * 0.82),
        new THREE.Vector3(x1, BAR_Y, BAR_Z),
      ],
      false,
      "centripetal",
    );
    const hook = mesh(new THREE.TubeGeometry(curve, 40, YOKE_R, 12, false), brass);
    yoke.add(hook);
  }

  /* The bar the two hooks land on. It runs the full width between
     them, so each hook's open end is buried inside it and there is
     no mitre to show at the corner. */
  const bar = mesh(
    new THREE.CylinderGeometry(YOKE_R, YOKE_R, BAR_HALF * 2, 16),
    brass,
  );
  bar.rotation.z = Math.PI / 2;
  bar.position.set(0, BAR_Y, BAR_Z);
  yoke.add(bar);

  /* The joint, where the arm arrives at the middle of the bar.
     Chamfered, like the base's steps and the column's collar — see
     BEVEL. */
  const joint = mesh(chamferedCollar(YOKE_R * 1.9, 0.26), brass);
  joint.rotation.z = Math.PI / 2;
  joint.position.set(0, BAR_Y, BAR_Z);
  yoke.add(joint);

  /* --- the tilt knob ---
     The pivot pin, straight out of one cap along the pivot axis and
     past the hook that turns away from it. A collar where it leaves
     the cap, and a rounded end — a capsule gives that without a
     ball stuck on the end of it. */
  const knobLen = YOKE_OUT + KNOB_OUT;
  const knobX = -(PIVOT_X + knobLen / 2);
  const pin = mesh(
    new THREE.CapsuleGeometry(KNOB_R, knobLen - KNOB_R, 6, 14),
    brass,
  );
  pin.rotation.z = Math.PI / 2;
  pin.position.set(knobX, 0, 0);
  yoke.add(pin);

  const pinCollar = mesh(
    chamferedCollar(KNOB_COLLAR_R, KNOB_COLLAR_LEN),
    brass,
  );
  pinCollar.rotation.z = Math.PI / 2;
  pinCollar.position.set(-(PIVOT_X + KNOB_COLLAR_LEN / 2 - 0.02), 0, 0);
  yoke.add(pinCollar);

  /* The bulb: a tubular lamp lying along the trough, up near the roof
     where a banker's lamp's socket is. **It is placed to be hidden**:
     at SHADE_TILT the home camera sits a few degrees on the closed
     side of the mouth plane, and a bulb this high is behind the shell
     from every framing above that. It does not cast — it is inside
     the fixture, and the only light in front of it is the point
     light, which casts nothing either. */
  const bulb = mesh(
    new THREE.CapsuleGeometry(BULB_R, BULB_HALF * 2 - BULB_R * 2, 6, 16),
    bulbMat,
    false,
  );
  /* A quarter turn about z lays the capsule's own y axis along x —
     the shade's length — so the tube runs side to side. */
  bulb.rotation.z = Math.PI / 2;
  bulb.position.set(0, BULB_Y, BULB_Z);
  bulb.receiveShadow = false;
  shell.add(bulb);

  /* The element inside it — see FILAMENT_R for why the bulb needs
     one. A plain cylinder: it is seen through a translucent envelope
     at two or three pixels wide, so there is nothing a capsule's
     rounded ends would add. It does not cast, for the bulb's own
     reason, and it does not receive either — every face of it is
     inside the glass. */
  const filament = mesh(
    new THREE.CylinderGeometry(
      FILAMENT_R,
      FILAMENT_R,
      (BULB_HALF - BULB_R) * 2 * (1 - FILAMENT_IN),
      6,
    ),
    filamentMat,
    false,
  );
  filament.rotation.z = Math.PI / 2;
  filament.position.set(0, BULB_Y, BULB_Z);
  filament.receiveShadow = false;
  shell.add(filament);

  /* The socket, capping the far end of the tube so the bulb reads as
     fitted rather than floating — the end the stem rises from, which
     puts it *behind* the bulb from the mouth. `brassDark` at
     BRASS_ROUGH_FITTING rather than the polished brass, and left
     unchamfered: this is the one fitting that should not catch the
     light, since a bright ring directly beside the filament reads as
     a second one. */
  const socket = mesh(
    new THREE.CylinderGeometry(SOCKET_R, SOCKET_R, SOCKET_LEN, 14),
    brassDark,
    false,
  );
  socket.rotation.z = Math.PI / 2;
  socket.position.set(SOCKET_X, BULB_Y, BULB_Z);
  shell.add(socket);

  /* **What makes it *mounted* rather than floating**: a short stem
     from the socket up to the inside of the roof. Its top comes off
     `shellHeightAt` times the lining's inset, so it lands on the
     cream exactly and can neither leave a gap under the roof nor —
     the failure that matters — poke through the green and show as a
     brass nub on the outside of the shade. */
  const stemTop = shellHeightAt(BULB_Z) * (1 - SHADE_T);
  const stem = mesh(
    new THREE.CylinderGeometry(0.05, 0.05, stemTop - BULB_Y, 10),
    brassDark,
    false,
  );
  stem.position.set(SOCKET_X, (BULB_Y + stemTop) / 2, BULB_Z);
  shell.add(stem);

  /* --- the lights ---
     See the header above POINT_RANGE for which one carries what, and
     why only one of them sits inside the shade. */
  const point = new THREE.PointLight(
    LAMP_COLOUR,
    0, // the caller writes this every frame; 0 until it does
    /* World units, so the group scale does not reach it — see
       LAMP_SCALE. Its *position* does, because that is a transform. */
    POINT_RANGE * LAMP_SCALE,
    POINT_DECAY,
  );
  /* **Just under the mouth, not up at the bulb.** Its job is the
     bloom around the fixture — the underside of the shade's lips,
     the top of the rod, the walnut immediately below — and from
     inside the shell it was lighting the one surface that does not
     need it, since the lining is emissive and the glass carries its
     own glow map. Centred in depth rather than set back with the
     bulb, so the glow is symmetric about the shade.

     It never casts. That is what lets it sit in the mouth without
     the shell blocking it, and it is why there are two lights here
     at all — see the header above POINT_RANGE. */
  point.position.set(0, SHADE_LIP_Y - 0.12, 0);
  point.castShadow = false;
  shell.add(point);

  const spot = new THREE.SpotLight(
    LAMP_COLOUR,
    0,
    SPOT_RANGE * LAMP_SCALE, // likewise world units
    SPOT_ANGLE,
    SPOT_PENUMBRA,
    SPOT_DECAY,
  );
  /* **Aimed by the shade, not by a second copy of its angle.** The
     spot is a child of the shade group, so its local -y *is* the
     mouth's normal — straight down the opening, tilted forward by
     exactly SHADE_TILT because the group carries it. Re-tilt the
     shade and the beam follows; there is no angle written twice and
     so no pair that can drift apart. `aimLamp` reads it back off the
     world matrices rather than restating it, for the same reason.

     **It is anchored at the bulb**, which it was not before: it used
     to sit 0.1 past the lower lip, outside the mouth, so that the
     whole fixture was behind the light and could not shadow its own
     pool. `castShadow` is per object and not per light, so the shade
     cannot cast for the moon and not for this — which is what that
     placement was dodging.

     Two things make the bulb safe now, and the first is the one that
     actually matters. **The shell is not in the cone.** Sampled
     along the profile, zero of 2001 points fall inside a downward
     cone from the bulb at half-angles up to 40 degrees; the shade
     bulges out to z -0.95 while the bulb sits at -0.55, so the cone
     reaches the lip's depth only well below where the lip ends.
     Clipping begins around 44, which is why SPOT_ANGLE is capped.

     And **`shadow.camera.near` clips the fixture out of its own
     shadow map** regardless. The nearest shell point to the bulb is
     0.58 world; the near plane is 1.12, so no part of the shade is
     ever rasterised into this light's depth pass. That makes the
     cone angle free to be re-tuned without the self-shadowing
     question coming back.

     The target sits directly below the light **in the shell's
     frame**, so the direction is local -y — the mouth's own normal,
     tilted by exactly SHADE_TILT because the group carries it. */
  spot.position.set(0, BULB_Y, BULB_Z);
  spot.target.position.set(0, BULB_Y - 3.0, BULB_Z);
  /* **The cookie that makes the pool an oval.** A SpotLight's cone is
     circular and nothing about the angle can change that, so a shade
     2.7 long and 1.9 deep would still throw a round pool. `light.map`
     is three's projected texture, and an ellipse painted into it
     comes out as an ellipse on the desk.

     Its horizontal axis lands on world **x** — the shade's length —
     and that is derivable rather than lucky: `SpotLightShadow`
     builds its camera with `lookAt` and the default up of (0,1,0), so
     the projection's right vector is the light direction crossed with
     world up, and this light points down the y/z plane. */
  spot.map = beamCookie();
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  /* VSM, like the moon's and the cone lamp's — so this is a blur width
     in texels. Wider than the cone lamp's 6, because this source is a
     2.7-unit trough barely two units above the desk and its shadow
     should have almost no edge left at all. */
  spot.shadow.radius = 9;
  spot.shadow.blurSamples = 16;
  /* `bias` 0 and the work done by `normalBias`, for the reason the
     moon's and the cone lamp's are — VSM compares a depth against a
     variance-bounded estimate, so a constant offset leaks light out
     from under contacts instead of curing the acne it would under PCF.
     Both figures are in world units and so both are scaled: a texel
     covers LAMP_SCALE times more world at LAMP_SCALE times the throw.
     The shadow camera's `far` sets itself from `light.distance` on
     every `updateMatrices`, so writing it is only so the two agree
     before the first shadow pass. */
  spot.shadow.bias = 0;
  spot.shadow.normalBias = 0.02 * LAMP_SCALE;
  /* Past the shade's own geometry — see the placement note above. */
  spot.shadow.camera.near = 0.75 * LAMP_SCALE;
  spot.shadow.camera.far = SPOT_RANGE * LAMP_SCALE;
  shell.add(spot, spot.target);

  /* --- the pull chain ---
     Beads in one InstancedMesh plus a drop at the end, hung from the
     shade's **front lip near one end**, where the reference's is. A
     switch you pull is half of what this object is.

     **It is a child of `root`, not of the shade**, and that is the
     one thing about it worth writing down: a chain parented to a
     shade tilted 20 degrees would hang 20 degrees off vertical. Its
     top is converted out of the shell's frame by `fromShell`, so it
     still follows the shade when the tilt changes — it just does not
     inherit the rotation. */
  const chainTop = fromShell(
    CHAIN_X,
    CHAIN_Y,
    shellDepthAt(CHAIN_Y) - BEAD_R,
  );
  const beads = new THREE.InstancedMesh(
    track(new THREE.SphereGeometry(BEAD_R, 8, 6)),
    brass,
    BEAD_N,
  );
  beads.castShadow = true;
  for (let i = 0; i < BEAD_N; i++) {
    m4.makeTranslation(chainTop.x, chainTop.y - i * BEAD_GAP, chainTop.z);
    beads.setMatrixAt(i, m4);
  }
  beads.instanceMatrix.needsUpdate = true;
  root.add(beads);

  /* The pull on the end. Stretched along the hang, so it reads as a
     turned drop rather than as one more bead. */
  const drop = mesh(new THREE.SphereGeometry(0.075, 14, 10), brass);
  drop.scale.y = 1.35;
  drop.position.set(
    chainTop.x,
    chainTop.y - BEAD_N * BEAD_GAP - 0.06,
    chainTop.z,
  );
  root.add(drop);

  /* --- grounding --- */
  const blob = new THREE.Mesh(
    track(new THREE.PlaneGeometry(BASE_R * 3.0, BASE_R * 3.0)),
    track(
      new THREE.MeshBasicMaterial({
        map: contactShadow(),
        transparent: true,
        depthWrite: false,
      }),
    ),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.012;
  blob.renderOrder = -1;
  /* **Not pickable.** The caller raycasts the whole group to decide
     whether a press was on the lamp, and this is a transparent square
     well over twice the fixture's own footprint — left in, it would
     make a patch of empty desk toggle the light. */
  blob.raycast = () => {};
  root.add(blob);

  parts = { point, spot, liningMat, glassMat, bulbMat, filamentMat, shade, root };
  setLamp(0);
  return { root, shade, point, spot };
}

/* **What "on" means, in one place.** The caller owns the state and the
   fade — this is the curve from a 0..1 level to the six things that
   have to move together, so a lamp at 0.3 can never be a bright bulb
   in a dark shade. Linear in the level on purpose, exactly as
   src/lamp.js is: the shaping lives in the caller's loop, so the ease
   can be re-cut without touching what a lamp at 0.3 looks like. */
export function setLamp(level) {
  if (!parts) return;
  const v = level < 0 ? 0 : level > 1 ? 1 : level;
  parts.point.intensity = POINT_INTENSITY * v;
  parts.spot.intensity = SPOT_INTENSITY * v;
  parts.bulbMat.emissiveIntensity = EMIT_BULB * v;
  parts.filamentMat.emissiveIntensity = EMIT_FILAMENT * v;
  parts.liningMat.emissiveIntensity = EMIT_LINING * v;
  parts.glassMat.emissiveIntensity = EMIT_GLASS * v;
}

/* **Re-aims the shade on a live page**, in degrees, and reports where
   the beam then lands on the surface the lamp stands on.

   The signature is src/lamp.js's — `(tiltDeg, swingDeg)` — because
   the contract is what makes the two interchangeable, and
   `_lampshots.mjs aim` drives it by that name. What the two angles
   mean here is this fixture's own: `tilt` is the forward roll about
   the shade's long axis (SHADE_TILT, which the mouth and the beam are
   both derived from, so this re-aims the light by re-aiming the
   shade) and `swing` yaws the whole shade about y. Past about 30
   degrees of tilt the bare bulb comes into shot from the home
   framing; past about 10 of swing the trough stops running parallel
   to the desk's front edge, which is most of what says *banker's
   lamp*.

   The pool is read **off the world matrices** rather than worked out
   from the angles — the point of deriving the beam from the shade is
   that there is one statement of where it points, and a report that
   restated it would be a second one.

   The caller owns re-rendering the frozen shadow map afterwards:
   moving a light is the one change in this scene that invalidates it,
   and that flag lives in scene.js. */
export function aimLamp(tiltDeg, swingDeg) {
  if (!parts) return null;
  if (tiltDeg !== undefined) {
    parts.shade.rotation.set(
      -THREE.MathUtils.degToRad(tiltDeg),
      THREE.MathUtils.degToRad(swingDeg ?? 0),
      0,
    );
    parts.shade.updateMatrixWorld(true);
  }
  const o = parts.spot.getWorldPosition(new THREE.Vector3());
  const d = parts.spot.target
    .getWorldPosition(new THREE.Vector3())
    .sub(o)
    .normalize();
  /* The lamp's own origin sits on the surface it stands on, so the
     plane to intersect is that y rather than a figure this module
     would otherwise have to be told. */
  const deskY = parts.root.getWorldPosition(new THREE.Vector3()).y;
  const t = d.y < -1e-4 ? (deskY - o.y) / d.y : Infinity;
  return {
    tilt: Number(THREE.MathUtils.radToDeg(-parts.shade.rotation.x).toFixed(1)),
    swing: Number(THREE.MathUtils.radToDeg(parts.shade.rotation.y).toFixed(1)),
    /* World, so it can be read against the desk's own plan. */
    pool: Number.isFinite(t)
      ? o
          .clone()
          .addScaledVector(d, t)
          .toArray()
          .map((v) => Number(v.toFixed(2)))
      : null,
    throw: Number.isFinite(t) ? Number(t.toFixed(2)) : null,
    /* The cone's own footprint at that range, long axis then short —
       the cookie's ellipse, which is what the pool actually is. */
    oval: Number.isFinite(t)
      ? [
          Number((2 * t * Math.tan(SPOT_ANGLE) * 0.92).toFixed(2)),
          Number(
            ((2 * t * Math.tan(SPOT_ANGLE) * 0.92) / COOKIE_ASPECT).toFixed(2),
          ),
        ]
      : null,
  };
}

export function lampLevels(next = {}) {
  if (parts) {
    if (next.point !== undefined) parts.point.intensity = next.point;
    if (next.spot !== undefined) parts.spot.intensity = next.spot;
  }
  return {
    point: parts ? parts.point.intensity : 0,
    spot: parts ? parts.spot.intensity : 0,
    full: { point: POINT_INTENSITY, spot: SPOT_INTENSITY },
    emissive: {
      bulb: parts ? parts.bulbMat.emissiveIntensity : 0,
      filament: parts ? parts.filamentMat.emissiveIntensity : 0,
      inner: parts ? parts.liningMat.emissiveIntensity : 0,
      outer: parts ? parts.glassMat.emissiveIntensity : 0,
    },
    colour: `#${LAMP_COLOUR.toString(16).padStart(6, "0")}`,
  };
}

export function disposeLamp() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
  parts = null;
}
