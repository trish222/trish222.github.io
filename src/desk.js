import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ==========================================
   THE DESK

   A 1950s-60s double-pedestal steel "tanker" desk, built entirely from
   primitives — no imported models — after design-references/desk.png.
   Taken from the reference: the cream enamel steel base and drawer
   fronts with the paint worn through here and there, the curved chrome
   pulls, the shallow locking centre drawer bridging the knee hole, and
   the short feet that stand the whole thing off the floor. The desk in
   the photograph has a dark linoleum top; this one gets a thick solid
   walnut slab instead, overhanging the steel on three sides.

   Local space matches the computer's: +Z is the front (the side the
   visitor sits at, and the side the drawers open toward), origin on the
   floor at the centre of the desk.

   **Which pedestal is which is stated in screen terms, not in the
   desk's own.** The camera sits in the +X/+Z octant, so +X is screen
   right; the reference photograph's left pedestal — the single deep
   file drawer — is therefore at -X here, and its right pedestal, the
   stack of three, at +X. That also puts the more interesting of the
   two on the near corner rather than behind the monitor.

   Scale is set by the computer that stands on it: the keyboard is 6.9
   units across, so a unit is a shade over two inches. The plan is
   a 47-inch by 31-inch desk; the *height* is deliberately not —
   a real 29-inch desk under a 17-inch CRT is nearly two-thirds desk,
   and at that ratio the machine is a detail on top of a cabinet. See
   DESK_TOP_Y.
   ========================================== */

/* --- Palette --------------------------------------------- */
/* Cream enamel, a touch warmer and darker than the computer's shell so
   the two do not merge into one object at this camera — and darker
   again than that looks necessary at the home framing, because of what
   happens at the ends of the orbit leash. A pedestal end is a large
   flat panel whose normal points along -X, and the key rakes in from
   almost exactly there: it takes about four times the direct light the
   floor does (N.L of 0.88 against sin 13 degrees), so at the brighter
   value the whole panel clipped to white at the left clamp and lost
   every chip and scuff on it. */
const ENAMEL = 0xc2b79e;
const ENAMEL_DARK = 0x6b6454;   // drawer reveals, the recessed bays
/* The knee hole and the inside of the carcase. Much darker than it
   "should" be as paint: the key rakes in from the left and never
   reaches in there, but ambient plus hemisphere fill still lift a
   cream interior to within a shade of the lit outside, and the opening
   then reads as a panel rather than a hole. Not black either — at
   0x3c382f the first version punched a hole clean through the picture
   and the modesty panel behind it vanished. */
const INTERIOR = 0x5d564a;
const CHROME = 0xd8dbdf;
const WOOD_TINT = 0xffffff;     // the map carries the colour; see deskWood

/* --- Proportions ----------------------------------------- */
const DESK_W = 19.0;            // along +X
/* Along +Z, and set by what has to stand on it rather than by taste:
   the CRT's funnel runs 4.8 units back from the stand and the keyboard
   2.6 forward of it, so the kit occupies very nearly 12 units of depth
   and a shallower desk simply has a monitor hanging off the back of
   it. Which is what the first pass did — 10.5 deep, from an estimate
   of the kit's depth rather than a measurement of it, and the overhang
   was invisible at the home framing and obvious the moment the camera
   swung to a side view. */
const DESK_D = 12.6;
/* Height of the *top surface*, which is what everything standing on the
   desk is placed against — hence the export.

   True to scale this would be about 11.4. It is 9 because the frame has
   to hold the desk, the monitor on top of it and enough floor either
   side for the wordmark to read: at 11.4 the assembly stands 17.9 units
   tall against an 18-unit frustum, so the camera would have to pull
   back far enough to shrink the CRT — the thing the visitor is meant to
   click — by about a fifth. Nine units reads as a desk and leaves the
   machine the hero. */
export const DESK_TOP_Y = 9.0;

const TOP_THICK = 0.62;         // a solid slab, not a veneered panel
const TOP_EDGE_R = 0.1;         // softly rounded, satin, worn smooth
/* The slab stands proud of the steel on the two ends and the front; the
   back is nearly flush, as it is on the reference. */
const OVERHANG = 0.55;
const OVERHANG_BACK = 0.22;

const FOOT_H = 0.55;            // short feet, just off the floor
const PED_W = 5.2;              // each pedestal, ~29% of the base as in the photo
const KNEE_W = DESK_W - 2 * OVERHANG - 2 * PED_W; // what is left between them

const BASE_W = DESK_W - 2 * OVERHANG;
const BASE_D = DESK_D - OVERHANG - OVERHANG_BACK;
const BASE_H = DESK_TOP_Y - TOP_THICK - FOOT_H;   // pedestal shell height

/* The shallow centre drawer bridging the knee hole, and the apron of
   steel the pedestals hang from behind it. */
const CENTRE_H = 0.86;
const CENTRE_W = KNEE_W - 0.5;

/* The drawer fronts are *overlay* fronts, as they are on the reference:
   they span the full width of the pedestal and the only reveals are the
   shadow lines between them. So the pedestal is modelled as a carcase
   that stops FRONT_SET short of the front, a dark panel closing it, and
   the fronts stacked in the space that leaves — which is what makes a
   reveal a gap you can see into rather than a line drawn on a cabinet.

   The first version stood the fronts 0.05 off a full-depth shell, and
   it failed twice over: the reveals showed cream, so the stack read as
   one panel with scratches on it; and a front 0.03 clear of the face
   behind it is far inside one texel of a shadow map spread over 160
   world units, so the contact came back as a dotted line of acne down
   every edge. Both go away once the gap is a real one. */
const FRONT_SET = 0.34;         // depth the fronts occupy at the front
const GAP = 0.1;                // the reveal between two of them

const disposables = [];
function track(...xs) { disposables.push(...xs); return xs[0]; }

/* ==========================================
   THE ENAMEL

   Two problems, two textures. The shells want a *tiling* field so a
   large flat panel is not one dead colour; the drawer fronts want a
   *per-face* one, because the wear on a sixty-year-old desk is not
   randomly scattered — it collects where hands and chair arms reach:
   along the edges, around the pull, and along the bottom lip where feet
   and vacuum cleaners get at it. A tiling texture cannot know where its
   edges are.

   Both come out of one draw as an albedo/roughness pair, the same
   trick plasticTextures plays in computer.js and for the same reason:
   on real paint the chipped and scuffed patches are also the duller
   ones, and roughness alone is invisible on a surface this matt.
   ========================================== */

/* Value noise on a lattice, bilinear with a smoothstep — the low
   frequency layer under both textures below. */
function valueNoise(size, cells) {
  const lattice = Array.from({ length: cells * cells }, () => Math.random());
  const at = (i, j) => lattice[(((j % cells) + cells) % cells) * cells +
                               (((i % cells) + cells) % cells)];
  const smooth = (t) => t * t * (3 - 2 * t);
  const cell = size / cells;
  return (x, y) => {
    const fx = x / cell, fy = y / cell;
    const i = Math.floor(fx), j = Math.floor(fy);
    const tx = smooth(fx - i), ty = smooth(fy - j);
    const a = at(i, j) * (1 - tx) + at(i + 1, j) * tx;
    const b = at(i, j + 1) * (1 - tx) + at(i + 1, j + 1) * tx;
    return a * (1 - ty) + b * ty;
  };
}

function canvas2d(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function texture(c, srgb, repeat) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat, repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return track(t);
}

/* The tiling field: sprayed enamel over pressed steel. Gentle — this is
   the ground the per-face wear sits on, so anything strong here would
   be read as dirt once it repeated across a panel. */
function enamelTextures(size = 320) {
  const low = valueNoise(size, 10);
  const [ac, actx] = canvas2d(size, size);
  const [rc, rctx] = canvas2d(size, size);
  const albedo = actx.createImageData(size, size);
  const rough = rctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const n = low(x, y);
      const fine = Math.random();
      const k = (y * size + x) * 4;
      /* Narrow spread: `map` multiplies the material colour, so more
         than a few percent here reads as grime rather than as paint. */
      const v = 242 + n * 8 + fine * 5;
      albedo.data[k] = albedo.data[k + 1] = albedo.data[k + 2] = v;
      albedo.data[k + 3] = 255;
      /* Wide spread: this is what breaks the sheen up across a panel,
         but only so far — at a 62-point swing the low-frequency layer
         read as stucco across a pedestal end rather than as paint. */
      const r = 172 + n * 30 + fine * 18;
      rough.data[k] = rough.data[k + 1] = rough.data[k + 2] = r;
      rough.data[k + 3] = 255;
    }
  }
  actx.putImageData(albedo, 0, 0);
  rctx.putImageData(rough, 0, 0);
  /* Repeat is a trade and both ends of it have been seen. Tile it
     often and each lattice cell lands small, but the *tile* repeats
     visibly: at six across a pedestal end the field read as a quilted
     diamond grid. Tile it rarely and a single cell spreads into a damp
     patch. Two tiles over ten world units, with ten cells in each,
     puts a cell at about half a unit and gives the eye only one seam
     to find. The albedo swing is deliberately tiny for the same
     reason — the roughness carries this, not the colour. */
  return { albedo: texture(ac, true, 2), rough: texture(rc, false, 2) };
}

/* One drawer front's worth of paint, drawn at the face's own aspect so
   the chips stay round and the scuffs stay horizontal however wide the
   drawer is.

   `handle` is where the pull crosses the face, 0 at the bottom and 1 at
   the top, or null for a panel with no pull. The knuckle-scuffs that
   collect under a handle are most of what says "this desk was used",
   so they are placed rather than left to the noise.

   Chips are drawn as bare steel with a lighter rim: a chip in enamel
   this thick leaves a visible lip of paint around the hole, and without
   it the chip reads as a smudge. Kept small and few — the brief asks
   for a worn desk, not a derelict one. */
function wearTextures(aspect, handle, seed = Math.random) {
  const long = 256;
  const w = aspect >= 1 ? long : Math.max(48, Math.round(long * aspect));
  const h = aspect >= 1 ? Math.max(48, Math.round(long / aspect)) : long;
  const low = valueNoise(Math.max(w, h), 6);

  const [ac, actx] = canvas2d(w, h);
  const [rc, rctx] = canvas2d(w, h);
  const albedo = actx.createImageData(w, h);
  const rough = rctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = low(x, y);
      const fine = Math.random();
      const k = (y * w + x) * 4;
      const v = 231 + n * 19 + fine * 5;
      albedo.data[k] = albedo.data[k + 1] = albedo.data[k + 2] = v;
      albedo.data[k + 3] = 255;
      const r = 150 + n * 62 + fine * 40;
      rough.data[k] = rough.data[k + 1] = rough.data[k + 2] = r;
      rough.data[k + 3] = 255;
    }
  }
  actx.putImageData(albedo, 0, 0);
  rctx.putImageData(rough, 0, 0);

  /* Scuffs: short horizontal smears, since a drawer front is wiped,
     knocked and dragged sideways far more than vertically. Banded by
     height — along the bottom lip, along the top, and across the line
     the pull sits on, which is where knuckles land.

     Not banded by *width*, though an earlier pass tried it: weighting
     them toward the two ends as well put a column of short strokes
     down each vertical edge, and once the stroke ran off the texture
     the clipped remains read as a dotted seam — like stitching down
     the side of every drawer. Horizontal placement is uniform, and the
     stroke is kept whole inside the face for the same reason. */
  const scuff = (ctx, dark) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 24; i++) {
      const roll = seed();
      let cy;
      if (handle !== null && roll < 0.34) cy = (1 - handle) * h + (seed() - 0.5) * h * 0.16;
      else if (roll < 0.62) cy = h - seed() * h * 0.16;        // bottom lip
      else if (roll < 0.8) cy = seed() * h * 0.14;             // top lip
      else cy = seed() * h;
      const len = (6 + seed() * 26) * (w / long);
      const cx = len / 2 + seed() * Math.max(1, w - len);
      ctx.strokeStyle = dark
        ? `rgba(118,110,96,${0.05 + seed() * 0.09})`
        : `rgba(255,255,255,${0.08 + seed() * 0.16})`;
      ctx.lineWidth = 0.6 + seed() * 1.3;
      ctx.beginPath();
      ctx.moveTo(cx - len / 2, cy + (seed() - 0.5) * 2);
      ctx.lineTo(cx + len / 2, cy + (seed() - 0.5) * 2);
      ctx.stroke();
    }
  };
  scuff(actx, true);
  scuff(rctx, false); // lighter here = shinier: a scuff polishes matt enamel

  /* Chips. Clustered on the two vertical edges and the bottom corners,
     which is where a steel drawer front actually loses its paint.

     Sized against how big the face *renders*, not against how big the
     texture is: a drawer front is about ninety screen pixels across at
     the establishing shot, so a chip two texels wide is a chip a fifth
     of a pixel wide — the first pass drew them at r = 1.6-4.8 and they
     were invisible. The second overcorrected to 4.5-9.5 and several
     per face, which read as mould rather than as missing paint. Two or
     three at four-ish texels is the band where they are legible and
     still small. */
  const chips = 2 + Math.floor(seed() * 2);
  for (let i = 0; i < chips; i++) {
    const onSide = seed() < 0.6;
    const cx = onSide
      ? (seed() < 0.5 ? seed() * w * 0.05 : w - seed() * w * 0.05)
      : seed() * w;
    const cy = onSide ? seed() * h : (seed() < 0.75 ? h - seed() * h * 0.06 : seed() * h * 0.06);
    const r = (2.6 + seed() * 2.4) * (long / 256);

    /* A ragged blob rather than a disc — a flake of paint does not come
       away in a circle. */
    const path = new Path2D();
    const steps = 9;
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const rr = r * (0.6 + seed() * 0.8);
      const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr * 0.8;
      if (s === 0) path.moveTo(px, py); else path.lineTo(px, py);
    }
    path.closePath();
    /* The lip of paint standing around the hole, then the bare steel. */
    actx.strokeStyle = 'rgba(255,255,255,0.42)';
    actx.lineWidth = 1.0;
    actx.stroke(path);
    actx.fillStyle = `rgba(118,110,98,${0.5 + seed() * 0.18})`;
    actx.fill(path);
    /* Bare steel is smoother than the enamel around it, and the lip is
       rougher where the paint broke. */
    rctx.strokeStyle = 'rgba(255,255,255,0.55)';
    rctx.lineWidth = 1.2;
    rctx.stroke(path);
    rctx.fillStyle = 'rgba(60,60,60,0.8)';
    rctx.fill(path);
  }

  return { albedo: texture(ac, true), rough: texture(rc, false) };
}

/* ==========================================
   MATERIALS
   ========================================== */
function enamelMaterial(tex, color = ENAMEL, roughness = 0.62) {
  return track(new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0,
    map: tex.albedo,
    roughnessMap: tex.rough,
    /* No bumpMap, deliberately: sprayed enamel over pressed steel has
       no relief to speak of at this size, and a per-texel noise field
       driving one only gives the anisotropic filter more to alias
       along an edge. The roughness map carries the whole effect. */
    /* Matched to the computer's shell: the HDRI is ambient from every
       direction and at full strength it fills exactly the faces the key
       never reaches, flattening the body. Holding the two at the same
       figure is what keeps the desk and the machine on it reading as
       lit by the same room. */
    envMapIntensity: 0.34,
  }));
}

/* The walnut top. The scan is Poly Haven's CC0 "Wood Table 001",
   lightened to a medium tone and cut to 512 — see
   public/textures/LICENSE.txt.

   Two things are deliberate. The grain in the file runs up the image,
   so the UVs are turned a quarter turn to put it along the desk's
   length, as a solid slab's would be. And the repeat is set from the
   desk's own dimensions rather than left at 1, so the grain keeps the
   same physical scale on the top, the edges and the ends instead of
   stretching to fit whichever face it lands on. */
function woodMaterial() {
  const loader = new THREE.TextureLoader();
  const base = `${import.meta.env.BASE_URL}textures/`;
  const load = (file, srgb) => {
    const t = loader.load(`${base}${file}`);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
    t.repeat.set(DESK_D / 7, DESK_W / 7);
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    return track(t);
  };
  return track(new THREE.MeshStandardMaterial({
    color: WOOD_TINT,
    map: load('desk-wood-512.jpg', true),
    roughnessMap: load('desk-wood-rough-512.jpg', false),
    /* Satin, not lacquer, and worn with it: high enough that the slab
       picks up the room rather than going dead, low enough that there
       is no hotspot to chase. The roughness map's own range sits around
       0.24, so this multiplies up to a believable 0.4-0.55. */
    roughness: 1.9,
    metalness: 0,
    bumpMap: load('desk-wood-rough-512.jpg', false),
    bumpScale: 0.01,
    envMapIntensity: 0.5,
  }));
}

function chromeMaterial() {
  return track(new THREE.MeshStandardMaterial({
    color: CHROME,
    /* Not a mirror: sixty years of hands have taken the flash off it,
       and a true chrome roughness with only a 256px blurred HDRI to
       reflect reads as a dull grey tube anyway. */
    metalness: 0.92,
    roughness: 0.26,
    envMapIntensity: 1.3,
  }));
}

/* The shells get their chips as decals rather than in their texture,
   because the texture they carry is a *tiling* one and the brief's
   "near the edges and the handles" is a statement about where a panel
   ends — which a tile cannot know. A handful of small quads laid on
   the two faces the camera sees, biased to the perimeter, puts them
   exactly where sixty years of chair arms and filing cabinets would.

   One texture, many instances: a single ragged flake of missing paint
   with the lip of enamel still standing round it, which is the detail
   that stops a chip reading as a smudge. */
function chipTexture() {
  const s = 64;
  const [c, ctx] = canvas2d(s, s);
  const path = new Path2D();
  const steps = 11;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = (s / 2) * (0.6 + Math.random() * 0.34);
    const x = s / 2 + Math.cos(a) * r;
    const y = s / 2 + Math.sin(a) * r * 0.85;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  path.closePath();
  /* The lip first and the hole over it, so only a thread of the lip
     survives round the edge. Drawn the other way round — or with a
     rim anything like as wide as the first attempt's — the chip reads
     at render size as a pale speck of dust rather than as a mark. */
  ctx.strokeStyle = 'rgba(252,250,244,0.8)';
  ctx.lineWidth = 2.2;
  ctx.stroke(path);
  ctx.fillStyle = 'rgba(104,96,84,0.92)';
  ctx.fill(path);
  return track(new THREE.CanvasTexture(c));
}

let chipMat = null;
function chipMaterial() {
  if (chipMat) return chipMat;
  const maps = Array.from({ length: 3 }, chipTexture);
  chipMat = maps.map((m) => track(new THREE.MeshStandardMaterial({
    map: m,
    transparent: true,
    roughness: 0.55,
    metalness: 0.15,
    envMapIntensity: 0.3,
    depthWrite: false,
    /* The quad sits on the surface it is chipping, so it needs to win
       the depth test against it without being pushed far enough off to
       show a gap at this grazing an angle. */
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  })));
  return chipMat;
}

/* `n` chips scattered over a `w` x `h` panel, weighted to its edges,
   as a Group lying in its own XY plane facing +Z. The caller rotates
   and positions it onto whichever face it belongs to.

   `size` is in world units and the default is not a guess: the chip
   fills a little under half its texture, so a quad much under a third
   of a unit lands at two or three screen pixels on the establishing
   shot and is simply not there. */
function chipDecals(n, w, h, size = 0.34) {
  const g = new THREE.Group();
  const mats = chipMaterial();
  const quad = track(new THREE.PlaneGeometry(1, 1));
  for (let i = 0; i < n; i++) {
    /* Pick an edge first, then slide along it — scattering uniformly
       and rejecting the middle gives clusters in the corners. */
    const edge = Math.floor(Math.random() * 4);
    const t = Math.random();
    const bite = Math.random() * 0.06;          // how far in from the edge
    const x = edge === 0 ? -w / 2 + bite * w
      : edge === 1 ? w / 2 - bite * w
      : (t - 0.5) * w;
    const y = edge === 2 ? -h / 2 + bite * h
      : edge === 3 ? h / 2 - bite * h
      : (t - 0.5) * h;
    const m = new THREE.Mesh(quad, mats[i % mats.length]);
    const sc = size * (0.6 + Math.random() * 0.9);
    m.scale.set(sc, sc * (0.7 + Math.random() * 0.5), 1);
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(x, y, 0);
    g.add(m);
  }
  return g;
}

/* ==========================================
   PARTS
   ========================================== */

/* The curved pull. One piece of stamped, chromed strip: it stands off
   the face, runs flat across, and turns back into the face at both
   ends — which is a path, so it is a tube through one, the same way
   computer.js draws its cables.

   The arc at each end is what identifies the period; a straight bar on
   two posts is a later fitting. */
function buildPull(width, mat) {
  const stand = 0.3;      // how far the bar sits off the drawer face
  const half = width / 2;
  const pts = [
    [-half, 0, 0],
    [-half + 0.1, 0, stand * 0.52],
    [-half + 0.34, 0, stand],
    [-half + 0.7, 0.012, stand],
    [half - 0.7, 0.012, stand],
    [half - 0.34, 0, stand],
    [half - 0.1, 0, stand * 0.52],
    [half, 0, 0],
  ].map((p) => new THREE.Vector3(...p));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
  const m = new THREE.Mesh(
    track(new THREE.TubeGeometry(curve, 52, 0.1, 10, false)), mat);
  /* Flattened, because the real fitting is pressed from strip and a
     round section reads as a length of rod bent into shape. The path
     is almost flat in Y, so squashing the whole mesh squashes the
     section and leaves the curve where it was. */
  m.scale.set(1, 0.55, 1);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/* The little barrel lock in the centre drawer. A chrome cylinder set
   almost flush, with a dark keyway across it. */
function buildLock(mat, dark) {
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(
    track(new THREE.CylinderGeometry(0.13, 0.145, 0.07, 20)), mat);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.03;
  barrel.castShadow = true;
  const keyway = new THREE.Mesh(
    track(new THREE.BoxGeometry(0.11, 0.022, 0.02)), dark);
  keyway.position.z = 0.072;
  g.add(barrel, keyway);
  return g;
}

/* A drawer front: a slab of painted steel filling the front of the
   pedestal, with its own wear texture and a pull across it. `handleAt`
   is the pull's height on the face, 0 at the bottom edge and 1 at the
   top — the reference's deep file drawer carries its pull high on the
   face, the box drawers carry theirs near the middle. */
function buildDrawer(w, h, thick, handleAt, pullW, chrome) {
  const g = new THREE.Group();
  const tex = wearTextures(w / h, handleAt);
  /* **Every painted part is a plain box.** RoundedBoxGeometry gives a
     fillet whose UVs collapse to a sliver, so a texture carrying any
     per-texel noise is minified to nothing across it — and what came
     out the far side of the anisotropic filter was a regular bead of
     highlights running down every corner and every drawer reveal. The
     desk looked riveted. Nothing here is round enough at the size it
     renders for the fillet to be worth that; the wood slab keeps its
     RoundedBoxGeometry because its edges are genuinely soft and its
     map is a photograph with no white noise in it to alias. */
  const face = new THREE.Mesh(
    track(new THREE.BoxGeometry(w, h, thick)),
    enamelMaterial(tex));
  face.castShadow = true;
  face.receiveShadow = true;
  g.add(face);

  const pull = buildPull(pullW, chrome);
  pull.position.set(0, -h / 2 + handleAt * h, thick / 2);
  g.add(pull);

  return g;
}

/* ==========================================
   ASSEMBLY
   ========================================== */
export function buildDesk() {
  const shellTex = enamelTextures();
  const shell = enamelMaterial(shellTex);
  /* Reveals and small trim — paint in its own shadow, not a void. */
  const darkTrim = track(new THREE.MeshStandardMaterial({
    color: ENAMEL_DARK, roughness: 0.84, metalness: 0, envMapIntensity: 0.2,
  }));
  /* Anything you are looking *into*: the drawer bays, the knee hole. */
  const interior = track(new THREE.MeshStandardMaterial({
    color: INTERIOR, roughness: 0.95, metalness: 0, envMapIntensity: 0.05,
  }));
  const chrome = chromeMaterial();

  const root = new THREE.Group();

  /* --- The top ------------------------------------------- */
  const topY = DESK_TOP_Y - TOP_THICK / 2;
  const top = new THREE.Mesh(
    track(new RoundedBoxGeometry(DESK_W, TOP_THICK, DESK_D, 4, TOP_EDGE_R)),
    woodMaterial());
  top.position.set(0, topY, (OVERHANG - OVERHANG_BACK) / 2 * 0 + 0);
  top.castShadow = true;
  top.receiveShadow = true;
  root.add(top);

  /* --- The steel carcase ---------------------------------
     The base sits inboard of the slab on the ends and the front; the
     back is nearly flush, so its centre is pushed back a little. */
  const baseZ = -(OVERHANG - OVERHANG_BACK) / 2;
  const baseY = FOOT_H + BASE_H / 2;
  const frontZ = baseZ + BASE_D / 2;
  const backZ = baseZ - BASE_D / 2;
  const underside = DESK_TOP_Y - TOP_THICK;

  const pedX = (BASE_W - PED_W) / 2;  // centre of each pedestal

  for (const sx of [-1, 1]) {
    /* Plain boxes, not RoundedBoxGeometry — see buildDrawer. The
       carcase stops short of the front; the drawer fronts make up the
       rest of the depth. */
    const ped = new THREE.Mesh(
      track(new THREE.BoxGeometry(PED_W, BASE_H, BASE_D - FRONT_SET)), shell);
    ped.position.set(sx * pedX, baseY, baseZ - FRONT_SET / 2);
    ped.castShadow = true;
    ped.receiveShadow = true;
    root.add(ped);

    /* The inside of the cabinet, seen through the reveals. A hair
       narrower than the carcase so it cannot show at the silhouette. */
    const back = new THREE.Mesh(
      track(new THREE.BoxGeometry(PED_W - 0.04, BASE_H - 0.04, 0.06)), interior);
    back.position.set(sx * pedX, baseY, frontZ - FRONT_SET + 0.03);
    back.receiveShadow = true;
    root.add(back);

    /* Feet. Short, tapered, one under each corner of each pedestal, and
       just inboard of the shell so they read as feet rather than as the
       cabinet continuing to the ground. */
    for (const fx of [-1, 1]) {
      for (const fz of [-1, 1]) {
        const foot = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.2, 0.26, FOOT_H + 0.08, 4)), shell);
        foot.rotation.y = Math.PI / 4;
        foot.position.set(
          sx * pedX + fx * (PED_W / 2 - 0.42),
          (FOOT_H + 0.08) / 2,
          baseZ + fz * (BASE_D / 2 - 0.42));
        foot.castShadow = true;
        foot.receiveShadow = true;
        root.add(foot);
      }
    }

    /* Chips along the end panel the camera can see. Only the outward
       face of each pedestal gets them — the inward one is in the knee
       hole and the back is never in shot. */
    const ends = chipDecals(4, BASE_D * 0.9, BASE_H * 0.9, 0.34);
    ends.rotation.y = sx * Math.PI / 2;
    ends.position.set(sx * (pedX + PED_W / 2 + 0.012), baseY, baseZ - FRONT_SET / 2);
    root.add(ends);
  }

  /* The knee hole is a hole: there is floor visible under the modesty
     panel, and that gap is most of what says the desk is standing on
     the ground rather than drawn onto it. The first version filled the
     opening with a solid panel and it read as a block of grey between
     two cabinets.

     What closes it is the modesty panel at the back and the apron at
     the top; the inner walls of the two pedestals are already there.
     They only need skinning in the interior tone, because the key
     light rakes in from the left and never reaches inside — but
     ambient and hemisphere fill still lift bare cream in there to
     within a shade of the lit outside. */
  for (const sx of [-1, 1]) {
    const wall = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.06, BASE_H, BASE_D - 0.2)), interior);
    wall.position.set(sx * (KNEE_W / 2 + 0.02), baseY, baseZ);
    wall.receiveShadow = true;
    root.add(wall);
  }

  /* The modesty panel. Hung off the apron and stopping well short of
     the floor, so the gap under it is what you see through. */
  const modestyH = BASE_H * 0.62;
  const modesty = new THREE.Mesh(
    track(new THREE.BoxGeometry(KNEE_W, modestyH, 0.14)), shell);
  modesty.position.set(0, FOOT_H + BASE_H - modestyH / 2, backZ + 0.3);
  modesty.castShadow = true;
  modesty.receiveShadow = true;
  root.add(modesty);

  /* The apron: the strip of steel under the slab that the centre drawer
     hangs from, spanning the knee hole and closing its top. */
  const apronH = CENTRE_H + 0.3;
  const apron = new THREE.Mesh(
    track(new THREE.BoxGeometry(KNEE_W, apronH, BASE_D - 0.6)), interior);
  apron.position.set(0, underside - apronH / 2, baseZ - 0.3);
  apron.receiveShadow = true;
  root.add(apron);
  /* ...and its painted face, which is the only part of it in the light. */
  const apronFace = new THREE.Mesh(
    track(new THREE.BoxGeometry(KNEE_W, apronH, 0.3)), shell);
  apronFace.position.set(0, underside - apronH / 2, frontZ - 0.15);
  apronFace.castShadow = true;
  apronFace.receiveShadow = true;
  root.add(apronFace);

  /* --- The drawers ---------------------------------------
     Fronts only. Nothing opens, and a modelled box behind each face
     would never be seen; what has to be right is the reveal between
     two of them and the shadow one drops into it.

     They are full-width overlay fronts, so the pedestal's painted
     sides run on past them and the only gaps are horizontal. */
  const frontThick = FRONT_SET - 0.06;
  const faceZ = frontZ - frontThick / 2;
  /* A hair narrower than the carcase. Flush, their side faces and its
     are the same plane, and the shadow map — one texel of which is half
     a drawer front wide — resolves that contact as a dotted line of
     acne down the corner. The step is far too small to read as a
     reveal and is enough to break it. */
  const FRONT_W = PED_W - 0.03;

  /* Screen left (-X): the deep file drawer. One front filling the
     pedestal, with the pull carried high on the face as it is on the
     reference — that high pull is most of what distinguishes a file
     drawer from a box drawer at a glance. */
  {
    const h = BASE_H - 2 * GAP;
    const d = buildDrawer(FRONT_W, h, frontThick, 0.78, PED_W * 0.46, chrome);
    d.position.set(-pedX, FOOT_H + BASE_H / 2, faceZ);
    root.add(d);
  }

  /* Screen right (+X): three box drawers. The top one is shallower, as
     in the photograph — it is the pencil drawer. */
  {
    const avail = BASE_H - 4 * GAP;
    const heights = [avail * 0.28, avail * 0.36, avail * 0.36];
    let y = FOOT_H + BASE_H - GAP;
    for (const h of heights) {
      const d = buildDrawer(FRONT_W, h, frontThick, 0.5, PED_W * 0.46, chrome);
      d.position.set(pedX, y - h / 2, faceZ);
      root.add(d);
      y -= h + GAP;
    }
  }

  /* The centre drawer, shallow, locking. It hangs off the apron rather
     than off the carcase, so its front sits a little further back than
     the pedestals' — which is how the reference reads. */
  {
    const z = frontZ - 0.1;
    const y = underside - apronH / 2;
    const d = buildDrawer(CENTRE_W, CENTRE_H, 0.22, 0.5, CENTRE_W * 0.34, chrome);
    d.position.set(0, y, z);
    root.add(d);
    const lock = buildLock(chrome, darkTrim);
    lock.position.set(0, y - CENTRE_H * 0.02, z + 0.11);
    root.add(lock);
  }

  /* --- Grounding ------------------------------------------
     The key light's shadow map is spread over ±80 world units, so a
     texel is ~0.08 across: the gap under a 0.42-unit foot never lands
     on one, and the feet end up looking welded to the floor. Same
     reasoning as the computer's contact shadows — paint them. */
  const blob = contactShadow();
  const quad = track(new THREE.PlaneGeometry(1, 1));
  for (const sx of [-1, 1]) {
    const mat = track(new THREE.MeshBasicMaterial({
      map: blob, transparent: true, depthWrite: false, opacity: 0.85,
    }));
    const s = new THREE.Mesh(quad, mat);
    s.rotation.x = -Math.PI / 2;
    s.scale.set(PED_W + 1.6, BASE_D + 1.6, 1);
    s.position.set(sx * pedX, 0.014, baseZ);
    s.renderOrder = -1;
    root.add(s);
  }

  return { root };
}

function contactShadow() {
  const s = 256;
  const [c, ctx] = canvas2d(s, s);
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.00, 'rgba(0,0,0,0.5)');
  g.addColorStop(0.42, 'rgba(0,0,0,0.26)');
  g.addColorStop(1.00, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return track(new THREE.CanvasTexture(c));
}

export function disposeDesk() {
  disposables.forEach((d) => d.dispose());
  disposables.length = 0;
}
