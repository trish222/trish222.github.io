import * as THREE from "three";
import { brassKit } from "./lamps/greenlamp.js";

/* ==========================================
   THE DESK NAMEPLATE

   The classic executive nameplate: a dark walnut wedge with a brushed
   brass plate on its sloped front face, the name engraved into the
   brass. Built from primitives like everything else here — the wedge
   is one extruded trapezoid, the plate is another, and the engraving
   is a canvas.

   Local space matches the desk's, the computer's and the treehouse's:
   origin on the **desk top** at the centre of the base, +Z the front,
   unyawed. scene.js lifts it by `DESK_TOP_Y` and yaws the group; see
   `NAMEPLATE_X` / `NAMEPLATE_Z` there for where it stands and why.

   **It is not pressable, and cannot become pressable by accident.**
   `pickTarget` raycasts the lamp's root and the computer's and nothing
   else, so an object that is in neither can never take a press — that
   is the whole of the guarantee and it costs nothing to keep (rule 2
   in CLAUDE.md). The `raycast` stubs below are belt and braces for the
   same promise: anything that ever raycasts the *scene* skips this.
   ========================================== */

/* --- Scale -----------------------------------------------
   A desk unit is a shade over two inches — the keyboard is 6.9 units
   across for a 17-inch board — so these are a real 8 x 2 x 2¼-inch
   nameplate at the room's own scale, and it stands a little under half
   the keyboard's width. Sized against the keyboard rather than against
   the desk on purpose: the keyboard is the thing in shot the eye reads
   scale from. */
const W = 3.25; // along the plate's face, ~8in
const H = 0.78; // ~2in tall
const D = 0.9; // ~2¼in deep at the base

/* How far the sloped face leans back over that height — 32° off
   vertical, where the real ones sit at about 26°. The extra six
   degrees are bought deliberately and they are the cheapest half of
   making the brass readable: every light in this room is *above* the
   plate (the moon through the window, the lamp's shade, the room's
   own fill) and so is the home camera at 37°, so leaning the face
   back turns it toward all three at once. Past about 35° the wedge
   starts to read as a plaque lying down and the flat top `D - RUN`
   gets too thin to be a top, which is where this stops. */
const RUN = 0.48;
const FACE_TILT = Math.atan(RUN / H);
const FACE_LEN = Math.hypot(RUN, H);

/* **Small, because the bevel is a highlight and not a chamfer.** Every
   edge here is a line the moon or the lamp catches; at 0.02 (half a
   millimetre at this scale) it is a bright hairline that keeps the
   wedge from reading as a shape cut out of the walnut behind it, and
   anything larger starts to round the thing off. The plate's is
   smaller again — it is a 1/16-inch sheet of brass, and its edge is a
   facet, not a moulding. */
const WEDGE_BEVEL = 0.02;
const PLATE_BEVEL = 0.012;

/* The brass sheet on the sloped face, inset from it on all four sides
   so a margin of walnut frames it. */
const PLATE_INSET_X = 0.13;
const PLATE_INSET_Y = 0.1;
const PLATE_W = W - 2 * PLATE_INSET_X;
const PLATE_H = FACE_LEN - 2 * PLATE_INSET_Y;
const PLATE_T = 0.018; // the flat core; the bevel adds its own thickness

/* --- Colour ----------------------------------------------
   Dark walnut: the desk's own top is a lit scan around 0xd8bca6, and
   this is the same timber in shadow and under lacquer. It is a
   *dielectric* and that is the point — the brass above it is lit by a
   drawn environment and barely moves when the lamp goes out, while
   this is lit by the lamp itself and drops with it, so the two halves
   of the object react differently and the thing reads as two
   materials rather than one object tinted twice. */
const WALNUT = 0x4a2e1d;
const WALNUT_ROUGH = 0.56;

/* --- The brass, and why it is not the lamp's -------------
   `brassKit` hands back one colour, one roughness and — the part that
   matters — one drawn room reflected in every brass object in the
   scene. The *environment* is still shared and must stay shared. The
   finish is not, and the reason is the angle: the lamp's fixture is a
   curved, nearly-mirror surface a hand's width from its own bulb, so
   at `roughness` 0.27 it reflects the bright thing next to it. This
   is a flat sheet eight units away, and a mirror that flat, at this
   pose, reflects exactly one thing — the unlit end of the room — and
   measured 5..12 of 255 across its whole face with the lamp on. It
   was black.

   So the plate is **brushed** rather than polished. Three changes,
   each doing a different job:

   - roughness 0.45 (within the 0.4..0.5 a brushed sheet lives in)
     widens the lobe from a single dark band of the environment to
     most of the upper hemisphere, which is where the window, the moon
     and the lamp's pool on the walnut all are.
   - a lighter, warmer base colour, because a rough metal returns less
     of what hits it than a polished one does and this has to come
     back as gold rather than as bronze.
   - metalness a little under 1. A pure metal has no diffuse term at
     all, so with the environment doing everything the plate could not
     see the room's fill — which is the half of the lighting that
     *tracks the lamp switch* (see `applyLampLevel` in scene.js). A
     quarter of a diffuse lobe is what lets the lamp light the face
     directly, and it is also what keeps the letters legible when the
     environment is scaled down with the lamp off.

   The wedge's walnut is untouched: it was never the problem. */
const PLATE_BRASS = 0xe7c272;
const PLATE_ROUGH = 0.45;
const PLATE_METAL = 0.76;

/* The engraved letters, as a multiplier on the brass's own colour. On
   a gold field this has to go nearly to black to read at the hundred
   screen pixels the plate is wide at home — it is still a *tint* of
   the brass rather than a neutral, so the groove is the same metal in
   shadow rather than paint poured into the letters. */
const ENGRAVE_INK = "#100c07";
/* The field the letters sit in, and it is deliberately *not* white.
   The map multiplies the material's `color`, so white is "the brass
   exactly". Keeping the field at 0.84 leaves room for the brass sheen;
   the material's own colour is lifted by the same figure in
   `brassFace` so the plate still lands on the brass the lamp is made
   of. */
const FIELD = 0.84;

/* **How dark the brass goes with the lamp off**, as a multiplier on
   `envMapIntensity`.

   The lamp's own brass does not do this, and the difference is not an
   inconsistency: that fixture is a hand's width from the bulb, so its
   speculars carry the switch on their own. This is eight units away
   across the desk, and three quarters of what lights it is a *drawn*
   environment that knows nothing about the switch — the diffuse
   quarter PLATE_METAL leaves does follow the room's fill down, but on
   its own it would leave the plate most of its brightness in a dark
   room. Scaling the environment is the cheapest honest answer: a
   uniform write, no recompile, and nothing moves, so the frozen shadow
   map stays valid (rule 3). */
const ENV_OFF = 0.45;

/* --- State ----------------------------------------------- */
let disposables = [];
/* The same deterministic hash the room's textures use, and for the
   same reason: a grain that moves on refresh is a grain that cannot be
   art-directed. */
function rand(seed) {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
}

let brass = null;
let brassFace = null;

function track(x) {
  disposables.push(x);
  return x;
}

const noRaycast = () => {};

/* Playfair, the face the CRT's greeting is set in and the only
   typeface in the 3D scene. `loadScreenFont` in computer.js is what
   makes it resident, and scene.js awaits that before `buildScene` — a
   canvas does not redraw itself when a webfont arrives late, so
   without that await this engraves itself in Georgia and looks close
   enough to pass. */
const PLATE_FONT = (size) =>
  `500 ${size}px "Playfair Display", Georgia, serif`;

/* --- The brush ------------------------------------------
   What makes brushed metal read as brushed is not the roughness
   number, which only says "not a mirror" — it is that the roughness
   varies *along one axis only*, so the highlight smears across the
   sheet in the direction of the brushing instead of sitting in a
   pool. These are horizontal strokes, which is how a plate this shape
   is finished and also the direction that does the most work here:
   the lamp is off to one side, so a streak running toward it carries
   its light the whole width of the face.

   The map multiplies `PLATE_ROUGH`, so the field is around 1 and the
   spread is what matters — roughly 0.38..0.52 of effective roughness,
   narrow enough that no stroke reads as a scratch. Tall and thin on
   purpose: the variation is all in v, so one pixel per column is all
   the data there is, and `anisotropy` plus the 2-pixel width keep the
   strokes from aliasing into bands at the angle this is seen from. */
const BRUSH_H = 512;
function brushedGrain(anisotropy) {
  const c = document.createElement("canvas");
  c.width = 2;
  c.height = BRUSH_H;
  const ctx = c.getContext("2d");
  const rnd = rand(0xb2a5);
  /* Two octaves of value noise down the height: a slow one that is
     the sheet's own unevenness, and a fast one that is the brush. */
  const slow = Array.from({ length: 12 }, () => rnd());
  const lerp = (a, b, t) => a + (b - a) * (t * t * (3 - 2 * t));
  for (let y = 0; y < BRUSH_H; y++) {
    const u = (y / BRUSH_H) * slow.length;
    const i = Math.floor(u);
    const wide = lerp(slow[i % slow.length], slow[(i + 1) % slow.length], u - i);
    const fine = rnd();
    const v = 0.86 + wide * 0.12 + fine * 0.14;
    const b = Math.round(Math.min(1, v) * 255);
    ctx.fillStyle = `rgb(${b},${b},${b})`;
    ctx.fillRect(0, y, 2, 1);
  }
  const t = track(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/* --- The engraving ---------------------------------------
   High enough to be crisp at the home framing with a long way to
   spare: the plate is about 100 screen pixels wide there, so 1024 is
   ten times oversampled — which is the point, since the texture is
   seen at a slant and mip-filtered, and because the flight passes the
   desk on its way to the glass. */
const TEX_W = 1024;

function engraving(name, aspect, anisotropy) {
  const w = TEX_W;
  const h = Math.round(w / aspect);
  /* Two canvases from one layout pass: the colour the brass is tinted
     by, and a height field. The second is what makes the letters
     *recessed* rather than painted dark — a bump map costs one
     texture fetch and it is the only one of the three cues (dark cut,
     light rim, recess) that survives the plate being seen from an
     angle the painted rim was not drawn for. */
  const c = document.createElement("canvas");
  const bc = document.createElement("canvas");
  c.width = bc.width = w;
  c.height = bc.height = h;
  const ctx = c.getContext("2d");
  const bctx = bc.getContext("2d");

  /* The polish: a slow vertical gradient, brightest a third of the way
     down. Brushed brass this size is not a mirror of the room above
     it — the environment and the brush map do that between them —
     but the sheet still has its own unevenness, which is what stops
     it reading as a decal. Narrow on purpose; this is a sheen, not a
     stripe. */
  const g = ctx.createLinearGradient(0, 0, 0, h);
  const f = (v) => `rgb(${(v * 255) | 0},${(v * 255) | 0},${(v * 255) | 0})`;
  g.addColorStop(0, f(FIELD * 0.94));
  g.addColorStop(0.34, f(FIELD * 1.06));
  g.addColorStop(1, f(FIELD * 0.9));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  /* Pack two linear masks in the same texture: red is the height
     field; blue is metalness. The sheet keeps its original metalness,
     while the cuts are bare metal so their dark colour also tints
     the reflections instead of picking up a white dielectric glint. */
  bctx.fillStyle = `rgb(255,255,${Math.round(PLATE_METAL * 255)})`;
  bctx.fillRect(0, 0, w, h);

  /* **Fitted, not assumed.** The name is whatever it is set to and
     Playfair's advance widths are nobody's business out here, so the
     size comes down until it fits the plate with a margin either
     side. Cap height is about 0.7em in this face, so the first guess
     puts the caps at a little over half the plate's height — which is
     where a real engraver sets them. */
  const cap = h * 0.52;
  let size = Math.round(cap / 0.7);
  for (const x of [ctx, bctx]) {
    x.textAlign = "center";
    x.textBaseline = "middle";
  }
  /* Engraved names are letterspaced — it is most of what makes a plate
     look engraved rather than printed. Written *after* the font every
     time, because engines disagree about whether setting `font` clears
     it; an engine that has neither loses the tracking and nothing
     else. */
  const setFont = (px) => {
    for (const x of [ctx, bctx]) {
      x.font = PLATE_FONT(px);
      x.letterSpacing = "0.025em";
    }
  };
  setFont(size);
  while (size > 8 && ctx.measureText(name).width > w * 0.92) {
    size -= 2;
    setFont(size);
  }

  const cx = w / 2;
  /* Optical centre: a line of mixed caps and descenders sits a hair
     high of the geometric middle on a `middle` baseline. */
  const cy = h * 0.52;
  /* A single lower-edge glint, not a bright outline around every
     stroke. Opposing light/dark outlines merge in the mip levels
     on phones, turning fine serifs into a soft, doubled silhouette. */
  ctx.fillStyle = "rgba(255,246,222,0.48)";
  ctx.fillText(name, cx, cy + 1);

  /* Keep Playfair at medium weight. A fraction of a screen pixel of
     extra coverage protects its hairlines when this 1024px texture
     is reduced to the small plate, without switching to a bold font.
     The colour and recess use exactly the same letter silhouette. */
  const cutStroke = size * 0.012;
  ctx.strokeStyle = ENGRAVE_INK;
  ctx.lineWidth = cutStroke;
  ctx.lineJoin = "round";
  ctx.strokeText(name, cx, cy);
  ctx.fillStyle = ENGRAVE_INK;
  ctx.fillText(name, cx, cy);

  /* Red goes down into the cut, blue goes up to pure metal. There
     is no raised ring to blur the edges in the smaller mip levels. */
  bctx.strokeStyle = "#1414ff";
  bctx.lineWidth = cutStroke;
  bctx.lineJoin = "round";
  bctx.strokeText(name, cx, cy);
  bctx.fillStyle = "#1414ff";
  bctx.fillText(name, cx, cy);

  const map = track(new THREE.CanvasTexture(c));
  map.colorSpace = THREE.SRGBColorSpace;
  const bump = track(new THREE.CanvasTexture(bc));
  for (const t of [map, bump]) {
    t.anisotropy = anisotropy;
    t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return { map, bump };
}

/* --- The walnut ------------------------------------------
   A cheap streak field for the roughness, so the wedge is timber
   rather than brown plastic. Low frequency and narrow: at this size
   the grain is never read as grain, it is read as the highlight along
   the top arris breaking up. */
function walnutGrain(anisotropy) {
  const w = 128;
  const h = 128;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#bdbdbd";
  ctx.fillRect(0, 0, w, h);
  const rnd = rand(0x4e50);
  /* Lines along the extrusion, which is the direction a board is cut
     and the direction this one's long edges run. */
  for (let i = 0; i < 34; i++) {
    const y = rnd() * h;
    const a = 0.05 + rnd() * 0.12;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 0.6 + rnd() * 2.2;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(w * 0.3, y + 2, w * 0.7, y - 2, w, y + 1);
    ctx.stroke();
  }
  const t = track(new THREE.CanvasTexture(c));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = anisotropy;
  return t;
}

/* --- Geometry --------------------------------------------
   Both solids are extruded profiles with a bevel, which is the one
   primitive that gives every edge of a shape a facet for nothing. The
   profile is drawn in the extruder's own XY and the mesh is then
   turned so the extrusion runs along X — ExtrudeGeometry only ever
   pushes along +Z, so the alternative is building the trapezoid
   sideways and reasoning about it sideways for ever. */
function extruded(shape, depth, bevel) {
  return track(
    new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: bevel * 0.6,
      bevelSize: bevel,
      bevelOffset: 0,
      bevelSegments: 1,
      curveSegments: 1,
    }),
  );
}

function wedgeProfile() {
  const s = new THREE.Shape();
  s.moveTo(-D / 2, 0); // back, on the walnut
  s.lineTo(D / 2, 0); // front, on the walnut
  s.lineTo(D / 2 - RUN, H); // up the sloped face
  s.lineTo(-D / 2, H); // the flat top, back to the vertical rear
  s.closePath();
  return s;
}

function plateProfile() {
  const s = new THREE.Shape();
  s.moveTo(-PLATE_W / 2, -PLATE_H / 2);
  s.lineTo(PLATE_W / 2, -PLATE_H / 2);
  s.lineTo(PLATE_W / 2, PLATE_H / 2);
  s.lineTo(-PLATE_W / 2, PLATE_H / 2);
  s.closePath();
  return s;
}

/* ==========================================
   ASSEMBLY
   ========================================== */

/* `anisotropy` is the renderer's maximum, handed in the way
   `buildRoom` and `buildComputer` take it: the plate is seen at a
   slant from every pose on the leash, which is exactly the case
   isotropic mips blur away. */
export function buildNameplate(name, anisotropy = 1) {
  const root = new THREE.Group();

  const kit = brassKit(track);
  /* **The same room, a different finish.** `brassKit` builds a fresh
     material per call and nothing else in the scene holds this one —
     the fixture makes its own from the same recipe — so re-finishing
     it here cannot touch the lamp. What is deliberately *not*
     re-made is `kit.finish.env`: the drawn room stays the one
     `brassEnvironment` draws, so a patch moved there still moves on
     both objects. See PLATE_BRASS for why the finish had to part
     company with the lamp's. */
  brass = kit.material;
  brass.color = new THREE.Color(PLATE_BRASS);
  brass.roughness = PLATE_ROUGH;
  brass.metalness = PLATE_METAL;
  brass.roughnessMap = brushedGrain(anisotropy);

  /* --- the wedge --- */
  const wedge = new THREE.Mesh(
    extruded(wedgeProfile(), W, WEDGE_BEVEL),
    track(
      new THREE.MeshStandardMaterial({
        color: WALNUT,
        roughness: WALNUT_ROUGH,
        roughnessMap: walnutGrain(anisotropy),
        metalness: 0,
      }),
    ),
  );
  /* The extrusion runs 0..W along +Z; this turns it onto +X and the
     translate re-centres it, so the group's origin lands where the
     module says it does — the middle of the base, on the desk. */
  wedge.rotation.y = -Math.PI / 2;
  wedge.position.x = W / 2;
  wedge.castShadow = true;
  wedge.receiveShadow = true;
  root.add(wedge);

  /* --- the brass plate ---
     Two meshes, and the split is about UVs rather than about shape.
     `ExtrudeGeometry` generates UVs from world position, so a texture
     on it is scaled in *world units* and there is no 0..1 face to
     centre a line of type in. So the sheet carries the bevel and the
     plain brass, and a plane the thickness of a sheet of paper in
     front of it carries the engraving on a proper 0..1 UV. Both are
     the same material; the face's is a clone with the engraving on
     it, so the environment, the brush and the roughness are shared
     and cannot drift. */
  const plate = new THREE.Mesh(
    extruded(plateProfile(), PLATE_T, PLATE_BEVEL),
    brass,
  );
  /* The profile is drawn centred, so the extrusion runs 0..PLATE_T out
     of the face it is bedded on. */
  plate.castShadow = false;
  plate.receiveShadow = true;

  brassFace = track(brass.clone());
  /* Lifted by exactly what the field in the map is down by, so the
     unengraved brass on this plane is the same brass as the bevel
     around it rather than a darker patch inside it.

     **In the working space, not in the map's.** The map is sRGB and is
     decoded before it multiplies the colour, so compensating by FIELD
     itself would leave the plate about a fifth dark — 0.84 sRGB is
     0.68 linear. Asking a Color to do the conversion is what keeps
     that true if three's colour management ever changes underneath
     it. */
  const fieldLinear = new THREE.Color().setRGB(
    FIELD,
    FIELD,
    FIELD,
    THREE.SRGBColorSpace,
  ).r;
  brassFace.color = new THREE.Color(PLATE_BRASS).multiplyScalar(
    1 / fieldLinear,
  );
  const cut = engraving(
    name,
    (PLATE_W - 2 * PLATE_BEVEL) / (PLATE_H - 2 * PLATE_BEVEL),
    anisotropy,
  );
  brassFace.map = cut.map;
  /* Shallow — the groove on a real plate is a few thousandths of an
     inch and `bumpScale` is in the geometry's units. Deep enough and
     the letters stop being cut into a flat sheet and start being
     moulded out of it. */
  brassFace.bumpMap = cut.bump;
  brassFace.bumpScale = 0.0015;
  brassFace.metalness = 1;
  brassFace.metalnessMap = cut.bump;

  const face = new THREE.Mesh(
    track(
      new THREE.PlaneGeometry(
        PLATE_W - 2 * PLATE_BEVEL,
        PLATE_H - 2 * PLATE_BEVEL,
      ),
    ),
    brassFace,
  );
  /* Inside the bevel, a hair proud of the flat it sits on. */
  face.position.z = PLATE_T + PLATE_BEVEL * 0.6 + 0.0015;
  face.castShadow = false;
  face.receiveShadow = true;

  /* Both go in one group, which is what gets laid onto the sloped
     face: the plate's local +Z is the face's outward normal, so the
     group carries the tilt and nothing inside it has to know about
     it. */
  const sheet = new THREE.Group();
  sheet.add(plate, face);
  /* The midpoint of the sloped edge of the profile, pushed out along
     its own normal by nothing — the sheet is bedded *on* the face, and
     its thickness grows forward from there. */
  sheet.position.set(0, H / 2, D / 2 - RUN / 2);
  /* Negative, so the plate's +Z tips up and forward with the face it
     lies on: the normal of the profile's sloped edge is (0, RUN, H). */
  sheet.rotation.x = -FACE_TILT;
  root.add(sheet);

  /* Nothing in here is a press target — see the header. */
  root.traverse((o) => {
    o.raycast = noRaycast;
  });

  return {
    root,
    /* The lamp's level, 0..1. Called by `applyLampLevel` in scene.js,
       which is also what writes the lamp's own brightnesses, so the
       plate tracks the fade frame by frame rather than only the two
       ends of it. Two uniform writes; see ENV_OFF. */
    setLight(level) {
      const e = ENV_OFF + (1 - ENV_OFF) * level;
      if (brass) brass.envMapIntensity = e;
      if (brassFace) brassFace.envMapIntensity = e;
    },
  };
}

export function disposeNameplate() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
  brass = null;
  brassFace = null;
}
