import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
/* gsap-core, not the "gsap" entry: every tween here targets a plain
   object and the DOM writes happen by hand in onUpdate, so CSSPlugin
   and the default-eases bundle it drags in are dead weight. Saves
   ~10 kB gzipped off the lazy scene chunk. */
import { gsap } from "gsap/gsap-core";
import {
  buildComputer,
  disposeComputer,
  MON_W,
  MON_H,
  MON_Y,
  SCREEN_W,
  SCREEN_H,
  OVERSCAN,
} from "./computer.js";
/* Playfair is declared in src/style.css and preloaded from index.html,
   so the fetch starts with the entry stylesheet rather than waiting for
   this chunk to load. Nothing to import here — just await it below. */

/* ==========================================
   ISOMETRIC INTRO SCENE

   Owns one <canvas id="scene">. The only module that imports three.

   Camera: orthographic, 35° down / 45° around — see
   design-references/isometric-angle.webp.
   Floor: cream plane carrying the name as repeated deep-blue Playfair
   Display, after design-references/floor-text.png. A single low
   directional light rakes a long soft shadow across the letters.
   ========================================== */

/* --- Look ------------------------------------------------ */
const CREAM = "#dcdee0";
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
   The figure went up with the flatter camera: at 20° of elevation the
   frame sees two-thirds more floor depth than it did at 35°, and the
   old value left the type a band across the top with bare floor under
   it. */
const FILL_DEPTH = 0.4;
const FILL_DEPTH_MOBILE = 0.55;
const ROWS_MIN = 4;
const ROWS_MAX = 24;

/* Per-row indent as a fraction of texture width, after floor-text.png —
   rows are staggered, and the line runs off the right edge. */
const ROW_INDENT = [0.03, 0.1, 0.04, 0.11, 0.06];

/* --- Camera ----------------------------------------------
   Elevation follows the axis tripod in the CAD screenshot the angle was
   specified from: there the ground axes fall about 18-19° below the
   horizon either side of a vertical z. For an orthographic camera at a
   symmetric 45° azimuth that screen slope is atan(sin(elevation)), so
   18.9° on screen is 20° of elevation — a much flatter read than the
   35° this started at.

   The azimuth is then swung 8° off that symmetry, toward the side the
   screen faces (the machine's glass looks down world +Z, and the camera
   sits in the +X/+Z octant, so a *smaller* azimuth walks it round
   towards the front). The ground axes are no longer mirror images — +X
   flattens to ~11.7° below the horizon while +Z steepens to ~24° — but
   the monitor turns out of its even three-quarter view and shows more
   picture, which is the point. Keep it slight: past ~30° the side vents
   go out of shot and the view stops reading as isometric. */
const ELEVATION = THREE.MathUtils.degToRad(20);
const AZIMUTH = THREE.MathUtils.degToRad(37);
const CAM_DIST = 60;
const FRUSTUM = 18; // world units of vertical view
const FRUSTUM_MOBILE = 31; // pull back on narrow screens so the keyboard clears the edge
const MOBILE_BP = 760;

/* How the two floor axes land on screen at this camera angle. The text
   runs along world +X and the rows stack along world +Z, so both are
   foreshortened diagonals — that is what sells the type as lying on the
   ground rather than floating over it. Off the symmetric azimuth the two
   no longer match: the baselines lie flatter and the stack climbs more
   steeply, so type size comes down a touch and the row count goes up.
   Both fall out of these two numbers, so nothing needs hand-retuning. */
/* In-plane spin of the floor texture, in quarter turns of the ground
   plane: which floor axis the baselines run along. At 0 the baselines
   run down-right along +X and the glyph tops point up-right along -Z,
   which is the upright reading of flat text at this camera. */
const FLOOR_SPIN = 0;

const PROJ_X = Math.cos(AZIMUTH); // screen x per unit along +X
const PROJ_Z = Math.sin(ELEVATION) * Math.sin(AZIMUTH); // screen y per unit along +Z

/* --- Floor ----------------------------------------------- */
/* Generously past the viewport on all sides. It has to grow as the
   camera flattens: at 20° of elevation the frame reaches about 2.9 world
   units of floor depth per unit of screen height, so a plane that cleared
   the frame at 35° now shows its far edge across the top corners. */
const FLOOR_SIZE = 160;
const TEX_W = 2048;
const TEX_W_MOBILE = 1024;
const TEX_H_MAX = 4096;

/* Lighting once the HDRI is in play — see the note on the PI factor below. */
const ENV_INTENSITY = 0.7;
const AMBIENT_WITH_ENV = 0.5;
const HEMI_WITH_ENV = 0.3;

const GTAO_BLEND = 1.0; // deep enough that the creases actually darken
const HOVER_RATE = 7; // hover easing, per second
/* Base intensity of the point light spilling off the screen onto its own
   bezel; the loop scales it with the picture brightness. */
const SCREEN_GLOW = 2.1;

/* Capped at 1.5 rather than 2: the scene is shaded through GTAO on a
   full-screen composite, so cost goes with the square of this number,
   and on a 2x display the difference between 1.5 and 2 is not visible
   on matt plastic and a blurred tube. */
const MAX_DPR = 1.5;

/* ==========================================
   FLYING INTO THE SCREEN

   One parameter, `fly.value`: 0 is the isometric establishing shot, 1
   is the screen filling the viewport. `applyFly` derives the whole
   pose — position, look-at target and frustum — from it, so a resize
   mid-flight re-derives the framing instead of losing it, and
   `applyFly(0)` reproduces the original isometric shot exactly. That
   is still the only definition of it.

   What drives that parameter is a single paused GSAP timeline, built
   once by `buildFlyTimeline`. Playing it flies in; `reverse()` flies
   out along the identical eased curve, which is what makes the back
   animation the exact reverse rather than a second implementation of
   the same move.

   Position and target follow a CatmullRomCurve3 through four poses
   instead of the old two-phase turn-then-zoom blend. The phases used
   to overlap by a tenth of the run to disguise their hand-over; a
   single C1-continuous spline has no hand-over to disguise. The knots
   are *sampled off the old two-phase path*, so the arc it was
   art-directed into — the swing round to head-on after
   design-references/crt-computer.png, then the push-in — is preserved
   rather than re-invented.

   The frustum rides the same spline, in log space: for an orthographic
   camera the frustum height *is* the zoom, so lerping it linearly
   reads as a lurch.
   ========================================== */
const FLY_S = 1.6; // seconds, the whole camera move
/* The canvas-out / page-in crossfade, overlapping the tail of the
   camera move so the arrival settles instead of popping. */
const FADE_S = 0.3;
const FLY_EASE = "power3.inOut";
const FADE_EASE = "power1.inOut";
/* How much the page is scaled down at the start of that crossfade.
   Slight on purpose: enough to read as settling, not as a zoom. */
const FADE_SCALE = 0.015;

/* Where the four spline knots are taken from along the old two-phase
   path. 0 and 1 are the two framings that must land exactly; the middle
   two are the arc's shape — 0.3 is mid-swing and 0.55 is where the turn
   used to finish, head-on and framing the whole monitor. */
const FLY_KNOTS = [0, 0.3, 0.55, 1];
/* Catmull-Rom tension. Below 0.5 the curve slackens into a gentler bow
   through the knots, which is the whole point of using a spline here;
   at 0.5 (the three default) it tracks the old path almost exactly. */
const FLY_TENSION = 0.42;

const TURN_END = 0.55; // of the legacy path: camera is head-on by here
const ZOOM_START = 0.45; // ...and the push-in has already started
/* The head-on framing the turn settles into, as a multiple of the
   monitor's own size — a little room around the case. */
const MONITOR_FRAME = 1.12;

/* The live HTML on the glass is a DOM box of this width, mapped onto
   the screen plane with a CSS matrix. Big enough that the dialog is
   near its natural size once the page fills a desktop viewport, so the
   arrival does not read as a blown-up screenshot. */
const SCREEN_BASE_W = 1200;
/* Mapped inside the picture's black overscan border: the bezel lip
   overhangs the glass by more than the opening's clearance, so at the
   isometric camera it clips a sliver off the left edge of the panel.
   Sitting inside the overscan keeps the overlay clear of it. */
const SCREEN_INNER = 1 - 2 * OVERSCAN;
const SCREEN_BASE_H = (SCREEN_BASE_W * SCREEN_H) / SCREEN_W;

/* Steps the CRT blur and scanline pitch are snapped to while the camera
   is moving — see updateScreenOverlay. Absolute, in the box's own
   pixels, and deliberately coarse: over a flight the blur sweeps about
   0-4.5px and the pitch 8-15px, so these give nine levels and four
   rather than the ~90 distinct values a frame-by-frame value produces. */
const BLUR_STEP = 0.5;
const SCAN_STEP = 2;

let renderer = null;
let canvasEl = null;
let scene = null;
let gtaoPass = null;
let screenEl = null;
/* value: 0 isometric, 1 arrived. dir: -1 / 0 / +1 while moving. */
let fly = { value: 0, dir: 0 };
let camera = null;
let floorMat = null;
let composer = null;
let computer = null;
let envMap = null;
let hover = { target: 0, value: 0 };
let fillLights = null;
let onPointerMove = null;
let frame = null;
let disposables = [];
let onResize = null;
let onVisibility = null;
let onScreenInput = null;
/* Last value written to --scene-fade, so a repeat is not rewritten. */
let sceneFade = -1;
/* Dev-only stats.js panel; null in a production build — see src/perf.js. */
let perf = null;

/* Width of NAME at font-size 1, measured once the webfont is resident. */
let nameRatio = 5.3;
/* What the current floor texture was built for. */
let texState = { rows: 0, texW: 0, ratio: 1 };

/* WebGL may be absent (old browser, blocklisted driver, or _review.mjs
   stubbing getContext). Caller falls back to the plain CSS desktop. */
function supportsWebGL() {
  try {
    const probe = document.createElement("canvas");
    return !!(probe.getContext("webgl2") || probe.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function isMobile() {
  return window.innerWidth < MOBILE_BP;
}

function frustumFor() {
  return isMobile() ? FRUSTUM_MOBILE : FRUSTUM;
}

function fillDepthFor() {
  return isMobile() ? FILL_DEPTH_MOBILE : FILL_DEPTH;
}

function fontSpec(size) {
  return `500 ${size}px "Playfair Display", Georgia, serif`;
}

function measureNameRatio() {
  const ctx = document.createElement("canvas").getContext("2d");
  ctx.font = fontSpec(100);
  nameRatio = ctx.measureText(NAME).width / 100;
}

/* ==========================================
   FLOOR TEXTURE

   Drawn with canvas 2D rather than extruded as geometry: the shadow then
   falls across the letters as one continuous surface, which is what the
   reference does.

   How many rows to draw depends on the viewport. The line always spans
   the viewport width, so on a narrow screen each row is small in world
   units and more of them are needed to cover the floor.
   ========================================== */

function layoutFor(width, height) {
  const frustum = frustumFor();
  const visibleWidth = frustum * (width / height);

  /* A line runs diagonally, so what has to span the viewport is its
     horizontal screen extent, not its world length. */
  const lineWorld = (visibleWidth * LINE_FILL) / PROJ_X;
  const leadingWorld = (lineWorld / nameRatio) * LEADING;

  /* Likewise the stack climbs the screen at PROJ_Z per world unit. */
  const rows = THREE.MathUtils.clamp(
    1 + Math.round((fillDepthFor() * frustum) / (PROJ_Z * leadingWorld)),
    ROWS_MIN,
    ROWS_MAX,
  );
  return { rows, texWorldX: lineWorld / LINE_IN_TEX };
}

function drawFloorTexture(rows) {
  const texW = isMobile() ? TEX_W_MOBILE : TEX_W;
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
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

  texState = { rows, texW, ratio: texH / texW };
  return tex;
}

/* Rebuild the texture when the row count or resolution tier changes, then
   scale it onto the floor so one line spans the viewport width. */
function fitFloor(width, height) {
  if (!floorMat) return;
  const { rows, texWorldX } = layoutFor(width, height);

  if (
    rows !== texState.rows ||
    (isMobile() ? TEX_W_MOBILE : TEX_W) !== texState.texW
  ) {
    const old = floorMat.map;
    floorMat.map = drawFloorTexture(rows);
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

function buildFloor() {
  const geo = new THREE.PlaneGeometry(FLOOR_SIZE, FLOOR_SIZE);
  floorMat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const floor = new THREE.Mesh(geo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  /* Only an in-plane spin, to pick which floor axis the baselines run
     along. The type stays aligned with the ground plane, so it
     foreshortens with it. */
  floor.rotation.z = FLOOR_SPIN;
  floor.receiveShadow = true;
  disposables.push(geo, floorMat);
  return floor;
}

function buildScene() {
  const s = new THREE.Scene();
  s.background = new THREE.Color(CREAM);

  s.add(buildFloor());

  computer = buildComputer();
  computer.root.name = "computer";
  s.add(computer.root);

  /* One low directional light — the shallow angle is what stretches the
     shadow out long and diagonal across the letters.
     Intensities look ~3x high because three's physical lighting divides
     them by PI; tuned so lit cream lands on CREAM and the shadow sits at
     ~0.72 of it, matching the reference. */
  const key = new THREE.DirectionalLight(0xfffaf2, 4.4);
  key.position.set(-30, 8, 14); // ~13° above the floor, raking from upper left
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 3; // VSM blur width
  key.shadow.blurSamples = 16;
  key.shadow.bias = 0; // VSM wants no depth bias
  key.shadow.normalBias = 0.02;
  /* The box has to bound every bit of floor in frame, not just the
     machine: anything outside it loses its shadow on a straight line,
     which at this flatter camera cut the cast shadow off mid-frame.
     Widening it spreads the same map over more ground, so the blur
     radius comes down to keep the edge from going to mush. */
  const cam = key.shadow.camera;
  cam.left = -80;
  cam.right = 80;
  cam.top = 80;
  cam.bottom = -80;
  cam.near = 1;
  cam.far = 220;
  cam.updateProjectionMatrix();
  s.add(key, key.target);

  /* Soft fill — keeps the shadowed cream warm rather than grey, while
     staying low enough that the shadow reads as a distinct wedge. */
  const ambient = new THREE.AmbientLight(0xffffff, 1.5);
  const hemi = new THREE.HemisphereLight(0xfcfcfd, 0xc6c8cc, 0.76);
  s.add(ambient, hemi);
  fillLights = { ambient, hemi };

  return s;
}

/* ==========================================
   CAMERA

   The key framings are still specified as an orbit — a point to look
   at, an azimuth, an elevation and a frustum height — rather than as
   hard-coded positions, which is what lets the isometric shot and the
   head-on close-up be the same four numbers at two values of a single
   parameter. `samplePose` below is where that lives.

   The camera does not *travel* on an orbit, though: the flight
   interpolates a spline fitted through those poses. See applyFly.
   ========================================== */
function applyCameraSize(cam, width, height, f = frustumFor()) {
  const aspect = width / height;
  cam.left = (-f * aspect) / 2;
  cam.right = (f * aspect) / 2;
  cam.top = f / 2;
  cam.bottom = -f / 2;
  cam.updateProjectionMatrix();
}

const ISO_TARGET = new THREE.Vector3(0, 0, 0);
/* The whole monitor, square to the camera — the turn's resting place. */
const MONITOR_TARGET = new THREE.Vector3(0, MON_Y, 0);
/* Filled in from the screen mesh once the machine is built. */
const SCREEN_TARGET = new THREE.Vector3();
const flyTarget = new THREE.Vector3();
/* The frustum applyFly last worked out, so the arrival log reports what
   the camera actually did rather than restating the constants. There are
   no angles to report any more — the camera rides a spline, not an
   orbit. */
const flyPose = { frustum: FRUSTUM };

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
/* The cubic the legacy two-phase path was shaped with. Only the knot
   sampling uses it now; the run itself is eased by GSAP's power3.inOut,
   which is the same curve. */
const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const lerp = THREE.MathUtils.lerp;

/* Frustum height that frames the whole monitor head-on. */
function monitorFrustum(aspect) {
  return Math.max(MON_H * MONITOR_FRAME, (MON_W * MONITOR_FRAME) / aspect);
}

/* ...and the one at which the picture covers the viewport. `min`, not
   `max`: the screen is 4:3-ish and the viewport rarely is, so covering
   means cropping the other axis rather than letterboxing it. */
function screenFrustum(aspect) {
  return Math.min(
    SCREEN_H * SCREEN_INNER,
    (SCREEN_W * SCREEN_INNER) / aspect,
  );
}

/* The two-phase turn-then-zoom path the fly-in used to run on. It is no
   longer what the camera follows — it is sampled at FLY_KNOTS to build
   the spline that replaced it, which is how the arc that was
   art-directed here survives the rebuild. Aspect-independent in
   position and target; only the frustum needs the viewport. */
const legacyPose = { position: new THREE.Vector3(), target: new THREE.Vector3(), frustum: 0 };

function samplePose(p, aspect) {
  const turn = easeInOut(clamp01(p / TURN_END));
  const zoom = easeInOut(clamp01((p - ZOOM_START) / (1 - ZOOM_START)));

  legacyPose.target.lerpVectors(ISO_TARGET, MONITOR_TARGET, turn);
  legacyPose.target.lerp(SCREEN_TARGET, zoom);
  const azimuth = AZIMUTH * (1 - turn);
  const elevation = ELEVATION * (1 - turn);
  legacyPose.position.set(
    legacyPose.target.x + CAM_DIST * Math.cos(elevation) * Math.sin(azimuth),
    legacyPose.target.y + CAM_DIST * Math.sin(elevation),
    legacyPose.target.z + CAM_DIST * Math.cos(elevation) * Math.cos(azimuth),
  );
  legacyPose.frustum = Math.exp(
    lerp(
      lerp(Math.log(frustumFor()), Math.log(monitorFrustum(aspect)), turn),
      Math.log(screenFrustum(aspect)),
      zoom,
    ),
  );
  return legacyPose;
}

/* The spline the camera actually flies. Three curves sharing one
   uniform parameterisation, so position, target and zoom stay locked to
   each other at every point of the run — sampling them at the same u is
   what makes them move "together" rather than as three tweens that
   happen to have the same duration.

   The frustum is a curve too, carrying log(height) in x: reusing
   three's Catmull-Rom for it guarantees it is parameterised identically
   to the other two, where a separate scalar easing would drift.

   Rebuilt on resize, because the frustum knots depend on the aspect. */
let flyPath = null;

function buildFlyPath(width, height) {
  const aspect = width / height;
  const positions = [];
  const targets = [];
  const frustums = [];
  for (const k of FLY_KNOTS) {
    const pose = samplePose(k, aspect);
    positions.push(pose.position.clone());
    targets.push(pose.target.clone());
    frustums.push(new THREE.Vector3(Math.log(pose.frustum), 0, 0));
  }
  const curve = (pts) =>
    new THREE.CatmullRomCurve3(pts, false, "catmullrom", FLY_TENSION);
  flyPath = {
    position: curve(positions),
    target: curve(targets),
    frustum: curve(frustums),
    /* The endpoints have to land exactly whatever the spline does, and
       the zoom must not overshoot — a frustum that dips below the final
       height and comes back reads as a bounce. */
    fMin: Math.min(frustums[0].x, frustums[3].x),
    fMax: Math.max(frustums[0].x, frustums[3].x),
  };
}

const flyPoint = new THREE.Vector3();

/* The single source of truth for where the camera is. Linear in p — the
   easing lives on the GSAP timeline, so `__flyTo(0.5)` is the
   geometric middle of the move rather than the temporal one.
   p = 0 reproduces buildCamera's original isometric pose exactly. */
function applyFly(p, width, height) {
  if (!flyPath) buildFlyPath(width, height);
  const u = clamp01(p);

  flyPath.position.getPoint(u, flyPoint);
  flyPath.target.getPoint(u, flyTarget);
  camera.position.copy(flyPoint);
  camera.lookAt(flyTarget);
  camera.updateMatrixWorld();

  const f = Math.exp(
    THREE.MathUtils.clamp(
      flyPath.frustum.getPoint(u, flyPoint).x,
      flyPath.fMin,
      flyPath.fMax,
    ),
  );
  applyCameraSize(camera, width, height, f);
  flyPose.frustum = f;

  /* GTAO's radius is in world units, tuned against the isometric
     framing. Six times closer in it is no longer sampling creases, so
     it fades out rather than blotching the bezel. */
  if (gtaoPass) gtaoPass.blendIntensity = GTAO_BLEND * (1 - clamp01(p / 0.3));
  return f;
}

/* Position, orientation and frustum all come from applyFly. */
function buildCamera() {
  const cam = new THREE.OrthographicCamera();
  cam.near = 0.1;
  cam.far = 400;
  return cam;
}

/* ==========================================
   THE LIVE PAGE ON THE GLASS

   #screen is a DOM box that gets laid onto the screen plane with a CSS
   matrix(). The camera is orthographic, so the projection of a plane
   is affine: three projected corners determine the transform exactly,
   with none of the matrix3d homography a perspective camera would
   need, and the same two lines hold at every point of the fly-in.
   ========================================== */
const screenCorner = new THREE.Vector3();
const TL = [0, 0];
const TR = [0, 0];
const BL = [0, 0];

function projectCorner(x, y, width, height, out) {
  screenCorner
    .set(x, y, 0)
    .applyMatrix4(computer.screen.matrixWorld)
    .project(camera);
  out[0] = (screenCorner.x * 0.5 + 0.5) * width;
  out[1] = (-screenCorner.y * 0.5 + 0.5) * height;
}

function updateScreenOverlay() {
  if (!screenEl || !camera || !computer) return;
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  if (!width || !height) return;

  const hw = (SCREEN_W * SCREEN_INNER) / 2;
  const hh = (SCREEN_H * SCREEN_INNER) / 2;
  projectCorner(-hw, hh, width, height, TL);
  projectCorner(hw, hh, width, height, TR);
  projectCorner(-hw, -hh, width, height, BL);

  const ax = (TR[0] - TL[0]) / SCREEN_BASE_W;
  const ay = (TR[1] - TL[1]) / SCREEN_BASE_W;
  const bx = (BL[0] - TL[0]) / SCREEN_BASE_H;
  const by = (BL[1] - TL[1]) / SCREEN_BASE_H;
  screenEl.style.transform = `matrix(${ax},${ay},${bx},${by},${TL[0]},${TL[1]})`;

  /* Scanline pitch and CRT softness are authored in the box's own
     pixels but want to be constant in *device* pixels, so both are
     divided by however much the matrix is currently shrinking it.
     Clamped: at the isometric framing the box is five times smaller
     than it draws, and an unclamped pitch would out-run the picture. */
  const scale = Math.hypot(ax, ay) || 1;
  const set = (k, v) => screenEl.style.setProperty(k, v);
  set("--zoom", fly.value.toFixed(4));

  /* --scan and --blur are the expensive two: they feed a blur filter
     and three repeating gradients, so every distinct value costs a
     fresh raster of the whole box — which by the end of a flight is the
     whole viewport. --zoom only drives opacity on a promoted layer,
     which the compositor does for free, so that one stays per-frame.

     Snapping the other two to a coarse grid while the camera moves
     turns ~90 rasters over a 1.6s flight into about a dozen, and the
     steps are not visible under the motion — the CRT softness is
     fading out across the same window. At rest they resolve exactly,
     which is where stepping *would* show. */
  const snap = (v, step) => Math.round(v / step) * step;
  let scan = Math.max(8, 3 / scale);
  let blur = (0.9 / scale) * (1 - fly.value);
  if (fly.dir !== 0) {
    scan = snap(scan, SCAN_STEP);
    blur = snap(blur, BLUR_STEP);
  }
  set("--scan", `${scan.toFixed(2)}px`);
  set("--blur", `${blur.toFixed(2)}px`);
}

/* ==========================================
   ENVIRONMENT MAP

   "Studio Small 09" by Sergej Majboroda, Poly Haven, CC0 — downsampled
   to 256x128 (see public/env/LICENSE.txt). It is only ever read through
   PMREM as a blurred reflection, so the small size costs nothing
   visually and saves ~1.4 MB. Loaded after the first frame: the scene
   stands up fine without it, it just looks flatter.
   ========================================== */
async function loadEnvironment() {
  try {
    const url = `${import.meta.env.BASE_URL}env/studio-small-09-256.hdr`;
    const hdr = await new HDRLoader().loadAsync(url);
    const pmrem = new THREE.PMREMGenerator(renderer);
    envMap = pmrem.fromEquirectangular(hdr).texture;
    scene.environment = envMap;
    /* The HDRI is now the ambient source, so the flat fills have to come
       down or the cream blows out and the shadow stops reading. */
    scene.environmentIntensity = ENV_INTENSITY;
    fillLights.ambient.intensity = AMBIENT_WITH_ENV;
    fillLights.hemi.intensity = HEMI_WITH_ENV;
    hdr.dispose();
    pmrem.dispose();
    return true;
  } catch (e) {
    console.warn("env map failed:", e);
    return false; // plain lighting; the scene still reads
  }
}

/* ==========================================
   AMBIENT OCCLUSION

   GTAO through an EffectComposer, desktop only — it is the single most
   expensive thing here and a phone does not need it. OutputPass takes
   over the colour-space conversion the renderer would otherwise do.
   ========================================== */
function buildComposer(width, height) {
  const c = new EffectComposer(renderer);
  c.addPass(new RenderPass(scene, camera));

  const gtao = new GTAOPass(scene, camera, width, height);
  gtao.output = GTAOPass.OUTPUT.Default;
  gtao.blendIntensity = GTAO_BLEND;
  gtao.updateGtaoMaterial({
    radius: 1.15, // world units — keep it to creases, not the whole floor
    distanceExponent: 1.4,
    thickness: 1.0,
    scale: 1.15, // deeper than neutral; past ~1.35 the noise shows on the bezel
    samples: 24, // 12 is not enough once the scale is up
  });
  c.addPass(gtao);
  c.addPass(new OutputPass());
  gtaoPass = gtao;
  return c;
}

/* ==========================================
   HOVER

   The canvas is pointer-events:none so the Win95 chrome stays
   clickable, so the move is tracked on the window and converted into
   canvas space by hand. Events over a window or the taskbar are
   ignored — those are in front of the scene.
   ========================================== */
function initHover(canvas) {
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();

  onPointerMove = (e) => {
    /* Once the camera is on its way in, the picture is the live page
       rather than the texture, and the hover feedback has nothing left
       to say. */
    if (fly.value > 0) {
      hover.target = 0;
      return;
    }
    if (e.target?.closest?.(".window, #taskbar, #start-menu")) {
      hover.target = 0;
      return;
    }
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    hover.target = ray.intersectObject(computer.root, true).length ? 1 : 0;
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
}

/* ==========================================
   THE FLY-IN

   Click the glass and the camera leaves the establishing shot, swings
   round to face the screen and pushes in until the page on it has the
   viewport; the canvas then fades out and what is left is ordinary
   HTML, which it was all along. The back button runs the same
   parameter the other way.

   `screen-active` is on the body for the whole trip (the desktop
   chrome stands down), `screen-zooming` only while the camera is
   moving, `screen-focused` once it has arrived.
   ========================================== */
function render() {
  if (composer) composer.render();
  else renderer.render(scene, camera);
}

function setFly(p) {
  fly.value = p;
  applyFly(p, canvasEl.clientWidth, canvasEl.clientHeight);
  updateScreenOverlay();
  /* The 40px strip the taskbar vacates carries the floor colour while
     there is still floor in shot, and the desktop teal once the picture
     has the frame. That hand-over tracks the *zoom*, not the crossfade:
     the floor is out of shot well before the canvas starts to dissolve,
     and mixing on the crossfade instead leaves a visibly lighter band
     under a screen that has already gone teal.

     The hand-over is held until late in the zoom: at the half-way point
     the floor still fills the bottom of the frame, and a strip already
     part-way to teal reads as a light band under it. By p = 0.95 the
     picture covers the canvas edge to edge and the strip has to match
     it. Snapped to 5% so most frames rewrite the same string and cost
     no style invalidation at all. */
  const step = Math.round(clamp01((p - 0.7) / 0.25) * 20) / 20;
  if (step !== sceneFade) {
    sceneFade = step;
    document.body.style.setProperty("--scene-fade", step.toFixed(2));
  }
}

/* Where the camera ends up, so the framing can be tuned by hand. The
   frustum height is the zoom — this camera is orthographic, so the
   distance along the view axis makes no difference to the framing. */
function logArrival() {
  const round = (v) => Math.round(v * 1000) / 1000;
  console.log("[scene] arrived at the screen", {
    position: camera.position.toArray().map(round),
    target: flyTarget.toArray().map(round),
    frustumHeight: round(flyPose.frustum),
  });
}

function arrive() {
  fly.dir = 0;
  document.body.classList.remove("screen-zooming");
  document.body.classList.add("screen-focused");
  /* Snap both parameters to the endpoint. GSAP lands on it exactly, but
     this is also the path reduced motion and a mid-flight reversal take,
     and the live HTML has to come back to an untransformed page. */
  applyFade(1);
  showStill(false);
  hover.target = 0;
  document.getElementById("login-user")?.focus({ preventScroll: true });
  logArrival();
}

function depart() {
  fly.dir = 0;
  document.body.classList.remove("screen-active", "screen-zooming");
  applyFade(0);
  showStill(false);
  /* The form may have been typed into while it was up, so the bitmap is
     stale for the next flight. */
  stillDirty = true;
  refreshStill();
}

/* ==========================================
   THE CROSSFADE

   The camera arriving and the page taking over used to be sequential:
   the frustum finished, `screen-focused` went on, and *then* a 0.5s CSS
   transition faded the canvas. That gap is the pop. Now it is a tween
   on the same timeline, overlapping the last FADE_S of the move, and
   `fade` carries all three of its parts so they cannot drift:

   - the canvas dissolves (it is still drawing the monitor the page is
     mapped onto, so this is the actual hand-over),
   - the page scales the last FADE_SCALE up to its resting size, so it
     settles into the frame rather than snapping to it,
   - and `--page-fade` crosses the body from the floor grey the taskbar
     strip shows during the flight to the desktop teal behind the login.
   ========================================== */
function applyFade(v) {
  if (canvasEl) canvasEl.style.opacity = `${1 - v}`;
  document.body.style.setProperty("--page-fade", v.toFixed(4));
  if (!screenEl) return;
  screenEl.style.setProperty("--settle", (1 - FADE_SCALE * (1 - v)).toFixed(5));
  /* visibility, not just the opacity the stylesheet derives from
     --page-fade: an element at opacity 0 is still painted, and painting
     this one is the whole cost the still exists to avoid. Hidden for
     the body of the move, revealed for the crossfade.

     Conditioned on the flight actually being in progress, because
     `depart` ends at fade 0 and the overlay has to be clickable again
     at the establishing shot — hiding it unconditionally leaves the
     monitor dead to a second click. `depart` removes the class before
     it calls this, which is what makes the test come out right there. */
  const flying = document.body.classList.contains("screen-active");
  screenEl.style.visibility = v === 0 && flying ? "hidden" : "";
}

/* ==========================================
   THE STILL

   During the move the glass shows a bitmap of the login rather than the
   live subtree. The live one is only ~40 nodes, so this is not about
   layout — it is about raster. `#screen-page` carries a blur filter and
   `.crt-fx` three gradients, and the matrix rescales the box every
   frame; the compositor cannot reuse a raster across a scale change, so
   the browser re-blurred and re-drew those gradients once per frame
   over an area that by the end of the move is the whole viewport. That
   measured at ~57ms a frame flying out on a phone-sized window. One
   immutable <img> costs a texture upload, once.

   Drawn through an SVG <foreignObject>, which is the only way to get
   the browser's own layout of real HTML into a canvas. Two things it
   needs:

   - every stylesheet inlined, since the SVG renders as an image with no
     access to the parent document or the network. Collected from
     document.styleSheets rather than imported, so it keeps working
     whatever Vite does to the CSS between dev and build.
   - the design tokens copied onto the wrapper as inline custom
     properties. They are declared on `:root`, which inside the SVG is
     the <svg> element rather than the <html> the selector expects.

   Fonts cannot be fetched from inside the image either, so the dialog
   renders in the local fallback of `--font`. It is correct for the
   login, which asks for a UI font and not Playfair.

   Browsers may refuse to draw a foreignObject image into a canvas, and
   some older ones get it wrong rather than refusing. Every failure path
   leaves `stillCanvas` null, and the move then shows the abstract
   desktop picture the glass carries at rest — the login then arrives
   with the crossfade instead of being there throughout. Different,
   still smooth, never broken.
   ========================================== */
let stillCanvas = null;
let stillDirty = true;
let stillPending = false;

function collectStyles() {
  let css = "";
  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) css += `${rule.cssText}\n`;
    } catch {
      /* A sheet we are not allowed to read. There are none on this
         origin, but a browser extension can inject one. */
    }
  }
  return css;
}

function collectTokens() {
  const computed = getComputedStyle(document.documentElement);
  let out = "";
  for (const name of computed) {
    if (name.startsWith("--")) out += `${name}:${computed.getPropertyValue(name)};`;
  }
  return out;
}

/* The contents of a <foreignObject> are parsed as XML, and neither half
   of what goes in there is XML-well-formed as authored: the login
   markup has bare void elements (`<input ...>`), and the stylesheets
   carry 98.css's icons as inline `data:` SVG, so the CSS text itself is
   full of raw `<` and `&`. Hand-concatenating the strings produces a
   document the parser rejects outright, and the only symptom is an
   image that never decodes.

   So the subtree is assembled as real DOM and handed to XMLSerializer,
   which closes the void elements and escapes the CSS text for us. */
function buildStillMarkup(w, h) {
  const page = document.getElementById("screen-page");
  if (!page) return null;

  const wrap = document.createElement("div");
  wrap.setAttribute(
    "style",
    `${collectTokens()}` +
      /* #screen-page is inset:0, so it needs a positioned parent — in
         here there is no #screen to resolve against. */
      `position:relative;width:${w}px;height:${h}px;overflow:hidden;` +
      /* The three variables that live on #screen rather than on :root,
         so the copied tokens do not carry them. The bitmap is drawn
         crisp and unscaled; the blur and the settle scale are applied
         to the <img> at display time, where they can keep tracking the
         camera. */
      `--blur:0px;--hover:0;--settle:1`,
  );

  const style = document.createElement("style");
  /* textContent, not innerHTML: the serializer escapes it on the way
     out and the XML parser hands the CSS back verbatim. */
  style.textContent = collectStyles();
  wrap.append(style, page.cloneNode(true));

  /* serializeToString puts the XHTML namespace on the div itself. */
  const inner = new XMLSerializer().serializeToString(wrap);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">` +
    `<foreignObject width="100%" height="100%">${inner}</foreignObject>` +
    `</svg>`
  );
}

async function drawStill() {
  const w = Math.round(SCREEN_BASE_W);
  const h = Math.round(SCREEN_BASE_H);
  try {
    /* Inside the try, all of it: assembling the markup walks every
       stylesheet in the document and runs XMLSerializer over the
       result, and a throw out there would be an unhandled rejection
       rather than the graceful fallback below. */
    const svg = buildStillMarkup(w, h);
    if (!svg) return false;

    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    /* Throws on a tainted canvas, which is the one failure mode that
       would otherwise only surface later as a WebGL security error on
       texture upload. Cheaper to find out here. */
    canvas.toDataURL("image/png");
    stillCanvas = canvas;
    stillDirty = false;
    return true;
  } catch (err) {
    /* Every exit here is survivable — showStill() will not switch the
       class on without a bitmap, and the move runs on the live subtree
       exactly as it used to. Worth knowing about while developing,
       though, because the only other symptom is the old frame rate. */
    if (import.meta.env.DEV) {
      console.warn("[scene] could not rasterise the login still", err);
    }
    stillCanvas = null;
    return false;
  }
}

/* Kept off the click: redrawing takes a few milliseconds, which is a
   visible hitch if it lands on the first frame of the move. Prepared
   once the scene is up and refreshed when the form changes, so by the
   time anyone clicks the bitmap is already decoded. */
function refreshStill() {
  if (stillPending || !stillDirty) return;
  stillPending = true;
  const run = () => {
    stillPending = false;
    drawStill();
  };
  if (window.requestIdleCallback) requestIdleCallback(run, { timeout: 2000 });
  else setTimeout(run, 0);
}

/* The hand-over between the texture and the live subtree. Both show the
   same login at the same place, so the crossfade between them has
   nothing to give away — which is exactly why the canvas can dissolve
   over the last FADE_S without a seam. */
function showStill(on) {
  if (!computer) return;
  if (on) {
    if (stillCanvas) computer.setStill(stillCanvas);
  } else {
    computer.clearStill();
  }
}

/* ==========================================
   THE TIMELINE

   One paused GSAP timeline, built once. `play()` flies in and
   `reverse()` flies out along the identical eased curve — the back
   animation is the forward one run backwards, not a second
   implementation, so it cannot drift out of agreement.

   Both tweens sit on the same proxy object and are read in `onUpdate`,
   rather than GSAP writing camera properties directly. That is
   deliberate: `applyFly` has to stay the only thing that poses the
   camera, because the curved path means position is sampled off a
   spline rather than interpolated between two values, and because a
   resize mid-flight re-derives the framing from `fly.value`. GSAP owns
   the *timing*; `applyFly` owns the *pose*.
   ========================================== */
let flyTl = null;
const flyState = { p: 0, fade: 0 };

function buildFlyTimeline() {
  /* GSAP's default lag smoothing (500ms threshold, counted as 33ms)
     protects the *animation* at the cost of wall-clock time: on a
     machine rendering at 0.5fps it stretched this 1.6s flight to over
     half a minute. The old hand-rolled loop capped each step at 250ms
     instead, on the reasoning that a machine which cannot hold 4fps
     should arrive promptly rather than be made to sit through a long
     flight. Same numbers, same reasoning. */
  gsap.ticker.lagSmoothing(250, 250);

  flyTl = gsap
    .timeline({
      paused: true,
      onComplete: arrive,
      onReverseComplete: depart,
    })
    .to(
      flyState,
      {
        p: 1,
        duration: FLY_S,
        ease: FLY_EASE,
        onUpdate: () => setFly(flyState.p),
      },
      0,
    )
    .to(
      flyState,
      {
        fade: 1,
        duration: FADE_S,
        ease: FADE_EASE,
        onUpdate: () => applyFade(flyState.fade),
      },
      FLY_S - FADE_S,
    );
}

/* Reduced motion gets the destination, not the journey. */
function jumpFly(to) {
  flyTl?.pause();
  flyState.p = to;
  flyState.fade = to;
  setFly(to);
  applyFade(to);
  if (to === 1) {
    document.body.classList.add("screen-active");
    render();
    arrive();
  } else {
    document.body.classList.remove("screen-focused");
    render();
    depart();
  }
}

export function flyToScreen() {
  if (!screenEl || fly.value === 1 || (flyTl && flyTl.isActive() && flyTl.reversed() === false)) return;
  document.body.classList.add("screen-active", "screen-zooming");
  if (prefersReducedMotion()) return jumpFly(1);
  showStill(true);
  fly.dir = 1;
  flyTl.play();
}

export function flyFromScreen() {
  if (!screenEl || fly.value === 0 || (flyTl && flyTl.isActive() && flyTl.reversed())) return;
  document.body.classList.remove("screen-focused");
  if (prefersReducedMotion()) return jumpFly(0);
  document.body.classList.add("screen-zooming");
  showStill(true);
  fly.dir = -1;
  flyTl.reverse();
}

function onScreenClick(e) {
  /* Once the page has the viewport the clicks belong to the form. */
  if (fly.value > 0) return;
  e.preventDefault();
  flyToScreen();
}

function initScreenOverlay() {
  screenEl = document.getElementById("screen");
  if (!screenEl) return;
  /* Sized from JS rather than CSS so the box's aspect is exactly
     SCREEN_W / SCREEN_H — offsetHeight rounds to whole pixels, and the
     matrix is derived from these two numbers. */
  screenEl.style.width = `${SCREEN_BASE_W}px`;
  screenEl.style.height = `${SCREEN_BASE_H}px`;
  screenEl.hidden = false;
  screenEl.addEventListener("click", onScreenClick);

  /* Typing in the login invalidates the bitmap, so mark it and redraw in
     idle time rather than on the next click. */
  onScreenInput = () => {
    stillDirty = true;
    refreshStill();
  };
  screenEl.addEventListener("input", onScreenInput);
  refreshStill();

  updateScreenOverlay();
}

/* ==========================================
   LIFECYCLE
   ========================================== */
export async function initScene(canvas) {
  if (!canvas || !supportsWebGL()) return false;

  canvasEl = canvas;
  const { clientWidth: w, clientHeight: h } = canvas;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  /* PCFSoftShadowMap was removed in three 0.186 and silently degrades to
     hard PCF. VSM is the remaining soft option. */
  renderer.shadowMap.type = THREE.VSMShadowMap;
  /* Nothing in this scene ever casts a different shadow: the light is
     fixed and the machine does not move (`lift` exists but nothing
     animates it any more — see computer.js). So the map is rendered
     once and then frozen, instead of re-rendering a 2048² VSM depth
     pass with 16 blur samples on every frame of the fly-in.

     `needsUpdate` is set rather than cleared — three renders the map on
     the next frame and clears the flag itself. If anything is ever
     animated back into the scene, this is what has to be reverted. */
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /* The floor is drawn with canvas 2D, so the webfont has to be resident
     before the first paint or it silently falls back to Georgia. */
  try {
    await document.fonts.load(fontSpec(100));
  } catch {
    /* fall back to the serif stack */
  }
  measureNameRatio();

  scene = buildScene();
  camera = buildCamera();
  /* The machine never moves, so one update pins the screen plane's
     world matrix for the overlay projection and for SCREEN_TARGET. */
  scene.updateMatrixWorld(true);
  computer.screen.getWorldPosition(SCREEN_TARGET);
  applyFly(0, w, h);
  fitFloor(w, h);

  if (!isMobile() && !prefersReducedMotion()) {
    try {
      composer = buildComposer(w, h);
    } catch {
      composer = null; // fall back to a straight render
    }
  }

  /* Handles for the visual-review scripts. `__flyTo` parks the camera
     at a point of the fly-in and draws it, which is how the head-on
     framing gets tuned without trying to catch it mid-animation. */
  window.__scene = scene;
  window.__composer = composer;
  window.__stillReady = () => !!stillCanvas;
  /* Parks the flight at a point of the *timeline* and draws it. It
     seeks the real timeline rather than posing the camera itself, so
     what it shows is what the flight shows there — the login bitmap on
     the glass, the crossfade, the body classes and all. Seeking with
     events on is what makes the tweens' onUpdate run; the endpoints
     therefore also fire arrive/depart, which is what parking at an
     endpoint means. */
  window.__flyTo = (x) => {
    if (!flyTl) return null;
    const t = clamp01(x);
    flyTl.pause();
    const moving = t > 0 && t < 1;
    document.body.classList.toggle("screen-active", t > 0);
    document.body.classList.toggle("screen-zooming", moving);
    showStill(moving);
    fly.dir = 0; // parked: --scan and --blur resolve exactly
    flyTl.progress(t, false);
    render();
    return {
      position: camera.position.toArray(),
      target: flyTarget.toArray(),
      frustumHeight: camera.top - camera.bottom,
      fade: flyState.fade,
    };
  };

  onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    /* The spline's frustum knots are framings, so they move with the
       aspect: the path has to be rebuilt, not just re-sampled. */
    buildFlyPath(width, height);
    /* Re-derived from fly.value rather than reset, so a resize part-way
       through the fly-in — or while the login page is up — keeps the
       camera where it was. */
    applyFly(fly.value, width, height);
    fitFloor(width, height);
    updateScreenOverlay();
    if (!frame && fly.value < 1) render();
  };
  window.addEventListener("resize", onResize);

  render();
  initScreenOverlay();
  buildFlyTimeline();
  loadEnvironment().then((ok) => {
    if (ok && !frame) render();
  });

  /* Reduced motion: one static frame, no loop and no hover. The screen
     is still clickable — the fly-in just arrives instead of flying. */
  if (prefersReducedMotion()) return true;

  /* Vite folds `import.meta.env.DEV` to `false` when building, so this
     branch — and src/perf.js with stats.js inside it — is dropped from
     the production bundle. */
  if (import.meta.env.DEV) {
    try {
      perf = (await import("./perf.js")).createPerfMeter();
    } catch {
      perf = null; // the meter is never load-bearing
    }
  }

  initHover(canvas);

  /* Hover happens entirely on the screen: the machine does not move, the
     picture does. The CRT comes up brighter and the window on it shows a
     greeting (`setScreen` crossfades the two pictures, see
     `screenDisplay` in computer.js). Nothing moves in world space, so
     the contact shadows and the cables stay put. */
  const screenMat = computer.screenMat;
  const screenGlow = computer.screenGlow;
  const clock = new THREE.Clock();
  let elapsed = 0;
  const tick = () => {
    frame = requestAnimationFrame(tick);
    perf?.begin();
    /* Time-based easing, so the picture settles at the same speed
       whatever the frame rate. */
    const dt = clock.getDelta();
    elapsed += dt;
    const k = 1 - Math.exp(-HOVER_RATE * dt);
    hover.value += (hover.target - hover.value) * k;
    computer.setScreen(hover.value);
    screenEl?.style.setProperty("--hover", hover.value.toFixed(3));
    /* A real tube never sits perfectly still — a shallow beat on the
       brightness, well under what reads as a flash. */
    const flicker =
      1 + 0.018 * Math.sin(elapsed * 11.3) * Math.sin(elapsed * 2.7);
    const bright = (1 + hover.value * 0.45) * flicker;
    screenMat.emissiveIntensity = bright;
    screenGlow.intensity = SCREEN_GLOW * bright;

    /* The fly-in is advanced by the GSAP timeline on its own ticker;
       all this loop owes it is a frame to land in. Once the page has
       the viewport the canvas is faded out, so there is nothing left to
       draw until the camera starts back. */
    if (fly.value < 1) render();
    perf?.end(fly.value);
  };
  tick();

  /* Don't burn frames on a hidden tab. */
  onVisibility = () => {
    if (document.hidden) {
      if (frame) cancelAnimationFrame(frame);
      frame = null;
    } else if (!frame) {
      tick();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);

  return true;
}

export function disposeScene() {
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  if (onResize) window.removeEventListener("resize", onResize);
  if (onVisibility)
    document.removeEventListener("visibilitychange", onVisibility);
  if (onPointerMove) window.removeEventListener("pointermove", onPointerMove);
  perf?.dispose();
  perf = null;
  disposables.forEach((d) => d.dispose());
  disposables = [];
  disposeComputer();
  floorMat = null;
  texState = { rows: 0, texW: 0, ratio: 1 };
  flyTl?.kill();
  flyTl = null;
  flyState.p = flyState.fade = 0;
  flyPath = null;
  if (screenEl) {
    screenEl.removeEventListener("click", onScreenClick);
    if (onScreenInput) screenEl.removeEventListener("input", onScreenInput);
    screenEl.hidden = true;
    screenEl.style.transform = "";
    screenEl.style.visibility = "";
  }
  stillCanvas = null;
  stillDirty = true;
  sceneFade = -1;
  document.body.style.removeProperty("--scene-fade");
  if (canvasEl) canvasEl.style.opacity = "";
  document.body.style.removeProperty("--page-fade");
  document.body.classList.remove("screen-active", "screen-zooming", "screen-focused");
  fly = { value: 0, dir: 0 };
  screenEl = null;
  gtaoPass = null;
  canvasEl = null;
  envMap?.dispose();
  composer?.dispose();
  renderer?.dispose();
  hover = { target: 0, value: 0 };
  renderer = scene = camera = composer = computer = envMap = null;
  onResize = onVisibility = onPointerMove = onScreenInput = null;
}
