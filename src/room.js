import * as THREE from "three";
/* The window on the left wall — its joinery, the night sky behind the
   glass and the rain running down it. Its own module for the same
   reason the desk and the treehouse are, and because it is the part of
   the room most likely to be re-tuned next. The wall is where it has
   to be attached rather than where it has to be *built*: it fades with
   its wall, so it is a child of the panel and its materials go into the
   panel's list (see buildWallPanel and THE CUTAWAY below). */
import {
  buildNightWindow,
  disposeNightWindow,
  OPENING as WINDOW_OPENING,
} from "./nightwindow.js";

/* ==========================================
   THE ROOM

   A finite dollhouse diorama — plank floor, two walls, wainscot, trim
   and a rug — floating in a flat #1C1A2A void. It replaces
   src/floor.js, whose job was the opposite: an effectively endless
   grey plane whose edges were hidden by fog in its own colour.

   **Nothing here is typeset.** floor.js tiled the name across the
   ground and the first version of this module set it once on the rug;
   both are gone, on request. The rug is a woven field now. Playfair is
   still loaded, but for the CRT's greeting rather than for anything on
   the ground — see computer.js.

   Why a diorama rather than a room: the camera swings 60 degrees
   either side of the monitor's front, so any wall the camera can get
   *behind* has to go. Only the two walls behind the desk at the home
   framing are built, and the near one fades out as the camera comes
   round to see it from the back — see "The cutaway" below. There is no
   ceiling and there are no near walls, so nothing is ever between the
   visitor and the desk.

   Local space is the desk's and the computer's: origin on the floor at
   the desk's centre in plan, +Z toward the viewer, +X screen right at
   the home camera. So the plan figures below can be read directly
   against desk.js's DESK_W (19) and DESK_D (12.6).
   ========================================== */

/* --- Palette --------------------------------------------- */
/* The void. Also the fog colour, and `--scene-void` in src/style.css,
   which paints the strip the taskbar vacates during the fly-in. The
   three have to agree exactly; see src/tonemap.js for what tone
   mapping does to that promise and how it is kept. */
export const VOID = "#1c1a2a";

/* The two walls are different values, and which is which is stated in
   *screen* terms because that is the only way it is checkable. The
   camera sits in the +X/+Z octant, so the wall at -Z is seen across
   screen right and the wall at -X across screen left. The right one is
   lighter: it is the more square-on of the two at the home framing
   (its normal is 0.75 of the view direction against the left wall's
   0.57), so it carries the room's value and the left one reads as the
   turn into shadow. */
const WALL_RIGHT = "#353152"; // the -Z wall, normal +Z
const WALL_LEFT = "#2b2842"; // the -X wall, normal +X
const WAINSCOT = "#231f36";
const TRIM = "#40395c";
const PLANK = "#3a2f40";
const RUG_FIELD = "#5a3e52";
const RUG_EDGE = "#83607a";

/* --- Plan ------------------------------------------------
   The desk is 19 x 12.6 centred on the origin, so it spans x -9.5..9.5
   and z -6.3..6.3. The floor slab is sized around that: a little
   breathing room behind and to the left, where the walls are, and a
   long run of open floor in front for the rug.

   The slab's own edges are deliberately *in frame* — that is what makes
   it a diorama rather than a room with the walls cropped off. The home
   framing reads about 77 world units of floor depth, so a 28-deep slab
   has void beyond it at the bottom of the picture by design. */
const X0 = -13.0; // the left wall's inner face
const X1 = 19.0; // the open right edge
const Z0 = -9.0; // the right wall's inner face
const Z1 = 19.0; // the open front edge

const FLOOR_W = X1 - X0;
const FLOOR_D = Z1 - Z0;

/* --- Elevation -------------------------------------------
   One world unit is about 3.2 inches here: desk.js's DESK_TOP_Y is 9
   for a 29-inch desk, a compression it took deliberately so the CRT
   does not become a detail on top of a cabinet. Every figure below is
   in that same compressed scale, so they read low against a tape
   measure and right against the furniture. */
/* **The wall height is a cut line, not a ceiling height.** At the home
   framing the frame reads about 30 world units of height at the back
   wall's depth, centred a little above the desk top — so a wall tall
   enough to be a real room (26-30 units, 7-8ft at this scale) fills the
   top of the picture and the diorama stops floating in anything. 19
   leaves a few units of void above the wall tops, which is the whole
   dollhouse read: walls that have been *cut off*, with nothing above
   them. It is why there is no crown moulding either — a crown implies
   a ceiling to meet. */
const WALL_H = 19.0;
const WALL_T = 0.6; // the cut edge shows this, so it is not zero
const WAINSCOT_H = 7.5; // cap rail sits *below* the 9-unit desk top
const BASE_H = 1.2; // skirting
const CAP_H = 0.38; // the wainscot's cap rail
/* How far each moulding stands off the wall field. The cap rail is the
   proudest because it is the one the key will eventually catch. */
const BASE_OUT = 0.22;
const WAINSCOT_OUT = 0.1;
const CAP_OUT = 0.3;

/* --- The window ------------------------------------------
   On the left wall, stated in *world* z and world y so it can be read
   against the plan above, and converted to the panel's local x below —
   the left wall is turned a quarter turn, so its local x runs along
   world z backwards (see buildRoom).

   Both figures are set against what else is on that wall. The sill
   clears the cap rail (7.88) and the desk top (9), so the opening is
   the one large bright area above the desk's left end rather than
   something half-hidden behind the machine. The centre is set back
   toward the corner rather than forward, because at this azimuth
   screen-x runs roughly 0.8x - 0.6z: moving the window *back* along
   -z walks it toward the middle of the frame, which is what keeps it
   in shot on a portrait viewport, where the frame sees far less world
   width. It cannot go much further — WINDOW_OPENING is 8 wide and the
   corner is at z -9, so this leaves 3 clear of it, which the casing,
   the sill's ears and the back wall's own thickness have to live in. */
const WINDOW_Z = -2.0;
/* Came down from 9.6 with the opening's height, to buy the head some
   frame at the top — see OPEN_H in src/nightwindow.js. The apron now
   reaches down to 8.58, which still leaves 0.7 clear of the cap rail. */
const WINDOW_SILL_Y = 9.4;

/* --- The rug ---------------------------------------------
   In the open floor in front of the desk (whose front edge is z 6.3).
   The plan is unchanged from when it carried the wordmark and was
   sized to set the name across: a smaller rug would read as a mat, and
   at the home framing its front edge is already off the bottom of the
   picture. */
const RUG_X0 = -6.5;
const RUG_X1 = 12.5;
const RUG_Z0 = 7.6;
const RUG_Z1 = 18.2;
const RUG_Y = 0.045; // off the planks, not in them
const RUG_INSET = 0.055; // the border's own width, as a share of the whole
/* Corner radius, in world units. The rug is 19 x 10.6, so 1.1 reads as
   a rounded rectangle rather than as a stadium — and it is one number
   for both the silhouette and the drawn border, which is the point:
   the texture's border band has to follow the geometry's corners or
   the two disagree exactly where the eye goes. */
const RUG_RADIUS = 1.1;

/* --- The cutaway -----------------------------------------
   Each wall fades on the angle between its inner normal and the
   camera's view *direction*. Direction rather than the vector to the
   camera, so the fade is about which face is turned toward the lens
   rather than which side of an infinite plane the eye is on — the
   walls are finite panels, and past about 20 degrees off the front the
   eye is already outside the left wall's plane while the panel itself
   is nowhere near the line of sight.

   `facing` below is -dot(normal, viewDir): 1 is square on, 0 is edge
   on, negative is seen from behind. The band is set so the left wall
   is solid through the whole right-hand half of the leash, is gone
   before the camera reaches the monitor's front, and never catches the
   right wall — whose facing bottoms out at 0.47 at either clamp, well
   above FADE_IN. That headroom is exactly what tightening the azimuth
   leash to +/-60 bought; at +/-90 the right wall would fade too and
   the diorama would come apart into bare floor at the extremes. */
const FADE_OUT = 0.05; // fully transparent at or below
const FADE_IN = 0.3; // fully opaque at or above
/* Below this a wall is skipped outright rather than drawn at zero
   alpha — a transparent draw still costs sorting and a full raster. */
const FADE_CULL = 0.004;

/* --- Texture resolution ----------------------------------
   The floor is drawn as **one** non-tiling texture rather than a tiled
   cell, which is only affordable because the slab is 32 x 28 units
   rather than the 1700 the old plane was. It buys the thing a tile
   cannot have: butt joints that fall where they actually fall across
   the room, and no repeat to spot. */
const FLOOR_TEX_W = 2048;
const WALL_TEX = 512; // value noise only, tiled
const RUG_TEX_W = 1024;

/* --- State ----------------------------------------------- */
let disposables = [];
let walls = [];
let anisotropy = 1;
/* Passed through to the window, whose rain is the only thing in this
   module that moves. */
let reducedMotion = false;

function track(x) {
  disposables.push(x);
  return x;
}

/* A cheap deterministic hash, so every texture here redraws identically
   between loads — a floor whose knots move on refresh is a floor that
   cannot be art-directed. */
function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makeTexture(canvas, { repeat = null, srgb = true } = {}) {
  const tex = track(new THREE.CanvasTexture(canvas));
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  if (repeat) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeat[0], repeat[1]);
  } else {
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  return tex;
}

/* ==========================================
   THE PLANK FLOOR

   Boards run along +X — the shallower of the two ground diagonals at
   this camera (+X falls ~11.7 degrees below the horizon against +Z's
   ~24), so the seams read as a gentle rake rather than as a staircase
   driving into the picture.
   ========================================== */
const PLANK_D = 1.6; // board width across the grain, ~5in at this scale
const PLANK_RUN = 11.0; // average board length before a butt joint

function drawFloor() {
  const px = FLOOR_TEX_W / FLOOR_W; // texture pixels per world unit
  const w = FLOOR_TEX_W;
  const h = Math.round(FLOOR_D * px);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const rnd = rand(0x51a7);

  ctx.fillStyle = PLANK;
  ctx.fillRect(0, 0, w, h);

  const rowH = PLANK_D * px;
  const rows = Math.ceil(h / rowH);
  for (let i = 0; i < rows; i++) {
    const y = i * rowH;
    /* Per-board value, so the floor is boards rather than one surface
       with lines ruled on it. Kept narrow: a plank floor at night is
       nearly one colour, and the variation is what catches the light
       later, not what carries the look now. */
    const v = 0.88 + rnd() * 0.24;
    /* Butt joints staggered per row, starting part-way along so no two
       rows break in the same place. */
    let x = -rnd() * PLANK_RUN * px;
    while (x < w) {
      const run = (PLANK_RUN * (0.7 + rnd() * 0.6)) * px;
      const bv = v * (0.96 + rnd() * 0.08);
      ctx.fillStyle = shade(PLANK, bv);
      ctx.fillRect(x, y, run - 1, rowH - 1);
      /* The joint: a dark hairline, and a lighter one on its far side
         where the board's arris catches. */
      ctx.fillStyle = shade(PLANK, 0.55);
      ctx.fillRect(x + run - 1, y, 1.4, rowH - 1);
      x += run;
    }
    /* The groove between courses, drawn full width so a stagger never
       leaves a course boundary open. */
    ctx.fillStyle = shade(PLANK, 0.5);
    ctx.fillRect(0, y + rowH - 1.3, w, 1.3);
  }

  /* Grain: short strokes along the boards, very low contrast. */
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 5200; i++) {
    const y = rnd() * h;
    const x = rnd() * w;
    const len = 12 + rnd() * 90;
    ctx.strokeStyle = rnd() > 0.5 ? "#000000" : "#b9a6c4";
    ctx.lineWidth = 0.8 + rnd() * 1.1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (rnd() - 0.5) * 1.6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  return makeTexture(c);
}

/* Multiply a hex colour by a scalar, in sRGB. Good enough for drawing
   into a texture, where the result is about to be read back as sRGB
   anyway. */
function shade(hex, k) {
  const c = new THREE.Color(hex);
  const r = Math.round(Math.min(255, c.r * 255 * k));
  const g = Math.round(Math.min(255, c.g * 255 * k));
  const b = Math.round(Math.min(255, c.b * 255 * k));
  return `rgb(${r},${g},${b})`;
}

/* ==========================================
   THE WALLS

   One shared near-white value-noise map, used as `map` on every wall
   and moulding material. `map` multiplies `color`, so a single greyish
   field tints every part correctly from its own base colour — and a
   flat-colour wall at night reads as CG, which is the whole reason it
   is here.
   ========================================== */
let wallNoise = null;

function drawWallNoise() {
  const n = WALL_TEX;
  const c = document.createElement("canvas");
  c.width = c.height = n;
  const ctx = c.getContext("2d");
  const rnd = rand(0x9e37);

  /* A low-frequency octave for patchiness, then per-pixel grain over
     it — the same two-scale approach computer.js uses on the shells,
     and for the same reason: one scale alone averages to flat at the
     size this actually renders. */
  const cells = 8;
  const lattice = [];
  for (let i = 0; i <= cells; i++) {
    lattice[i] = [];
    for (let j = 0; j <= cells; j++) lattice[i][j] = rnd();
  }
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const gx = (x / n) * cells;
      const gy = (y / n) * cells;
      const i = Math.floor(gx);
      const j = Math.floor(gy);
      const fx = gx - i;
      const fy = gy - j;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const a = lattice[i][j] * (1 - sx) + lattice[i + 1][j] * sx;
      const b = lattice[i][j + 1] * (1 - sx) + lattice[i + 1][j + 1] * sx;
      const low = a * (1 - sy) + b * sy;
      const v = 0.9 + low * 0.085 + (rnd() - 0.5) * 0.03;
      const p = (y * n + x) * 4;
      const q = Math.round(Math.min(255, Math.max(0, v * 255)));
      img.data[p] = img.data[p + 1] = img.data[p + 2] = q;
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return makeTexture(c, { repeat: [1, 1] });
}

function wallMaterial(colour, repeat) {
  const m = track(
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(colour),
      map: wallNoise,
      roughness: 0.92,
      metalness: 0,
      /* Always transparent, so the cutaway never has to toggle the
         flag — which changes how three sorts the object. Opacity does
         all the work, and a wall under FADE_CULL is made invisible
         instead, so a fully-faded wall costs no draw at all. */
      transparent: true,
      opacity: 1,
    }),
  );
  /* Each part tiles the shared noise at its own rate, so the lattice
     does not line up across a cap rail and give the join away. */
  if (repeat) {
    m.map = wallNoise.clone();
    track(m.map);
    m.map.needsUpdate = true;
    m.map.repeat.set(repeat[0], repeat[1]);
  }
  return m;
}

/* A wall panel in its own local space: `width` along local X, height up
   local Y, and the **inner face at local z = 0** with the thickness
   running back to -WALL_T. That last part is what lets both walls be
   the same builder — the caller puts the group on the inner face and
   turns it, and local +Z is then the inner normal. */
function buildWallPanel(width, colour, opening = null) {
  const g = new THREE.Group();
  const half = width / 2;

  /* **Only the wall the moon comes through casts, and that is a
     deliberate lie worth stating plainly.**

     The rule used to be that nothing in the room cast at all: the key
     raked in from outside the left wall, so a casting wall would have
     put the entire desk in shadow, and a dollhouse's light coming
     through its missing walls was the convention that bought the way
     out of it.

     The night rig makes the opposite choice for exactly one panel.
     The moon is aimed *through* the window (see `moonDirection` in
     scene.js), and the field around that opening is now a real hole —
     so letting this one wall cast is what turns the beam into a
     window-shaped pool of light on the floor and the desk, striped by
     the sash and the mullions. It is the single thing that makes the
     light read as coming from somewhere rather than from nowhere.

     The right wall still does not cast, and would wreck it if it did:
     the light travels toward +z, so the -z wall is upstream of
     everything and would shadow the whole room. It is a receiver —
     the far wall the beam lands on — which is the half of the dollhouse
     convention that survives. */
  const casts = !!opening;
  const add = (w, h, t, x, y, z, mat) => {
    const geo = track(new THREE.BoxGeometry(w, h, t));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = casts;
    mesh.receiveShadow = true;
    g.add(mesh);
    return mesh;
  };

  /* The field's noise is tiled at **one lattice per 9 world units** on
     both axes. For a plain box that is `width / 9` over a 0..1 UV; for
     the extruded panel below the UVs are already in world units, so it
     is 1 / 9. The two spellings have to agree or a wall with a window
     in it reads at a different grain from the one without. */
  const field = opening
    ? wallMaterial(colour, [1 / 9, 1 / 9])
    : wallMaterial(colour, [width / 9, WALL_H / 9]);
  const wainscot = wallMaterial(WAINSCOT, [width / 7, WAINSCOT_H / 7]);
  const trim = wallMaterial(TRIM, [width / 4, 1]);

  /* The field runs the whole height behind everything else, so the
     wainscot and the mouldings are applied *over* it rather than
     having to tile up to each other's edges.

     **With a window in it the field is an extruded shape with a hole,
     not a box**, and that is the same decision computer.js makes for
     the bezel: a panel plus a dark inset cannot make an opening, it
     can only cover one. The alternative here was four boxes around the
     opening, which is cheaper to write and wrong in a way that shows —
     each box carries its own 0..1 UV, so four pieces of different
     sizes crop the shared noise differently and the lattice breaks at
     every joint. Extruding puts the UVs in world units instead, so the
     grain runs continuously around the opening. */
  if (opening) {
    const shape = new THREE.Shape();
    shape.moveTo(-half, 0);
    shape.lineTo(half, 0);
    shape.lineTo(half, WALL_H);
    shape.lineTo(-half, WALL_H);
    shape.closePath();
    const hole = new THREE.Path();
    const { x, y, w, h } = opening;
    hole.moveTo(x - w / 2, y);
    hole.lineTo(x - w / 2, y + h);
    hole.lineTo(x + w / 2, y + h);
    hole.lineTo(x + w / 2, y);
    hole.closePath();
    shape.holes.push(hole);
    /* Extrudes from local z 0 to +WALL_T, so it is translated back to
       put the **inner** face on z = 0 — the plane every other part of
       the panel is positioned against, and the one the caller's
       rotation makes the inner normal. `bevelEnabled: false` because a
       fillet here would do what it does on the desk: collapse the UVs
       to a sliver and alias into a bead of highlights down the reveal. */
    const geo = track(
      new THREE.ExtrudeGeometry(shape, {
        depth: WALL_T,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 1,
      }),
    );
    geo.translate(0, 0, -WALL_T);
    const mesh = new THREE.Mesh(geo, field);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
  } else {
    add(width, WALL_H, WALL_T, 0, WALL_H / 2, -WALL_T / 2, field);
  }
  /* Wainscot, standing a little proud of the field. */
  add(width, WAINSCOT_H, WAINSCOT_OUT, 0, WAINSCOT_H / 2, WAINSCOT_OUT / 2, wainscot);
  /* Skirting at the floor, proudest of the lower parts. */
  add(width, BASE_H, BASE_OUT, 0, BASE_H / 2, BASE_OUT / 2, trim);
  /* The cap rail on top of the wainscot. The wall's own top edge gets
     no moulding: it is a cut, not a ceiling line. */
  add(width, CAP_H, CAP_OUT, 0, WAINSCOT_H + CAP_H / 2, CAP_OUT / 2, trim);

  const materials = [field, wainscot, trim];

  /* The window hangs off the panel rather than off the room, and its
     materials join the panel's list. That is what makes the cutaway
     work on it for free: `updateWallFade` walks this list, and the
     group's `visible` flag culls the whole wall — glass, rain and
     joinery with it — when the camera comes round behind it. */
  if (opening) {
    const win = buildNightWindow({
      noise: wallNoise,
      thickness: WALL_T,
      anisotropy,
      reduced: reducedMotion,
    });
    win.group.position.set(opening.x, opening.y, 0);
    g.add(win.group);
    materials.push(...win.materials);
  }

  return { group: g, materials };
}

/* A rounded rectangle, traced into whatever accepts the four calls
   below — a canvas 2D context or a THREE.Path, which share enough of
   an interface for one function to drive both. That sharing is the
   reason this exists rather than two `roundRect` calls: the drawn
   border and the cut silhouette have to agree on the corner, and the
   only way to guarantee that is for one piece of code to describe it.
   Traced counter-clockwise from the left edge, which is the winding
   THREE.Shape wants for an outer contour. */
function traceRoundedRect(p, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  p.moveTo(x, y + rad);
  p.lineTo(x, y + h - rad);
  p.quadraticCurveTo(x, y + h, x + rad, y + h);
  p.lineTo(x + w - rad, y + h);
  p.quadraticCurveTo(x + w, y + h, x + w, y + h - rad);
  p.lineTo(x + w, y + rad);
  p.quadraticCurveTo(x + w, y, x + w - rad, y);
  p.lineTo(x + rad, y);
  p.quadraticCurveTo(x, y, x, y + rad);
}

/* ==========================================
   THE RUG

   A bound field: border, keyline, pile. No wordmark — it set one
   "Trish Nguyen" in cream across the middle and that is gone on
   request, so the rug is now the one large plain surface in front of
   the desk rather than a label lying on the floor.
   ========================================== */
function drawRug() {
  const w = RUG_TEX_W;
  const h = Math.round((w * (RUG_Z1 - RUG_Z0)) / (RUG_X1 - RUG_X0));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  const rnd = rand(0x2bd1);

  /* Border, then field inset into it — both rounded, and the radius
     comes off the same world figure the geometry is cut to. The
     texture is drawn at a uniform scale (w / rug width equals
     h / rug depth to the pixel), so one radius in pixels is correct on
     both axes. The field's corner is tightened by its own inset, which
     is what keeps the band an even width round the turn instead of
     fattening at the corners. */
  const pxPerUnit = w / (RUG_X1 - RUG_X0);
  const radius = RUG_RADIUS * pxPerUnit;
  ctx.fillStyle = RUG_EDGE;
  ctx.beginPath();
  traceRoundedRect(ctx, 0, 0, w, h, radius);
  ctx.fill();

  const inset = Math.round(Math.min(w, h) * RUG_INSET);
  ctx.beginPath();
  traceRoundedRect(ctx, inset, inset, w - 2 * inset, h - 2 * inset, radius - inset);
  ctx.fillStyle = RUG_FIELD;
  ctx.fill();
  /* A keyline between the two, a touch darker than either, so the
     border reads as bound rather than as a painted margin. */
  ctx.strokeStyle = shade(RUG_FIELD, 0.74);
  ctx.lineWidth = Math.max(1.5, inset * 0.12);
  ctx.stroke();

  /* Pile: fine noise over the border and the field alike, so the two
     read as one woven piece rather than as two flat fills. It is the
     only thing giving the rug any surface now the type has gone. */
  ctx.globalAlpha = 0.07;
  for (let i = 0; i < 24000; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    ctx.fillStyle = rnd() > 0.5 ? "#000000" : "#ffffff";
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.globalAlpha = 1;

  return makeTexture(c);
}

/* The rug's silhouette. Built in the XY plane so the mesh can be
   rotated flat the way the old PlaneGeometry was, and with UVs
   rewritten to the 0..1 box PlaneGeometry would have produced —
   ShapeGeometry's own are in shape coordinates, which here are world
   units, so the texture would tile nineteen times across. */
function rugGeometry() {
  const w = RUG_X1 - RUG_X0;
  const d = RUG_Z1 - RUG_Z0;
  const shape = new THREE.Shape();
  traceRoundedRect(shape, -w / 2, -d / 2, w, d, RUG_RADIUS);
  /* 16 segments a corner: at the home framing the rug's corner spans
     about 60 screen pixels, where 12 (the default) still shows as
     facets along the curve. */
  const g = new THREE.ShapeGeometry(shape, 16);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, (pos.getY(i) + d / 2) / d);
  }
  uv.needsUpdate = true;
  return g;
}

/* ==========================================
   BUILD
   ========================================== */
export function buildRoom(maxAnisotropy = 1, reduced = false) {
  anisotropy = maxAnisotropy;
  reducedMotion = !!reduced;
  const root = new THREE.Group();
  root.name = "room";
  wallNoise = drawWallNoise();

  /* --- the floor slab --- */
  const floor = new THREE.Mesh(
    track(new THREE.PlaneGeometry(FLOOR_W, FLOOR_D)),
    track(
      new THREE.MeshStandardMaterial({
        map: drawFloor(),
        roughness: 0.82,
        metalness: 0,
      }),
    ),
  );
  floor.name = "floor";
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
  floor.receiveShadow = true;
  floor.castShadow = false;
  root.add(floor);

  /* --- the rug ---
     A real rounded silhouette, not a rectangle with rounded paint on
     it: the corner has to survive being seen against the dark planks,
     and the flat view (2 degrees above the floor) looks straight along
     the rug's own front edge, where a painted corner would show its
     square geometry as a hard notch either side.

     ShapeGeometry rather than a plane, which costs the UVs: it writes
     the shape's own coordinates into `uv`, so the texture would be
     mapped in world units. `rugGeometry` normalises them back to 0..1
     over the bounding box, reproducing exactly what PlaneGeometry
     would have given — which is what lets drawRug stay unchanged. */
  const rug = new THREE.Mesh(
    track(rugGeometry()),
    track(
      new THREE.MeshStandardMaterial({
        map: drawRug(),
        roughness: 0.95,
        metalness: 0,
      }),
    ),
  );
  rug.name = "rug";
  rug.rotation.x = -Math.PI / 2;
  rug.position.set((RUG_X0 + RUG_X1) / 2, RUG_Y, (RUG_Z0 + RUG_Z1) / 2);
  rug.receiveShadow = true;
  rug.castShadow = false;
  root.add(rug);

  /* --- the two walls ---
     Each is built facing local +Z and then placed on its own inner
     face, so `normal` below is just the group's rotation applied to
     +Z. The right wall spans the full floor width *plus* the left
     wall's thickness, so the two meet in a closed corner with the
     left wall butting into it rather than crossing it. */
  const right = buildWallPanel(FLOOR_W + WALL_T, WALL_RIGHT);
  right.group.position.set((X0 + X1) / 2 - WALL_T / 2, 0, Z0);
  right.group.name = "wall-right";
  right.normal = new THREE.Vector3(0, 0, 1);

  /* The left wall carries the window. Its local x runs along world z
     *backwards* — the panel is turned a quarter turn below, so local
     +X maps to world -Z — hence the subtraction rather than the
     addition the group's own position would suggest. */
  const left = buildWallPanel(FLOOR_D, WALL_LEFT, {
    x: (Z0 + Z1) / 2 - WINDOW_Z,
    y: WINDOW_SILL_Y,
    w: WINDOW_OPENING.w,
    h: WINDOW_OPENING.h,
  });
  left.group.position.set(X0, 0, (Z0 + Z1) / 2);
  left.group.rotation.y = Math.PI / 2; // local +Z -> world +X
  left.group.name = "wall-left";
  left.normal = new THREE.Vector3(1, 0, 0);

  walls = [right, left];
  for (const wall of walls) {
    wall.opacity = -1; // force the first write
    root.add(wall.group);
  }

  return { root, walls };
}

/* ==========================================
   THE CUTAWAY

   Called once per frame from scene.js with the live camera. Two dot
   products and, on the frames where a value actually moves, a handful
   of opacity writes — opacity is a plain uniform, so there is no
   recompile and nothing to batch.
   ========================================== */
const viewDir = new THREE.Vector3();

export function updateWallFade(camera) {
  if (!walls.length) return;
  camera.getWorldDirection(viewDir);
  for (const wall of walls) {
    const facing = -wall.normal.dot(viewDir);
    const t = THREE.MathUtils.clamp(
      (facing - FADE_OUT) / (FADE_IN - FADE_OUT),
      0,
      1,
    );
    /* Smoothstep rather than the raw ramp: a wall that starts and stops
       fading abruptly draws the eye to the fade itself. */
    const o = t * t * (3 - 2 * t);
    if (Math.abs(o - wall.opacity) < 0.002) continue;
    wall.opacity = o;
    const on = o > FADE_CULL;
    wall.group.visible = on;
    if (on) for (const m of wall.materials) m.opacity = o;
  }
}

/* Where each wall currently stands, for the review scripts. */
export function wallFades() {
  return walls.map((w) => ({
    name: w.group.name,
    facing: Number((-w.normal.dot(viewDir)).toFixed(4)),
    opacity: Number(Math.max(0, w.opacity).toFixed(4)),
    visible: w.group.visible,
  }));
}

/* ==========================================
   FOG, AND THE EXTENT

   Fog in the void's own colour, so the diorama's far corner falls away
   into the backdrop instead of ending on a lit edge. It is a depth cue
   now rather than the edge-hider it was in floor.js: there is no
   endless plane left to hide, and the range below is set to just catch
   the back-left corner of the slab and nothing nearer.

   Both ends are offsets from the camera's own distance, which stopped
   being a constant when the camera became perspective — it is derived
   from the framing, so it differs between the two viewports. The
   diorama spans roughly 55..92 units from the eye at the home desktop
   framing, so FOG_FROM has to clear the back wall (~79) without
   reaching the desk.
   ========================================== */
const FOG_FROM = 8;
const FOG_SPAN = 85;

export function buildFog(dist) {
  const fog = new THREE.Fog(new THREE.Color(VOID), 0, 0);
  setFogRange(fog, dist);
  return fog;
}

export function setFogRange(fog, dist) {
  if (!fog) return;
  fog.near = dist + FOG_FROM;
  fog.far = dist + FOG_FROM + FOG_SPAN;
}

/* Distance from the origin to the furthest corner of the diorama —
   what the camera's `far` plane has to reach past. It replaces
   floor.js's FLOOR_SIZE in that derivation, and is smaller by three
   orders of magnitude, which is the whole point of a finite room. */
export const ROOM_RADIUS = Math.hypot(
  Math.max(Math.abs(X0), Math.abs(X1)),
  WALL_H,
  Math.max(Math.abs(Z0), Math.abs(Z1)),
);

/* The plan, for the review scripts and for anything that has to be
   placed against the room rather than against the desk. */
export const ROOM_PLAN = {
  X0,
  X1,
  Z0,
  Z1,
  WALL_H,
  WAINSCOT_H,
  WALL_T,
  window: {
    wall: "left",
    z: WINDOW_Z,
    sillY: WINDOW_SILL_Y,
    w: WINDOW_OPENING.w,
    h: WINDOW_OPENING.h,
  },
};

export function disposeRoom() {
  disposeNightWindow();
  disposables.forEach((d) => d.dispose());
  disposables = [];
  walls = [];
  wallNoise = null;
  reducedMotion = false;
}
