import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { buildComputer, disposeComputer, FACING } from './computer.js';
import '@fontsource/playfair-display/500.css';

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
const CREAM = '#f4efe1';
const BLUE  = '#1b47a3';

const NAME = 'Trish Nguyen';   // the floor wordmark

/* How much of the viewport width one line's horizontal extent covers.
   Under 1, so a whole name sits inside the frame with cream around it. */
const LINE_FILL = 0.62;
/* How much of the texture width that line occupies. Kept well under 1 so
   the texture keeps a cream border: the floor is larger than the texture,
   and ClampToEdge then stretches cream rather than smearing a sliced
   glyph into a streak across the ground. */
const LINE_IN_TEX = 0.82;
const MARGIN_X = 0.14;         // left margin before a row's indent
/* Rows nearly touch in the reference — leading is well under the em. */
const LEADING   = 0.74;
/* Share of the visible floor depth the rows should cover — the knob for
   row count. At 16:9 this works out to 4 rows. Portrait gets its own
   value: a phone frame is far deeper in floor terms, so the desktop
   figure would leave the type a small patch adrift in cream. */
const FILL_DEPTH        = 0.236;
const FILL_DEPTH_MOBILE = 0.55;
const ROWS_MIN = 4;
const ROWS_MAX = 24;

/* Per-row indent as a fraction of texture width, after floor-text.png —
   rows are staggered, and the line runs off the right edge. */
const ROW_INDENT = [0.03, 0.10, 0.04, 0.11, 0.06];

/* --- Camera ---------------------------------------------- */
const ELEVATION = THREE.MathUtils.degToRad(35);
const AZIMUTH   = THREE.MathUtils.degToRad(45);
const CAM_DIST  = 60;
const FRUSTUM        = 18;     // world units of vertical view
const FRUSTUM_MOBILE = 31;     // pull back on narrow screens so the keyboard clears the edge
const MOBILE_BP = 760;

/* How the two floor axes land on screen at this camera angle. The text
   runs along world +X and the rows stack along world +Z, so both are
   foreshortened diagonals — that is what sells the type as lying on the
   ground rather than floating over it. */
/* In-plane spin of the floor texture, in quarter turns of the ground
   plane: which floor axis the baselines run along. At 0 the baselines
   run down-right along +X and the glyph tops point up-right along -Z,
   which is the upright reading of flat text at this camera. */
const FLOOR_SPIN = 0;

const PROJ_X = Math.cos(AZIMUTH);                        // screen x per unit along +X
const PROJ_Z = Math.sin(ELEVATION) * Math.sin(AZIMUTH);  // screen y per unit along +Z

/* --- Floor ----------------------------------------------- */
const FLOOR_SIZE = 70;         // generously past the viewport on all sides
const TEX_W        = 2048;
const TEX_W_MOBILE = 1024;
const TEX_H_MAX    = 4096;

/* Lighting once the HDRI is in play — see the note on the PI factor below. */
const ENV_INTENSITY    = 0.70;
const AMBIENT_WITH_ENV = 0.50;
const HEMI_WITH_ENV    = 0.30;

const HOVER_RATE = 9;          // hover easing, per second

const MAX_DPR = 2;

let renderer = null;
let scene = null;
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

/* Width of NAME at font-size 1, measured once the webfont is resident. */
let nameRatio = 5.3;
/* What the current floor texture was built for. */
let texState = { rows: 0, texW: 0, ratio: 1 };

/* WebGL may be absent (old browser, blocklisted driver, or _review.mjs
   stubbing getContext). Caller falls back to the plain CSS desktop. */
function supportsWebGL() {
  try {
    const probe = document.createElement('canvas');
    return !!(probe.getContext('webgl2') || probe.getContext('webgl'));
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const ctx = document.createElement('canvas').getContext('2d');
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
  const texH = Math.min(Math.round((rows - 1) * leading + size * 1.6), TEX_H_MAX);

  const c = document.createElement('canvas');
  c.width = texW;
  c.height = texH;
  const ctx = c.getContext('2d');

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, texW, texH);

  ctx.font = fontSpec(size);
  ctx.fillStyle = BLUE;
  ctx.textBaseline = 'middle';
  const top = (texH - (rows - 1) * leading) / 2;
  for (let i = 0; i < rows; i++) {
    ctx.fillText(NAME, texW * (MARGIN_X - ROW_INDENT[i % ROW_INDENT.length]), top + i * leading);
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

  if (rows !== texState.rows || (isMobile() ? TEX_W_MOBILE : TEX_W) !== texState.texW) {
    const old = floorMat.map;
    floorMat.map = drawFloorTexture(rows);
    floorMat.needsUpdate = true;
    if (old) {
      disposables = disposables.filter(d => d !== old);
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
  computer.root.name = 'computer';
  s.add(computer.root);

  /* One low directional light — the shallow angle is what stretches the
     shadow out long and diagonal across the letters.
     Intensities look ~3x high because three's physical lighting divides
     them by PI; tuned so lit cream lands on CREAM and the shadow sits at
     ~0.72 of it, matching the reference. */
  const key = new THREE.DirectionalLight(0xfff6e2, 4.4);
  key.position.set(-30, 8, 14);    // ~13° above the floor, raking from upper left
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.radius = 5;           // VSM blur width
  key.shadow.blurSamples = 16;
  key.shadow.bias = 0;             // VSM wants no depth bias
  key.shadow.normalBias = 0.02;
  const cam = key.shadow.camera;
  cam.left = -42; cam.right = 42; cam.top = 42; cam.bottom = -42;
  cam.near = 1; cam.far = 140;
  cam.updateProjectionMatrix();
  s.add(key, key.target);

  /* Soft fill — keeps the shadowed cream warm rather than grey, while
     staying low enough that the shadow reads as a distinct wedge. */
  const ambient = new THREE.AmbientLight(0xffffff, 1.5);
  const hemi = new THREE.HemisphereLight(0xfffaf0, 0xcfc4a8, 0.76);
  s.add(ambient, hemi);
  fillLights = { ambient, hemi };

  return s;
}

/* ==========================================
   CAMERA
   ========================================== */
function applyCameraSize(cam, width, height) {
  const f = frustumFor();
  const aspect = width / height;
  cam.left   = (-f * aspect) / 2;
  cam.right  = (f * aspect) / 2;
  cam.top    = f / 2;
  cam.bottom = -f / 2;
  cam.updateProjectionMatrix();
}

function buildCamera(width, height) {
  const cam = new THREE.OrthographicCamera();
  cam.near = 0.1;
  cam.far = 400;
  cam.position.set(
    CAM_DIST * Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    CAM_DIST * Math.sin(ELEVATION),
    CAM_DIST * Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  );
  cam.lookAt(0, 0, 0);
  applyCameraSize(cam, width, height);
  return cam;
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
    console.warn('env map failed:', e);
    return false;   // plain lighting; the scene still reads
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
  gtao.blendIntensity = 0.85;
  gtao.updateGtaoMaterial({
    radius: 0.9,            // world units — keep it to creases, not the whole floor
    distanceExponent: 1.4,
    thickness: 1.0,
    scale: 1.0,
    samples: 12,
  });
  c.addPass(gtao);
  c.addPass(new OutputPass());
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

  onPointerMove = e => {
    if (e.target?.closest?.('.window, #taskbar, #start-menu')) {
      hover.target = 0;
      return;
    }
    const r = canvas.getBoundingClientRect();
    ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    ray.setFromCamera(ndc, camera);
    hover.target = ray.intersectObject(computer.root, true).length ? 1 : 0;
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
}

/* ==========================================
   LIFECYCLE
   ========================================== */
export async function initScene(canvas) {
  if (!canvas || !supportsWebGL()) return false;

  const { clientWidth: w, clientHeight: h } = canvas;

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  /* PCFSoftShadowMap was removed in three 0.186 and silently degrades to
     hard PCF. VSM is the remaining soft option. */
  renderer.shadowMap.type = THREE.VSMShadowMap;

  /* The floor is drawn with canvas 2D, so the webfont has to be resident
     before the first paint or it silently falls back to Georgia. */
  try {
    await document.fonts.load(fontSpec(100));
  } catch { /* fall back to the serif stack */ }
  measureNameRatio();

  scene = buildScene();
  camera = buildCamera(w, h);
  fitFloor(w, h);

  if (!isMobile() && !prefersReducedMotion()) {
    try {
      composer = buildComposer(w, h);
    } catch {
      composer = null;   // fall back to a straight render
    }
  }

  const render = () => (composer ? composer.render() : renderer.render(scene, camera));

  /* Handles for the visual-review scripts. */
  window.__scene = scene;
  window.__composer = composer;

  onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_DPR));
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    applyCameraSize(camera, width, height);
    fitFloor(width, height);
    if (!frame) render();
  };
  window.addEventListener('resize', onResize);

  render();
  loadEnvironment().then(ok => { if (ok && !frame) render(); });

  /* Reduced motion: one static frame, no loop and no hover. */
  if (prefersReducedMotion()) return true;

  initHover(canvas);

  /* Hover: the machine lifts a little, turns a touch further toward the
     camera, and the screen brightens. */
  /* Lift the machine, not the whole group — the contact shadows live on
     the root and have to stay on the floor. */
  const lift = computer.lift;
  const screenMat = computer.screenMat;
  const clock = new THREE.Clock();
  const tick = () => {
    frame = requestAnimationFrame(tick);
    /* Time-based easing, so the lift settles at the same speed whatever
       the frame rate. */
    const k = 1 - Math.exp(-HOVER_RATE * clock.getDelta());
    hover.value += (hover.target - hover.value) * k;
    lift.position.y = hover.value * 0.32;
    computer.root.rotation.y = FACING + hover.value * 0.06;
    screenMat.emissiveIntensity = 1 + hover.value * 0.45;
    render();
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
  document.addEventListener('visibilitychange', onVisibility);

  return true;
}

export function disposeScene() {
  if (frame) cancelAnimationFrame(frame);
  frame = null;
  if (onResize) window.removeEventListener('resize', onResize);
  if (onVisibility) document.removeEventListener('visibilitychange', onVisibility);
  if (onPointerMove) window.removeEventListener('pointermove', onPointerMove);
  disposables.forEach(d => d.dispose());
  disposables = [];
  disposeComputer();
  floorMat = null;
  texState = { rows: 0, texW: 0, ratio: 1 };
  envMap?.dispose();
  composer?.dispose();
  renderer?.dispose();
  hover = { target: 0, value: 0 };
  renderer = scene = camera = composer = computer = envMap = null;
  onResize = onVisibility = onPointerMove = null;
}
