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
/* The moulding bevel. Tiny, and it is here because the key rakes in
   almost horizontally: without it two stacked bricks of the same colour
   share one unbroken face and the course line vanishes. These bricks
   carry flat colour and no noise map, so the fillet's collapsed UVs —
   the thing that made RoundedBoxGeometry unusable on the desk — cost
   nothing here. */
const BEVEL = STUD * 0.055;

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
const PETAL_WHITE = 0xf6f1ec;
const PETAL_PINK = 0xf2a3bb;
const PETAL_LIGHT = 0xfac4d4;
const ROPE = 0xcbab80;          // the ladder and the swing
const BLOSSOM_EYE = 0xf4d262;   // the pip at the centre of a flower

/* --- Proportions ----------------------------------------
   The base is a round plate a little narrower than the keyboard is
   deep, so the whole model sits inside the keyboard's footprint.

   The model was built a fifth larger and taken down to this on
   request, and **the way it was taken down is the point**: STUD did
   not move. Shrinking the pitch would have shrunk the bricks, which
   is the one thing this model cannot afford — at 0.24 a stud is back
   under eight pixels and the build stops reading as a build. So every
   figure that is a *count* of bricks came down instead: the trunk from
   nine courses to seven, its root from 4x4 studs to 3x3, the branch
   sections one size each, and the reaches below scaled with them. The
   bricks are the same bricks; there are fewer of them. */
const BASE_R = 1.64;
const BASE_H = PH * 1.4;        // a round base plate, a little proud of a plate
const RIM_H = PH * 0.8;         // the darker course it stands on

/* The trunk, in courses: seven to the fork, against a 3.3-unit lawn.
   What matters is the ratio rather than either figure — nine courses
   over the first, 4.1-unit base was the same tree, and seven courses
   over *that* base (which is what the first attempt was) reads as a
   shrub standing in the middle of a lot of grass. The two came down
   together. */
const TRUNK_COURSES = 7;
const TRUNK_H = TRUNK_COURSES * BH;
const TWIST = 0.085;            // radians of yaw added per course

/* --- The house ------------------------------------------
   Five studs square, which is as small as it can be and still hold a
   two-stud door with a wall either side of it. The ridge runs along Z,
   so the roof slopes down to the two flanks and the **gable faces the
   front** — the triangle over the door, which is the whole silhouette
   of a treehouse.

   ROOF_RISE being exactly BH is not a rounding. A stepped brick roof
   and the stepped gable under it have to meet, and they only meet if
   one course of rise lands on one stud of run: at the 0.75 x BH the
   first version used, every gable course poked a tenth of a unit
   through the slope above it. One brick per stud also happens to be a
   50-degree pitch, which is the steep roof the brief asks for. */
const HOUSE_W = 5;              // studs along X
const HOUSE_D = 5;              // studs along Z
const WALL_COURSES = 3;
const DOOR_COURSES = 2;         // how far up the doorway reaches
const WINDOW_COURSE = 1;        // which course the round window interrupts
const DECK_H = PH * 2;
/* Both above the lawn, and both at module scope because the rope
   ladder in part three has to start exactly where the porch ends. */
const DECK_Y = TRUNK_H;
const DECK_TOP = DECK_Y + DECK_H;
/* The roof's rise per unit of half-span — 1.1 is a 48-degree pitch —
   its overhang past the wall, and how deep it runs along the ridge.
   All three came down together after the first slope roof: at 1.15
   over a 0.9 half-span and seven studs deep, the slope face seen from
   the flank was larger than the wall under it and the model read as a
   roof with a house for a plinth. ROOF_THICK is the slope brick's own
   depth. */
const ROOF_PITCH = 1.1;
const ROOF_OVER = 0.4;          // studs of eave past the wall face
const ROOF_DEPTH = HOUSE_D + 1; // studs along the ridge
const ROOF_THICK = PH * 1.7;
const PORCH_D = 2;              // studs of deck standing out past the front wall
const RAIL_COURSES = 1;         // posts, in courses

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
        color: colour, roughness, metalness: 0, envMapIntensity: 0.34,
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
        () => new RoundedBoxGeometry(bw * STUD, h, bd * STUD, 1, BEVEL),
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
        () => new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 10),
        material, compose(x, y + STUD_H / 2, z, new THREE.Quaternion()));
    },

    /* A piece whose orientation is not a yaw — a branch segment lying
       along its curve, a roof slope. `make` is called once per batch. */
    piece(key, make, material, pos, quat) {
      put(key, make, material, new THREE.Matrix4().compose(pos, quat, UNIT));
    },

    bake(parent) {
      for (const b of batches.values()) {
        const geo = track(b.make());
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

  const hub = new THREE.CylinderGeometry(hubR, hubR * 0.92, h, 8);
  parts.push(hub);

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const p = new THREE.CylinderGeometry(petalR, petalR * 0.86, h * 0.86, 7);
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
const FLOWER_PIP_R = STUD * 0.17;

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
  for (let i = 0; i < 7; i++) {
    const a = r() * Math.PI * 2;
    const d = 0.8 + r() * 0.66;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    flower(kit, r() < 0.45 ? PETAL_PINK : PETAL_WHITE,
      new THREE.Vector3(x, top, z),
      new THREE.Quaternion().setFromAxisAngle(UP, r() * Math.PI * 2), 0.78);
  }
}

/* ==========================================
   THE TRUNK

   Seven courses, each yawed a little further round than the one under
   it and each laid out of two or three bricks rather than one — which
   is both how a trunk this thick is actually built and what gives the
   silhouette its knuckles. The alternating long axis between courses
   is the ordinary way bricks are bonded; here it also means the taper
   steps in and out instead of shrinking smoothly, which is what reads
   as bark.

   Each entry is a list of [w, d, dx, dz] in studs, laid in the course's
   own frame. The frame is yawed by the cumulative twist and leaned a
   little off vertical.
   ========================================== */
const TRUNK_PLAN = [
  [[3, 2, 0, -0.5], [3, 1, 0, 1]],               // 3x3 at the root
  [[2, 3, -0.5, 0], [1, 3, 1, 0]],               // 3x3 again, bonded crossways
  [[3, 2, 0, 0], [1, 1, -1.5, 1]],               // starting to taper, one knuckle
  [[2, 3, 0, 0], [2, 1, 0.5, -1.5]],
  [[3, 2, 0, 0]],
  [[2, 2, 0, 0], [1, 1, 1.5, -0.5]],
  [[2, 2, 0, 0]],
];

/* Where a course's frame sits: a gentle lean plus the twist. The trunk
   leans back and to the left, away from the viewer, so the house in the
   fork comes forward over the base rather than hanging off the back. */
function trunkFrame(i) {
  const t = i / TRUNK_COURSES;
  return {
    x: -0.13 * t * t - 0.04 * Math.sin(i * 0.9),
    z: -0.16 * t * t + 0.03 * Math.sin(i * 1.3 + 1),
    ry: i * TWIST,
  };
}

const TRUNK_TOP = trunkFrame(TRUNK_COURSES);   // the fork, in the base's frame

function buildTrunk(kit, floorY) {
  const bark = kit.mat(BARK, 0.56);
  const barkDark = kit.mat(BARK_DARK, 0.6);

  for (let i = 0; i < TRUNK_COURSES; i++) {
    const f = trunkFrame(i);
    const y = floorY + i * BH;
    const c = Math.cos(f.ry), s = Math.sin(f.ry);
    /* Every third course in the darker brown. Real builds mix two
       browns for exactly this reason — one colour over seven courses
       reads as a painted post. */
    const m = i % 3 === 2 ? barkDark : bark;
    for (const [w, d, dx, dz] of TRUNK_PLAN[i]) {
      const lx = dx * STUD, lz = dz * STUD;
      kit.brick(m, w, d,
        f.x + lx * c + lz * s, y, f.z - lx * s + lz * c,
        /* Studs only on the top course: everywhere else the next course
           is sitting on them, and a stud buried in a brick is geometry
           nobody will ever see. */
        { ry: f.ry, studs: i === TRUNK_COURSES - 1 });
    }
  }
  return floorY + TRUNK_H;
}

/* ==========================================
   THE BRANCHES

   Each branch is a quadratic curve with bricks stepped along it, one
   per course-height of arc, each turned so its own up-axis runs along
   the branch — which is how a brick branch is built, stacked end to
   end rather than side by side. The pieces overlap slightly so a bend
   has no gap in it, and they step down through three thicknesses, so
   the whole canopy's worth of branches is three geometries.

   The last piece of each branch gets a stud: that is where the
   blossoms clip on, and it is the one place on a branch where a stud
   points somewhere you can see it.
   ========================================== */
const BRANCH_SIZES = [[2, 2], [1, 2], [1, 1]];
/* The low branch is a limb, not a bough: at the thickness the canopy
   branches need it came off the trunk nearly as wide as the trunk and
   read as an arm sticking out of the model. */
const LIMB_SIZES = [[1, 2], [1, 1], [1, 1]];

function buildBranch(kit, material, from, ctrl, to, spin = 0, sizes = BRANCH_SIZES) {
  const curve = new THREE.QuadraticBezierCurve3(from, ctrl, to);
  const len = curve.getLength();
  const step = BH * 0.92;
  const n = Math.max(2, Math.round(len / step));
  const h = step * 1.3;             // overlap, so bends do not open up
  const tan = new THREE.Vector3();
  const q = new THREE.Quaternion();
  let tip = to, tipQ = q.clone();

  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const p = curve.getPoint(t);
    curve.getTangent(t, tan).normalize();
    q.setFromUnitVectors(UP, tan);
    /* A roll along the branch, so successive pieces are not all
       presenting the same face — the stepped-stack look. Gently: at a
       fifth of a turn per piece the first version read as a twisted
       rag rather than as a branch, because every piece showed a
       different corner to the key. */
    q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, spin + i * 0.12));

    const [w, d] = sizes[t < 0.18 ? 0 : t < 0.68 ? 1 : 2];
    kit.piece(`branch|${w}x${d}|${material.userData.key}`,
      () => new RoundedBoxGeometry(w * STUD, h, d * STUD, 1, BEVEL),
      material, p, q.clone());
    if (i === n - 1) { tip = p; tipQ = q.clone(); }
  }

  /* The stud on the end, pointing along the branch. */
  const o = tip.clone().add(new THREE.Vector3(0, h / 2, 0).applyQuaternion(tipQ));
  kit.put(`tipstud|${material.userData.key}`,
    () => new THREE.CylinderGeometry(STUD_R, STUD_R, STUD_H, 10),
    material, new THREE.Matrix4().compose(
      o.add(new THREE.Vector3(0, STUD_H / 2, 0).applyQuaternion(tipQ)),
      tipQ, UNIT));
  return to;
}

/* The fork: four branches up and out to carry the canopy, and one low
   one reaching out over the lawn for the swing to hang from. They are
   listed in the base's frame, with the fork as their common root.

   **The four are paired to the flanks, two each, and that is the house
   talking.** A fork that splays evenly round the compass puts a bough
   through the front wall and another through the back, and a branch
   passing through a wall with no notch cut for it reads as a mistake
   rather than as a tree. Sending them out along +/-X instead leaves
   the front (the door, the porch) and the back clear, and the two
   pairs then frame the house from either side, which is what "in the
   fork" is supposed to look like.

   They leave the trunk a course or two below the deck, bow out hard
   *below* it and then climb nearly straight: at the deck's own height
   each one is already 0.06 or more outside its 0.75 edge, and by the
   eave it is 0.18 clear of the roof's 0.87 overhang. The control
   points are set against those two numbers and nothing else, so moving
   HOUSE_W, ROOF_OVER or the deck means re-checking them.

   They are also spread in Z rather than stacked along X. The first
   pass sent all four out at |z| under 0.85 and from the flank they
   crossed in an X over the round window — the house's one piece of
   detail, behind a pair of limbs.

   `BRANCH_TIPS` is what the canopy is hung off later, so it is
   exported rather than recomputed — the blossoms have to land on the
   branches that are actually there. The swing goes further and asks
   for the whole curve; see branchCurve. */
const FORK_Y = TRUNK_H;
const BRANCH_PLAN = [
  // [ from, control, to ]  — all relative to the base's origin
  [[0.06, 1.98, 0.08], [1.30, 2.35, 0.85], [1.20, 4.40, 1.05]],    // +X, forward
  [[0.08, 2.10, -0.06], [1.26, 2.46, -0.80], [1.14, 4.02, -1.00]], // +X, back
  [[-0.06, 2.04, 0.06], [-1.28, 2.40, 0.80], [-1.16, 4.24, 1.00]], // -X, forward
  [[-0.08, 1.92, -0.08], [-1.22, 2.30, -0.76], [-1.08, 3.86, -0.94]], // -X, back
  /* The low one, for the swing. Out toward +X and well forward, which
     at this model's facing is screen right and toward the viewer — over
     open lawn, clear of the porch and of the bough above it. */
  [[0.22, 1.22, 0.10], [0.70, 1.42, 0.55], [1.05, 1.52, 1.05]],
];
export const BRANCH_TIPS = BRANCH_PLAN.map(([, , to]) => new THREE.Vector3(...to));
const SWING_LIMB = 4;          // which branch the swing hangs from

/* The sprays: a thin twig continuing each canopy branch up and inward
   over the house, and the only reason they exist is that the blossom
   has to get **above** the roof.

   Raising the four branch tips instead was the first attempt and it
   fails on a geometry the house already fixed: a branch that climbs
   faster reaches the eave's height at a smaller t, which is further
   *down* its own bow and therefore further *in*. Every tip I raised
   had to be paid for by pushing the control point out until the bough
   overhung the lawn. A spray starts where the verified curve ends and
   leaves all those clearances alone.

   Each one ends above the roof's 5.22 apex or outside its 0.87 half
   span, checked against both. */
const SPRAY_PLAN = [
  [[1.20, 4.40, 1.05], [1.22, 4.95, 0.92], [0.80, 5.30, 0.62]],
  [[1.14, 4.02, -1.00], [1.20, 4.60, -0.88], [0.78, 5.10, -0.60]],
  [[-1.16, 4.24, 1.00], [-1.20, 4.80, 0.90], [-0.78, 5.22, 0.60]],
  [[-1.08, 3.86, -0.94], [-1.14, 4.45, -0.84], [-0.74, 4.95, -0.58]],
];
const SPRAY_SIZES = [[1, 1], [1, 1], [1, 1]];

export function sprayCurve(i, lawnY) {
  const lift = new THREE.Vector3(0, lawnY, 0);
  const [a, c, b] = SPRAY_PLAN[i];
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...a).add(lift),
    new THREE.Vector3(...c).add(lift),
    new THREE.Vector3(...b).add(lift));
}

/* The curve a branch is actually built along, lifted onto the lawn.
   Exported from here rather than re-derived, because the swing hangs
   off branch 4 and a swing hanging off a *copy* of the maths is a
   swing that comes adrift the moment the branch is re-aimed. */
export function branchCurve(i, lawnY) {
  const lift = new THREE.Vector3(0, lawnY, 0);
  const [a, c, b] = BRANCH_PLAN[i];
  return new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...a).add(lift),
    new THREE.Vector3(...c).add(lift),
    new THREE.Vector3(...b).add(lift));
}

function buildBranches(kit, lawnY) {
  const bark = kit.mat(BARK, 0.56);
  const barkDark = kit.mat(BARK_DARK, 0.6);
  BRANCH_PLAN.forEach((_, i) => {
    const c = branchCurve(i, lawnY);
    buildBranch(kit, i % 2 ? barkDark : bark, c.v0, c.v1, c.v2,
      i * 0.7, i === 4 ? LIMB_SIZES : BRANCH_SIZES);
  });
  SPRAY_PLAN.forEach((_, i) => {
    const c = sprayCurve(i, lawnY);
    buildBranch(kit, i % 2 ? bark : barkDark, c.v0, c.v1, c.v2,
      i * 1.1 + 0.4, SPRAY_SIZES);
  });
}

/* ==========================================
   THE HOUSE

   Laid out on the stud grid in the trunk's own frame, so moving the
   trunk moves the house with it. `ix`/`iz` turn a stud index into a
   local coordinate; indices run -2..2 across a five-stud house, so a
   wall face sits at index +/-2.5 and the roof's eave at +/-3.5.

   The house deliberately does **not** inherit the trunk's cumulative
   twist. The trunk is 0.51 rad round by its top course and a house
   turned with it would face nowhere in particular; the model's own +Z
   is the front, and scene.js turns the whole group to present it.
   ========================================== */
const HOUSE_F = trunkFrame(TRUNK_COURSES - 1);
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
  const wallY = deckY + DECK_H;
  const eaveY = wallY + WALL_COURSES * BH;

  /* --- The deck ------------------------------------------
     One slab of plates carrying the house and the porch in front of
     it, two plates thick so its edge is a board rather than a line.
     Seven studs deep: five under the house, two standing out past the
     front wall. */
  const deckD = HOUSE_D + PORCH_D;
  const deckZ = iz(PORCH_D / 2);              // pushed forward by the porch
  for (let k = 0; k < 2; k++) {
    kit.brick(deckMat, HOUSE_W, deckD, ix(0), deckY + k * PH, deckZ,
      { h: PH, studs: k === 1 });
  }

  /* Two joists under it crossing the trunk's top, and a strut out to
     each front corner. A five-stud deck on a two-stud post is a
     cantilever, and without something visibly carrying it the house
     reads as stuck on rather than built on. */
  for (const j of [-1.5, 1.5]) {
    kit.brick(bark, HOUSE_W - 1, 1, ix(0), deckY - PH, iz(j), { h: PH, studs: false });
  }
  for (const sx of [-1, 1]) {
    const a = new THREE.Vector3(ix(sx * 0.4), deckY - 0.62, iz(0.2));
    const b = new THREE.Vector3(ix(sx * 1.9), deckY - 0.02, iz(1.9));
    const d = b.clone().sub(a);
    kit.piece(`strut|${bark.userData.key}|${d.length().toFixed(3)}`,
      () => new RoundedBoxGeometry(STUD * 0.8, d.length(), STUD * 0.8, 1, BEVEL),
      bark, a.clone().add(b).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
  }

  /* --- The walls -----------------------------------------
     Five studs square. The front carries a two-stud doorway, the +X
     flank a round window, and the courses are bonded — the joint moves
     a stud each course, which is both how a wall is laid and what
     keeps the two tans from stacking into vertical stripes. */
  for (let c = 0; c < WALL_COURSES; c++) {
    const y = wallY + c * BH;
    const m = c % 2 ? plankAlt : plank;
    const top = c === WALL_COURSES - 1;
    const odd = c % 2 === 1;

    // back
    if (odd) {
      kit.brick(m, 2, 1, ix(-1.5), y, iz(-2), { studs: top });
      kit.brick(m, 3, 1, ix(1), y, iz(-2), { studs: top });
    } else {
      kit.brick(m, 3, 1, ix(-1), y, iz(-2), { studs: top });
      kit.brick(m, 2, 1, ix(1.5), y, iz(-2), { studs: top });
    }

    // front, with the doorway at stud indices -1 and 0
    if (c < DOOR_COURSES) {
      kit.brick(m, 1, 1, ix(-2), y, iz(2), { studs: top });
      kit.brick(m, 2, 1, ix(1.5), y, iz(2), { studs: top });
    } else {
      kit.brick(m, HOUSE_W, 1, ix(0), y, iz(2), { studs: top });  // the lintel
    }

    // flanks, three studs between the front and back walls
    for (const sx of [-1, 1]) {
      if (sx === 1 && c === WINDOW_COURSE) {
        /* The one stud the round window needs out of the way. Its
           frame is wider than the hole and stands proud of the face,
           so the hole never shows as a square. */
        kit.brick(m, 1, 1, ix(2), y, iz(-1), { studs: false });
        kit.brick(m, 1, 1, ix(2), y, iz(1), { studs: false });
      } else {
        kit.brick(m, 1, 3, ix(sx * 2), y, iz(0), { studs: top });
      }
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
     a five-stud span it is two steps, and two steps do not read as a
     pitch: from the gable end it was a ziggurat and from the flank a
     plain grey box as deep as the house. A slope brick is every bit as
     much a standard brick element, and five of them in a row read as a
     roof immediately.

     The geometry is set by the *underside* line, eave to ridge, and
     everything else is derived from it: the slab's own thickness is
     carried outward along the slope normal, so the eave lands exactly
     on the plate rather than a fraction of a unit through it. */
  const roofD = ROOF_DEPTH;
  kit.brick(shingle, HOUSE_W + 2 * ROOF_OVER, roofD, ix(0), eaveY, iz(0),
    { h: PH, studs: false });

  const baseY = eaveY + PH;
  const eaveX = (HOUSE_W / 2 + ROOF_OVER) * STUD;
  const rise = eaveX * ROOF_PITCH;
  const ang = Math.atan2(rise, eaveX);
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
  const apexY = baseY + rise + ROOF_THICK / ca;
  kit.piece(`ridgebar|${ridgeMat.userData.key}`,
    () => new RoundedBoxGeometry(STUD * 0.62, PH * 1.1, roofD * STUD, 1, BEVEL),
    ridgeMat, new THREE.Vector3(ix(0), apexY - PH * 0.45, iz(0)), new THREE.Quaternion());

  /* --- The gable -----------------------------------------
     The triangle the slope leaves over the front and back walls. See
     gableRows for where the widths come from. */
  gableRows(rise, eaveX).forEach((w, r) => {
    for (const sz of [-1, 1]) {
      kit.brick(r % 2 ? plankAlt : plank, w, 1, ix(0),
        baseY + r * PH, iz(sz * 2), { h: PH, studs: false });
    }
  });

  /* --- The door ------------------------------------------
     A panel filling the opening rather than a hole: the house has no
     interior, and an open door on an empty box is worse than a shut
     one. The panel alone was not enough — the front faces away from
     the key, so a dark panel in a dark reveal read as a doorway with
     nothing in it. The light trim casing around it is what says door. */
  const doorW = 2 * STUD, doorH = DOOR_COURSES * BH;
  const doorZ = iz(2.5);
  kit.piece(`doorcase|${trim.userData.key}`,
    () => new RoundedBoxGeometry(doorW + 0.1, doorH + 0.06, PH * 0.45, 1, BEVEL),
    trim,
    new THREE.Vector3(ix(-0.5), wallY + doorH / 2 + 0.02, doorZ + PH * 0.18),
    new THREE.Quaternion());
  kit.piece(`door|${deckMat.userData.key}`,
    () => new RoundedBoxGeometry(doorW - 0.04, doorH - 0.04, PH * 0.5, 1, BEVEL),
    deckMat,
    new THREE.Vector3(ix(-0.5), wallY + doorH / 2, doorZ + PH * 0.36),
    new THREE.Quaternion());
  kit.piece(`knob|${trim.userData.key}`,
    () => new THREE.CylinderGeometry(STUD * 0.12, STUD * 0.12, PH * 0.7, 10),
    trim,
    new THREE.Vector3(ix(0.12), wallY + doorH * 0.5, doorZ + PH * 0.6),
    new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0, 0, 1)));

  /* --- The round window ----------------------------------
     A ring and a pane on the +X flank, which at this model's facing is
     the side the camera sees. The frame is a torus, and that is the
     fix rather than a detail: the first version used a cylinder for
     it, which is a solid disc — it covered its own glass completely
     and the window rendered as a blank white dot. The pane sits inside
     the ring and a little behind it, so the rim throws a shadow line
     across the glass, which is what stops it reading as a sticker. */
  const faceX = ix(2.5);
  const winY = wallY + (WINDOW_COURSE + 0.5) * BH;
  const acrossX = new THREE.Quaternion()
    .setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  kit.piece(`winframe|${trim.userData.key}`,
    () => new THREE.TorusGeometry(STUD * 0.82, STUD * 0.17, 8, 24),
    trim, new THREE.Vector3(faceX + PH * 0.42, winY, iz(0)), acrossX);
  kit.piece(`winglass|${glassMat.userData.key}`,
    () => new THREE.CylinderGeometry(STUD * 0.8, STUD * 0.8, PH * 0.5, 20),
    glassMat, new THREE.Vector3(faceX + PH * 0.16, winY, iz(0)),
    new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(1, 0, 0)));

  /* --- The porch rail ------------------------------------
     Posts at the two front corners and a rail of plates between them,
     with the middle stud of the front run left open: that gap is where
     the rope ladder goes over the edge. One course of post, not two —
     at two the rail stood within a plate of the wall top and read as a
     second storey rather than as something to lean on. */
  const railY = deckY + DECK_H;
  const postH = RAIL_COURSES * BH;
  for (const sx of [-1, 1]) {
    kit.brick(deckMat, 1, 1, ix(sx * 2), railY, iz(4), { h: postH, studs: false });
    // the side rail, post back to the front wall
    kit.brick(deckMat, 1, 2, ix(sx * 2), railY + postH, iz(3), { h: PH });
  }
  /* The front run, with its gap lined up on the doorway rather than on
     the centre line — the two are not the same, the door sits a stud
     left of centre, and a rail across half of it was the first
     version. The gap is both the way out onto the ladder and the
     reason the door is not hidden behind a bar. */
  kit.brick(deckMat, 1, 1, ix(-2), railY + postH, iz(4), { h: PH });
  kit.brick(deckMat, 2, 1, ix(1.5), railY + postH, iz(4), { h: PH });

  return apexY;   // the ridge, for the canopy to clear
}

/* ==========================================
   THE ROPE LADDER

   From the gap in the porch rail down to the lawn. Two ropes and eight
   rungs; the ropes are one tube geometry built in the YZ plane and
   placed twice either side of the centre line, since both follow the
   identical curve.

   Where it lands is not free. The porch's front edge is 1.25 from the
   base's centre and the lawn's own radius is 1.64, so a ladder that
   leans out as far as a real one would — the foot kicked a half unit
   clear of the drop — comes down off the edge of the base plate and
   onto the desk. It hangs nearly plumb instead, with a slight belly,
   and the foot lands at 1.27: on the grass, with room.
   ========================================== */
const LADDER_X = -0.5;          // stud index, inside the rail's gap
const LADDER_Z = 4.4;           // stud index, just inside the deck's edge
const LADDER_RUNGS = 8;
const ROPE_R = 0.042;           // thick enough to survive the home framing

function buildLadder(kit, lawnY) {
  const rope = kit.mat(ROPE, 0.68);
  const rung = kit.mat(PLANK_DARK, 0.6);
  const z0 = iz(LADDER_Z);

  /* Built about x = 0 so one tube serves both ropes. */
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(0, lawnY + DECK_TOP, z0),
    new THREE.Vector3(0, lawnY + DECK_TOP * 0.45, z0 + 0.22),
    new THREE.Vector3(0, lawnY + 0.03, z0 + 0.16));

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
/* How far the seat hangs below the tie. 0.86 put it 0.45 above the
   grass, which on a 3.3-unit lawn reads as a plank left lying there
   rather than as a seat; 0.68 clears it by 0.63. */
const SWING_DROP = 0.68;

function buildSwing(kit, lawnY) {
  const rope = kit.mat(ROPE, 0.68);
  const seatMat = kit.mat(PLANK_DARK, 0.55);

  const limb = branchCurve(SWING_LIMB, lawnY);
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
const PETALS = 26;

function buildPetals(kit, lawnTop) {
  const r = rng(0x9e7a11);
  const tint = [kit.mat(PETAL_PINK, 0.4), kit.mat(PETAL_LIGHT, 0.4)];
  const scale = new THREE.Vector3(1.45, 1, 0.78);
  const limit = BASE_R - STUD * 0.9;
  const axis = new THREE.Vector3();

  for (let i = 0; i < PETALS; i++) {
    let x, z;
    do {
      x = (r() * 2 - 1) * limit;
      z = (r() * 2 - 1) * limit;
    } while (Math.hypot(x, z) > limit || Math.hypot(x, z) < 0.64);

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

   Clusters of cherry blossom in three tints, filling a shell around
   and above the house. Three things decide where a cluster can go:

   - **A shell, not a ball.** The flowers are a surface — a solid
     canopy is thousands of blossoms nobody can see, and the ones
     inside cost exactly what the ones outside do. Centres are sampled
     between 0.62 and 1.0 of the ellipsoid's radius, biased upward, so
     the mass reads as a crown rather than as a sphere on a stick.
   - **A keep-out box round the house.** The house is inside the
     canopy's volume, so without this the blossom grows through the
     roof and out of the walls. It is the roof's own half-span and
     apex with a little margin, which is why it is written against
     those numbers and not against a guess.
   - **Clusters on the branches as well as on the shell**, so the
     canopy is visibly carried by the wood under it rather than
     hovering over it. They go on the outer half of each bough and
     along the whole of each spray.

   The flowers face outward from the canopy's centre, not up. A field
   of blossom all facing the sky is a lawn; what makes this read as a
   tree is that every flower on the underside is looking down at you.
   ========================================== */
const BLOSSOM_TINTS = [PETAL_PINK, PETAL_LIGHT, PETAL_WHITE];
const BLOSSOM_MIX = [0.42, 0.74];      // cumulative, so soft/light/white
const CANOPY_Y = 4.85;                 // the shell's centre, above the lawn
const CANOPY_R = [1.55, 0.95, 1.45];   // its radii
const CANOPY_SHELL = [0.62, 1.0];      // how thick a skin the clusters occupy
const CANOPY_CLUSTERS = 48;
const CLUSTER_R = 0.17;                // how far a flower strays from its cluster
const CLUSTER_N = [3, 6];
const BLOOM_SIZE = [0.82, 1.22];
/* The house, as the canopy sees it: the roof's half span and its apex,
   plus enough margin that a flower's own radius cannot reach in. */
const KEEP_X = 1.02, KEEP_Z = 1.02, KEEP_Y = 5.42;
const CANOPY_FLOOR = 3.45;             // no blossom hanging level with the walls

function tintFor(v) {
  return BLOSSOM_TINTS[v < BLOSSOM_MIX[0] ? 0 : v < BLOSSOM_MIX[1] ? 1 : 2];
}

/* A rosette: a handful of flowers around a point, each turned to face
   roughly along `normal` with a few degrees of its own wander. */
function cluster(kit, r, centre, normal, lawnY) {
  const n = CLUSTER_N[0] + Math.floor(r() * (CLUSTER_N[1] - CLUSTER_N[0] + 1));
  for (let i = 0; i < n; i++) {
    const off = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5)
      .multiplyScalar(CLUSTER_R * 2);
    const p = centre.clone().add(off);
    if (insideHouse(p, lawnY)) continue;
    const face = normal.clone().add(off.clone().multiplyScalar(2.2)).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(UP, face)
      .multiply(new THREE.Quaternion().setFromAxisAngle(UP, r() * Math.PI * 2));
    flower(kit, tintFor(r()), p, q,
      BLOOM_SIZE[0] + r() * (BLOOM_SIZE[1] - BLOOM_SIZE[0]));
  }
}

function insideHouse(p, lawnY) {
  return Math.abs(p.x - HOUSE_F.x) < KEEP_X
    && Math.abs(p.z - HOUSE_F.z) < KEEP_Z
    && p.y < lawnY + KEEP_Y;
}

function buildCanopy(kit, lawnY) {
  const r = rng(0xb1055 % 0xffffffff);
  const centre = new THREE.Vector3(0, lawnY + CANOPY_Y, 0);

  /* The shell. Rejection sampling rather than a closed form, because
     the keep-out is a box and the shell is an ellipsoid; the guard is
     only there so a bad constant cannot spin forever. */
  let placed = 0;
  for (let guard = 0; placed < CANOPY_CLUSTERS && guard < 6000; guard++) {
    const theta = r() * Math.PI * 2;
    const cy = -0.3 + r() * 1.3;                  // biased to the crown
    const s = Math.sqrt(Math.max(0, 1 - cy * cy));
    const dir = new THREE.Vector3(Math.cos(theta) * s, cy, Math.sin(theta) * s);
    const f = CANOPY_SHELL[0] + r() * (CANOPY_SHELL[1] - CANOPY_SHELL[0]);
    const p = centre.clone().add(new THREE.Vector3(
      dir.x * CANOPY_R[0] * f, dir.y * CANOPY_R[1] * f, dir.z * CANOPY_R[2] * f));
    if (p.y < lawnY + CANOPY_FLOOR || insideHouse(p, lawnY)) continue;
    cluster(kit, r, p, dir, lawnY);
    placed++;
  }

  /* And on the wood: the outer half of each bough, and the whole of
     each spray. */
  const tan = new THREE.Vector3();
  const along = (curve, ts) => {
    for (const t of ts) {
      const p = curve.getPoint(t);
      if (p.y < lawnY + CANOPY_FLOOR) continue;
      curve.getTangent(t, tan);
      const normal = p.clone().sub(centre).normalize().add(tan).normalize();
      cluster(kit, r, p, normal, lawnY);
    }
  };
  for (let i = 0; i < 4; i++) {
    along(branchCurve(i, lawnY), [0.72, 0.88, 1.0]);
    along(sprayCurve(i, lawnY), [0.22, 0.5, 0.78, 1.0]);
  }
}

/* ==========================================
   DRIFTING PETALS

   A dozen petals falling out of the canopy onto the base, and the one
   piece of this model that is not static geometry. Four things fall
   out of that, and the first is the only one the scene cares about:

   - **They do not cast.** The scene renders its shadow map once and
     freezes it (`renderer.shadowMap.autoUpdate = false`), because
     nothing in the room moves; a moving caster would bake its shadow
     into that one frame and then drag the stale print around the floor
     for the rest of the session. `castShadow = false` keeps them out
     of the shadow pass entirely, so the freeze stays correct. They
     still *receive*, which costs nothing and is read from the same
     frozen map.
   - **They fade by shrinking, not by alpha.** A petal is about two
     pixels across at the home framing, and at that size the two are
     indistinguishable — while a transparent material would mean
     depth-sorting a dozen moving quads against three hundred blossoms
     for no visible gain. The scale ramps up over the first twelve
     percent of the fall and back down over the last twenty, so a petal
     appears in the canopy and is gone by the time it reaches the
     grass.
   - **They fall outside the house, not through it.** Spawn radius
     starts beyond the canopy's own keep-out box, and the sway is small
     enough that none of them wanders back over the roof. Petals fall
     *around* a house; there is no case to handle.
   - **`frustumCulled` is off.** Three caches an InstancedMesh's
     bounding sphere the first time it needs one, and these instances
     move every frame, so the cache would be describing where the
     petals used to be. Two small meshes; not worth recomputing it.

   Under `prefers-reduced-motion` scene.js never starts a render loop,
   so there is nothing to step the fall — the group is hidden instead,
   rather than left as a dozen petals frozen in mid-air.
   ========================================== */
const DRIFT_N = 12;
const DRIFT_SPAN = 4.5;         // how far a petal falls
const DRIFT_SECONDS = [11, 17]; // and how long it takes — slowly
const DRIFT_SWAY = 0.13;
const DRIFT_R = [1.16, 1.52];   // spawn radius: outside the house, inside the lawn
const PETAL_SHAPE = new THREE.Vector3(1.45, 1, 0.78);

function buildDrift(lawnY) {
  const group = new THREE.Group();
  const geo = track(new THREE.CylinderGeometry(STUD * 0.23, STUD * 0.23, PH * 0.3, 8));
  const r = rng(0x5ca77e);
  const meshes = [];
  const petals = [];

  for (const colour of [PETAL_PINK, PETAL_LIGHT]) {
    const n = DRIFT_N / 2;
    const im = new THREE.InstancedMesh(geo, track(new THREE.MeshStandardMaterial({
      color: colour, roughness: 0.4, metalness: 0, envMapIntensity: 0.34,
    })), n);
    im.castShadow = false;
    im.receiveShadow = true;
    im.frustumCulled = false;
    meshes.push(im);
    group.add(im);

    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2;
      const d = DRIFT_R[0] + r() * (DRIFT_R[1] - DRIFT_R[0]);
      petals.push({
        mesh: im,
        index: i,
        x: Math.cos(a) * d,
        z: Math.sin(a) * d,
        top: lawnY + DRIFT_SPAN,
        /* Staggered, so they are not a falling curtain. */
        u: r(),
        rate: 1 / (DRIFT_SECONDS[0] + r() * (DRIFT_SECONDS[1] - DRIFT_SECONDS[0])),
        phase: r() * Math.PI * 2,
        sways: 1.2 + r() * 1.6,
        spins: 1.5 + r() * 2.5,
        axis: new THREE.Vector3(r() - 0.5, r() * 0.4, r() - 0.5).normalize(),
        size: 0.85 + r() * 0.4,
      });
    }
  }

  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();

  function place(p) {
    const turn = p.phase + p.u * Math.PI * 2;
    pos.set(
      p.x + Math.sin(turn * p.sways) * DRIFT_SWAY,
      p.top - p.u * DRIFT_SPAN,
      p.z + Math.cos(turn * p.sways * 0.8) * DRIFT_SWAY * 0.7);
    const s = p.size
      * Math.min(1, p.u / 0.12)           // appearing in the canopy
      * Math.min(1, (1 - p.u) / 0.2);     // gone before it reaches the grass
    scl.copy(PETAL_SHAPE).multiplyScalar(s);
    q.setFromAxisAngle(p.axis, p.phase + p.u * p.spins * Math.PI * 2);
    p.mesh.setMatrixAt(p.index, m.compose(pos, q, scl));
  }

  petals.forEach(place);
  meshes.forEach((im) => { im.instanceMatrix.needsUpdate = true; });

  return {
    group,
    update(dt) {
      for (const p of petals) {
        p.u += dt * p.rate;
        if (p.u >= 1) p.u -= 1;
        place(p);
      }
      for (const im of meshes) im.instanceMatrix.needsUpdate = true;
    },
  };
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

  /* The one moving part. It hangs off `root` with everything else, so
     it travels with the model; scene.js owns whether it is stepped. */
  const drift = buildDrift(lawnY);
  drift.group.name = "treehouse-drift";
  root.add(drift.group);

  return { root, lawnY, ridgeY, drift };
}

export function disposeTreehouse() {
  disposables.forEach((d) => d.dispose());
  disposables.length = 0;
}
