import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ==========================================
   THE EXECUTIVE DESK

   A traditional double-pedestal executive desk in dark walnut, built
   entirely from primitives — no imported models — after the reference
   photograph. Taken from it: the heavy moulded top with a crossbanded
   border, the reeded pilasters standing at every front corner, the
   raised-panel cabinet doors under a drawer on each pedestal, the
   stepped moulded plinth the whole thing sits on, and the pull-out
   writing slide left half out over the knee hole.

   It is the **bulky** alternative to `classic.js`'s steel tanker desk,
   and it satisfies the same contract — see docs/desk.md. Local space
   is identical: +Z is the front, origin on the floor at the centre of
   the desk, so the two are interchangeable by the seat frame alone.

   Reachable with `?desk=executive`; dev only, like `?lamp=`.

   **Two figures are deliberately *not* this desk's own.** `DESK_W`
   matches the tanker desk's 22.8 to the unit, because that width was
   set by the left wall — the slab's ends reach x ±11.4 against the
   wall's inner face at -13.0 — and the brief asks for about the same
   width anyway. And `DESK_TOP_Y` stays 9.0, which is below true scale
   for a desk this heavy, for the reason classic.js states at length:
   the frame has to hold the desk, the monitor on it and enough floor
   either side, and a taller desk shrinks the thing the visitor is
   meant to click. All of this desk's extra bulk is therefore in its
   *plan* and in the weight of its mouldings, not in its height.
   ========================================== */

/* --- Palette ---------------------------------------------
   Every tint below multiplies the walnut scan, whose own channel means
   sit at roughly #6b4a33 — so white is the scan as vendored and these
   darken it. The reference desk is a much deeper, redder walnut than
   the tanker desk's medium top: `WALNUT` lands around #5b3721.

   The three tones are doing the job the enamel's wear textures do on
   the tanker desk. A polished frame-and-panel carcase has no chips and
   no scuffs to speak of, but it does have *tone*: a raised panel sits
   in its own shadow and reads darker than the frame around it, and the
   top — the one surface that gets waxed — reads lighter than both. On
   a flat tint the door would be one slab of brown with lines on it. */
const WALNUT = 0xd8bca6;        // the carcase, the doors' frames
const WALNUT_DARK = 0xa88a74;   // the recessed fields, the modesty panel
const WALNUT_LIGHT = 0xffe8d2;  // the top's field, the writing slide
/* Anything you are looking *into*: the knee hole's ceiling and its two
   inner walls. Not black — the same argument classic.js makes for its
   INTERIOR, which is that a hole punched clean through the picture
   loses the modesty panel behind it. Unmapped, because a surface the
   key never reaches cannot show grain anyway. */
const INTERIOR = 0x3a2e24;
/* Antique brass rather than the reference's near-black bronze. At
   `metalness` this high there is no diffuse term to carry a dark
   fitting, and the room is a night room: a bronze pull in here is a
   pull-shaped hole. Brass catches the lamp, which is what makes the
   hardware read as hardware. */
const BRASS = 0x8d7247;

/* --- Proportions -----------------------------------------
   Along +X, matched to the tanker desk — see the note above. */
const DESK_W = 22.8;
/* Along +Z. Half a unit deeper than the tanker desk, which is most of
   where the extra bulk comes from in plan, and it is slack rather than
   need: the computer kit occupies very nearly 12 units of depth and
   the scene seats it off the *front* edge, so the depth all goes on
   behind the monitor. */
const DESK_D = 13.2;
/* Height of the top surface — what everything standing on the desk is
   placed against, hence the export. Held at the tanker desk's figure;
   see the header. */
export const DESK_TOP_Y = 9.0;

/* **The usable top, in the desk's own local space.** `X`/`Z` are the
   slab's centre, `W`/`D` its extent, so the four edges are X ± W/2 and
   Z ± D/2. scene.js's `seatToDesk` reads it to carry the machine, the
   lamp, the treehouse and the spare bricks across unchanged: x from
   the centre, z from the front edge. This top is centred on the desk
   like the tanker desk's, and half a unit deeper, so the whole
   arrangement simply moves 0.3 forward with the front edge and keeps
   its spacing exactly. */
export const DESK_TOP = { X: 0, Z: 0, W: DESK_W, D: DESK_D };

/* --- The top ---------------------------------------------
   Three bands, because the edge of an executive desk top is a moulding
   and a moulding is a profile: a bullnose cap standing full width, a
   cove undercut set back from it, and a fascia below that comes back
   out nearly flush. What the eye actually reads is the *shadow line*
   the cove leaves between cap and fascia — which is why the cove is
   the thinnest of the three and set back furthest. A single slab with
   a rounded edge, which is what the tanker desk has, reads as a plank;
   this reads as a piece of furniture. */
const TOP_CAP_H = 0.26;
const TOP_CAP_R = 0.06;
const TOP_COVE_H = 0.14;
const TOP_COVE_IN = 0.15;
const TOP_FASCIA_H = 0.32;
const TOP_FASCIA_IN = 0.04;
const TOP_THICK = TOP_CAP_H + TOP_COVE_H + TOP_FASCIA_H;  // 0.72
const UNDER_Y = DESK_TOP_Y - TOP_THICK;                   // 8.28

/* The crossbanded border: a frame of four rails around a centre field,
   all coplanar at DESK_TOP_Y, which is how the real top is made — and
   also why there is no z-fighting to manage. The band earns its five
   meshes by carrying the grain *across* itself on all four sides while
   the field's runs along the desk, so the border is legible as a
   border rather than as four lines drawn on one plank. */
const BAND = 0.95;

/* --- The carcase -----------------------------------------
   Inboard of the slab on the ends and the front, nearly flush at the
   back, as the reference is. */
const OVER_SIDE = 0.55;
const OVER_FRONT = 0.55;
const OVER_BACK = 0.20;
const BASE_W = DESK_W - 2 * OVER_SIDE;
const BASE_D = DESK_D - OVER_FRONT - OVER_BACK;
const BASE_Z = -(OVER_FRONT - OVER_BACK) / 2;
const FRONT_Z = BASE_Z + BASE_D / 2;
const BACK_Z = BASE_Z - BASE_D / 2;

/* **The pedestals are what make this desk bulky.** 6.1 across against
   the tanker desk's 5.2 — 56% of the base between them, where the
   tanker desk's two take 48% — so the knee hole comes in from 11.3 to
   9.5 and the whole front reads as cabinet rather than as opening.
   That is the proportion in the photograph, where the knee is only a
   little wider than one pedestal. */
const PED_W = 6.1;
const PED_X = (BASE_W - PED_W) / 2;
const KNEE_W = BASE_W - 2 * PED_W;

/* The stepped plinth. Two courses, each standing proud of the carcase
   above it, which is the whole of why this desk looks planted rather
   than stood up on feet the way the tanker desk is. The tanker desk
   needs painted contact shadows because a shadow-map texel never
   resolves the gap under a 0.55-unit foot; this one needs them for the
   opposite reason — there is no gap at all, and a plinth meeting the
   floor with nothing under it reads as a sticker. */
const PLINTH_LO_H = 0.42;
const PLINTH_LO_OUT = 0.26;
const PLINTH_HI_H = 0.28;
const PLINTH_HI_OUT = 0.12;
const PLINTH_H = PLINTH_LO_H + PLINTH_HI_H;   // 0.70

/* The reeded pilasters at the front corners. Both corners of both
   pedestals, as in the reference — including the two either side of
   the knee, which is the pair that actually frames the opening. */
const PIL_W = 0.62;
const PIL_PROUD = 0.16;
const FACE_W = PED_W - 2 * PIL_W;             // what is left for the fronts

const DRW_TOP = UNDER_Y - 0.06;               // a reveal under the fascia
const DRW_H = 1.45;
const DOOR_TOP = DRW_TOP - DRW_H - 0.10;      // the reveal between them
const DOOR_BOT = PLINTH_H + 0.10;
const DOOR_H = DOOR_TOP - DOOR_BOT;

const disposables = [];
function track(...xs) { disposables.push(...xs); return xs[0]; }

/* ==========================================
   THE WALNUT

   One scan, many parts, and that is the whole difference from the
   tanker desk's wood: there the walnut is a single slab and one
   material will do, here it is a carcase whose parts range from a
   13-unit top to a 0.18-unit moulding strip. A BoxGeometry's UVs run
   0..1 per face, so one shared repeat would put four tiles across the
   top and four across a moulding — the grain would change physical
   scale from part to part, which is the one thing a solid timber desk
   never does.

   So the three files load **once** and every material takes clones with
   its own repeat. `Texture.clone()` shares the underlying `Source`, so
   the maps still share their source images however many parts there are;
   what the clone carries is the wrap, the rotation and the repeat.

   The catch is that a clone made before the image lands has its own
   `version`, and three only re-uploads a texture whose version moved.
   Hence `pendingClones`: the load callback bumps every clone that was
   cut from that file. Without it the first frame uploads an empty
   texture and nothing ever replaces it — and on the reduced-motion
   path, which draws one frame and stops, that first frame is the only
   one there is.
   ========================================== */
let woodPending = [];
let pendingClones = [];
let baseMaps = null;

function woodMaps() {
  if (baseMaps) return baseMaps;
  const loader = new THREE.TextureLoader();
  const base = `${import.meta.env.BASE_URL}textures/`;
  const load = (file, srgb) => {
    let settle;
    /* Settles on error as well as on load: a missing file is a desk
       with no grain, not a scene that never redraws. Same contract as
       classic.js's, and `ready` below is what the caller waits on. */
    woodPending.push(new Promise((res) => { settle = res; }));
    const done = () => {
      pendingClones.forEach((c) => { c.needsUpdate = true; });
      settle();
    };
    const t = loader.load(`${base}${file}`, done, undefined, done);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return track(t);
  };
  baseMaps = {
    albedo: load('desk-wood-512.jpg', true),
    rough: load('desk-wood-rough-512.jpg', false),
    normal: load('desk-wood-normal-512.jpg', false),
  };
  return baseMaps;
}

/* `ru`/`rv` are tiles across the face, worked out by the caller from
   the part's own size so the grain holds one physical scale. `rot` of
   a quarter turn puts the grain along the part's width instead of up
   it — the scan's own grain runs up the file. */
function woodMap(base, ru, rv, rot, srgb) {
  const t = base.clone();
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.center.set(0.5, 0.5);
  t.rotation = rot;
  t.repeat.set(ru, rv);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  pendingClones.push(t);
  return track(t);
}

/* One tile of the scan per this many world units, on every part. The
   figure is the tanker desk's — its slab divides both dimensions by 7
   — kept so the two desks' timber reads at the same grain size and a
   switch between them does not look like a change of scale. */
const GRAIN = 7;

function wood(w, h, opts = {}) {
  const {
    tint = WALNUT,
    /* Multiplies the roughness map, whose own range sits around 0.24.
       1.6 lands on 0.34-0.42 — a shade glossier than the tanker desk's
       satin 1.9, because this is a French-polished piece and the
       reference has the window in its top. */
    rough = 1.6,
    rot = 0,
    env = 0.5,
  } = opts;
  const maps = woodMaps();
  /* The repeat is in the *texture's* axes, and a quarter turn swaps
     them — so the caller always passes the part's width and height and
     this works out which is which. */
  const [ru, rv] = rot ? [h / GRAIN, w / GRAIN] : [w / GRAIN, h / GRAIN];
  const rgh = woodMap(maps.rough, ru, rv, rot, false);
  return track(new THREE.MeshStandardMaterial({
    color: tint,
    map: woodMap(maps.albedo, ru, rv, rot, true),
    roughnessMap: rgh,
    roughness: rough,
    metalness: 0,
    // Scanned tangent-space relief, independent of the finish's roughness.
    normalMap: woodMap(maps.normal, ru, rv, rot, false),
    normalScale: new THREE.Vector2(0.25, 0.25),
    envMapIntensity: env,
  }));
}

function brassMaterial() {
  return track(new THREE.MeshStandardMaterial({
    color: BRASS,
    /* Not quite 1: the scene's environment map is off, so a fitting at
       full metalness has nothing to reflect and comes back black. A
       little diffuse is what keeps a brass pull brass in a room with
       no HDRI in it — the same compromise classic.js's chrome makes. */
    metalness: 0.88,
    roughness: 0.33,
    envMapIntensity: 1.2,
  }));
}

function interiorMaterial() {
  return track(new THREE.MeshStandardMaterial({
    color: INTERIOR, roughness: 0.95, metalness: 0, envMapIntensity: 0.05,
  }));
}

/* ==========================================
   PARTS
   ========================================== */

/* A mitred applied moulding: four strips laid in a rectangle on the
   face of a door or a drawer front, standing `proud` off it.

   They are *applied* rather than cut into the panel because that is
   what the reference has — a strip of ogee pinned around the field —
   and because it is the only version that survives this camera. A
   groove modelled by insetting the field relies on the reveal being
   wider than a shadow-map texel; a strip standing 0.09 proud casts its
   own line whatever the map resolution, and the same geometry reads
   from the azimuth clamps where the face is nearly edge-on.

   The two long strips run the full width and the two short ones fit
   between them, which is a butt joint rather than a mitre. At this
   size the difference is well under a pixel and it saves four
   non-axis-aligned parts per door. */
function mouldedFrame(w, h, inset, proud, mat, strip = 0.18) {
  const g = new THREE.Group();
  const fw = w - 2 * inset;
  const fh = h - 2 * inset;
  const add = (sw, sh, x, y) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(sw, sh, proud)), mat);
    m.position.set(x, y, proud / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  add(fw, strip, 0, (fh - strip) / 2);
  add(fw, strip, 0, -(fh - strip) / 2);
  add(strip, fh - 2 * strip, (fw - strip) / 2, 0);
  add(strip, fh - 2 * strip, -(fw - strip) / 2, 0);
  return g;
}

/* A reeded pilaster: the corner column, with three half-round beads
   standing down its face.

   Reeds, not flutes — convex beads rather than concave channels. Both
   exist on furniture of this kind and the reference has reeds, but the
   reason it matters here is lighting: a flute is a groove, and a groove
   this shallow in a room whose key rakes in almost horizontally fills
   with its own shadow and reads as three dark lines. A bead catches the
   lamp along its crown, which is a highlight, and a highlight survives
   a dark room. */
function buildPilaster(h, mat) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(
    track(new THREE.BoxGeometry(PIL_W, h, PIL_PROUD)), mat);
  shaft.position.z = PIL_PROUD / 2;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);

  const reed = track(new THREE.CylinderGeometry(0.085, 0.085, h - 0.5, 10));
  for (const i of [-1, 0, 1]) {
    const m = new THREE.Mesh(reed, mat);
    m.position.set(i * 0.17, 0, PIL_PROUD);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  }
  return g;
}

/* The drawer pull: a brass bar on two posts. A period desk would carry
   a swinging bail here, but a bail hangs — and a hanging fitting on a
   drawer that never opens is detail the camera cannot tell from a bar
   at this size, for three more parts and a pivot that means nothing. */
function buildBarPull(width, mat) {
  const g = new THREE.Group();
  const stand = 0.24;
  const bar = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.055, 0.055, width, 10)), mat);
  bar.rotation.z = Math.PI / 2;
  bar.position.z = stand;
  bar.castShadow = true;
  g.add(bar);
  const post = track(new THREE.CylinderGeometry(0.05, 0.055, stand, 8));
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(post, mat);
    p.rotation.x = Math.PI / 2;
    p.position.set(sx * (width / 2 - 0.1), 0, stand / 2);
    p.castShadow = true;
    g.add(p);
  }
  return g;
}

/* The cabinet knob: a turned brass mushroom on a short neck. */
function buildKnob(mat) {
  const g = new THREE.Group();
  const neck = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.06, 0.075, 0.12, 10)), mat);
  neck.rotation.x = Math.PI / 2;
  neck.position.z = 0.06;
  g.add(neck);
  const head = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.15, 14, 10)), mat);
  head.scale.set(1, 1, 0.72);
  head.position.z = 0.18;
  head.castShadow = true;
  g.add(head);
  return g;
}

/* A raised-panel door. Five planes of depth in six boxes plus the
   moulding, and the order matters: the back slab carries the *field*,
   the four frame members stand proud of it, and the applied moulding
   stands proud of those. So the field is genuinely recessed behind two
   steps, which is what the shadow in the reference's door is.

   The field is also the one part that takes `WALNUT_DARK`. It is in
   its own shadow on the real desk and it is the thing that keeps a
   door from reading as one slab with a rectangle drawn on it — the
   same argument classic.js makes for the reveals between its drawer
   fronts showing dark rather than cream. */
function buildPanelDoor(w, h, mat, panelMat, mouldMat, brass) {
  const g = new THREE.Group();
  const BACK_T = 0.14;
  const FRAME_T = 0.05;
  const STILE = 0.72;

  const back = new THREE.Mesh(
    track(new THREE.BoxGeometry(w, h, BACK_T)), panelMat);
  back.position.z = BACK_T / 2;
  back.castShadow = true;
  back.receiveShadow = true;
  g.add(back);

  const frame = (fw, fh, x, y) => {
    const m = new THREE.Mesh(
      track(new THREE.BoxGeometry(fw, fh, FRAME_T)), mat);
    m.position.set(x, y, BACK_T + FRAME_T / 2);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  };
  frame(w, STILE, 0, (h - STILE) / 2);
  frame(w, STILE, 0, -(h - STILE) / 2);
  frame(STILE, h - 2 * STILE, (w - STILE) / 2, 0);
  frame(STILE, h - 2 * STILE, -(w - STILE) / 2, 0);

  const mould = mouldedFrame(w, h, STILE - 0.1, 0.09, mouldMat);
  mould.position.z = BACK_T + FRAME_T;
  g.add(mould);

  /* On the stile and high, which is where the catch is on the
     reference. Which stile is the caller's business — it goes to the
     knee side on both pedestals, the one pair of positions not
     swallowed by a pilaster at the ends of the orbit leash — so it is
     handed back by name rather than fished out by child index. */
  const knob = buildKnob(brass);
  knob.position.set(w / 2 - STILE / 2, h / 2 - 1.1, BACK_T + FRAME_T);
  g.add(knob);
  g.userData.knob = knob;

  return g;
}

/* A drawer front: a slab with a bead run round it and a bar pull. No
   frame-and-panel here — the reference's drawers are solid fronts with
   a moulded edge, which is what a drawer 1.45 units deep can carry. */
function buildDrawerFront(w, h, mat, mouldMat, brass) {
  const g = new THREE.Group();
  const T = 0.16;
  const face = new THREE.Mesh(track(new THREE.BoxGeometry(w, h, T)), mat);
  face.position.z = T / 2;
  face.castShadow = true;
  face.receiveShadow = true;
  g.add(face);

  const bead = mouldedFrame(w, h, 0.16, 0.06, mouldMat, 0.12);
  bead.position.z = T;
  g.add(bead);

  const pull = buildBarPull(1.9, brass);
  pull.position.z = T;
  g.add(pull);
  return g;
}

/* ==========================================
   ASSEMBLY
   ========================================== */
export function buildDesk() {
  woodPending = [];
  pendingClones = [];
  baseMaps = null;

  const root = new THREE.Group();
  const bodyH = UNDER_Y - PLINTH_H;

  /* **Which way the grain runs is a per-part decision**, and it is
     the reason `wood` takes a rotation at all. On a solid timber desk
     the grain follows the member: up a stile and a cabinet side, along
     a rail, a plinth course, a drawer front and a panel's width. One
     material for the whole carcase would run it the same way through
     parts at right angles to each other, which is the look of a thing
     veneered from one sheet rather than built.

     The quarter turn is what puts the grain along the part's *width*
     — see `wood`, which also works the repeat out from it, so the
     grain keeps one physical scale whichever way it is turned. */
  const ACROSS = Math.PI / 2;
  const carcase = wood(PED_W, bodyH, { tint: WALNUT });
  const drawerMat = wood(FACE_W, DRW_H, { tint: WALNUT, rot: ACROSS });
  const frameMat = wood(FACE_W, DOOR_H, { tint: WALNUT });
  const panelMat = wood(FACE_W, DOOR_H, {
    tint: WALNUT_DARK, rough: 1.75, rot: ACROSS,
  });
  const mouldMat = wood(FACE_W, 0.5, { tint: WALNUT, rough: 1.45, rot: ACROSS });
  const plinthMat = wood(PED_W, PLINTH_H, { tint: WALNUT_DARK, rot: ACROSS });
  const brass = brassMaterial();
  const interior = interiorMaterial();

  /* --- The top ------------------------------------------- */
  const topY = DESK_TOP_Y - TOP_CAP_H;

  /* The field, grain along the desk's length as a solid top's is. */
  const fieldW = DESK_W - 2 * BAND;
  const fieldD = DESK_D - 2 * BAND;
  const field = new THREE.Mesh(
    track(new RoundedBoxGeometry(fieldW, TOP_CAP_H, fieldD, 3, 0.03)),
    wood(fieldW, fieldD, {
      tint: WALNUT_LIGHT, rough: 1.4, rot: ACROSS,
    }));
  field.position.y = topY + TOP_CAP_H / 2;
  field.castShadow = true;
  field.receiveShadow = true;
  root.add(field);

  /* The border. The two long rails take the full width and the two
     short ones fit between them, and each carries its grain *across*
     itself — a quarter turn on the long pair, none on the short — so
     the band runs round the top the way a crossbanding does. */
  const bandLong = wood(DESK_W, BAND, { tint: WALNUT, rough: 1.4 });
  const bandShort = wood(BAND, fieldD, {
    tint: WALNUT, rough: 1.4, rot: ACROSS,
  });
  const addBand = (w, d, x, z, mat) => {
    const m = new THREE.Mesh(
      track(new RoundedBoxGeometry(w, TOP_CAP_H, d, 3, TOP_CAP_R)), mat);
    m.position.set(x, topY + TOP_CAP_H / 2, z);
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  };
  addBand(DESK_W, BAND, 0, (DESK_D - BAND) / 2, bandLong);
  addBand(DESK_W, BAND, 0, -(DESK_D - BAND) / 2, bandLong);
  addBand(BAND, fieldD, (DESK_W - BAND) / 2, 0, bandShort);
  addBand(BAND, fieldD, -(DESK_W - BAND) / 2, 0, bandShort);

  /* The cove: set back from the cap and thin, so what the eye reads is
     the shadow line it leaves rather than the box itself. */
  const coveY = topY - TOP_COVE_H;
  const cove = new THREE.Mesh(
    track(new THREE.BoxGeometry(
      DESK_W - 2 * TOP_COVE_IN, TOP_COVE_H, DESK_D - 2 * TOP_COVE_IN)),
    wood(DESK_W, TOP_COVE_H, { tint: WALNUT_DARK, rough: 1.7, rot: ACROSS }));
  cove.position.y = coveY + TOP_COVE_H / 2;
  cove.receiveShadow = true;
  root.add(cove);

  const fascia = new THREE.Mesh(
    track(new RoundedBoxGeometry(
      DESK_W - 2 * TOP_FASCIA_IN, TOP_FASCIA_H,
      DESK_D - 2 * TOP_FASCIA_IN, 3, 0.04)),
    wood(DESK_W, TOP_FASCIA_H, { tint: WALNUT, rot: ACROSS }));
  fascia.position.y = UNDER_Y + TOP_FASCIA_H / 2;
  fascia.castShadow = true;
  fascia.receiveShadow = true;
  root.add(fascia);

  /* The underside of the top, for the reason classic.js gives for its
     own: the orbit leash drops to 2° above the floor, which puts the
     eye a seventh of a unit above this surface, and lit walnut on the
     bottom face of a slab is the one thing there that was never meant
     to be looked at. A plate rather than a re-modelled part, inset
     from the silhouette so it changes nothing at a framing that was
     already right. */
  const underPlate = new THREE.Mesh(
    track(new THREE.BoxGeometry(DESK_W - 0.2, 0.05, DESK_D - 0.2)), interior);
  underPlate.position.y = UNDER_Y - 0.025;
  underPlate.receiveShadow = true;
  root.add(underPlate);

  /* --- The pedestals ------------------------------------- */
  for (const sx of [-1, 1]) {
    const x = sx * PED_X;

    const body = new THREE.Mesh(
      track(new THREE.BoxGeometry(PED_W, bodyH, BASE_D)), carcase);
    body.position.set(x, PLINTH_H + bodyH / 2, BASE_Z);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);

    /* The plinth: two courses, each standing proud of what is above
       it, and both proud on the ends and the front only — the back is
       against the wall side of the desk and a course there is weight
       the camera never sees. */
    const addPlinth = (h, out, y) => {
      const d = BASE_D + out;    // front only
      const m = new THREE.Mesh(
        track(new THREE.BoxGeometry(PED_W + 2 * out, h, d)), plinthMat);
      m.position.set(x, y + h / 2, BASE_Z + out / 2);
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    };
    addPlinth(PLINTH_LO_H, PLINTH_LO_OUT, 0);
    addPlinth(PLINTH_HI_H, PLINTH_HI_OUT, PLINTH_LO_H);

    /* The two pilasters, at the pedestal's own front corners. */
    const pilH = bodyH;
    for (const px of [-1, 1]) {
      const p = buildPilaster(pilH, carcase);
      p.position.set(
        x + px * (PED_W - PIL_W) / 2, PLINTH_H + pilH / 2, FRONT_Z);
      root.add(p);
    }

    const drawer = buildDrawerFront(FACE_W, DRW_H, drawerMat, mouldMat, brass);
    drawer.position.set(x, DRW_TOP - DRW_H / 2, FRONT_Z);
    root.add(drawer);

    const door = buildPanelDoor(
      FACE_W, DOOR_H, frameMat, panelMat, mouldMat, brass);
    door.position.set(x, DOOR_BOT + DOOR_H / 2, FRONT_Z);
    door.userData.knob.position.x = -sx * (FACE_W / 2 - 0.36);
    root.add(door);

    /* The inner wall of the knee hole. A plate on the carcase rather
       than a re-tinted face, so the box keeps one material and only
       the surface you look *into* goes dark. */
    const wall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.05, bodyH - 0.1, BASE_D - 0.6)), interior);
    wall.position.set(x - sx * (PED_W / 2 + 0.025), PLINTH_H + bodyH / 2, BASE_Z);
    wall.receiveShadow = true;
    root.add(wall);
  }

  /* --- The knee hole -------------------------------------
     It is a hole, and the floor under it is most of what says the desk
     stands on the ground. What closes it is the apron at the top and
     the modesty panel at the back; the pedestals' inner walls are
     already there and only wanted skinning, above. Its ceiling is the
     top's own underside plate, which already spans the whole footprint
     — a second plate here would be two coplanar boxes fighting for the
     same depth. */
  const apronH = 0.62;
  const apron = new THREE.Mesh(
    track(new THREE.BoxGeometry(KNEE_W, apronH, 0.42)),
    wood(KNEE_W, apronH, { tint: WALNUT, rot: ACROSS }));
  apron.position.set(0, UNDER_Y - apronH / 2, FRONT_Z - 0.21);
  apron.castShadow = true;
  apron.receiveShadow = true;
  root.add(apron);

  const modH = 4.7;
  const modesty = new THREE.Mesh(
    track(new THREE.BoxGeometry(KNEE_W, modH, 0.18)),
    wood(KNEE_W, modH, { tint: WALNUT_DARK, rough: 1.8, rot: ACROSS }));
  modesty.position.set(0, PLINTH_H + 0.9 + modH / 2, BACK_Z + 0.5);
  modesty.castShadow = true;
  modesty.receiveShadow = true;
  root.add(modesty);

  /* --- The writing slide ---------------------------------
     Left half out, as the reference has it. It is the one part of this
     desk that is *doing* something, and it is cheap: it breaks the
     front of the knee hole, which would otherwise be a flat rectangle
     of shadow between two cabinets, and it puts a lit horizontal edge
     at the only height between the plinth and the top where there is
     nothing else.

     Pale, because a pull-out slide is a secondary wood and because it
     has spent its life inside the desk. It is also the reason it reads
     at all against the knee hole behind it. */
  const SLIDE_OUT = 1.3;
  const slideW = KNEE_W - 1.2;
  const slideD = 4.0;
  const slideY = UNDER_Y - apronH - 0.22;
  const slideZ = FRONT_Z + SLIDE_OUT - slideD / 2;
  const slideMat = wood(slideW, slideD, {
    tint: WALNUT_LIGHT, rough: 1.5,
  });
  const slide = new THREE.Mesh(
    track(new THREE.BoxGeometry(slideW, 0.14, slideD)), slideMat);
  slide.position.set(0, slideY, slideZ);
  slide.castShadow = true;
  slide.receiveShadow = true;
  root.add(slide);

  const lip = new THREE.Mesh(
    track(new RoundedBoxGeometry(slideW, 0.3, 0.16, 3, 0.05)),
    wood(slideW, 0.3, { tint: WALNUT, rot: ACROSS }));
  lip.position.set(0, slideY - 0.04, FRONT_Z + SLIDE_OUT - 0.08);
  lip.castShadow = true;
  lip.receiveShadow = true;
  root.add(lip);

  /* --- Grounded ------------------------------------------
     Painted, for the reason classic.js paints its own: the shadow map
     is frozen at 2048² over the whole room, so one texel is ~0.08
     across and the line where a plinth meets the floor never lands on
     one. The plinth has no gap under it at all, which makes the
     contact *more* important here rather than less — a solid mass
     meeting the floor with no darkening at the joint is the single
     clearest tell that a thing has been drawn onto a picture. */
  const blob = contactShadow();
  const quad = track(new THREE.PlaneGeometry(1, 1));
  for (const sx of [-1, 1]) {
    const mat = track(new THREE.MeshBasicMaterial({
      map: blob, transparent: true, depthWrite: false, opacity: 0.9,
    }));
    const s = new THREE.Mesh(quad, mat);
    s.rotation.x = -Math.PI / 2;
    s.scale.set(PED_W + 2 * PLINTH_LO_OUT + 1.6, BASE_D + 1.6, 1);
    s.position.set(sx * PED_X, 0.014, BASE_Z + PLINTH_LO_OUT / 2);
    s.renderOrder = -1;
    root.add(s);
  }

  /* `ready` settles once the walnut has landed (or failed to), so the
     caller can draw one more frame on a path that has no loop — which
     is the reduced-motion path, and the whole reason the promise
     exists. See `desk.ready` in scene.js. */
  return { root, ready: Promise.all(woodPending) };
}

function contactShadow() {
  const s = 256;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.40, 'rgba(0,0,0,0.3)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return track(new THREE.CanvasTexture(c));
}

export function disposeDesk() {
  disposables.forEach((d) => d.dispose());
  disposables.length = 0;
  baseMaps = null;
  pendingClones = [];
}
