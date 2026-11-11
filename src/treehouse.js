import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/* ==========================================
   THE CHERRY BLOSSOM TREEHOUSE

   An original brick-built model standing on the desk to the right of
   the monitor, built entirely from primitives in code — boxes with
   round studs on top. Nothing here is anybody's artwork: no logos on
   the studs, no minifigures, no imported model. The *shapes* are the
   generic interlocking-brick vocabulary (a stud is a cylinder, a brick
   is a bevelled box), which is what makes the thing read as a brick
   build rather than as a tree.

   Local space matches the desk's and the computer's — +Z is the front —
   with the origin on the **desk top**, so scene.js only has to lift the
   group by DESK_TOP_Y. Everything is placed against y = 0 being the
   surface the base plate sits on.

   ---------------------------------------------------------------
   Scale, which is the one decision everything else hangs off.

   A desk unit here is a shade over two inches, so a true-scale brick
   would have a 0.15-unit stud pitch — and at the home framing the
   scene is ~26 units of frustum over ~900px, so a stud would land at
   five pixels and a 1x1 brick at five. The model would read as a
   speckled green blob. STUD is therefore 0.3: double scale, the big
   chunky bricks a child builds with, which at this camera gives a
   ~10px stud and a brick course you can actually count. The model is
   the size of the keyboard's footprint either way; what changes is how
   coarse the bricks in it are, and coarse is legible.
   ========================================== */

/* --- The brick system ------------------------------------ */
const STUD = 0.3;             // stud pitch — see above
const BH = STUD * 1.2;        // one brick course, at the usual 6:5 ratio
const PH = BH / 3;            // one plate: a third of a brick, as it should be
const STUD_R = STUD * 0.3;    // the stud itself
const STUD_H = STUD * 0.2;
/* Small moulding radii preserve flat faces. A separate assembly gap
   defines the seams without rounding thin canopy plates into pillows. */
const BEVEL = STUD * 0.045;
const BRICK_GAP = STUD * 0.035;

/* Moulded ABS catches the light; sprayed enamel and aged plastic do
   not. The two numbers that make the model read as a toy standing on
   the furniture rather than as more furniture:

   - **GLOSS multiplies every roughness the kit is asked for**, rather
     than each call site being retuned. The relative spread stays —
     bark duller than petal, grass between them — and the whole model
     moves together. 0.78 takes the kit's 0.42 default to 0.33:
     a readable plastic sheen without tiny shimmering highlights.
   - **BRICK_ENV is above the furniture's 0.34.** The studio HDRI is
     ambient from every direction, so on a matt surface it only
     flattens; on a glossy one it is what puts a sheen on the faces the
     key never reaches, which is most of the underside of a canopy. */
const GLOSS = 0.78;
const BRICK_ENV = 0.55;

/* --- Palette ---------------------------------------------
   Moulded ABS, not sprayed enamel: glossier than the desk and the
   computer, which is most of what separates a toy standing on the desk
   from the furniture it stands on. */
const GRASS = 0x5c9a42;
const GRASS_DARK = 0x3f7330;    // the rim course under the lawn
const BARK = 0x6e4a2e;
const BARK_DARK = 0x54371f;     // the shaded side of the trunk, and the knuckles
/* The house. Plank walls in two tans a shade apart, laid course about:
   a brick course *is* a plank course at this scale, and one flat tan
   over three courses reads as a painted box rather than as boards. */
const PLANK = 0xdcc096;
const PLANK_ALT = 0xcfae82;
const PLANK_DARK = 0x9c7a52;    // the deck boards, the door, the railing
const TRIM = 0xf0e6d4;          // the round window's frame
const GLASS = 0xa9cfdd;
const SHINGLE = 0x3d444c;       // the roof
const SHINGLE_RIDGE = 0x2e343b; // its cap, a shade down
/* The blossom, after `design-references/cherryblossom.png`. The
   proportions matter more than the hues: that tree reads **white**
   from across the room, with pale pink under it and a scatter of hot
   coral through it — and it is the coral that stops the white reading
   as snow. The old palette was three pinks and a rose, which read as
   one pink mass however it was graded.

   White and pale carry about three quarters of the flowers between
   them; see tintFor for how the four are drawn. */
const PETAL_WHITE = 0xf8f4f0;
const PETAL_PALE = 0xfadfe7;    // barely pink; the second dominant
const PETAL_PINK = 0xf3aec3;    // the mid pink, now a minority
const PETAL_CORAL = 0xee7f5e;   // the accent, scattered through
const ROPE = 0xcbab80;          // the ladder and the swing
/* The pip. It was a strong yellow, and against three pinks that was
   fine; against a mostly-white canopy a few hundred saturated yellow
   dots read as a field of daisies rather than as blossom. Softened to
   a warm cream and shrunk — see FLOWER_PIP_R. */
const BLOSSOM_EYE = 0xf6e0b4;   // the pip at the centre of a flower

/* --- Proportions ----------------------------------------
   The base is a round plate a little narrower than the keyboard is
   deep, so the whole model sits inside the keyboard's footprint.

   The model has now been taken down three times, and **the way it is
   taken down is the point every time**: STUD does not move. Shrinking
   the pitch would shrink the bricks, which is the one thing this model
   cannot afford — at 0.24 a stud is back under eight pixels and the
   build stops reading as a build. So every figure that is a *count*
   of bricks comes down instead, and the reaches scale with them.

   The second pass was sized against the monitor rather than against
   the desk: the machine stands 6.60 units above the desk top, the
   model used to reach 6.25 of that — level with it, which read as a
   second object competing with the thing a visitor is meant to press.

   The third is a flat 15% off the whole model. Only two counts were
   coarse enough to carry it — the trunk went four courses to three and
   the house five studs square to four, which between them put the
   ridge at 0.852 of where it was — and everything continuous was then
   multiplied by 0.85: this block, the deck, the eave, the roof's
   thickness and overhang, every control point in LIMB_PLAN, every lobe
   radius, the canopy's heart and floors, the swing's drop, the ladder.
   The measured top is 3.95 above the desk, against 4.75.

   BASE_R is still set by the deck rather than chosen: the deck's
   front-left corner lands 1.318 from the centre, so 1.34 is the floor.
   It is only 11% down where the rest is 15%, and that is the one place
   the shrink could not be uniform — the porch has to stay two studs
   deep for the ladder to have anything to hang off. */
const BASE_R = 1.34;
const BASE_H = PH * 1.19;        // a round base plate, a little proud of a plate
const RIM_H = PH * 0.68;         // the darker course it stands on

/* The trunk is a **curve now, not a stack of courses**, and that is
   the change the whole rebuild hangs off. It was three bonded courses
   with a yaw per course — which can lean, and can twist, but cannot
   bend back: a stack of axis-aligned footprints has no way to make the
   S in `design-references/cherryblossom.png`, where the trunk goes out
   one way low down, crosses back through its own axis and leans the
   other way under the crown.

   So the spine is a Catmull-Rom through five points and the bricks are
   stepped along it the way a branch's are, each turned so its own up
   axis runs along the trunk. The taper is in the footprints
   (TRUNK_SIZES), not in a scale, because a scaled brick is not a
   brick.

   TRUNK_TOP_Y is 2.10 and it is the figure the whole model is laid out
   against: the tree tops out at 3.73 above the lawn, so a fork there
   leaves the trunk **exposed for the lower half** and the canopy the
   upper. The house hangs on the exposed part below it (HOUSE_T), which
   is what the reference's two bare lower branches leave room for. */
const TRUNK_TOP_Y = 2.35;
const TRUNK_SPINE = [
  [0.00, 0.00, 0.00],
  [-0.16, 0.34, 0.06],
  [-0.46, 0.84, 0.14],
  [-0.06, 1.40, -0.10],
  [0.26, 1.92, -0.52],
  [0.10, TRUNK_TOP_Y, -0.68],
];
/* Footprints along it, root to fork, and the parameter each band ends
   at. Three studs through at the root against two at the fork: the
   reference's trunk is thick and barely tapers, and a trunk that
   narrows to one stud reads as a stick with a tree on top. */
const TRUNK_SIZES = [[4, 4], [3, 3], [3, 2], [2, 2]];
const TRUNK_BANDS = [0.08, 0.30, 0.66];

/* --- The house ------------------------------------------
   Four studs square, which is as small as it can be and still hold a
   two-stud door with a wall either side of it — the five-stud version
   this came down from had two studs on one side and one on the other,
   which is what put the door, and so the rail's gap and the ladder,
   off the centre line. At four they are all on it. The ridge runs along Z,
   so the roof slopes down to the two flanks and the **gable faces the
   front** — the triangle over the door, which is the whole silhouette
   of a treehouse.

   ROOF_RISE being exactly BH is not a rounding. A stepped brick roof
   and the stepped gable under it have to meet, and they only meet if
   one course of rise lands on one stud of run: at the 0.75 x BH the
   first version used, every gable course poked a tenth of a unit
   through the slope above it. One brick per stud also happens to be a
   50-degree pitch, which is the steep roof the brief asks for. */
const HOUSE_W = 3;              // studs along X
const HOUSE_D = 3;              // studs along Z
const WALL_COURSES = 2;
const DOOR_COURSES = 2;         // how far up the doorway reaches
const WINDOW_COURSE = 1;        // which course the round window sits on
const DECK_H = PH * 1.2;
/* Where the house hangs on the trunk: HOUSE_T is a parameter along the
   spine and DECK_Y the height its deck sits at, both on the exposed
   lower half and both between the two low branches. Module scope
   because the rope ladder has to start exactly where the porch ends,
   and because the canopy's keep-out is written against the same
   point. */
const HOUSE_T = 0.52;
const DECK_Y = 0.80;
const DECK_TOP = DECK_Y + DECK_H;
/* The roof's rise per unit of half-span — 0.75 is a 37-degree pitch —
   its overhang past the wall, and how deep it runs along the ridge.
   The last two came down together after the first slope roof: at 1.15
   over a 0.9 half-span and seven studs deep, the slope face seen from
   the flank was larger than the wall under it and the model read as a
   roof with a house for a plinth. ROOF_THICK is the slope brick's own
   depth.

   **The pitch came down from 1.1 to make room for the crown**, and it
   is the one place the height was available. The walls cannot lose a
   course — the doorway wants two and the round window wants the third
   around it, which is what keeps a 0.30-radius frame off the deck and
   out of the eave — and the house cannot lose a stud of plan without
   rewriting every bonded course for nothing: at four studs square the
   roof is 0.09 shorter and the walls, which are most of the height,
   are exactly as tall. 0.75 is still a gable you read as a gable from
   the flank, and it spends 0.26 of the 4.40 on blossom instead. */
const ROOF_PITCH = 0.62;
const ROOF_OVER = 0.30;         // studs of eave past the wall face
const ROOF_DEPTH = HOUSE_D + 1; // studs along the ridge
const ROOF_THICK = PH * 1.2;
const PORCH_D = 1;              // studs of deck standing out past the front wall
/* The stud index of the deck's front face: the house's own half-depth
   plus the porch. The rail and the ladder both hang off it. */
const DECK_FRONT = HOUSE_D / 2 + PORCH_D;
const RAIL_COURSES = 1;         // posts, in courses

/* --- The house's heights, in the lawn's frame -----------
   Hoisted out of buildHouse because the canopy needs them, and needs
   them as more than a bounding box: a blossom may lie *on* the roof
   but not inside it, which is a question about the slope's height at
   a given x. buildHouse adds lawnY and lays the slope against exactly
   these, so there is one set of numbers rather than two that have to
   be kept agreeing. */
/* The stud index of a wall's own centre line: a wall brick is one stud
   thick, so its line sits half a stud inside the face. Written as a
   derivation because the house lost a stud in each direction when the
   model came down 15% — every figure that used to be a literal 2 is
   this. */
const WALL_X = HOUSE_W / 2 - 0.5;
const WALL_Z = HOUSE_D / 2 - 0.5;
const WALL_Y = DECK_TOP;                       // the wall's bottom course
const EAVE_Y = WALL_Y + WALL_COURSES * BH;     // where the eave plate lands
const ROOF_BASE_Y = EAVE_Y + PH;               // the slope's own base
const EAVE_X = (HOUSE_W / 2 + ROOF_OVER) * STUD;
const ROOF_RISE = EAVE_X * ROOF_PITCH;
const ROOF_ANG = Math.atan2(ROOF_RISE, EAVE_X);
const APEX_Y = ROOF_BASE_Y + ROOF_RISE + ROOF_THICK / Math.cos(ROOF_ANG);

const disposables = [];
function track(...xs) { disposables.push(...xs); return xs[0]; }

/* Deterministic, and that is not a detail: the flowers, the chips of
   bark and later the petals are scattered, and a model that reshuffles
   itself on every reload cannot be compared between two screenshots.
   Mulberry32 — four lines, no dependency. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ==========================================
   THE KIT

   Every piece in the model goes through here, and nothing is added to
   the scene until `bake`. The point is that repeated pieces end up in
   one InstancedMesh each: the studs alone number in the hundreds, and
   a Mesh apiece would put more draw calls on the desk than the rest of
   the scene has objects.

   A batch is keyed by shape *and* colour, so the key is what decides
   how much is shared. Two things fall out of that and are worth
   knowing:

   - **Footprints are canonicalised.** A 4x2 brick and a 2x4 brick are
     one geometry and a right angle, so `brick` swaps the two and adds
     90 degrees of yaw rather than building both. Position is given as
     the centre of the footprint, which is what makes that safe.
   - **Studs are not part of a brick.** They are placed separately, in
     the brick's frame, so every stud in the model of a given colour is
     one instanced cylinder regardless of what it sits on.
   ========================================== */
const UNIT = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

function brickGeometry(w, h, d) {
  return new RoundedBoxGeometry(
    w - BRICK_GAP, h - BRICK_GAP, d - BRICK_GAP, 1, BEVEL);
}

/* A flat-topped stud with a small moulded rim, rather than a sharp
   low-sided cylinder. Shared by every instance, including spare bricks. */
function studGeometry() {
  const r = STUD_R, half = STUD_H / 2, lip = STUD * 0.018;
  return new THREE.LatheGeometry([
    new THREE.Vector2(0, -half),
    new THREE.Vector2(r, -half),
    new THREE.Vector2(r, half - lip),
    new THREE.Vector2(r - lip, half),
    new THREE.Vector2(0, half),
  ], 12);
}

/* Subtle baked cavity shading on each moulded part. It follows the
   piece's local normals, so undersides and sidewalls stay distinct on
   phones too, where the expensive screen-space AO pass is disabled. */
function shadePiece(geometry) {
  const normals = geometry.getAttribute('normal');
  const colours = new Float32Array(normals.count * 3);
  for (let i = 0; i < normals.count; i++) {
    const y = normals.getY(i);
    const light = y >= 0 ? 0.86 + y * 0.14 : 0.86 + y * 0.12;
    colours.fill(light, i * 3, i * 3 + 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  return geometry;
}

function createKit() {
  const batches = new Map();
  const mats = new Map();

  /* One material per colour, made on demand. Roughness is the ABS
     sheen; envMapIntensity matches the desk and the computer so the
     model is lit by the same room they are. */
  function mat(colour, roughness = 0.42) {
    const key = `${colour}:${roughness}`;
    let m = mats.get(key);
    if (!m) {
      m = track(new THREE.MeshStandardMaterial({
        color: colour, roughness: Math.max(0.1, roughness * GLOSS),
        metalness: 0, envMapIntensity: BRICK_ENV, vertexColors: true,
      }));
      m.userData.key = key;
      mats.set(key, m);
    }
    return m;
  }

  function put(key, make, material, matrix) {
    let b = batches.get(key);
    if (!b) batches.set(key, (b = { make, material, xf: [] }));
    b.xf.push(matrix);
  }

  function compose(x, y, z, quat) {
    return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), quat, UNIT);
  }

  const yawQ = (ry) => new THREE.Quaternion().setFromAxisAngle(UP, ry);

  const kit = {
    mat,
    put,
    compose,

    /* A brick. (x, z) is the centre of its footprint and **y is its
       bottom**, because that is how a brick is put down: on top of
       whatever is already there. w x d is the footprint in studs, h is
       the height in world units — BH for a brick, PH for a plate. */
    brick(material, w, d, x, y, z, { ry = 0, h = BH, studs = true } = {}) {
      let bw = w, bd = d, yaw = ry;
      if (bw > bd) { bw = d; bd = w; yaw += Math.PI / 2; }
      put(`box|${bw}x${bd}x${h.toFixed(3)}|${material.userData.key}`,
        () => brickGeometry(bw * STUD, h, bd * STUD),
        material, compose(x, y + h / 2, z, yawQ(yaw)));
      if (studs) kit.studGrid(material, w, d, x, y + h, z, ry);
    },

    /* The studs on top of a w x d footprint, in that footprint's frame.
       y is the brick's top surface. */
    studGrid(material, w, d, x, y, z, ry = 0) {
      const c = Math.cos(ry), s = Math.sin(ry);
      for (let i = 0; i < w; i++) {
        for (let j = 0; j < d; j++) {
          const lx = (i - (w - 1) / 2) * STUD;
          const lz = (j - (d - 1) / 2) * STUD;
          kit.stud(material, x + lx * c + lz * s, y, z - lx * s + lz * c);
        }
      }
    },

    stud(material, x, y, z) {
      put(`stud|${material.userData.key}`,
        studGeometry,
        material, compose(x, y + STUD_H / 2, z, new THREE.Quaternion()));
    },

    /* A piece whose orientation is not a yaw — a branch segment lying
       along its curve, a roof slope. `make` is called once per batch. */
    piece(key, make, material, pos, quat) {
      put(key, make, material, new THREE.Matrix4().compose(pos, quat, UNIT));
    },

    bake(parent) {
      for (const b of batches.values()) {
        const geo = track(shadePiece(b.make()));
        let mesh;
        if (b.xf.length === 1) {
          mesh = new THREE.Mesh(geo, b.material);
          mesh.applyMatrix4(b.xf[0]);
        } else {
          mesh = new THREE.InstancedMesh(geo, b.material, b.xf.length);
          b.xf.forEach((m, i) => mesh.setMatrixAt(i, m));
          mesh.instanceMatrix.needsUpdate = true;
        }
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
      }
      batches.clear();
    },
  };
  return kit;
}

/* ==========================================
   THE FLOWER PIECE

   The one piece in the model that is not a box or a cylinder: the
   little five-petal round plate that the blossoms, and the flowers in
   the lawn, are both made of. Five petal discs around a hub and a pip
   in the middle, merged into one geometry so a canopy of hundreds is
   still one draw call per colour.

   It is built at 1.6 studs across rather than 1 — at one stud a petal
   would be 0.045 units, which is under a pixel at the home framing.
   The segment counts are low on purpose: at the home framing a
   blossom covers about fifteen pixels, and the canopy instances this
   several hundred times.
   ========================================== */
function flowerGeometry() {
  const parts = [];
  const hubR = STUD * 0.3;
  const petalR = STUD * 0.29;
  const ring = STUD * 0.44;
  const h = PH * 0.62;

  const hub = new THREE.CylinderGeometry(hubR, hubR * 0.92, h, 10);
  parts.push(hub);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.CylinderGeometry(petalR, petalR * 0.86, h * 0.86, 8);
    // A shallow cup catches a rim highlight and exposes the petal's side.
    p.rotateZ(0.16);
    p.rotateY(-a);
    p.translate(Math.cos(a) * ring, -h * 0.07, Math.sin(a) * ring);
    parts.push(p);
  }

  /* The pip, which is what makes it read as a flower rather than as a
     cog: a contrasting centre standing proud of the petals. It is a
     separate batch because it is a different colour, so this geometry
     carries only the dish. */
  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.translate(0, h / 2, 0);
  return merged;
}

const FLOWER_TOP = PH * 0.62;             // where the pip sits
const FLOWER_PIP_R = STUD * 0.125;

/* One flower. **Scale is carried in the instance matrix, not in the
   batch key** — the geometry of a big blossom and a small one is the
   same geometry — so the canopy's several hundred flowers come out as
   one draw call per colour however much they vary in size. */
function flower(kit, petalColour, pos, quat, scale = 1) {
  const petal = kit.mat(petalColour, 0.38);
  const s3 = new THREE.Vector3(scale, scale, scale);
  kit.put(`flower|${petal.userData.key}`, flowerGeometry, petal,
    new THREE.Matrix4().compose(pos, quat, s3));

  /* The pip sits on the flower's own axis, so it rides the same
     rotation rather than being stacked in world Y. */
  const eye = kit.mat(BLOSSOM_EYE, 0.34);
  const up = new THREE.Vector3(0, (FLOWER_TOP + PH * 0.25) * scale, 0)
    .applyQuaternion(quat);
  kit.put(`pip|${eye.userData.key}`,
    () => new THREE.CylinderGeometry(FLOWER_PIP_R, FLOWER_PIP_R, PH * 0.5, 8),
    eye, new THREE.Matrix4().compose(pos.clone().add(up), quat, s3));
}

/* The gable, in plates from the eave up: each row is the widest stud
   count whose outer corner still clears the slope overhead at that
   row's top. Derived rather than written down, because it is a
   statement about the roof — change the pitch or the overhang and a
   hand-kept list silently starts poking through the slope.

   Plates, not bricks. A plate is a third of a course, so the stack
   follows a 48-degree underside to within its own thickness; the
   brick-high version of the same triangle manages two steps over five
   studs and leaves wedges of daylight into the house. */
function gableRows(rise, eaveX) {
  const rows = [];
  for (let r = 0; ; r++) {
    const clear = eaveX * (1 - ((r + 1) * PH) / rise);
    const w = Math.min(HOUSE_W, Math.floor((clear / STUD) * 2));
    if (w < 1) return rows;
    rows.push(w);
  }
}

/* ==========================================
   THE BASE

   A round grassy base plate: one green disc with the studs on it laid
   out on the square grid and clipped to the circle — which is exactly
   what a round baseplate is — standing on a slightly smaller, darker
   course so the lawn has an edge rather than a cut line.
   ========================================== */
function buildBase(kit) {
  const grass = kit.mat(GRASS, 0.46);
  const rim = kit.mat(GRASS_DARK, 0.5);

  kit.piece('base|plate', () => new THREE.CylinderGeometry(BASE_R, BASE_R, BASE_H, 64),
    grass, new THREE.Vector3(0, RIM_H + BASE_H / 2, 0), new THREE.Quaternion());
  kit.piece('base|rim',
    () => new THREE.CylinderGeometry(BASE_R - STUD * 0.16, BASE_R - STUD * 0.3, RIM_H, 64),
    rim, new THREE.Vector3(0, RIM_H / 2, 0), new THREE.Quaternion());

  /* Studs on the square grid, kept a stud's shoulder inside the rim so
     none of them overhangs the edge. */
  const top = RIM_H + BASE_H;
  const limit = BASE_R - STUD * 0.75;
  const n = Math.floor(BASE_R / STUD);
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const x = (i + 0.5) * STUD, z = (j + 0.5) * STUD;
      if (Math.hypot(x, z) > limit) continue;
      kit.stud(grass, x, top, z);
    }
  }
  return top;
}

/* A few tiny flowers in the lawn — the same five-petal piece the
   blossoms use, at lawn scale, clear of the trunk's footprint. */
function buildLawnFlowers(kit, top) {
  const r = rng(0x5eed10);
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.61 + r() * 0.48;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    flower(kit, r() < 0.45 ? PETAL_PALE : PETAL_WHITE,
      new THREE.Vector3(x, top, z),
      new THREE.Quaternion().setFromAxisAngle(UP, r() * Math.PI * 2), 0.78);
  }
}

/* ==========================================
   THE TRUNK

   A thick S-curved trunk on a flared root base, after
   `design-references/cherryblossom.png`. Bricks are stepped along the
   spine the way a branch's are — each turned so its own up axis runs
   along the curve — which is what lets the trunk bend back on itself.
   The stacked-course version this replaced could lean and twist but
   never cross its own axis, and the S is the whole character of the
   reference.

   Three things here are less obvious than they look:

   - **The twist per piece is doing the work the bond used to do.**
     Stacked courses got their knuckles from alternating the long axis;
     a swept trunk gets them from rolling each piece a little further
     round, so the corners stagger down the silhouette instead of
     lining up into four long edges.
   - **The overlap is tighter than a branch's.** A branch wants its
     pieces to close up round a bend, so it runs 1.26 of the step; the
     trunk wants the course lines to read, so it runs 1.14.
   - **The roots are short branches, not a plinth.** The reference's
     base is a splay of separate roots with lawn visible between them,
     which a cone or a stack of widening plates cannot give. Five of
     them leave the trunk's foot and dive to the plate at their own
     angles and reaches.
   ========================================== */
const TRUNK_CURVE = new THREE.CatmullRomCurve3(
  TRUNK_SPINE.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);

/* A point on the spine, in the lawn's frame. The house, the low
   branches and every limb of the canopy are placed off this rather
   than off remembered coordinates, so re-shaping the S carries all
   three with it. */
function trunkPoint(t) {
  return TRUNK_CURVE.getPoint(t);
}

/* The roots: angle round the foot, where on the spine each leaves, and
   how far out it reaches. Deliberately uneven — five roots at one
   radius is a stool, not a root ball.

   **They have to leave the trunk part way UP it, not at the lawn.** The
   first version started them all at t≈0.02 and ran them outward along
   the ground, which is a ring of planks lying on the grass rather than
   a flare: what makes a root ball read is wood coming *down* out of
   the trunk and meeting the plate, so each one leaves between 0.25 and
   0.40 up and dives from there. The flare itself is the trunk's own
   bottom piece, a 4x4 against the 2x2 at the fork; the roots break its
   outline up. */
const ROOT_PLAN = [
  { a: 0.42, t: 0.26, reach: 0.72 },
  { a: 1.62, t: 0.20, reach: 0.58 },
  { a: 2.74, t: 0.27, reach: 0.68 },
  { a: 3.86, t: 0.19, reach: 0.54 },
  { a: 5.16, t: 0.29, reach: 0.76 },
];
const ROOT_SIZES = [[1, 2], [1, 1], [1, 1]];

/* The two low branches, out one side each, bare — they carry a small
   blossom cluster apiece and the house sits between them. `t` is where
   on the spine each leaves. The -X one is lower and dips at its tip,
   the +X one leaves higher and lifts: in the reference the two are
   nothing like a mirrored pair, and a pair that matched would read as
   a crossbar through the trunk. */
const LOW_PLAN = [
  { t: 0.30, ctrl: [-0.84, 1.00, 0.28], to: [-1.26, 0.84, 0.38] },
  { t: 0.54, ctrl: [0.58, 1.40, -0.14], to: [1.14, 1.50, -0.30] },
];
const LOW_SIZES = [[2, 2], [1, 2], [1, 1]];

/* Each low branch's curve, lifted onto the lawn. The start comes off
   the spine rather than being written down, for the same reason a
   canopy limb's does: re-shaping the S must carry the branch, the
   swing hanging off it and the cluster on its tip. */
export function lowBranchCurve(i, lawnY) {
  const L = LOW_PLAN[i];
  const lift = new THREE.Vector3(0, lawnY, 0);
  return new THREE.QuadraticBezierCurve3(
    trunkPoint(L.t).add(lift),
    new THREE.Vector3(...L.ctrl).add(lift),
    new THREE.Vector3(...L.to).add(lift));
}

function buildTrunk(kit, floorY) {
  const bark = kit.mat(BARK, 0.56);
  const barkDark = kit.mat(BARK_DARK, 0.6);
  const lift = new THREE.Vector3(0, floorY, 0);

  /* The roots first, so the trunk's own bottom pieces sit over where
     they meet it rather than under. */
  ROOT_PLAN.forEach((R, i) => {
    const c = Math.cos(R.a), s = Math.sin(R.a);
    const from = trunkPoint(R.t);
    const curve = new THREE.QuadraticBezierCurve3(
      from.clone().add(lift),
      new THREE.Vector3(c * R.reach * 0.34, floorY + from.y * 0.50, s * R.reach * 0.34),
      new THREE.Vector3(c * R.reach, floorY + PH * 0.5, s * R.reach));
    buildBranch(kit, i % 2 ? barkDark : bark, curve,
      { spin: i * 1.1, sizes: ROOT_SIZES, step: BH * 0.52, tipStud: false });
  });

  /* The spine. Studs only on the last piece — everywhere else the next
     one is sitting on them, and a stud buried in a brick is geometry
     nobody will ever see. */
  const spine = new THREE.CatmullRomCurve3(
    TRUNK_SPINE.map((p) => new THREE.Vector3(...p).add(lift)), false, 'catmullrom', 0.5);
  buildBranch(kit, bark, spine, {
    sizes: TRUNK_SIZES, bands: TRUNK_BANDS, step: BH * 0.8,
    overlap: 1.14, twist: 0.17, shade: barkDark,
  });

  LOW_PLAN.forEach((_, i) => {
    buildBranch(kit, i ? bark : barkDark, lowBranchCurve(i, floorY),
      { spin: 0.6 + i * 1.4, sizes: LOW_SIZES, step: BH * 0.82 });
  });

  return floorY + TRUNK_TOP_Y;
}

/* ==========================================
   THE BRANCHES

   Each limb is a quadratic curve with bricks stepped along it, one per
   course-height of arc, each turned so its own up-axis runs along the
   limb — which is how a brick branch is built, stacked end to end
   rather than side by side. The pieces overlap slightly so a bend has
   no gap in it, and they step down through three thicknesses, so the
   whole tree's worth of wood is a handful of geometries.

   The last piece of each limb gets a stud: that is where the blossom
   clips on, and it is the one place on a branch where a stud points
   somewhere you can see it.

   ---------------------------------------------------------------
   The structure, which is the thing that changed.

   It used to be four boughs leaving the fork at the same height, bowing
   out by the same amount and climbing to tips within 0.3 of one height,
   plus one twig continuing each. Four of anything that similar is not a
   tree: it is a candelabra, and the canopy hung on it came out as one
   smooth shell because the points it was hung from were themselves
   spread evenly round a sphere.

   What is here instead is a **fork tree**: six limbs off the trunk at
   six different heights and angles (five that carry the tree and the
   low one the swing hangs from), each forking again into two or three
   at *its* own angles and lengths, and five twigs off those. No two
   reaches are the same, nothing is a mirror of anything, and the
   generations taper — a gen-0 limb is two studs through, a twig is one.
   `LIMB_PLAN` is that table, and the whole canopy is hung off the tips
   it produces (see THE CANOPY), so the silhouette is a consequence of
   the branching rather than something drawn over it.

   Reading the table:

   - `p` is the parent's index, or -1 for a limb off the trunk itself;
     `at` is where along the parent it leaves (1 = the parent's tip, so
     two children with `at: 1` are a genuine fork). A child's start is
     *derived* from its parent, so re-aiming a limb carries everything
     hanging off it — the same reason `limbCurve` is the single source
     for the swing.
   - `lobe` is the clump of blossom that sits at the tip, and `r` is its
     radius; limbs with no `lobe` carry nothing of their own (the trunk
     limbs' blossom hangs off their children). `floor` overrides how low
     that clump may hang, and `edge` marks the loose, sparse clumps out
     on the twigs.

   Three properties of the table are load-bearing, and a change that
   breaks one of them will not look like what it is:

   - **The four trunk limbs are paired to the flanks, not splayed round
     the compass.** A limb through the front wall or the back wall, with
     no notch cut for it, reads as a mistake. +/-X leaves the door, the
     porch and the ladder clear, which is also what keeps them legible
     from the home view.
   - **|x| never decreases along a limb or through a fork**, except on
     the back leader, which has no x to speak of. Bowing out and coming
     back is what drew a closed egg round the house in the first
     version: branches that meet over the ridge read as a frame with a
     house inside it rather than as a tree with a house in its fork.
   - **The reach is lopsided on purpose, and the direction is not
     arbitrary.** At this camera screen-x runs roughly 0.8x - 0.6z in
     the model's own frame, so +x and -z both go screen *right* — and
     -z costs nothing, because world x (the desk's near edge, the figure
     `_canopyfit.mjs` watches) barely moves with it. So the long side is
     the back-right one: C1, C2 and the twig off C1 land at sx 2.4 to
     3.0, where the furthest thing on the left stops at -2.0. That buys
     an asymmetric crown *and* a better margin to the desk edge than
     the symmetric version had, and it keeps the growth away from the
     monitor, which is off to screen left.

   The back leader `K` is the one limb that is not about silhouette. The
   house stands on the trunk's top, so nothing can continue straight up
   through it; K leaves the trunk below the deck, sweeps back clear of
   the deck's rear edge (z -0.67) and the roof's (z -0.81), and tops out
   just over the ridge. It is what carries the crown over the house from
   behind, which is the only way to have blossom above the roof without
   a twig hooking back inward over it.
   ========================================== */
const BRANCH_SIZES = [[2, 2], [1, 2], [1, 1]];
const LIMB_SIZES = [[1, 2], [1, 1], [1, 1]];
const TWIG_SIZES = [[1, 1], [1, 1], [1, 1]];
const GEN_SIZES = [BRANCH_SIZES, LIMB_SIZES, TWIG_SIZES];

/* Which footprint a piece at parameter t gets. The thresholds are an
   option because the trunk's three bands are not a branch's: a branch
   is nearly all its middle thickness, a trunk holds its root size for
   a third of its length. */
const BRANCH_BANDS = [0.18, 0.68];
function sizeAt(sizes, bands, t) {
  for (let i = 0; i < bands.length; i++) if (t < bands[i]) return sizes[i];
  return sizes[sizes.length - 1];
}

/* Steps bricks along `curve`, each turned so its own up axis runs
   along the tangent — which is how a brick branch is built, stacked
   end to end rather than side by side, and is also the only way to
   build a trunk that bends back on itself.

   `overlap` is the piece height as a multiple of the step, and both
   figures came down when the orientation was quantised: a smooth tube
   needed 1.3 to keep its bends from opening up, where a stepped one
   breaks in 18-degree jumps and only has to cover the wedge that
   leaves — 1.26 on a branch, 1.14 on the trunk. Less overlap is the
   point rather than a saving: the less one piece buries the next, the
   more of the seam between them the bevel has to draw. `shade`
   alternates a second colour down the run, which is what keeps a long
   trunk from reading as a painted post. */
/* **A brick-built limb cannot point a brick anywhere it likes.** The
   first version turned each piece to the exact tangent, which draws a
   perfectly smooth tube out of boxes: correct as geometry and wrong as
   a model, because the one thing a build does that a sculpt does not
   is *step*. So the tilt and the roll are both quantised — a run of
   pieces shares an angle, then visibly breaks to the next one, which
   is what a builder gets out of a bag of hinge plates.

   The two steps are different sizes on purpose. The tilt is the
   coarser of the two (18 degrees) because it is the one the silhouette
   shows; the roll is 22.5, which is a little over three of `twist`, so
   the corners stagger down a trunk in threes instead of spiralling. */
const TILT_STEP = Math.PI / 10;   // 18 degrees of lean per step
const ROLL_STEP = Math.PI / 8;    // 22.5 degrees of turn per step
const snap = (v, q) => Math.round(v / q) * q;

function steppedQuat(tan, roll) {
  /* Polar off UP and azimuth round it, both snapped, then rebuilt —
     quantising a quaternion's own components would not keep it a
     rotation. */
  const p = snap(Math.acos(THREE.MathUtils.clamp(tan.y, -1, 1)), TILT_STEP);
  const a = snap(Math.atan2(tan.z, tan.x), ROLL_STEP);
  const d = new THREE.Vector3(
    Math.sin(p) * Math.cos(a), Math.cos(p), Math.sin(p) * Math.sin(a));
  return new THREE.Quaternion().setFromUnitVectors(UP, d)
    .multiply(new THREE.Quaternion().setFromAxisAngle(UP, snap(roll, ROLL_STEP)));
}

function buildBranch(kit, material, curve, {
  spin = 0, sizes = BRANCH_SIZES, bands = BRANCH_BANDS,
  step = BH * 0.92, overlap = 1.26, twist = 0.12, tipStud = true, shade = null,
} = {}) {
  const len = curve.getLength();
  const n = Math.max(2, Math.round(len / step));
  const h = step * overlap;
  const tan = new THREE.Vector3();
  const q = new THREE.Quaternion();
  let tip = curve.getPoint(1), tipQ = q.clone(), tipMat = material;

  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = curve.getPoint(t);
    curve.getTangent(t, tan).normalize();
    /* Snapped, not aimed — see steppedQuat. The roll is still a slow
       twist down the run, it is just taken in whole steps. */
    q.copy(steppedQuat(tan, spin + i * twist));

    const m = shade && i % 3 === 1 ? shade : material;
    const [w, d] = sizeAt(sizes, bands, t);
    kit.piece(`branch|${w}x${d}|${m.userData.key}`,
      () => brickGeometry(w * STUD, h, d * STUD),
      m, p, q.clone());
    if (i === n - 1) { tip = p; tipQ = q.clone(); tipMat = m; }
  }

  if (!tipStud) return curve.getPoint(1);

  /* The stud on the end, pointing along the branch. */
  const o = tip.clone().add(new THREE.Vector3(0, h / 2, 0).applyQuaternion(tipQ));
  kit.put(`tipstud|${tipMat.userData.key}`,
    studGeometry,
    tipMat, new THREE.Matrix4().compose(
      o.add(new THREE.Vector3(0, STUD_H / 2, 0).applyQuaternion(tipQ)),
      tipQ, UNIT));
  return curve.getPoint(1);
}

/* The tree, in the lawn's frame. Indices are referred to by `p`, so the
   order matters; the comment on each row is the name used in the notes
   above and in the canopy below. */
const LIMB_PLAN = [
  /* --- the five leaders off the trunk -------------------
     Every one of these is more reach than rise. That is the whole
     difference between this crown and the one it replaced: a leader
     that climbs carries a ball, a leader that runs out carries a
     cloud. --- */
  // 0  W — west. The short side: it stops at -1.44 where the back
  //        side runs to -2.54 in z.
  { p: -1, tt: 0.86, ctrl: [-0.38, 2.46, 0.10], to: [-0.80, 2.58, 0.26] },
  // 1  N — back, and the leader of the long side.
  { p: -1, tt: 0.96, ctrl: [0.34, 2.54, -1.02], to: [0.58, 2.66, -1.40] },
  // 2  E — east.
  { p: -1, tt: 1.00, ctrl: [0.66, 2.56, -0.44], to: [1.02, 2.68, -0.52] },
  // 3  S — front, out over the porch.
  { p: -1, tt: 0.90, ctrl: [0.18, 2.48, 0.38], to: [0.28, 2.60, 0.74] },
  // 4  C — the crown's own stem: the one limb that goes up rather
  //        than out, and all it carries is the middle of the cloud.
  { p: -1, tt: 1.00, ctrl: [0.14, 2.62, -0.62], to: [0.20, 2.86, -0.54], lobe: { r: 0.40, inner: true } },

  /* --- second generation, which is where the width comes from --- */
  // 5  W1 — the west shoulder.
  { p: 0, ctrl: [-1.10, 2.74, 0.22], to: [-1.32, 2.82, 0.12], lobe: { r: 0.38 } },
  // 6  W2 — **the droop**: out, forward and down, below where it
  //        started. The low end of the asymmetry.
  { p: 0, at: 0.76, ctrl: [-1.00, 2.42, 0.56], to: [-1.18, 2.22, 0.76], lobe: { r: 0.33, floor: 1.98, edge: true } },
  // 7  W3 — short, turning back in over the house.
  { p: 0, at: 0.58, ctrl: [-0.58, 2.78, -0.28], to: [-0.66, 2.94, -0.44], lobe: { r: 0.35 } },
  // 8  N1 — **the far reach**, out over the back. Almost no rise at
  //        all: it is the longest limb in the tree and it ends lower
  //        than the shoulder it left.
  { p: 1, ctrl: [0.80, 2.76, -1.84], to: [0.90, 2.74, -2.12], lobe: { r: 0.41 } },
  // 9  N2 — inboard of N1, filling the back of the middle.
  { p: 1, at: 0.70, ctrl: [0.26, 2.86, -1.28], to: [0.34, 2.98, -1.40], lobe: { r: 0.37 } },
  // 10 E1 — east and back, nearly level.
  { p: 2, ctrl: [1.30, 2.74, -0.90], to: [1.40, 2.70, -1.14], lobe: { r: 0.40 } },
  // 11 E2 — the east shoulder, and the only second-generation limb
  //         with real rise in it.
  { p: 2, at: 0.68, ctrl: [1.00, 2.92, -0.20], to: [1.06, 3.08, -0.12], lobe: { r: 0.38 } },
  // 12 E3 — forward and low: the second, smaller droop.
  { p: 2, at: 0.86, ctrl: [1.14, 2.56, 0.22], to: [1.22, 2.44, 0.44], lobe: { r: 0.30, floor: 2.20, edge: true } },
  // 13 S1 — up and forward over the porch.
  { p: 3, ctrl: [0.42, 2.80, 0.96], to: [0.46, 2.88, 1.10], lobe: { r: 0.34 } },
  // 14 S2 — west along the front.
  { p: 3, at: 0.64, ctrl: [-0.26, 2.72, 0.74], to: [-0.46, 2.76, 0.80], lobe: { r: 0.33 } },
  // 15 C1 — off the stem, east over the ridge.
  { p: 4, ctrl: [0.50, 3.04, -0.64], to: [0.64, 3.12, -0.78], lobe: { r: 0.37 } },
  // 16 C2 — and west.
  { p: 4, at: 0.82, ctrl: [-0.16, 3.02, -0.42], to: [-0.30, 3.08, -0.30], lobe: { r: 0.35 } },

  /* --- twigs: the bumps that break the top edge and the loose ends
     that break the outline. Their tips are deliberately at six
     different heights — a top edge is bumpy because the wood under it
     is, not because the blossom on it is noisy. --- */
  // 17 off W1 — the west bump.
  { p: 5, ctrl: [-1.46, 3.02, 0.06], to: [-1.44, 3.14, -0.04], lobe: { r: 0.23, edge: true } },
  // 18 off N1 — the furthest thing in the tree.
  { p: 8, ctrl: [1.00, 2.86, -2.34], to: [1.04, 2.84, -2.54], lobe: { r: 0.24, edge: true } },
  // 19 off E1 — out past the east mass.
  { p: 10, ctrl: [1.56, 2.84, -1.30], to: [1.60, 2.84, -1.44], lobe: { r: 0.23, edge: true } },
  // 20 off E2 — the top of the crown.
  { p: 11, ctrl: [1.10, 3.28, -0.06], to: [1.06, 3.38, 0.00], lobe: { r: 0.26, edge: true } },
  // 21 off C1 — a bump on the skyline over the house.
  { p: 15, ctrl: [0.72, 3.30, -0.84], to: [0.70, 3.38, -0.88], lobe: { r: 0.24, edge: true } },
  // 22 off S1 — loose out over the porch.
  { p: 13, ctrl: [0.52, 2.96, 1.26], to: [0.50, 2.94, 1.38], lobe: { r: 0.21, edge: true } },
  // 23 off C2 — a low bump on the west side.
  { p: 16, ctrl: [-0.48, 3.10, -0.16], to: [-0.58, 3.12, -0.08], lobe: { r: 0.23, edge: true } },
];


/* Each limb's three control points, with every child's start resolved
   off its parent. Built once at module scope: the canopy, the swing and
   the branch geometry all read it, and none of them may hold a private
   copy of where a limb went. */
const LIMB_PTS = (() => {
  const pts = [];
  for (const L of LIMB_PLAN) {
    const from = L.p < 0
      ? trunkPoint(L.tt)
      : new THREE.QuadraticBezierCurve3(...pts[L.p]).getPoint(L.at ?? 1);
    pts.push([from, new THREE.Vector3(...L.ctrl), new THREE.Vector3(...L.to)]);
  }
  return pts;
})();

/* How many forks deep a limb is, which is what picks its thickness. */
const LIMB_GEN = LIMB_PLAN.map(function gen(L, i, all) {
  let g = 0, p = L.p;
  while (p >= 0) { g++; p = all[p].p; }
  return Math.min(g, GEN_SIZES.length - 1);
});

/* The swing hangs off the -X low branch now, not off a canopy limb:
   the low branches are the only wood left out in the open once the
   crown moved up onto the fork. */
const SWING_LOW = 1;

/* The curve a limb is actually built along, lifted onto the lawn.
   Exported from here rather than re-derived, because the swing hangs
   off limb 5 and a swing hanging off a *copy* of the maths is a swing
   that comes adrift the moment the limb is re-aimed. */
export function limbCurve(i, lawnY) {
  const lift = new THREE.Vector3(0, lawnY, 0);
  const [a, c, b] = LIMB_PTS[i];
  return new THREE.QuadraticBezierCurve3(
    a.clone().add(lift), c.clone().add(lift), b.clone().add(lift));
}

function buildBranches(kit, lawnY) {
  const bark = kit.mat(BARK, 0.56);
  const barkDark = kit.mat(BARK_DARK, 0.6);
  LIMB_PLAN.forEach((_, i) => {
    buildBranch(kit, i % 2 ? barkDark : bark, limbCurve(i, lawnY),
      { spin: i * 0.7, sizes: GEN_SIZES[LIMB_GEN[i]] });
  });
}

/* ==========================================
   THE HOUSE

   Laid out on the stud grid in the trunk's own frame, so moving the
   trunk moves the house with it. `ix`/`iz` turn a stud index into a
   local coordinate; indices run -1.5..1.5 across a four-stud house, so
   a wall face sits at index +/-2 and the roof's eave at +/-2.34.

   The house deliberately does **not** inherit the trunk's cumulative
   twist. The trunk is 0.51 rad round by its top course and a house
   turned with it would face nowhere in particular; the model's own +Z
   is the front, and scene.js turns the whole group to present it.
   ========================================== */
const HOUSE_F = trunkPoint(HOUSE_T);
const ix = (i) => HOUSE_F.x + i * STUD;   // stud index -> local x
const iz = (j) => HOUSE_F.z + j * STUD;

function buildHouse(kit, lawnY) {

  const plank = kit.mat(PLANK, 0.5);
  const plankAlt = kit.mat(PLANK_ALT, 0.5);
  const deckMat = kit.mat(PLANK_DARK, 0.55);
  const trim = kit.mat(TRIM, 0.4);
  const glassMat = kit.mat(GLASS, 0.16);
  const shingle = kit.mat(SHINGLE, 0.5);
  const ridgeMat = kit.mat(SHINGLE_RIDGE, 0.5);
  const bark = kit.mat(BARK, 0.56);

  const deckY = lawnY + DECK_Y;               // the deck sits on the fork
  const wallY = lawnY + WALL_Y;
  const eaveY = lawnY + EAVE_Y;

  /* --- The deck ------------------------------------------
     One slab of plates carrying the house and the porch in front of
     it, two plates thick so its edge is a board rather than a line.
     Six studs deep: four under the house, two standing out past the
     front wall. */
  const deckD = HOUSE_D + PORCH_D;
  const deckZ = iz(PORCH_D / 2);              // pushed forward by the porch
  for (let k = 0; k < 2; k++) {
    kit.brick(deckMat, HOUSE_W, deckD, ix(0), deckY + k * PH, deckZ,
      { h: PH, studs: k === 1 });
  }

  /* Two joists under it crossing the trunk's top, and a strut out to
     each front corner. A four-stud deck on a two-stud post is a
     cantilever, and without something visibly carrying it the house
     reads as stuck on rather than built on. */
  for (const j of [-0.9, 0.9]) {
    kit.brick(bark, HOUSE_W - 1, 1, ix(0), deckY - PH, iz(j), { h: PH, studs: false });
  }
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(ix(sx * 0.3), deckY - 0.46, iz(0.2));
    const b = new THREE.Vector3(ix(sx * 1.1), deckY - 0.02, iz(1.3));
    const d = b.clone().sub(a);
    kit.piece(`strut|${bark.userData.key}|${d.length().toFixed(3)}`,
      () => new RoundedBoxGeometry(STUD * 0.8, d.length(), STUD * 0.8, 1, BEVEL),
      bark, a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
  }

  /* --- The walls -----------------------------------------
     Four studs square. The front carries a two-stud doorway, the +X
     flank a round window, and the courses are bonded — the joint moves
     a stud each course, which is both how a wall is laid and what
     keeps the two tans from stacking into vertical stripes. */
  for (let c = 0; c < WALL_COURSES; c++) {
    const y = wallY + c * BH;
    const m = c % 2 ? plankAlt : plank;
    const top = c === WALL_COURSES - 1;
    const odd = c % 2 === 1;

    // back, bonded: the joint moves half the wall each course
    if (odd) {
      kit.brick(m, 1, 1, ix(-1), y, iz(-WALL_Z), { studs: top });
      kit.brick(m, 2, 1, ix(0.5), y, iz(-WALL_Z), { studs: top });
    } else {
      kit.brick(m, 2, 1, ix(-0.5), y, iz(-WALL_Z), { studs: top });
      kit.brick(m, 1, 1, ix(1), y, iz(-WALL_Z), { studs: top });
    }

    /* Front, with the doorway on the middle stud. On a three-stud wall
       the door is one stud wide, not two — which is the right trade:
       a 0.3 x 0.72 opening is a door's own proportion, where two studs
       out of three would leave half a stud of wall either side and
       read as a missing panel. */
    if (c < DOOR_COURSES) {
      kit.brick(m, 1, 1, ix(-1), y, iz(WALL_Z), { studs: top });
      kit.brick(m, 1, 1, ix(1), y, iz(WALL_Z), { studs: top });
    } else {
      kit.brick(m, HOUSE_W, 1, ix(0), y, iz(WALL_Z), { studs: top });  // the lintel
    }

    /* Flanks: one stud between the front and back walls, and it stays
       solid. The round window is applied to the face rather than
       punched through it — at a one-stud plan the opening would be
       0.3 by 0.36 and no frame small enough to suit a house this size
       can cover a rectangle whose diagonal is bigger than the frame.
       The ring standing proud still throws the shadow line that stops
       it reading as a sticker, which was the only thing the hole was
       ever for. */
    for (const sx of [-1, 1]) {
      kit.brick(m, 1, HOUSE_D - 2, ix(sx * WALL_X), y, iz(0), { studs: top });
    }
  }

  /* --- The roof ------------------------------------------
     A plate laps the wall tops and overhangs them all round — that is
     the eave, and it also seals the line the slope above it cannot.
     On it stand two runs of **slope bricks**, one per stud of roof
     depth, meeting at a ridge bar.

     This started as a stepped roof — courses of brick stepping a stud
     in and a course up — on the reasoning that stepping is the honest
     brick way to make a diagonal. It is, at a large enough scale. Over
     a four-stud span it is two steps, and two steps do not read as a
     pitch: from the gable end it was a ziggurat and from the flank a
     plain grey box as deep as the house. A slope brick is every bit as
     much a standard brick element, and a row of them reads as a roof
     immediately.

     The geometry is set by the *underside* line, eave to ridge, and
     everything else is derived from it: the slab's own thickness is
     carried outward along the slope normal, so the eave lands exactly
     on the plate rather than a fraction of a unit through it. */
  const roofD = ROOF_DEPTH;
  kit.brick(shingle, HOUSE_W + 2 * ROOF_OVER, roofD, ix(0), eaveY, iz(0),
    { h: PH, studs: false });

  const baseY = lawnY + ROOF_BASE_Y;
  const eaveX = EAVE_X, rise = ROOF_RISE, ang = ROOF_ANG;
  const slopeLen = Math.hypot(eaveX, rise);
  const ca = Math.cos(ang), sa = Math.sin(ang);

  for (const sx of [-1, 1]) {
    /* eave -> ridge along the slope, and the outward normal off it */
    const ux = -sx * ca, uy = sa;
    const nx = sx * sa, ny = ca;
    const cx = sx * eaveX + ux * (slopeLen / 2 + 0.05) + nx * (ROOF_THICK / 2);
    const cy = baseY + uy * (slopeLen / 2 + 0.05) + ny * (ROOF_THICK / 2);
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sx * ang);
    for (let j = 0; j < roofD; j++) {
      kit.piece(`slope|${shingle.userData.key}`,
        () => new RoundedBoxGeometry(
          slopeLen + 0.1, ROOF_THICK, STUD * 0.94, 1, BEVEL * 0.7),
        shingle,
        new THREE.Vector3(ix(0) + cx, cy, iz(j - (roofD - 1) / 2)), q);
    }
  }
  const apexY = lawnY + APEX_Y;
  kit.piece(`ridgebar|${ridgeMat.userData.key}`,
    () => new RoundedBoxGeometry(STUD * 0.62, PH * 1.1, roofD * STUD, 1, BEVEL),
    ridgeMat, new THREE.Vector3(ix(0), apexY - PH * 0.45, iz(0)), new THREE.Quaternion());

  /* --- The gable -----------------------------------------
     The triangle the slope leaves over the front and back walls. See
     gableRows for where the widths come from. */
  gableRows(rise, eaveX).forEach((w, r) => {
    for (const sz of [-1, 1]) {
      kit.brick(r % 2 ? plankAlt : plank, w, 1, ix(0),
        baseY + r * PH, iz(sz * WALL_Z), { h: PH, studs: false });
    }
  });

  /* --- The door ------------------------------------------
     A panel filling the opening rather than a hole: the house has no
     interior, and an open door on an empty box is worse than a shut
     one. The panel alone was not enough — the front faces away from
     the key, so a dark panel in a dark reveal read as a doorway with
     nothing in it. The light trim casing around it is what says door. */
  const doorW = STUD, doorH = DOOR_COURSES * BH;
  const doorZ = iz(HOUSE_D / 2);
  kit.piece(`doorcase|${trim.userData.key}`,
    () => new RoundedBoxGeometry(doorW + 0.1, doorH + 0.06, PH * 0.45, 1, BEVEL),
    trim,
    new THREE.Vector3(ix(0), wallY + doorH / 2 + 0.02, doorZ + PH * 0.18),
    new THREE.Quaternion());
  kit.piece(`door|${deckMat.userData.key}`,
    () => new RoundedBoxGeometry(doorW - 0.04, doorH - 0.04, PH * 0.5, 1, BEVEL),
    deckMat,
    new THREE.Vector3(ix(0), wallY + doorH / 2, doorZ + PH * 0.36),
    new THREE.Quaternion());
  kit.piece(`knob|${trim.userData.key}`,
    () => new THREE.CylinderGeometry(STUD * 0.09, STUD * 0.09, PH * 0.7, 10),
    trim,
    new THREE.Vector3(ix(0.3), wallY + doorH * 0.5, doorZ + PH * 0.6),
    new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0, 0, 1)));

  /* --- The round window ----------------------------------
     A ring and a pane on the +X flank, which at this model's facing is
     the side the camera sees. The frame is a torus, and that is the
     fix rather than a detail: the first version used a cylinder for
     it, which is a solid disc — it covered its own glass completely
     and the window rendered as a blank white dot. The pane sits inside
     the ring and a little behind it, so the rim throws a shadow line
     across the glass, which is what stops it reading as a sticker. */
  const faceX = ix(HOUSE_W / 2);
  const winY = wallY + (WINDOW_COURSE + 0.5) * BH;
  const acrossX = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  kit.piece(`winframe|${trim.userData.key}`,
    () => new THREE.TorusGeometry(STUD * 0.46, STUD * 0.13, 8, 20),
    trim, new THREE.Vector3(faceX + PH * 0.34, winY, iz(0)), acrossX);
  kit.piece(`winglass|${glassMat.userData.key}`,
    () => new THREE.CylinderGeometry(STUD * 0.45, STUD * 0.45, PH * 0.5, 16),
    glassMat, new THREE.Vector3(faceX + PH * 0.12, winY, iz(0)),
    new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(1, 0, 0)));

  /* --- The porch rail ------------------------------------
     Posts at the two front corners and a rail of plates between them,
     with the middle stud of the front run left open: that gap is where
     the rope ladder goes over the edge. One course of post, not two —
     at two the rail stood within a plate of the wall top and read as a
     second storey rather than as something to lean on. */
  const railY = deckY + DECK_H;
  const postH = RAIL_COURSES * BH;
  /* Two newel posts with a plate cap apiece. A one-stud porch has no
     run between the post and the wall for a side rail, and at this
     size two posts either side of the gap is the whole gesture. */
  for (const sx of [-1, 1]) {
    kit.brick(deckMat, 1, 1, ix(sx * WALL_X), railY, iz(DECK_FRONT - 0.5),
      { h: postH, studs: false });
    kit.brick(deckMat, 1, 1, ix(sx * WALL_X), railY + postH,
      iz(DECK_FRONT - 0.5), { h: PH });
  }
  /* The front run: one stud at each corner and the two middle studs
     left open. That gap is both the way out onto the ladder and the
     reason the door is not hidden behind a bar — on the four-stud
     house the door takes those same two middle studs, so the two line
     up without being told to. */

  return apexY;   // the ridge, for the canopy to clear
}

/* ==========================================
   THE ROPE LADDER

   From the gap in the porch rail down to the lawn. Two ropes and eight
   rungs; the ropes are one tube geometry built in the YZ plane and
   placed twice either side of the centre line, since both follow the
   identical curve.

   Where it lands is not free. The porch's front edge is 1.13 from the
   base's centre and the lawn's own radius is 1.34, so a ladder that
   leans out as far as a real one would — the foot kicked a half unit
   clear of the drop — comes down off the edge of the base plate and
   onto the desk. It hangs nearly plumb instead, with a slight belly,
   and the foot lands at 1.23: on the grass, with 0.11 to spare.
   ========================================== */
const LADDER_X = 0;             // stud index, inside the rail's gap
const LADDER_Z = 2.4;           // stud index, just inside the deck's edge
/* Four, not eight. The drop is 1.48 now rather than 3.00, and eight
   rungs over it sit 0.16 apart against a rung 0.06 thick — close
   enough that the ladder reads as a zip rather than as something to
   climb. Four holds the ~0.37 spacing the five-rung version had over
   its own longer drop, which is the figure to keep. */
const LADDER_RUNGS = 3;
const ROPE_R = 0.042;           // thick enough to survive the home framing

function buildLadder(kit, lawnY) {
  const rope = kit.mat(ROPE, 0.68);
  const rung = kit.mat(PLANK_DARK, 0.6);
  const z0 = iz(LADDER_Z);

  /* Built about x = 0 so one tube serves both ropes. */
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, lawnY + DECK_TOP, z0),
    new THREE.Vector3(0, lawnY + DECK_TOP * 0.45, z0 + 0.19),
    new THREE.Vector3(0, lawnY + 0.03, z0 + 0.14));

  for (const sx of [-1, 1]) {
    kit.piece(`ladderrope|${rope.userData.key}`,
      () => new THREE.TubeGeometry(curve, 28, ROPE_R, 6, false),
      rope, new THREE.Vector3(ix(LADDER_X) + sx * 0.13, 0, 0),
      new THREE.Quaternion());
  }

  const tan = new THREE.Vector3();
  for (let i = 0; i < LADDER_RUNGS; i++) {
    const t = (i + 0.55) / LADDER_RUNGS;
    const p = curve.getPoint(t);
    curve.getTangent(t, tan).normalize();
    /* The rung stays square to the model and only tilts with the
       ladder's own slope, which is a rotation about X alone: its up
       axis is the tangent reversed, since the tangent runs downward. */
    const q = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), Math.atan2(-tan.z, -tan.y));
    kit.piece(`rung|${rung.userData.key}`,
      () => new RoundedBoxGeometry(STUD * 1.08, PH * 0.5, PH * 0.9, 1, BEVEL * 0.6),
      rung, new THREE.Vector3(ix(LADDER_X), p.y, p.z), q);
  }

  /* The tie-off on the deck, in the rail's gap. */
  kit.brick(rope, 1, 1, ix(LADDER_X), lawnY + DECK_TOP, iz(LADDER_Z - 0.3),
    { h: PH, studs: false });
}

/* ==========================================
   THE SWING

   Hung off the low limb rather than off a remembered copy of where it
   used to be: the two anchors are sampled from the same curve the
   branch was built along, so re-aiming the limb carries the swing with
   it. The seat hangs level under them and its long axis follows the
   line between them, which is the only orientation a swing on two
   ropes can take.
   ========================================== */
const SWING_T = [0.66, 0.92];   // where on the limb the ropes are tied
/* How far the seat hangs below the tie, and the one figure that fixed
   the trunk's height. The limb ties at 0.85 above the grass now, so
   the drop and the clearance share that and nothing else: 0.39 puts
   the seat at 0.31, which is the same fraction of the lawn the old
   0.46-over-0.39 was, and that the same fraction the 0.68-over-0.63
   before it was. Take any more off the drop and the seat is a plank
   lying on the grass. */
const SWING_DROP = 0.39;

function buildSwing(kit, lawnY) {
  const rope = kit.mat(ROPE, 0.68);
  const seatMat = kit.mat(PLANK_DARK, 0.55);

  const limb = lowBranchCurve(SWING_LOW, lawnY);
  const ends = SWING_T.map((t) => limb.getPoint(t));
  /* Tie under the limb, not through its middle. */
  ends.forEach((e) => { e.y -= STUD * 0.42; });
  const seatY = Math.min(ends[0].y, ends[1].y) - SWING_DROP;

  for (const e of ends) {
    const len = e.y - seatY;
    kit.piece(`swingrope|${rope.userData.key}|${len.toFixed(3)}`,
      () => new THREE.CylinderGeometry(ROPE_R * 0.8, ROPE_R * 0.8, len, 6),
      rope, new THREE.Vector3(e.x, seatY + len / 2, e.z), new THREE.Quaternion());
  }

  const span = new THREE.Vector3().subVectors(ends[1], ends[0]);
  span.y = 0;
  const mid = new THREE.Vector3().addVectors(ends[0], ends[1]).multiplyScalar(0.5);
  kit.piece(`seat|${seatMat.userData.key}`,
    () => new RoundedBoxGeometry(span.length() + STUD * 0.9, PH, STUD, 1, BEVEL),
    seatMat, new THREE.Vector3(mid.x, seatY, mid.z),
    new THREE.Quaternion().setFromAxisAngle(UP, Math.atan2(span.z, span.x) * -1));
}

/* ==========================================
   FALLEN PETALS

   Scattered on the lawn, in the two pinks the canopy will be built
   from. They are ellipses rather than discs — one axis scaled in the
   instance matrix, so they are still a single geometry — and each
   carries a few degrees of tilt, because a field of flat discs all at
   the same height reads as polka dots printed on the plate rather than
   as something that fell.
   ========================================== */
const PETALS = 19;

function buildPetals(kit, lawnTop) {
  const r = rng(0x9e7a11);
  const tint = [kit.mat(PETAL_PINK, 0.4), kit.mat(PETAL_PALE, 0.4)];
  const scale = new THREE.Vector3(1.45, 1, 0.78);
  const limit = BASE_R - STUD * 0.9;
  const axis = new THREE.Vector3();

  for (let i = 0; i < PETALS; i++) {
    let x, z;
    do {
      x = (r() * 2 - 1) * limit;
      z = (r() * 2 - 1) * limit;
    } while (Math.hypot(x, z) > limit || Math.hypot(x, z) < 0.48);

    const m = tint[r() < 0.45 ? 0 : 1];
    axis.set(r() - 0.5, 0, r() - 0.5).normalize();
    const q = new THREE.Quaternion()
      .setFromAxisAngle(UP, r() * Math.PI * 2)
      .multiply(new THREE.Quaternion().setFromAxisAngle(axis, (r() - 0.5) * 0.3));
    kit.put(`petal|${m.userData.key}`,
      () => new THREE.CylinderGeometry(STUD * 0.23, STUD * 0.23, PH * 0.3, 8),
      m, new THREE.Matrix4().compose(
        new THREE.Vector3(x, lawnTop + PH * 0.2, z), q, scale));
  }
}

/* ==========================================
   THE CANOPY

   A real cherry's crown is not a surface. It is a dozen separate
   masses, each one carried on the end of a limb, with sky between them
   and the wood showing through the gaps — wider than it is tall,
   heavier on one side than the other, and ragged at the edges where
   the twigs run out of blossom. That is what the reference photograph
   shows and it is what this is built as now.

   What it replaced is worth stating, because the old version was not
   wrong in its details and still came out looking moulded: it sampled
   an **ellipsoid shell** by rejection — centres between 0.58 and 1.0
   of the radius, biased upward — and dropped a clump wherever a sample
   survived. Every control that shape had was a radius, so every answer
   it could give was a smooth closed curve. Scattering the clumps
   differently inside it, or adding tints, could not help: the outline
   was the ellipsoid, the top was an arc, and the two sides were the
   same arc mirrored. The silhouette is not a texture, and it cannot be
   fixed by texturing it.

   So the shell is gone, and nothing samples a global volume any more.
   Instead:

   - **It is laid on the stud grid.** `markClump` resolves the lobe
     volumes below onto CELL in plan and one plate in height; nothing
     in the crown sits off that grid, which is why its outline comes
     out a staircase rather than a curve. See `bakeCanopy` for what
     the marked cells become.
   - **The clumps are the limb tips.** `LIMB_PLAN` hangs a `lobe` on
     most of its rows, and every piece of blossom in the model belongs
     to one of them. The crown's outline is therefore a *consequence*
     of where the branching went — move a limb and its mass moves with
     it, and two limbs that fork apart leave a gap between their
     clumps with the wood visible down it. There is no step at which a
     curve is fitted through them.
   - **A clump is not a ball either.** Each is three to five
     sub-lobes, offset from the clump's centre and overlapping, so the
     clump itself has bays and shoulders. Nothing fills a clump solid:
     `bakeCanopy` culls every cell whose six neighbours are all
     occupied, so what is emitted is the shell — blossom nobody can
     see costs exactly what the visible pieces cost.
   - **The edges are looser than the middle.** The `edge` lobes — the
     five twig tips, and both droops — run a size down (EDGE_SUB_R)
     and carry more blossom per exposed stud (EDGE_BLOOM), so out
     there the structure thins to single plates while the flowers on
     them do not. That is what makes an outline loose rather than a
     hard rim.
   - **The inner lobes are the mass, and they are a size apart.** Each
     gen-1 limb also carries a lobe part-way along itself
     (`MID_T` / `MID_SCALE`), and the four trunk limbs carry one at the
     fork where their children leave — marked `inner`, which both
     enlarges them a little and pushes their tint toward the deep rose.
     Those fill the middle of the crown without reaching the outline.

   Three things that were true before are still true and still load
   bearing:

   - **The flowers are clipped to studs, so they point the way the
     studs do.** They used to be turned outward — a blend of the
     sub-lobe's normal and the direction away from `CANOPY_HEART` —
     which is a sculpt's answer rather than a build's. SIDE_BLOOM is
     what fills the role that facing played: axis-aligned flowers on
     the outward vertical faces, so the crown is blossom from beside
     and underneath and not only from above.
   - **Tint carries depth.** Four tints, and `tintFor` shifts the draw
     toward the lighter ones as a flower sits further out and higher:
     the deep rose collects inside and underneath where a real canopy
     is in its own shade, the white sits on the lit top. The gradient
     is most of what stops several hundred flowers reading as one flat
     blob; four tints scattered evenly do not.
   - **The keep-outs are unchanged**, and they are what keeps the model
     readable: nothing inside the walls, nothing under the roof's own
     height at its own x (plus a clearance that tapers from nothing at
     the eave to RIDGE_CLEAR at the ridge, so blossom laps the lower
     slopes while the ridge shows), nothing in front of the front wall
     below the door head, and nothing below CANOPY_FLOOR except the two
     droops and the one clump on the swing limb's tip.

   ---------------------------------------------------------------
   Size, and the two numbers it is checked against.

   The model is sized against the monitor, which stands 6.60 above the
   desk top. 74% of that — a top near 4.9 — is what keeps the tree a
   companion to the machine rather than a rival to it, and the ridge at
   3.79 plus RIDGE_CLEAR is what has to fit underneath. The three crown
   lobes sit at 3.62 to 3.86 with radii under 0.5, and with the fringe
   on top of that the model tops out at 4.75 above the desk — a shade
   under where it stood before this rebuild, which is where to keep
   it.

   Width is the other one, and it is lopsided on purpose — see the note
   on LIMB_PLAN for why the long side is the back-right one and what it
   buys. `_canopyfit.mjs` measures both ends of it: the model's world
   box against the desk's, and the model's NDC box against the live
   overlay's client rect, which *is* the glass. Run it after anything
   that moves a lobe outward.
   ========================================== */
const BLOSSOM_TINTS = [PETAL_PINK, PETAL_PALE, PETAL_WHITE];
/* What share of the canopy is coral — and it is **two shares, because
   a plate is not a flower**. Eight percent of the flowers is a scatter
   you read as flecks, and that figure survived the rebuild unchanged.
   Eight percent of the *structure* does not: a patch of plates covers
   something like ten times the area a flower does, so the same share
   came back as slabs of orange and the crown read as a maple. The
   structure runs at a quarter of it.

   The same arithmetic is behind PLATE_LIFT. The three graded tints
   were balanced against flowers; at plate size the pinks carry far
   more of the frame than they did, so the structure's draw is pushed
   toward the white end and the crown reads white again — which is what
   the reference does from across the room. */
const CORAL_SHARE = 0.08;
const CORAL_PLATE = 0.022;
const PLATE_LIFT = 0.12;

/* The middle of the crown. It is not a shape any more — nothing is
   sampled against it — but two things still want one point to measure
   from: which way a flower faces, and how far out it is for the tint. */
const CANOPY_HEART = new THREE.Vector3(0.26, 2.96, -0.55);
const HEART_SPAN = 1.55;               // the distance that counts as "out"

/* **Every clump is an oblate spheroid, not a ball.** This is the one
   change that makes the crown a cloud rather than a dome, and it is
   worth being clear about why no amount of limb-table work could do
   it alone: a cloud assembled out of spheres is at least one sphere
   tall everywhere, so widening it only ever gave a wider dome. The
   squash scales the y of every offset inside a clump — the sub-lobes'
   own displacement, the shell the flowers sit in, and the fringe — so
   a 0.40 clump is 0.80 across and 0.46 deep. The crown then runs
   about 1.3 tall against 3.5 wide where it used to be 2.0 against
   3.3. */
const LOBE_SQUASH = 0.58;

const LOBE_SUBS = [3, 5];              // sub-lobes per clump
/* The sub-lobes run larger and sit closer in than they did when they
   held scattered flowers, and both moved for the same reason. A
   voxelised lobe only keeps the cells whose *centres* fall inside it,
   so it finishes about half a cell short of its nominal radius in
   every direction — and the shortfall is taken off each lobe
   separately, so a clump of four came out as four islands with grid
   gaps between them. Bigger and nearer closes the gaps; the clump's
   own extent is the same, because the two changes pull opposite ways. */
const LOBE_SUB_R = [0.58, 0.92];       // each, as a share of the clump radius
const LOBE_SUB_OFF = [0.20, 0.46];     // and how far off centre it sits
const EDGE_SUB_R = 0.86;               // an edge clump's lobes run a size down
const INNER_SCALE = 1.12;              // the fork lobes run a little larger

/* --- the grid the crown is laid on ----------------------
   The canopy is a *build*, so it is laid on the same grid the base
   plate's studs are: CELL in plan, one plate in height, with the
   layers counted up from the lawn. Nothing in the crown sits off it —
   which is the whole reason the outline comes out stair-stepped
   instead of drawn.

   RUN_MAX is the longest plate laid in one piece. It is a batching
   figure as much as a modelling one: each distinct footprint is its
   own geometry, so an uncapped run would mint a 1x11 nobody can see
   the far end of. Three is the longest run, keeping seams visible. */
const CELL = STUD;
const LAYER = PH;
const RUN_MAX = 3;

/* How much blossom goes on. A flower is *clipped to a stud*, so these
   are shares of the exposed studs rather than densities in a volume —
   the structure decides where blossom may go and these decide how much
   of it is taken. Where a flower is not taken the stud is left bare,
   which is what puts studs on the upward-facing surfaces. */
const TOP_BLOOM = 0.40;                // leave studs and plate seams visible
const EDGE_BLOOM = 0.66;
const SIDE_BLOOM = 0.20;
const BLOOM_TOP_SIZE = 0.70;           // one flower fits within one stud cell
const BLOOM_SIDE_SIZE = 0.66;
/* The loose single plates stepped off the mass. They are what the old
   scattered fringe was for — an outline you can see the sky through —
   except that each one is a 1x1 with a flower on it, on the grid, in
   line with the build. */
const TIP_N = 10;                      // per 0.45 of clump radius
const TIP_REACH = 1.46;
/* The two puffs on the low branches. They are most of what says the
   crown is a cloud *above* a tree rather than the whole tree, and
   they need their own floor: CANOPY_FLOOR is 2.42 and these hang at
   0.8 to 1.5. */
const LOW_LOBE_R = 0.30;
const LOW_LOBE_FLOOR = 0.52;
const MID_T = 0.54;                    // where on a limb its second lobe sits
const MID_SCALE = 0.74;
const CANOPY_FLOOR = 2.42;             // nothing hanging down level with the swing

/* The house's footprint as the canopy sees it, wide enough that a
   flower's own radius cannot reach in through a wall. This is the
   keep-out *below the eave* only; above it the roof decides. */
const KEEP_X = 0.64, KEEP_Z = 0.64;
/* The porch void: in front of the front wall, up to the door head. */
const PORCH_Z = (HOUSE_D / 2) * STUD;
const PORCH_Y = WALL_Y + DOOR_COURSES * BH + PH;

/* Which tint. `depth` is 0 deep inside the canopy and 1 out on its lit
   surface, and it shifts the draw toward the lighter ones.

   **The coral is drawn flat, not against depth, and that is the whole
   trick.** In the reference it falls in small patches all through the
   crown — on the skyline, in the shade, out on the twigs alike — so
   grading it the way the pinks are graded would collect it somewhere
   and read as a stain. Everything else is graded: pink deep inside,
   white out on the lit surface. */
function tintFor(v, depth, coral = CORAL_SHARE, lift = 0) {
  if (v < coral) return PETAL_CORAL;
  const t = ((v - coral) / (1 - coral)) * 0.66 + depth * 0.34 + lift;
  return BLOSSOM_TINTS[t < 0.30 ? 0 : t < 0.62 ? 1 : 2];
}

/* The line the keep-out follows over the house: the roof's own upper
   surface, plus a clearance that grows from nothing at the eave to
   RIDGE_CLEAR at the ridge.

   **That taper is what makes the house read.** With the clearance flat
   at zero the blossom lay on the roof everywhere, and since the camera
   looks down on it at 20 degrees the whole roof went under — "nestled"
   became "buried", and the one piece of the model that says *house*
   rather than *tree* was gone. With it, blossom still laps the lower
   slopes and the eaves, which is the contact that makes the house look
   grown into the tree, while the ridge and the top third of both
   slopes stay clear.

   Past the eave there is no roof at all, which is what the -Infinity
   says: a point out there is never under one. */
const RIDGE_CLEAR = 0.13;

function roofTopAt(x) {
  const dx = Math.abs(x - HOUSE_F.x);
  if (dx > EAVE_X) return -Infinity;
  return ROOF_BASE_Y + (EAVE_X - dx) * ROOF_PITCH
    + ROOF_THICK / Math.cos(ROOF_ANG)
    + RIDGE_CLEAR * (1 - dx / EAVE_X);
}

/* Is this point in the solid of the house? Below the eave that is the
   walls plus a flower's clearance; above it, the slope. Above the apex
   nothing is, which is the early out that lets the crown sit over the
   ridge. */
function insideHouse(p, lawnY) {
  const y = p.y - lawnY;
  if (y >= APEX_Y + RIDGE_CLEAR) return false;
  if (Math.abs(p.z - HOUSE_F.z) >= KEEP_Z) return false;
  if (y < EAVE_Y) return Math.abs(p.x - HOUSE_F.x) < KEEP_X;
  return y < roofTopAt(p.x);
}

function inPorchVoid(p, lawnY) {
  return p.z - HOUSE_F.z > PORCH_Z
    && Math.abs(p.x - HOUSE_F.x) < KEEP_X
    && p.y - lawnY < PORCH_Y;
}

function blocked(p, lawnY, floor) {
  return p.y - lawnY < floor
    || insideHouse(p, lawnY)
    || inPorchVoid(p, lawnY);
}

/* --- the grid, in both directions ------------------------ */
const cellX = (i) => (i + 0.5) * CELL;
const cellZ = (k) => (k + 0.5) * CELL;
const cellY = (j) => j * LAYER;        // a plate's bottom, in the lawn's frame
const key3 = (i, j, k) => `${i}|${j}|${k}`;

/* A deterministic value per cell. Used for colour and for whether a
   stud carries a flower, and it is a *hash of the coordinates* rather
   than a draw off the clump's rng on purpose: the two passes that want
   it (marking and baking) run at different times over different sets,
   so a sequential rng would give a cell one answer in one pass and
   another in the next. */
function hash3(a, b, c) {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b)
    ^ Math.imul(b + 0x165667b1, 0xc2b2ae35)
    ^ Math.imul(c + 0x27d4eb2f, 0x1b873593);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/* A direction on the sphere, taken properly rather than off a cube: a
   cube of offsets piles the tips into the corners. */
function sphereDir(r, v) {
  const cy = r() * 2 - 1;
  const sy = Math.sqrt(Math.max(0, 1 - cy * cy));
  const th = r() * Math.PI * 2;
  return v.set(Math.cos(th) * sy, cy, Math.sin(th) * sy);
}

/* One clump, marked onto the grid rather than drawn: three or four
   squashed sub-lobes around `centre`, every cell whose centre falls
   inside one of them flagged occupied, plus a handful of single cells
   stepped off the edge.

   **This is the step that makes the crown a build.** The volume the
   sub-lobes describe is the one the old scattered canopy had, so the
   mass and the silhouette are the same shape — what changed is that
   the shape is now resolved onto the stud grid before anything is
   emitted, so its outline can only ever be a staircase. There is no
   stage at which a smooth surface is approximated; the cells *are* the
   model.

   The tips do what the old fringe did and are the one place the two
   differ in kind. The fringe scattered loose blooms past the mass at
   any angle and any distance; a tip is a 1x1 plate on the grid, one or
   two cells clear of the mass, with a flower clipped to it. Same job —
   an outline with sky through it — done the way the rest of the model
   is done. */
function markClump(cells, r, centre, lawnY, {
  radius, floor = CANOPY_FLOOR, edge = false, inner = 0,
} = {}) {
  const subs = LOBE_SUBS[0] + Math.floor(r() * (LOBE_SUBS[1] - LOBE_SUBS[0] + 1));
  const dir = new THREE.Vector3();
  const sub = new THREE.Vector3();
  const p = new THREE.Vector3();

  /* `tip` loses to anything already there — a single stepped off one
     clump that lands inside the next is just part of the mass. The
     mass likewise wins the `edge` flag, so a cell shared by a loose
     clump and a solid one carries the solid one's blossom density. */
  const mark = (i, j, k, tip) => {
    p.set(cellX(i), lawnY + cellY(j) + LAYER / 2, cellZ(k));
    if (blocked(p, lawnY, floor)) return;
    const was = cells.get(key3(i, j, k));
    if (was) {
      if (tip) return;
      was.inner = Math.max(was.inner, inner);
      was.edge = was.edge && edge;
      was.tip = false;
      return;
    }
    cells.set(key3(i, j, k), { i, j, k, inner, edge, tip: !!tip });
  };

  /* Every cell whose centre is inside the squashed sphere. The bounds
     are the sphere's own box in cell indices, so a 0.2 lobe visits
     nine cells rather than the whole crown. */
  const fill = (c, sr) => {
    const ry = sr * LOBE_SQUASH;
    const i0 = Math.floor((c.x - sr) / CELL - 0.5);
    const i1 = Math.ceil((c.x + sr) / CELL - 0.5);
    const k0 = Math.floor((c.z - sr) / CELL - 0.5);
    const k1 = Math.ceil((c.z + sr) / CELL - 0.5);
    const j0 = Math.floor((c.y - lawnY - ry) / LAYER);
    const j1 = Math.ceil((c.y - lawnY + ry) / LAYER);
    for (let i = i0; i <= i1; i++) {
      for (let k = k0; k <= k1; k++) {
        for (let j = j0; j <= j1; j++) {
          const dx = (cellX(i) - c.x) / sr;
          const dy = (lawnY + cellY(j) + LAYER / 2 - c.y) / ry;
          const dz = (cellZ(k) - c.z) / sr;
          if (dx * dx + dy * dy + dz * dz <= 1) mark(i, j, k, false);
        }
      }
    }
  };

  const subR = edge ? EDGE_SUB_R : 1;
  for (let s = 0; s < subs; s++) {
    const sr = radius * subR
      * (LOBE_SUB_R[0] + r() * (LOBE_SUB_R[1] - LOBE_SUB_R[0]));
    /* Off centre, and downward a little less than upward: a clump
       spreads along its branch and over it, not under it. */
    dir.set(r() - 0.5, (r() - 0.5) * 0.7, r() - 0.5).normalize();
    const off = radius
      * (LOBE_SUB_OFF[0] + r() * (LOBE_SUB_OFF[1] - LOBE_SUB_OFF[0]));
    sub.set(centre.x + dir.x * off,
      centre.y + dir.y * off * LOBE_SQUASH,
      centre.z + dir.z * off);
    fill(sub, sr);
  }

  /* The tips, biased away from the heart of the tree so they step
     outward rather than back into the mass. */
  const away = new THREE.Vector3(
    centre.x - CANOPY_HEART.x,
    (centre.y - lawnY - CANOPY_HEART.y) * 0.5,
    centre.z - CANOPY_HEART.z).normalize();
  const tips = Math.round(TIP_N * (radius / 0.45));
  for (let t = 0; t < tips; t++) {
    sphereDir(r, dir).addScaledVector(away, 0.9).normalize();
    const f = radius * (1 + r() * (TIP_REACH - 1));
    mark(Math.round((centre.x + dir.x * f) / CELL - 0.5),
      Math.round((centre.y + dir.y * f * LOBE_SQUASH - lawnY) / LAYER),
      Math.round((centre.z + dir.z * f) / CELL - 0.5), true);
  }
}

/* Turning the marked cells into pieces. Four passes, and the order of
   the first two is the whole performance story:

   1. **Colour.** Per cell, from `tintFor` as before — but the draw is
      a hash of the cell's *patch* (two cells square, three layers
      deep, which is one brick course) rather than of the cell, so the
      tints come out in patches a few plates across. That is both what
      a builder's bag of parts looks like and what lets the next pass
      merge anything at all: per-cell colour would make every run one
      plate long.
   2. **Cull the interior.** A cell with all six neighbours occupied
      can never be seen, and a crown this size is mostly interior. The
      neighbour test runs against the *full* set, so a surface cell
      under a culled one still knows it is covered and does not sprout
      a stud into solid blossom.
   3. **Merge runs.** Along x, within a layer, same colour, capped at
      RUN_MAX — so a flat top comes out as a few long plates and a
      stepped flank as a stack of short ones.
   4. **Studs and flowers.** A flower is clipped to an exposed stud and
      hides it, so the two are alternatives rather than stacked: where
      the draw takes a flower the stud is not drawn at all. The side
      faces get a few as well, axis-aligned — the crown is seen from
      the side as much as from above, and a bare plate wall there would
      read as a wall. */
function bakeCanopy(kit, cells, lawnY) {
  const full = cells;
  const has = (i, j, k) => full.has(key3(i, j, k));

  /* 1 — colour and depth. */
  for (const c of full.values()) {
    const x = cellX(c.i), z = cellZ(c.k), y = cellY(c.j) + LAYER / 2;
    const out = Math.hypot(x - CANOPY_HEART.x, z - CANOPY_HEART.z);
    c.depth = Math.min(1, Math.max(0,
      0.30 + 0.52 * out / HEART_SPAN
      + 0.26 * (y - CANOPY_HEART.y) - c.inner));
    c.col = tintFor(hash3(c.i >> 1, Math.floor(c.j / 3), c.k >> 1), c.depth,
      CORAL_PLATE, PLATE_LIFT);
  }

  /* 2 — the shell. */
  const skin = [];
  for (const c of full.values()) {
    if (has(c.i + 1, c.j, c.k) && has(c.i - 1, c.j, c.k)
      && has(c.i, c.j + 1, c.k) && has(c.i, c.j - 1, c.k)
      && has(c.i, c.j, c.k + 1) && has(c.i, c.j, c.k - 1)) continue;
    skin.push(c);
  }

  /* 3 — runs. Grouped by layer and row, then walked in x. */
  const rows = new Map();
  for (const c of skin) {
    const rk = `${c.j}|${c.k}`;
    let row = rows.get(rk);
    if (!row) rows.set(rk, (row = []));
    row.push(c);
  }
  for (const row of rows.values()) {
    row.sort((a, b) => a.i - b.i);
    let n = 0;
    for (let a = 0; a < row.length; a = n) {
      n = a + 1;
      while (n < row.length && n - a < RUN_MAX
        && row[n].i === row[n - 1].i + 1 && row[n].col === row[a].col) n++;
      const w = n - a, c = row[a];
      kit.brick(kit.mat(c.col, 0.38), w, 1,
        cellX(c.i + (w - 1) / 2), lawnY + cellY(c.j), cellZ(c.k),
        { h: LAYER, studs: false });
    }
  }

  /* 4 — what is clipped on top, and on the flanks. */
  const axes = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const v = new THREE.Vector3();
  for (const c of skin) {
    const x = cellX(c.i), z = cellZ(c.k);
    const top = lawnY + cellY(c.j) + LAYER;

    if (!has(c.i, c.j + 1, c.k)) {
      const share = c.tip ? 1 : c.edge ? EDGE_BLOOM : TOP_BLOOM;
      if (hash3(c.i, c.j + 977, c.k) < share) {
        flower(kit, tintFor(hash3(c.i + 31, c.j, c.k + 17), c.depth),
          new THREE.Vector3(x, top, z),
          new THREE.Quaternion().setFromAxisAngle(UP,
            snap(hash3(c.i + 7, c.j + 7, c.k + 7) * Math.PI * 2, ROLL_STEP)),
          BLOOM_TOP_SIZE);
      } else {
        kit.stud(kit.mat(c.col, 0.38), x, top, z);
      }
    }

    /* One flank flower at most, on the first open face going round —
       which `tip` cells never get, since a single plate out on its own
       already carries one on top. */
    if (c.tip || hash3(c.i + 5, c.j + 5, c.k + 5) >= SIDE_BLOOM) continue;
    for (const [di, dk] of axes) {
      if (has(c.i + di, c.j, c.k + dk)) continue;
      v.set(di, 0, dk);
      flower(kit, tintFor(hash3(c.i + 53, c.j + 11, c.k + 53), c.depth),
        new THREE.Vector3(x + di * CELL / 2,
          lawnY + cellY(c.j) + LAYER / 2, z + dk * CELL / 2),
        new THREE.Quaternion().setFromUnitVectors(UP, v),
        BLOOM_SIDE_SIZE);
      break;
    }
  }
}

function buildCanopy(kit, lawnY) {
  const r = rng(0xb1055 % 0xffffffff);
  const cells = new Map();

  LIMB_PLAN.forEach((L, i) => {
    if (!L.lobe) return;
    const { r: radius, floor = CANOPY_FLOOR, edge = false, inner = false } = L.lobe;
    const curve = limbCurve(i, lawnY);
    const opts = {
      radius: radius * (inner ? INNER_SCALE : 1),
      floor,
      edge,
      /* The fork lobes sit in the heart of the tree whatever their
         coordinates say, so their tint is pushed toward the rose. */
      inner: inner ? 0.30 : 0,
    };
    markClump(cells, r, curve.getPoint(1), lawnY, opts);

    /* A second, smaller clump part-way along the limb, so the mass is
       visibly carried by the wood instead of balanced on the end of
       it. Not on the twigs — a twig is all tip. */
    if (LIMB_GEN[i] === 1) {
      markClump(cells, r, curve.getPoint(MID_T), lawnY,
        { ...opts, radius: opts.radius * MID_SCALE });
    }
  });

  /* One small, separate cluster on each low branch, out at the tip.
     On the +X branch that is past both of the swing's ties, so the
     ropes and the seat stay clear. */
  LOW_PLAN.forEach((_, i) => {
    markClump(cells, r, lowBranchCurve(i, lawnY).getPoint(1), lawnY, {
      radius: LOW_LOBE_R, floor: LOW_LOBE_FLOOR, edge: true,
    });
  });

  bakeCanopy(kit, cells, lawnY);
}

/* ==========================================
   THE SPARE BRICKS

   Four loose pieces on the desk in front of the model, as if left over
   from building it — a 2x4, a 2x2, a 1x2 and a two-brick stack, in
   four colours already in the build. They are the one thing on this
   desk that says somebody put the tree together rather than bought it.

   Four things about them:

   - **They are their own group, not part of the model.** That is a
     tooling decision as much as a modelling one: `_canopyfit.mjs`
     measures the model's world box against the desk's, and a brick
     dropped two units in front of the tree would quietly move the
     front-edge margin it reports and stop the number meaning what it
     says. A sibling group costs a handful of draw calls — these are
     single pieces, so nothing instances — and keeps `__fit("treehouse")`
     honest. `__fit("spares")` reads this one.
   - **Their frame is the desk's, not the model's.** The treehouse is
     yawed by TREEHOUSE_FACING and the clearances these have to hold —
     the mouse's contact shadow at x 3.5..5.7 over z 2.0..4.6, its cord
     at x 1.5..4.5 over z 0.4..2.6, the base plate at 1.34 around
     (6.9, -2.1) — are all stated in the desk's. Sitting at the desk's
     own origin means the plan below is those coordinates directly
     rather than the same figures rotated by half a radian.
   - **One is tipped onto its side.** Three bricks lying flat at three
     angles still reads as an arrangement; a brick resting on a long
     face is the one that reads as dropped. `tip` rolls it a quarter
     turn about its own length, which puts its studs out sideways and
     its resting height at half its width.
   - **They cast for real.** Everything else small on this desk is
     grounded with a painted contact shadow, because the key's shadow
     map spreads 2048 texels over +/-80 world units and the hairline
     under a base plate never lands on one. A brick is a different
     case: it stands a third of a unit tall under a key raking in at
     13 degrees, so it throws about a unit and a half of shadow across
     the walnut — twenty texels of it, soft but unmistakably there.
   ========================================== */
const QUARTER = new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 2);
const LONG = new THREE.Vector3(0, 0, 1);

/* Three-quarters of full size: set down at 0.556, taken up 75% to
   0.973 and then back down 20%, all on request.

   Worth knowing what that lands on, because the number it wants to be
   compared against is not 1. The model carries a group scale
   (`TREEHOUSE_SCALE`, 1.1733) and these carry none, so the ratio is
   what decides whether a loose piece reads as the same part as the
   ones in the build: at 0.7784 it is ~66% of one. That is below the
   ~83% the 0.973 pass reached and well above the ~32% it started at —
   a brick that reads as belonging to the build while sitting a little
   smaller than one in it.

   It is carried in each piece's own matrix rather than on the group,
   because the group's origin is the desk's centre — scaling there
   would walk all four bricks a share of seven units back toward the
   mouse, which is a move dressed up as a resize. In the matrix the
   batch key is untouched, so these still share geometry with the
   build's own bricks; they are simply instanced at their own size.

   What it costs is clearance, and every figure is measured rather
   than assumed: these grow about their own placement points, so the
   group's box spreads on all four sides. Re-run `_spares.mjs` after
   touching this — the mouse's contact shadow, the desk's +x edge and
   the canopy's +z overhang are the three gaps it has to hold. */
const SPARE_SCALE = 0.7784;

/* w x d footprint, colour, where on the desk top, and the yaw it came
   to rest at. `on` is a second brick stacked on the first, crossed
   over it the way a leftover pair ends up. */
const SPARE_PLAN = [
  { w: 2, d: 4, c: PLANK, x: 7.05, z: 1.35, yaw: 0.33 },
  { w: 2, d: 2, c: PETAL_PINK, x: 8.25, z: 0.80, yaw: -0.54 },
  { w: 1, d: 2, c: GRASS, x: 8.70, z: 2.05, yaw: 1.15, tip: true },
  {
    w: 2, d: 2, c: PLANK_ALT, x: 7.25, z: 2.95, yaw: -0.20,
    on: { w: 1, d: 2, c: PETAL_PALE, yaw: 1.37 },
  },
];

/* A brick at an arbitrary orientation, with its studs. The kit's own
   `brick` is y-up and yaw-only — it places a piece on top of whatever
   is already there, which is what building is — so a piece lying where
   it fell needs this instead. Footprints are canonicalised the same
   way, and the quarter turn goes on the *right* so it happens in the
   brick's own frame before the pose does; that is what keeps it
   correct for a piece that is also rolled onto its side. The batch
   keys are the kit's, so a loose 2x4 in a colour the build already
   uses lands in the same geometry. */
function looseBrick(kit, material, w, d, pos, quat) {
  let bw = w, bd = d;
  const q = quat.clone();
  if (bw > bd) { bw = d; bd = w; q.multiply(QUARTER); }
  const s3 = new THREE.Vector3(SPARE_SCALE, SPARE_SCALE, SPARE_SCALE);

  kit.put(`box|${bw}x${bd}x${BH.toFixed(3)}|${material.userData.key}`,
    () => brickGeometry(bw * STUD, BH, bd * STUD),
    material, new THREE.Matrix4().compose(pos, q, s3));

  /* The stud offsets are in the brick's own space, so they take the
     scale before the pose does — otherwise the studs stay on the
     full-size grid and walk off the ends of a smaller brick. */
  const o = new THREE.Vector3();
  for (let i = 0; i < bw; i++) {
    for (let j = 0; j < bd; j++) {
      o.set((i - (bw - 1) / 2) * STUD, BH / 2 + STUD_H / 2,
        (j - (bd - 1) / 2) * STUD)
        .multiplyScalar(SPARE_SCALE).applyQuaternion(q).add(pos);
      kit.put(`stud|${material.userData.key}`,
        studGeometry,
        material, new THREE.Matrix4().compose(o.clone(), q, s3));
    }
  }
}

/* Built in the desk's frame with its origin on the desk top, so
   scene.js only lifts it by DESK_TOP_Y. */
export function buildSpareBricks() {
  const root = new THREE.Group();
  const kit = createKit();

  for (const B of SPARE_PLAN) {
    const q = new THREE.Quaternion().setFromAxisAngle(UP, B.yaw);
    /* Rolled about its own length, so it rests on a long face. The
       footprint is kept w <= d for a tipped piece, so the
       canonicalising quarter turn above never lands on top of this. */
    if (B.tip) q.multiply(new THREE.Quaternion().setFromAxisAngle(LONG, Math.PI / 2));
    const lie = (B.tip ? (B.w * STUD) / 2 : BH / 2) * SPARE_SCALE;
    const pos = new THREE.Vector3(B.x, lie, B.z);
    looseBrick(kit, kit.mat(B.c, 0.40), B.w, B.d, pos, q);

    if (!B.on) continue;
    /* The second of the pair, square on the first and crossed over it.
       Its own yaw is in the desk's frame like everything else here. */
    looseBrick(kit, kit.mat(B.on.c, 0.40), B.on.w, B.on.d,
      new THREE.Vector3(B.x, (BH + BH / 2) * SPARE_SCALE, B.z),
      new THREE.Quaternion().setFromAxisAngle(UP, B.on.yaw));
  }

  kit.bake(root);
  return root;
}

/* ==========================================
   GROUNDING IT

   The same painted contact shadow the desk and the computer use, and
   for the same reason: the key light's shadow map covers +/-80 world
   units, so a texel is about 0.08 across and the hairline under a base
   plate never lands on one. Without this the model floats.
   ========================================== */
function contactShadowTexture() {
  const s = 128;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(0,0,0,0.46)');
  g.addColorStop(0.46, 'rgba(0,0,0,0.24)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return track(new THREE.CanvasTexture(c));
}

/* ==========================================
   BUILD
   ========================================== */
export function buildTreehouse() {
  const root = new THREE.Group();
  const kit = createKit();

  const lawnY = buildBase(kit);
  buildLawnFlowers(kit, lawnY);
  buildTrunk(kit, lawnY);
  buildBranches(kit, lawnY);
  const ridgeY = buildHouse(kit, lawnY);
  buildLadder(kit, lawnY);
  buildSwing(kit, lawnY);
  buildPetals(kit, lawnY);
  buildCanopy(kit, lawnY);

  kit.bake(root);

  const shade = new THREE.Mesh(
    track(new THREE.PlaneGeometry(1, 1)),
    track(new THREE.MeshBasicMaterial({
      map: contactShadowTexture(), transparent: true, depthWrite: false, opacity: 0.85,
    })));
  shade.rotation.x = -Math.PI / 2;
  shade.scale.set(BASE_R * 2.2, BASE_R * 2.2, 1);
  shade.position.y = 0.012;
  shade.renderOrder = -1;
  root.add(shade);

  return { root, lawnY, ridgeY };
}

export function disposeTreehouse() {
  disposables.forEach((d) => d.dispose());
  disposables.length = 0;
}
