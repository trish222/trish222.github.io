import * as THREE from "three";

/* ==========================================
   THE FLOOR

   Its own module so it can be swapped whole. Everything about what the
   ground *is* — its colour, its size, the wordmark drawn across it, the
   fog that dissolves its edges — lives in here; `scene.js` only asks
   for a mesh, hands it the viewport facts it needs to size the type, and
   disposes it. Replacing the name text with a different floor means
   rewriting `drawFloorTexture` and `layoutFor`, and nothing else.

   The type is drawn with canvas 2D rather than extruded as geometry: the
   shadow then falls *across* the letters as one continuous surface,
   which is what design-references/floor-text.png does.
   ========================================== */

/* --- Look ------------------------------------------------
   CREAM is a historical name — the ground is a neutral grey now. It is
   also the scene background and the fog colour, and `--scene-floor` in
   src/style.css has to match it: the taskbar strip hands over to that
   variable at the end of the fly-in. */
export const CREAM = "#dcdee0";
const BLUE = "#1b47a3";

const NAME = "Trish Nguyen"; // the floor wordmark

/* How much of the viewport width one line's horizontal extent covers.
   Under 1, so a whole name sits inside the frame with cream around it. */
const LINE_FILL = 0.62;
/* How much of the texture width that line occupies. Kept well under 1 so
   the texture keeps a cream border: the floor is larger than the texture,
   and ClampToEdge then stretches cream rather than smearing a sliced
   glyph into a streak across the ground. */
const LINE_IN_TEX = 0.82;
const MARGIN_X = 0.14; // left margin before a row's indent
/* Rows nearly touch in the reference — leading is well under the em. */
const LEADING = 0.74;
/* Share of the visible floor depth the rows should cover — the knob for
   row count. At 16:9 this works out to 8 rows. Portrait gets its own
   value: a phone frame is far deeper in floor terms, so the desktop
   figure would leave the type a small patch adrift in cream.

   Note this is deliberately read against the *home* framing's
   foreshortening, not the live camera's. The orbit can now drop to 2°
   above the floor, where the frame reads several hundred world units of
   depth and no row count would cover it; re-deriving the count from the
   live elevation would redraw the texture mid-drag for a band of type
   that is edge-on anyway. The patch stays the size the establishing
   shot wants and the fog takes care of everything past it. */
const FILL_DEPTH = 0.4;
const FILL_DEPTH_MOBILE = 0.55;
const ROWS_MIN = 4;
const ROWS_MAX = 24;

/* Per-row indent as a fraction of texture width, after floor-text.png —
   rows are staggered, and the line runs off the right edge. */
const ROW_INDENT = [0.03, 0.1, 0.04, 0.11, 0.06];

/* In-plane spin of the floor texture, in quarter turns of the ground
   plane: which floor axis the baselines run along. At 0 the baselines
   run down-right along +X and the glyph tops point up-right along -Z,
   which is the upright reading of flat text at this camera. */
const FLOOR_SPIN = 0;

/* --- Size, and why it is this big ------------------------
   The frame reads `frustum / sin(elevation)` of floor depth, so the
   plane has to grow as the camera flattens. At the old 16° floor of the
   orbit leash, 160 units was already close; at the 2° the leash reaches
   now, a portrait frame sees about 790 units of ground ahead of the
   camera and another 270 *behind* it.

   So the plane is sized to put its own edge off-frame at the flattest
   view on the deepest viewport, with the fog below finishing the job —
   between them there is no floor edge and no horizon anywhere on the
   leash. Both halves are needed: the plane alone would want to be
   enormous for every future camera, and fog alone leaves an edge in
   frame on a tall viewport, where it only happens to be invisible
   because the fogged floor and the background are the same colour.

   Two consequences in `scene.js`, both of which go with this number:
   the camera's `far` has to reach the far edge, and its `near` has to
   be *negative* enough to keep the ground behind the camera — which at
   2° is the bottom of the frame — from being clipped away. */
export const FLOOR_SIZE = 1700;

/* Fog in the floor's own colour, which is also the scene background's:
   the far reaches of the plane dissolve into the backdrop instead of
   ending at a line. Linear, and NEAR sits well past the furniture — the
   camera stays `CAM_DIST` from whatever it is looking at, so nothing on
   the desk is ever inside the fade, at any point of the orbit or the
   fly-in. Note there is no tone mapping on either render path, so a
   fully-fogged fragment resolves to exactly the clear colour. */
const FOG_NEAR = 140;
const FOG_FAR = 460;

const TEX_W = 2048;
const TEX_W_MOBILE = 1024;
const TEX_H_MAX = 4096;

/* --- State ----------------------------------------------- */
let disposables = [];
let floorMat = null;
let anisotropy = 1;
/* Width of NAME at font-size 1, measured once the webfont is resident. */
let nameRatio = 5.3;
/* What the current floor texture was built for. */
let texState = { rows: 0, texW: 0, ratio: 1 };

function track(x) {
  disposables.push(x);
  return x;
}

function fontSpec(size) {
  return `500 ${size}px "Playfair Display", Georgia, serif`;
}

/* The type is drawn with canvas 2D, so the webfont has to be resident
   before the first 3D frame or it silently falls back to Georgia. */
export async function loadFloorFont() {
  try {
    await document.fonts.load(fontSpec(100));
  } catch {
    /* fall back to the serif stack */
  }
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = fontSpec(100);
  nameRatio = ctx.measureText(NAME).width / 100;
}

/* ==========================================
   FLOOR TEXTURE

   How many rows to draw depends on the viewport. The line always spans
   the viewport width, so on a narrow screen each row is small in world
   units and more of them are needed to cover the floor.
   ========================================== */
function layoutFor(view) {
  const { frustum, aspect, projX, projZ, mobile } = view;
  const visibleWidth = frustum * aspect;

  /* A line runs diagonally, so what has to span the viewport is its
     horizontal screen extent, not its world length. */
  const lineWorld = (visibleWidth * LINE_FILL) / projX;
  const leadingWorld = (lineWorld / nameRatio) * LEADING;

  /* Likewise the stack climbs the screen at projZ per world unit. */
  const fillDepth = mobile ? FILL_DEPTH_MOBILE : FILL_DEPTH;
  const rows = THREE.MathUtils.clamp(
    1 + Math.round((fillDepth * frustum) / (projZ * leadingWorld)),
    ROWS_MIN,
    ROWS_MAX,
  );
  return { rows, texWorldX: lineWorld / LINE_IN_TEX };
}

function drawFloorTexture(rows, mobile) {
  const texW = mobile ? TEX_W_MOBILE : TEX_W;
  const size = (texW * LINE_IN_TEX) / nameRatio;
  const leading = size * LEADING;
  /* Pad past the ascenders and descenders so the border stays clean. */
  const texH = Math.min(
    Math.round((rows - 1) * leading + size * 1.6),
    TEX_H_MAX,
  );

  const c = document.createElement("canvas");
  c.width = texW;
  c.height = texH;
  const ctx = c.getContext("2d");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, texW, texH);

  ctx.font = fontSpec(size);
  ctx.fillStyle = BLUE;
  ctx.textBaseline = "middle";
  const top = (texH - (rows - 1) * leading) / 2;
  for (let i = 0; i < rows; i++) {
    ctx.fillText(
      NAME,
      texW * (MARGIN_X - ROW_INDENT[i % ROW_INDENT.length]),
      top + i * leading,
    );
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  texState = { rows, texW, ratio: texH / texW };
  return tex;
}

/* Rebuild the texture when the row count or resolution tier changes, then
   scale it onto the floor so one line spans the viewport width.

   `view` carries what the type is sized against — the frustum, the
   aspect, the two foreshortening factors and which resolution tier the
   viewport is in — so this module needs to know nothing about the
   camera. */
export function fitFloor(view) {
  if (!floorMat) return;
  const { rows, texWorldX } = layoutFor(view);

  if (
    rows !== texState.rows ||
    (view.mobile ? TEX_W_MOBILE : TEX_W) !== texState.texW
  ) {
    const old = floorMat.map;
    floorMat.map = drawFloorTexture(rows, view.mobile);
    floorMat.needsUpdate = true;
    if (old) {
      disposables = disposables.filter((d) => d !== old);
      old.dispose();
    }
    disposables.push(floorMat.map);
  }

  const tex = floorMat.map;
  const rx = FLOOR_SIZE / texWorldX;
  const ry = FLOOR_SIZE / (texWorldX * texState.ratio);
  tex.repeat.set(rx, ry);
  tex.offset.set(-(rx - 1) / 2, -(ry - 1) / 2);
}

/* The fog belongs to the floor, not to the camera — it is how the plane
   ends. Handed back for the scene to install. */
export function buildFog() {
  return new THREE.Fog(new THREE.Color(CREAM), FOG_NEAR, FOG_FAR);
}

export function buildFloor(maxAnisotropy = 1) {
  anisotropy = maxAnisotropy;
  const geo = track(new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE));
  floorMat = track(
    new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 }),
  );
  const floor = new THREE.Mesh(geo, floorMat);
  floor.name = "floor";
  floor.rotation.x = -Math.PI / 2;
  /* Only an in-plane spin, to pick which floor axis the baselines run
     along. The type stays aligned with the ground plane, so it
     foreshortens with it. */
  floor.rotation.z = FLOOR_SPIN;
  floor.receiveShadow = true;
  return floor;
}

export function disposeFloor() {
  disposables.forEach((d) => d.dispose());
  disposables = [];
  floorMat = null;
  texState = { rows: 0, texW: 0, ratio: 1 };
}
