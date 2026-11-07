import * as THREE from "three";

/* ==========================================
   THE DESK LAMP

   A base, a pole and a cone shade, built from primitives like
   everything else in this scene — and the one object in it the visitor
   can *change*. Pressing it toggles the light; scene.js owns the state
   and the fade, this module owns the shape and what "on" means for
   each of its parts.

   **Local space matches the desk's, the computer's and the
   treehouse's** — +Z is the front, y up, origin on the **desk top** at
   the centre of the base. So scene.js only lifts the group by
   `DESK_TOP_Y` and sets x and z; nothing here knows how tall the desk
   is.

   **The shade is tilted, and that is a visibility decision rather than
   a styling one.** The camera looks *down* at 20 degrees, so a shade
   hanging mouth-down shows nothing but its outside — the emissive
   inner wall and the bulb, which are most of what says the lamp is
   lit, would never be in shot at all. At SHADE_TILT / SHADE_SWING the
   mouth's own normal comes to within about 55 degrees of the direction
   back to the camera, so a clear ellipse of the lit inside — with the
   bulb in it — is visible at the home framing, and the beam lands
   forward on the desk toward the keyboard, where a task lamp's
   actually does. Both angles were swept rather than chosen; see
   SHADE_TILT.
   ========================================== */

/* --- Palette ---------------------------------------------
   Brass and a deep green enamel. The room is plum walls, a plum plank
   floor, cream enamel and walnut; brass is the one warm metal in it
   and reads as the fixture a warm light belongs to, while the green
   keeps the shade from merging with either the desk's cream or the
   wall behind it. */
const BRASS = 0x8e7242;
const SHADE_OUT = 0x3d5a4e;
const SHADE_IN = 0xf7e6c8; // the inside is painted pale, as shades are
const BULB = 0xfff0d6;
/* The lamp's own colour, and the brief's: a warm tungsten. Used for
   both lights and for every emissive on the fixture, so the glow on
   the shade, the bulb and the pool on the desk cannot drift apart. */
export const LAMP_COLOUR = 0xffb866;
const BULB_EMISSIVE = 0xffd9a0; // the filament reads paler than its spill

/* --- Proportions -----------------------------------------
   These are the figures the *shape* was art-directed at, and the
   fixture is then scaled by LAMP_SCALE below — so read them as
   proportions rather than as world units. At scale 1 the lamp topped
   out at about 3.9 against the CRT's 6.60 above the desk top, a shade
   under 60% of it, which was the same argument the treehouse's height
   is set by: the thing a visitor has to find and press is the monitor,
   so nothing else on this desk may come up level with it.

   **At LAMP_SCALE 1.75 that is no longer true** — the fixture tops out
   near 6.8, past the machine. It was asked for and is recorded rather
   than quietly corrected; the lever is LAMP_SCALE, and about 1.60
   brings the true top back under the 6.25 the treehouse is held to.
   It does not *occlude* the machine from anywhere on the orbit leash,
   which is checked on rays by `_lampbig.mjs` — see CLAUDE.md. */
const BASE_R = 0.88;
const BASE_H = 0.16;
const DOME_R = 0.62; // the moulded step on top of the base
const DOME_H = 0.12;
const POLE_R = 0.07;
const POLE_TOP = 3.6; // the knuckle's centre, and the shade's pivot
const KNUCKLE_R = 0.13;

/* **The whole fixture is scaled by this, as a group scale on the root
   rather than a rebuild.** 1.75 was asked for, and the figures below
   are left at the sizes the shape was art-directed at so the
   proportions stay readable — SHADE_H is still "a 1.1-unit cone", and
   the one place the scale has to be stated twice is the lights.

   **A group scale reaches the geometry and the positions and nothing
   else.** Three things in a light are in world units and are
   therefore blind to it, so each is multiplied here explicitly or the
   fixture grows while its light stays the size it was:

   - `distance` on both lights — the range at which each dies;
   - the spot's shadow `camera.near` (its `far` three derives from
     `distance`, so that one follows on its own);
   - the spot's `shadow.normalBias`, which walks a sample along the
     normal by a distance in world units. The shadow frustum's *angle*
     does not change, so at 1.75x the throw a texel covers 1.75x more
     world and the bias has to grow with it or the acne comes back
     under the base.

   `shadow.radius` is deliberately *not* scaled: it is a blur width in
   texels, and a texel is now wider in world terms — so the penumbra
   grows on its own, which is what a bigger mouth should give.

   The fourth thing a group scale cannot reach is the **falloff**, and
   it is the one that was measured rather than predicted. The bulb is
   now LAMP_SCALE further from the walnut, so at these decays the pool
   arrives dimmer by `LAMP_SCALE ** decay` — and that is not a
   rounding error: a transect of on/off luma across the desk top put
   the peak at 88 against 181 before, a factor of 2.06 against the
   1.75^1.3 = 2.11 the spot's decay predicts. The footprint had grown
   and flattened exactly as it should; the light had halved. So both
   intensities carry the same compensation, which is what makes "the
   pool grows with the lamp" true rather than only wider. It also
   keeps the night rig's four-source calibration — every figure of
   which holds at `lampLevel === 1` — where it was set. */
export const LAMP_SCALE = 1.75;

const SHADE_TOP_R = 0.4;
const SHADE_BOT_R = 1.0;
const SHADE_H = 1.1;
const SHADE_T = 0.015; // the inner cone sits this far inside the outer
const CAP_T = 0.06; // closes the shade's narrow end, under the knuckle
const FITTER_R = 0.17;

/* How far the shade leans off the pole: forward toward +Z, and toward
   +X — the desk's centre, which is where the work is. See the header
   for why it leans at all.

   **These two were swept rather than chosen**, through
   `window.__lamp({ tilt, swing })` off one page load — see `aimLamp`
   below and `node _lampshots.mjs aim`. They decide three things at
   once, which is why they could not be set one at a time: how much of
   the lit inside the camera sees, where the pool falls on the desk,
   and whether anything stands in the beam at all.

   At the first pair (45 / 18) the beam landed at world (-5.95, 1) —
   bare walnut three units short of the keyboard — and the only thing
   the spot's shadow was doing was keeping the lamp from shining
   *through* the desk top onto the drawer fronts. At 50 / 24 it lands
   at (-5.11, 0.69), so the pool runs from the fixture to the
   keyboard's left end (which goes from luma 58 unlit to 92) and the
   mouth turns far enough toward the camera to show the bulb. Past
   about 55 the pool is a broad wash in the middle of the desk and
   stops reading as *this lamp's*. */
const SHADE_TILT = THREE.MathUtils.degToRad(50);
const SHADE_SWING = THREE.MathUtils.degToRad(24);

/* --- The two lights, and why there are two ---------------
   The brief asks for a warm `PointLight` under the shade with soft
   shadows, and three 0.186 cannot give one both of those at once:
   `WebGLShadowMap` refuses VSM shadows for point lights outright
   (`'VSM shadow maps are not supported for PointLights'`, and it
   `continue`s — the flag would be silently dead), and this scene is on
   `VSMShadowMap` for the moon's penumbra. So the fixture carries two:

   - **the point light**, which is the lamp's light. It sits *inside*
     the shade at the bulb and casts nothing, which is what lets it
     light the shade's own outside, the pole and the window reveal
     behind — a shade really does glow, and a non-casting point source
     inside one is the cheapest honest way to say so. Short range, so
     it stays a bloom around the fixture rather than a second pool.
   - **the spot light**, which carries the throw and the soft cast
     shadow. A cone shade *is* a cone of light, so this is also the
     shape the fixture should make.

   **The spot sits just outside the shade's mouth, not at the bulb**,
   and that is the detail that lets every part of the lamp cast for the
   moon. A light inside the shade would have the shade's own inner wall
   in front of it, so either the shade casts and the pool is entirely
   shadowed, or the shade does not cast and loses its moon shadow too —
   `castShadow` is per object, not per light. Pushed 0.06 past the rim
   the whole fixture is *behind* the light and neither trade has to be
   made. */
const POINT_RANGE = 4.6;
/* Not inverse-square, for the same reason the CRT's spill is not: a
   lit shade is an area source and this is a point, so at `decay` 2 the
   shade's own plastic blows out before anything a hand's width away
   sees light at all. */
const POINT_DECAY = 1.4;
/* **Both intensities are compensated for the scale**, by the falloff
   the extra distance costs — see LAMP_SCALE, where the measurement is.
   Written as the exponent rather than as a pre-multiplied number so
   that re-scaling the fixture carries the brightness with it and the
   two cannot drift apart. */
const POINT_INTENSITY = 14.0 * LAMP_SCALE ** POINT_DECAY;

const SPOT_RANGE = 15.0;
const SPOT_DECAY = 1.3;
/* Wider than the shade's own flare (28 degrees): the source is a bulb
   with a 1-unit rim in front of it, not a laser, so what leaves the
   mouth spreads to about 50. `penumbra` near 1 is most of what makes
   the pool's edge read as a lamp rather than as a projector. */
const SPOT_ANGLE = THREE.MathUtils.degToRad(51);
const SPOT_PENUMBRA = 0.9;
const SPOT_INTENSITY = 46.0 * LAMP_SCALE ** SPOT_DECAY;

/* What "fully on" means for each emissive, and all three figures were
   moved once after looking at the fixture from the ends of the orbit
   leash rather than only from home:

   - **the bulb is hotter than the wall behind it** (5.5 against 1.7).
     At 4.5/2.2 the mouth was one flat white blob with no filament in
     it — the inner wall was bright enough to swallow the thing it is
     supposed to be lit by.
   - **the outer shade gets very little.** It was 0.18, and at the left
     clamp — where the mouth faces away and nothing else reaches the
     back of the cone — that was the *only* term on those fragments, so
     the shade read as a flat tan kite cut out of paper. At 0.07 the
     back of the shade is its own dark green lit by the hemisphere,
     which is what it should be, and the glow still reads from the
     front, where there is shading under it. */
const EMIT_BULB = 5.5;
const EMIT_INNER = 1.7;
const EMIT_OUTER = 0.07;

let disposables = [];
/* The parts whose brightness `setLamp` writes. Module state rather
   than a closure because scene.js drives this once a frame and should
   not have to carry five handles to do it. */
let parts = null;

function track(x) {
  disposables.push(x);
  return x;
}

function brassMaterial() {
  return track(
    new THREE.MeshStandardMaterial({
      color: BRASS,
      /* Not a mirror. There is no environment map in this scene at all
         (ENV_INTENSITY is 0 — see scene.js), so a true polished metal
         would have nothing to reflect and would come out black; a
         satin, half-rough brass picks the moon and its own lamp up off
         its roughness instead. */
      metalness: 0.78,
      roughness: 0.38,
      envMapIntensity: 0.55,
    }),
  );
}

/* The painted contact shadow under the base. Both of this lamp's
   lights can miss it — the spot points down-*forward* and the moon
   comes through the window above and behind — so the hairline where
   the base meets the walnut is not reliably drawn by either. Same
   decision, and the same texture, as the blobs under the monitor's
   stand and the desk's feet. */
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

export function buildLamp() {
  const root = new THREE.Group();
  root.name = "lamp";
  /* **Scaled about the root's own origin**, which sits on the desk top
     at the centre of the base — so the fixture grows *in place*, the
     base stays flat on the walnut at DESK_TOP_Y, and scene.js's
     placement does not have to know the scale exists. Same decision,
     and the same reason, as TREEHOUSE_SCALE. */
  root.scale.setScalar(LAMP_SCALE);

  const brass = brassMaterial();
  const outerMat = track(
    new THREE.MeshStandardMaterial({
      color: SHADE_OUT,
      roughness: 0.52,
      metalness: 0.1,
      emissive: new THREE.Color(LAMP_COLOUR),
      emissiveIntensity: 0,
      /* The mouth has to show its inside, and the inner cone is a
         separate mesh a hair within this one — so this is single-sided
         and the inner one is BackSide. Two meshes rather than
         DoubleSide because the two faces of a real shade are not the
         same colour and only one of them glows. */
      side: THREE.FrontSide,
    }),
  );
  const innerMat = track(
    new THREE.MeshStandardMaterial({
      color: SHADE_IN,
      roughness: 0.88,
      metalness: 0,
      emissive: new THREE.Color(LAMP_COLOUR),
      emissiveIntensity: 0,
      side: THREE.BackSide,
    }),
  );
  const bulbMat = track(
    new THREE.MeshStandardMaterial({
      color: BULB,
      roughness: 0.3,
      metalness: 0,
      emissive: new THREE.Color(BULB_EMISSIVE),
      emissiveIntensity: 0,
    }),
  );

  const mesh = (geo, mat, cast = true) => {
    const m = new THREE.Mesh(track(geo), mat);
    m.castShadow = cast;
    m.receiveShadow = true;
    return m;
  };

  /* --- base and pole --- */
  const base = mesh(
    new THREE.CylinderGeometry(BASE_R, BASE_R * 1.07, BASE_H, 36),
    brass,
  );
  base.position.y = BASE_H / 2;
  root.add(base);

  const dome = mesh(
    new THREE.CylinderGeometry(DOME_R * 0.74, DOME_R, DOME_H, 28),
    brass,
  );
  dome.position.y = BASE_H + DOME_H / 2;
  root.add(dome);

  const poleFoot = BASE_H + DOME_H;
  const pole = mesh(
    new THREE.CylinderGeometry(POLE_R, POLE_R * 1.12, POLE_TOP - poleFoot, 18),
    brass,
  );
  pole.position.y = (poleFoot + POLE_TOP) / 2;
  root.add(pole);

  /* The joint the shade hangs off. It is what makes a shade leaning
     50 degrees off a vertical pole read as adjustable rather than as
     broken. */
  const knuckle = mesh(new THREE.SphereGeometry(KNUCKLE_R, 18, 12), brass);
  knuckle.position.y = POLE_TOP;
  root.add(knuckle);

  /* --- the shade ---
     Its own group, pivoted at the knuckle with the cone hanging down
     its local -y, so the two tilts are the only statement of where it
     points and the bulb, the collar and both lights follow them. */
  const shade = new THREE.Group();
  shade.name = "lamp-shade";
  shade.position.y = POLE_TOP;
  /* **The order matters at these angles and it is three's default.**
     `Quaternion.setFromEuler` with order XYZ builds qx*qy*qz, so the
     matrix is Rx*Rz here and the roll happens *first*, in the shade's
     own frame: the mouth's direction works out to
     `(sin(swing)cos(tilt), -cos(swing)cos(tilt), sin(tilt))`. That is
     the arithmetic the aim was predicted from, and `aimLamp` reports
     the beam off the world matrices rather than restating it — the two
     agreed to two decimals, which is what makes the derivation worth
     writing down. */
  shade.rotation.set(-SHADE_TILT, 0, SHADE_SWING);
  root.add(shade);

  const coneGeo = track(
    new THREE.CylinderGeometry(
      SHADE_TOP_R,
      SHADE_BOT_R,
      SHADE_H,
      40,
      1,
      true, // open-ended: the mouth is the whole point
    ),
  );
  const outer = new THREE.Mesh(coneGeo, outerMat);
  outer.position.y = -SHADE_H / 2;
  outer.castShadow = true;
  outer.receiveShadow = true;
  shade.add(outer);

  /* The same geometry a hair inside, flipped. Sharing it is free — the
     material is what differs — and the inset is what keeps the two
     from z-fighting along the rim. */
  const inner = new THREE.Mesh(coneGeo, innerMat);
  inner.position.y = -SHADE_H / 2;
  inner.scale.setScalar(1 - SHADE_T);
  inner.castShadow = false; // the outer cone already casts this silhouette
  inner.receiveShadow = false;
  shade.add(inner);

  /* Closes the narrow end. Without it the camera looks straight down
     the shade's top opening at the bulb from the home framing, which
     is a hole in the lamp rather than a vent. */
  const cap = mesh(
    new THREE.CylinderGeometry(SHADE_TOP_R, SHADE_TOP_R, CAP_T, 40),
    outerMat,
  );
  cap.position.y = -CAP_T / 2;
  shade.add(cap);

  /* The fitter stands entirely *above* the cap rather than straddling
     it: at a 45-degree tilt the mouth shows a good deal of the shade's
     own ceiling, and a collar hanging through it read as a dark bar
     across the lit inside. */
  const fitter = mesh(
    new THREE.CylinderGeometry(FITTER_R, FITTER_R, 0.22, 18),
    brass,
  );
  fitter.position.y = 0.11;
  shade.add(fitter);

  /* The bulb, inside the shade and visible through the mouth at this
     camera. It does not cast: it is inside the fixture, and the only
     light it is in front of is the point light, which casts nothing
     either. */
  const bulbY = -(SHADE_H * 0.42);
  const bulb = mesh(new THREE.SphereGeometry(0.17, 20, 14), bulbMat, false);
  bulb.position.y = bulbY;
  bulb.receiveShadow = false;
  shade.add(bulb);

  /* --- the lights ---
     See the header above POINT_RANGE for why there are two of them and
     why only one of them sits inside the shade. */
  const point = new THREE.PointLight(
    LAMP_COLOUR,
    0, // scene.js writes this every frame; 0 until it does
    /* World units, so the group scale does not reach it — see
       LAMP_SCALE. Its *position* does, because that is a transform. */
    POINT_RANGE * LAMP_SCALE,
    POINT_DECAY,
  );
  point.position.y = bulbY;
  point.castShadow = false;
  shade.add(point);

  const spot = new THREE.SpotLight(
    LAMP_COLOUR,
    0,
    SPOT_RANGE * LAMP_SCALE, // likewise world units
    SPOT_ANGLE,
    SPOT_PENUMBRA,
    SPOT_DECAY,
  );
  spot.position.y = -(SHADE_H + 0.06);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  /* VSM, like the moon's — so this is a blur width in texels. The
     brief's "soft" for a shaded lamp is softer than a moon's: the
     source is a 2-unit mouth a couple of units above the desk. */
  spot.shadow.radius = 6;
  spot.shadow.blurSamples = 16;
  /* `bias` 0 and the work done by `normalBias`, for exactly the reason
     the moon's does — see scene.js. The frustum is 51 degrees over
     1024 texels at a throw of ~3 units, so a texel covers ~0.007 world
     units here and two of them is 0.015. */
  spot.shadow.bias = 0;
  /* Both in world units and so both scaled — a texel covers
     LAMP_SCALE times more world at LAMP_SCALE times the throw. The
     `far` three sets itself from `light.distance` on every
     `updateMatrices`, so writing it here is only so the two agree
     before the first shadow pass. */
  spot.shadow.normalBias = 0.015 * LAMP_SCALE;
  spot.shadow.camera.near = 0.4 * LAMP_SCALE;
  spot.shadow.camera.far = SPOT_RANGE * LAMP_SCALE;
  /* The target has to be in the graph for its world matrix to follow
     the shade's tilt; as a child of the shade it does, and "straight
     down the shade's axis" stays true however the two tilts move. */
  spot.target.position.y = -(SHADE_H + 2.0);
  shade.add(spot, spot.target);

  /* --- grounding --- */
  const blob = new THREE.Mesh(
    track(new THREE.PlaneGeometry(BASE_R * 3.1, BASE_R * 3.1)),
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
  /* **Not pickable.** scene.js raycasts the whole group to decide
     whether a press was on the lamp, and this is a 2.7-unit
     transparent square lying on the walnut — left in, it would make a
     patch of empty desk twice the fixture's own footprint toggle the
     light. */
  blob.raycast = () => {};
  root.add(blob);

  parts = { point, spot, innerMat, outerMat, bulbMat, shade, root };
  setLamp(0);
  return { root, shade, point, spot };
}

/* **What "on" means, in one place.** scene.js owns the state and the
   fade — this is the curve from a 0..1 level to the five things that
   have to move together, so a lamp at 0.3 can never be a bright bulb
   in a dark shade. Linear in the level on purpose: the shaping (the
   ease, and the flicker on the strike) lives in scene.js's loop, the
   same way the fly-in keeps its easing on the timeline and its
   geometry in `applyFly`. */
export function setLamp(level) {
  if (!parts) return;
  const v = level < 0 ? 0 : level > 1 ? 1 : level;
  parts.point.intensity = POINT_INTENSITY * v;
  parts.spot.intensity = SPOT_INTENSITY * v;
  parts.bulbMat.emissiveIntensity = EMIT_BULB * v;
  parts.innerMat.emissiveIntensity = EMIT_INNER * v;
  parts.outerMat.emissiveIntensity = EMIT_OUTER * v;
}

/* **Re-aims the shade on a live page**, in degrees, and reports where
   the beam then lands on the desk top. The two tilts decide three
   things at once — how much of the lit inside the camera sees, where
   the pool falls, and what (if anything) stands in the beam to cast a
   shadow — so they cannot be bisected one build at a time any more
   than the room's four intensities could. `_lampshots.mjs aim` drives
   this.

   The caller owns re-rendering the frozen shadow map afterwards:
   moving the light is the one change in this scene that invalidates
   it, and scene.js is where that flag lives. */
export function aimLamp(tiltDeg, swingDeg) {
  if (!parts) return null;
  if (tiltDeg !== undefined) {
    parts.shade.rotation.set(
      -THREE.MathUtils.degToRad(tiltDeg),
      0,
      THREE.MathUtils.degToRad(swingDeg ?? 0),
    );
    parts.shade.updateMatrixWorld(true);
  }
  /* Where the axis meets the plane the lamp stands on, in the lamp's
     own frame — which is the desk top, since that is where its origin
     sits. */
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
    swing: Number(THREE.MathUtils.radToDeg(parts.shade.rotation.z).toFixed(1)),
    /* World, so it can be read against the desk's own plan. */
    pool: Number.isFinite(t)
      ? o.clone().addScaledVector(d, t).toArray().map((v) => Number(v.toFixed(2)))
      : null,
    throw: Number.isFinite(t) ? Number(t.toFixed(2)) : null,
  };
}

/* The rig's own figures, for the review scripts and for tuning the two
   lights against each other on a live page — four numbers that only
   mean anything together, which is the same reason `window.__lights`
   exists for the room. */
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
      inner: parts ? parts.innerMat.emissiveIntensity : 0,
      outer: parts ? parts.outerMat.emissiveIntensity : 0,
    },
    colour: `#${LAMP_COLOUR.toString(16).padStart(6, "0")}`,
  };
}

export function disposeLamp() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
  parts = null;
}
