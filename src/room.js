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

   The corner of a room — plank floor, two walls, wainscot, skirting,
   crown and a rug — standing in a flat #1C1A2A void that is only ever
   seen past the open sides. It replaces src/floor.js, whose job was
   the opposite: an effectively endless grey plane whose edges were
   hidden by fog in its own colour.

   **It used to be a dollhouse diorama and the geometry is the only
   thing that changed.** The walls were 19 units tall and the slab 32 x
   28, both deliberately cropped by the frame so the model read as a
   cut-away model of a room. They are 34 and 76 x 66 now, sized so that
   no top and no end edge is in shot at any pose the leash allows — the
   frame cuts the walls, rather than the walls ending inside the frame.
   What did *not* change is the lighting: see `cast` in buildWallPanel
   for how the frozen shadow map survived the room growing around it.

   **Nothing here is typeset.** floor.js tiled the name across the
   ground and the first version of this module set it once on the rug;
   both are gone, on request. The rug is a woven field now. Playfair is
   still loaded, but for the CRT's greeting rather than for anything on
   the ground — see computer.js.

   Why only two walls: the camera swings 60 degrees either side of the
   monitor's front, so any wall the camera can get *behind* has to go.
   Only the two walls behind the desk at the home framing are built,
   and the near one fades out as the camera comes round to see it from
   the back — see "The cutaway" below. There is no ceiling and there
   are no near walls, so nothing is ever between the visitor and the
   desk, and at the far end of the swing the open sides are what the
   fog is for.

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
/* The lighter value, used on the beads: the fillet under the crown and
   the cap on the skirting. A moulding reads as a moulding because one
   of its faces takes more light than the field it stands on, and at
   this scale that is cheaper to say in the palette than to model in
   geometry. */
const TRIM_LIT = "#4b4368";
/* **Dark walnut, not near-black.** It was #3a2f40, a value set when
   the slab was a small lit island in the void — in a room that closes
   over it, the same colour reads as a hole in the floor rather than as
   a floor. Lifted about 60% in luminance and walked toward brown,
   which is what keeps it *wood*: the planks are the one large warm
   surface in a picture whose walls, fog and moonlight are all cool. */
const PLANK = "#644c3d";
const RUG_FIELD = "#5a3e52";
const RUG_EDGE = "#83607a";

/* --- Plan ------------------------------------------------
   The desk is 19 x 12.6 centred on the origin, so it spans x -9.5..9.5
   and z -6.3..6.3. The corner it stands in is where it always was —
   `X0` and `Z0` have not moved, so the window, the moon's aim and the
   whole lighting calibration read against the same two faces.

   **What moved is the open pair, and they moved a long way.** They
   were 19 and 19, which put the slab's own edges in frame on purpose.
   For the floor to run off the picture instead they have to clear the
   near edge of the frame at the *flattest* pose the leash allows,
   which is the widest-seeing one: the eye drops to y ~9.7 on desktop
   and ~11 on a phone, the bottom of the frame is then 12 degrees below
   the horizon, and it meets the floor some 45 units (desktop) to 52
   units (phone, where the camera stands 115 out rather than 75) ahead
   of the camera. Projected back onto the plan that is floor needed out
   to x ~57 and z ~53 at the corners of the frame, on a portrait
   viewport at either azimuth clamp.

   **X1 went 62 -> 66 when the azimuth leash lost its old cap.** The
   leash is both wall planes now and nothing else (see scene.js), so
   the camera reaches ~+88 degrees off the monitor's front instead of
   stopping at +60 — nearly over the +X axis, looking back along the
   room. From there a portrait frame's bottom corner landed 1.4 units
   past x 62. 66 puts it 0.1 inside, which is the slab's own edge
   softness. Z1 is untouched and still has the one exposure it had:
   on a phone at the flattest elevation near the *near* clamp, the
   frame's bottom edge reaches about 7 units past the front edge of the
   floor.

   The walls are sized off the same figures: the right wall runs the
   whole floor width and the left one the whole depth, so neither ends
   anywhere the frame can see. Far more of each is built than is ever
   in shot at the home framing, and that is the point — it costs two
   boxes and an extrude, and the alternative is an edge in the
   picture. */
const X0 = -13.0; // the left wall's inner face
const X1 = 66.0; // the open right edge
const Z0 = -9.0; // the right wall's inner face
const Z1 = 56.0; // the open front edge
/* A plan figure as much as an elevation one, which is why it is up
   here: the floor is sized from the walls' *outer* faces. */
const WALL_T = 0.6;

/* **The floor runs under both walls, not up to their inner faces.**
   It used to stop at X0/Z0, which left each panel's cut edge standing
   on a seam; the skirting hides that from most angles and not from the
   flat one. Half a unit of boards under the wall costs nothing and
   there is no join to find. */
const FLOOR_X0 = X0 - WALL_T;
const FLOOR_Z0 = Z0 - WALL_T;
const FLOOR_W = X1 - FLOOR_X0;
const FLOOR_D = Z1 - FLOOR_Z0;

/* --- Elevation -------------------------------------------
   One world unit is about 3.2 inches here: desk.js's DESK_TOP_Y is 9
   for a 29-inch desk, a compression it took deliberately so the CRT
   does not become a detail on top of a cabinet. Every figure below is
   in that same compressed scale, so they read low against a tape
   measure and right against the furniture. */
/* **The wall height is a ceiling height now, and it is set by the
   phone.** It was 19, a cut line chosen to leave void above the wall
   tops. For no top to be in shot it has to clear the top of the frame
   at the back corner, which is a different number on each viewport
   because the portrait frustum is 1.54x the landscape one: solving
   "this point sits exactly on the top edge" at the back corner gives
   y 17.6 at the home desktop framing, 24.8 on a phone at home, and
   29.4 on a phone at the flattest elevation the leash allows. 34 is
   that worst case with a few units to spare, and reads as a 9ft
   ceiling at this scale, which is what a 20 x 17ft room wants.

   **The pose that used to defeat this is now unreachable.** The figure
   above was set against the -60 degree azimuth clamp, where the camera
   stood outside a faded left wall and the frame looked lengthwise down
   the right one. There is no fade and no such clamp: the leash is the
   two wall planes, so the camera cannot get outside either of them and
   the lengthwise view down a wall is gone with them.

   What is left is the *steep* end, and no height fixes it. At the +10
   degree rise the eye stands at y 44 on desktop and 64 on a phone —
   above these wall tops either way — so from near an azimuth clamp a
   wide frame's top corner can look over one of them into the void. It
   is symmetric (the left wall does it at the near clamp, the right at
   the far one), it wants an aspect past about 2:1 to show at all, and
   a taller wall only moves the aspect at which it starts: the camera
   is above the top edge, not below it. FOG_SPAN's 55 is what keeps the
   far reaches of both walls dark rather than a silhouette. */
const WALL_H = 34.0;
const WAINSCOT_H = 7.5; // cap rail sits *below* the 9-unit desk top
const BASE_H = 1.9; // skirting board
const BASE_CAP_H = 0.26; // the bead on top of it
const CAP_H = 0.38; // the wainscot's cap rail
const CROWN_H = 1.4; // the cove at the ceiling line
const CROWN_FILLET_H = 0.3; // and the fillet under it
/* How far each moulding stands off the wall field. Each pair steps
   out as it goes up, which is the whole trick: a band that is merely a
   different colour reads as paint, and one that is proud of its
   neighbour reads as a board. The crown is the proudest because it is
   the one furthest from the eye. */
const BASE_OUT = 0.28;
const BASE_CAP_OUT = 0.38;
const WAINSCOT_OUT = 0.1;
const CAP_OUT = 0.3;
const CROWN_FILLET_OUT = 0.3;
const CROWN_OUT = 0.46;

/* **The casting silhouette, frozen at the dimensions the shadow map
   was calibrated against.** The left wall is the one thing in the room
   that casts, and the moon is aimed through its window — so the wall's
   top edge and its far end are both *lighting* figures, not just
   geometry: light passing over a 23-tall wall lands on the floor from
   x 2.8 onward, and that boundary is in the shot. Letting the whole
   34 of it cast would walk that out past x 11 and take the lit wedge
   in front of the desk with it, which is a lighting change dressed up
   as a composition one.

   So only this rectangle of the panel casts. Everything the room grew
   by is a non-caster, the frozen map is the same map, and CAST_Z1 is
   exactly what Z1 was before the room became a room. Move either and
   the moonlight moves; see scene.js's shadow box, whose six faces are
   fitted to this.

   **CAST_H is no longer the old WALL_H, and it had to move.** The
   hole is cut in this rectangle — a hole in a non-caster throws no
   sash stripes, and the window pool is made of them — so the core has
   to contain the opening. That is why it went to 23 when the opening
   was portrait and its head stood at 22, and it is why **23 stayed
   when the opening went landscape and the head came down to 19**:
   the core still contains the hole with four units to spare, and this
   figure is a lighting constant before it is a geometric one. Lowering
   it to hug the new head would walk the lit wedge in front of the desk
   back out toward x 3.6 for nothing.

   Raising it does change the light, which is the thing the old note
   warned about, and the change is smaller than that warning implies
   because the beam steepened at the same time. The moon is aimed from
   the opening's *centre*, which rose from 12.6 to 16 — so the rake
   went from 36.5 to 43 degrees below the horizon, and light clearing
   the top of a taller wall at a steeper angle lands in nearly the
   same place: the lit wedge in front of the desk starts at x 2.8
   where it started at 3.6. The pool itself did not move at all; it is
   pinned at MOON_AT by construction. What did move is the shadow box,
   which `window.__shadowfit()` re-measured — see scene.js. */
const CAST_H = 23.0;
const CAST_Z1 = 19.0;

/* --- The window ------------------------------------------
   On the left wall, stated in *world* z and world y so it can be read
   against the plan above, and converted to the panel's local x below —
   the left wall is turned a quarter turn, so its local x runs along
   world z backwards (see buildRoom).

   Both figures are set against what else is on that wall. The sill
   clears the cap rail (7.88) and the desk top (9), so the opening is
   the one large bright area above the desk's left end rather than
   something half-hidden behind the machine. The centre wants to be as
   far back toward the corner as it can get, because at this azimuth
   screen-x runs roughly 0.8x - 0.6z: moving the window *back* along
   -z walks it toward the middle of the frame, which is what keeps it
   in shot on a portrait viewport, where the frame sees far less world
   width.

   **It is at 0 and not -2 because the opening went landscape**, and
   the back corner is what set the figure. The sill's ear reaches half
   the opening plus the casing plus the ear — 7 + 0.65 + 0.4 = 8.05 —
   so at 14 across and z -2 it would have come to -10.05, a unit
   *through* the back wall's inner face at -9. At z 0 it reaches -8.05
   and clears the corner by 0.95, which is the clearance the 9.5-wide
   opening had at -2. There is no slack left in either direction:
   widening further or moving back puts the ear through the corner
   again, and moving forward walks the window off a portrait frame. */
const WINDOW_Z = 0.0;
/* **A sill height, not a clearance.** It went 9.6 -> 9.4 -> 10.0, and
   only the last of those was chosen for the reason a sill is chosen:
   a window sits a little above the work surface in front of it, and
   the desk top is at 9. A unit is about 3.2 inches here, so this is
   the 3-inch step a 32-inch sill makes over a 29-inch desk.

   What it costs is the top, and the landscape opening is what stopped
   it costing much: the head is at 19 against a home desktop frame
   that ends at about 18.6, so the sill now buys its realism out of
   half a unit rather than out of the three and a half the 12-tall
   opening spent above the cut. The apron hangs to 9.02, which still
   leaves 1.14 clear of the cap rail. */
const WINDOW_SILL_Y = 10.0;

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

/* --- No cutaway ------------------------------------------
   **Both walls are opaque at every pose and nothing here fades.**
   There used to be a cutaway: each wall dimmed on the angle between
   its inner normal and the view direction, and vanished as the camera
   came round to see it from behind. What replaced it is the camera's
   own leash — scene.js clamps the azimuth off `ROOM_PLAN.X0` and
   `ROOM_PLAN.Z0`, so there is no pose from which the back of a wall
   can be seen and nothing left for a fade to hide. See
   `wallAzimuthRange` there, which is where the two figures below are
   now read.

   Two things followed the fade out of this file: the panel materials
   are plain opaque `MeshStandardMaterial` again (they were
   permanently `transparent: true` so the fade never had to toggle the
   flag and re-sort), and the per-wall list of materials and normals
   that the fade walked is gone with it.

/* --- Texture resolution ----------------------------------
   The floor is drawn as **one** non-tiling texture rather than a tiled
   cell, which was affordable at 32 x 28 units and is still affordable
   at 76 x 66. It buys the thing a tile cannot have: butt joints that
   fall where they actually fall across the room, and no repeat to
   spot.

   **The number did not go up with the room, so the density came
   down**: 2048 over 76 units is 27 texels per world unit against 64
   before. That is held deliberately. The canvas is 2048 x 1778 either
   way — about 15MB, the same bill as before — and 27 texels is still
   about one per screen pixel at the home framing, where the frame
   reads 26 units of height over a ~900px viewport. Matching the old
   density would have meant a 3900px canvas and 53MB, most of it spent
   on floor that the fog takes to the void. What *is* affected is every
   figure drawFloor draws in pixels — see the grain below. */
const FLOOR_TEX_W = 2048;
const WALL_TEX = 512; // value noise only, tiled
const RUG_TEX_W = 1024;

/* --- State ----------------------------------------------- */
let disposables = [];
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

  /* Grain: strokes along the boards, very low contrast.

     **Counted per canvas pixel and measured in world units**, which is
     the split the drop in texel density forces. The count has to go on
     the canvas or the loop grows with the room — 5.8 strokes per world
     unit over a 4959-unit floor is 29,000 of them, which is a tenth of
     a second of canvas time on the load path for grain nobody can
     resolve. The *length* has to go on the room, or the same 12-90px
     stroke that was a third of a board long becomes most of one. So
     the scatter is sparser than it was per unit of floor and the
     streaks are longer, which is the right way round: long grain is
     what wood looks like, and it is what stops a thinner scatter from
     reading as flat. */
  const grainMin = 0.25 * px; // world units, not pixels
  const grainRun = 1.9 * px;
  ctx.globalAlpha = 0.05;
  const strokes = Math.round((w * h) / 450);
  for (let i = 0; i < strokes; i++) {
    const y = rnd() * h;
    const x = rnd() * w;
    const len = grainMin + rnd() * grainRun;
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

/* One piece of a wall's field, extruded from a shape traced in the
   panel's own local coordinates: from local z 0 to +WALL_T, then
   translated back so the **inner** face lands on z = 0 — the plane
   every other part of the panel is positioned against, and the one the
   caller's rotation makes the inner normal. `bevelEnabled: false`
   because a fillet here would do what it does on the desk: collapse
   the UVs to a sliver and alias into a bead of highlights down the
   reveal. */
function addField(group, shape, material, casts) {
  const geo = track(
    new THREE.ExtrudeGeometry(shape, {
      depth: WALL_T,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 1,
    }),
  );
  geo.translate(0, 0, -WALL_T);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = casts;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

/* A wall panel in its own local space: `width` along local X, height up
   local Y, and the **inner face at local z = 0** with the thickness
   running back to -WALL_T. That last part is what lets both walls be
   the same builder — the caller puts the group on the inner face and
   turns it, and local +Z is then the inner normal. */
function buildWallPanel(width, colour, opening = null, cast = null) {
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
     convention that survives.

     And since the room grew, only *part* of the windowed panel casts:
     `cast` below is the rectangle the shadow map was calibrated
     against, and everything outside it is a non-caster. */
  const add = (w, h, t, x, y, z, mat) => {
    const geo = track(new THREE.BoxGeometry(w, h, t));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    /* **No moulding casts, on either wall**, where the ones on the
       windowed wall used to. It bought nothing even then: the light
       comes in from behind this wall, so a band standing three tenths
       of a unit proud of it throws its shadow into the strip of floor
       the wall itself already has in shadow. What it would cost now is
       an artefact — the field outside `cast` is deliberately not a
       caster, so a casting skirting out there would lay a shadow on
       floor that nothing above it is shadowing. */
    mesh.castShadow = false;
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
  const bead = wallMaterial(TRIM_LIT, [width / 5, 1]);

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
    const hole = new THREE.Path();
    const { x, y, w, h } = opening;
    hole.moveTo(x - w / 2, y);
    hole.lineTo(x - w / 2, y + h);
    hole.lineTo(x + w / 2, y + h);
    hole.lineTo(x + w / 2, y);
    hole.closePath();

    /* **The core, and it is the only caster in the room.** `cast` is
       the panel at the size it stood when the moon's shadow map was
       rendered — see CAST_H / CAST_Z1 — anchored into the corner, so
       the light that clears the wall clears it at the same height and
       the same end it always did. The opening is cut in this piece
       because the opening is inside it; a hole in a non-caster would
       throw no sash stripes and the window pool is made of them.

       Both pieces are extruded in the panel's own local coordinates
       and both carry the field material, whose `map.repeat` is 1/9 —
       ExtrudeGeometry writes shape coordinates into `uv`, so the noise
       lattice is pinned to local space rather than to each piece's
       own 0..1 box. That is what makes the seam between them
       invisible, and it is the same reason the field is an extrude
       rather than four boxes around the opening. */
    const core = cast ?? { x0: -half, x1: half, h: WALL_H };
    const coreShape = new THREE.Shape();
    coreShape.moveTo(core.x0, 0);
    coreShape.lineTo(core.x1, 0);
    coreShape.lineTo(core.x1, core.h);
    coreShape.lineTo(core.x0, core.h);
    coreShape.closePath();
    coreShape.holes.push(hole);
    addField(g, coreShape, field, true);

    /* Everything the room grew by, as one L — the full panel minus
       that corner rectangle, traced counter-clockwise from the near
       end. It assumes the core is flush with the +x end and the floor,
       which is how buildRoom places it; a core floating in the middle
       of the panel would need two pieces instead of this one. */
    if (core.x0 > -half || core.h < WALL_H) {
      const rest = new THREE.Shape();
      rest.moveTo(-half, 0);
      rest.lineTo(core.x0, 0);
      rest.lineTo(core.x0, core.h);
      rest.lineTo(core.x1, core.h);
      rest.lineTo(core.x1, WALL_H);
      rest.lineTo(-half, WALL_H);
      rest.closePath();
      addField(g, rest, field, false);
    }
  } else {
    add(width, WALL_H, WALL_T, 0, WALL_H / 2, -WALL_T / 2, field);
  }
  /* Wainscot, standing a little proud of the field. */
  add(width, WAINSCOT_H, WAINSCOT_OUT, 0, WAINSCOT_H / 2, WAINSCOT_OUT / 2, wainscot);
  /* Skirting at the floor, and the bead that caps it. Two bands rather
     than the one 1.2-unit board this was: a skirting is the moulding
     the eye checks a room's floor line against, and at the flat end of
     the orbit — where the eye is level with the desk top and the floor
     line runs most of the width of the frame — a single dark stripe
     reads as the floor not quite meeting the wall. */
  add(width, BASE_H, BASE_OUT, 0, BASE_H / 2, BASE_OUT / 2, trim);
  add(
    width,
    BASE_CAP_H,
    BASE_CAP_OUT,
    0,
    BASE_H + BASE_CAP_H / 2,
    BASE_CAP_OUT / 2,
    bead,
  );
  /* The cap rail on top of the wainscot. */
  add(width, CAP_H, CAP_OUT, 0, WAINSCOT_H + CAP_H / 2, CAP_OUT / 2, trim);
  /* **The crown, at the ceiling line — which is the wall's own top
     edge, and that is the point.** There was no crown here while the
     top edge was a cut, because a crown implies a ceiling to meet. It
     implies one now. Note what it costs to be honest about where it
     goes: the top of the wall is off the top of the frame at the home
     framing on both viewports, which is the whole requirement the
     height was set to, so the crown is a detail of the flat end of the
     orbit and of the portrait viewport rather than of the hero shot.
     Dropping it to somewhere it could be seen at home would mean bare
     wall above a ceiling line. */
  add(width, CROWN_H, CROWN_OUT, 0, WALL_H - CROWN_H / 2, CROWN_OUT / 2, trim);
  add(
    width,
    CROWN_FILLET_H,
    CROWN_FILLET_OUT,
    0,
    WALL_H - CROWN_H - CROWN_FILLET_H / 2,
    CROWN_FILLET_OUT / 2,
    bead,
  );

  /* The window hangs off the panel rather than off the room, which is
     what keeps room.js's placement of it a single line: the group is
     positioned in the panel's own local space, so the two cannot
     disagree about which way the wall faces. It used to matter for the
     cutaway as well — the window's materials joined the panel's list
     and faded with it — and that list went when the fade did. */
  if (opening) {
    const win = buildNightWindow({
      noise: wallNoise,
      thickness: WALL_T,
      anisotropy,
      reduced: reducedMotion,
    });
    win.group.position.set(opening.x, opening.y, 0);
    g.add(win.group);
    /* **The night outside goes in beside the window, not inside it.**
       The backdrop is the stack of parallax planes behind the hole
       (see LAYERS in nightwindow.js); it is placed at the same point
       as the joinery and in the same local space, and the only reason
       it is a second group is that `__fit("wall-window")` has to go
       on meaning the window rather than the seventy units of sky
       behind it. Both hang off the panel, so both travel with the
       wall. */
    win.backdrop.position.copy(win.group.position);
    g.add(win.backdrop);
  }

  return { group: g };
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
  floor.position.set((FLOOR_X0 + X1) / 2, 0, (FLOOR_Z0 + Z1) / 2);
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
     face and turned, so local +Z becomes the inner normal. The right
     wall spans the whole floor width — which now
     includes the left wall's thickness, since the floor is sized from
     the outer faces — so the two meet in a closed corner with the left
     wall butting into it rather than crossing it. */
  const right = buildWallPanel(FLOOR_W, WALL_RIGHT);
  right.group.position.set((FLOOR_X0 + X1) / 2, 0, Z0);
  right.group.name = "wall-right";

  /* The left wall carries the window. Its local x runs along world z
     *backwards* — the panel is turned a quarter turn below, so local
     +X maps to world -Z — hence the subtractions rather than the
     additions the group's own position would suggest. It stops at Z0
     rather than running under the right wall, which is the other half
     of that closed corner.

     The opening and the casting core are both given in local x off the
     same centre, so neither moves when Z1 does: the window stays at
     world z = WINDOW_Z and the core stays in the corner, spanning the
     wall as it stood at CAST_Z1 and CAST_H. */
  const centreZ = (Z0 + Z1) / 2;
  const left = buildWallPanel(
    Z1 - Z0,
    WALL_LEFT,
    {
      x: centreZ - WINDOW_Z,
      y: WINDOW_SILL_Y,
      w: WINDOW_OPENING.w,
      h: WINDOW_OPENING.h,
    },
    { x0: centreZ - CAST_Z1, x1: centreZ - Z0, h: CAST_H },
  );
  left.group.position.set(X0, 0, centreZ);
  left.group.rotation.y = Math.PI / 2; // local +Z -> world +X
  left.group.name = "wall-left";

  root.add(right.group);
  root.add(left.group);

  return { root };
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
/* **The span came in from 85 when the room grew**, and it is the one
   lighting figure that had to move. 85 was set against a slab that
   ended 28 units in front of the desk: nothing was far enough away for
   the far end of the ramp to matter. The floor now runs 65 units deep
   and the right wall 76 across, so at the flat end of the orbit the
   frame looks lengthwise down both of them and whatever the geometry
   does not cover has to be dark rather than merely dim. 55 puts the
   far end of the right wall at about 90% of the way to the void at
   both azimuth clamps, and costs the back corner at the home framing
   nine points of fog against six — which is the whole trade. */
const FOG_SPAN = 55;

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
  wallNoise = null;
  reducedMotion = false;
}
