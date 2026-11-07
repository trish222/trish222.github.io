import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

/* ==========================================
   THE LAMP LAB

   A harness for looking at one lamp module on its own, under the
   room's own night rig, without booting the desktop, the fly-in or the
   rest of the scene. `lamp-lab.html?lamp=<name>` loads
   `src/lamps/<name>.js`; with no `lamp` it loads `src/lamp.js`, the
   one the site actually ships.

   **It is a dev tool and does not ship.** `lamp-lab.html` sits at the
   repo root, so `npm run dev` serves it; `vite build` only takes
   `index.html` as an entry, so none of this reaches `dist/`. Same
   standing as the `_*.mjs` review scripts.

   **The rig is copied from scene.js deliberately rather than imported
   from it**, and the duplication is the point: importing scene.js
   would drag in the computer, the desk, the treehouse, the room, the
   fly-in and GSAP, and the lab would then be measuring all of them.
   What is copied is four numbers and an operator, and if the room's
   rig is ever re-graded these have to be re-copied — which is why they
   are named and commented here rather than inlined.

   What a lamp module has to export for this to work is the contract
   src/lamp.js defines: `buildLamp`, `setLamp`, `aimLamp`,
   `lampLevels`, `disposeLamp`, `LAMP_SCALE`, `LAMP_COLOUR`.
   ========================================== */

/* --- The night rig, copied from scene.js -----------------
   See "The night lighting" in CLAUDE.md for what each is calibrated
   against. Intensities read ~3x high because three's physical lighting
   divides them by PI. */
const MOON_COLOUR = 0x8fa3d8;
const MOON_INTENSITY = 5.5;
const HEMI_SKY = 0x3a3560;
const HEMI_GROUND = 0x1c1a2a;
const HEMI_INTENSITY = 30.0;
const TONE_EXPOSURE = 1.3;
const VOID_COLOUR = 0x1c1a2a;
const WALL_COLOUR = 0x2b2842;

/* The lamp's own fade, copied from scene.js for the same reason: on is
   `1-(1-p)²` (fast off the mark, settling into the last few percent,
   which is how a filament behaves) and off is `p²` (most of the way
   immediately, then a tail, which is a filament cooling). Both linear
   in time, so the fade really is LAMP_FADE_S. */
const LAMP_FADE_S = 0.4;
const easeOn = (p) => 1 - (1 - p) * (1 - p);
const easeOff = (p) => p * p;

const canvas = document.getElementById("lab");
const hud = document.getElementById("hud");

const params = new URLSearchParams(location.search);
const NAME = params.get("lamp") || "lamp";

/* Static prefixes on both arms so Vite can analyse them. The default
   is the shipping module and is not under `lamps/`, which is why this
   is a branch rather than one template literal. */
const mod =
  NAME === "lamp"
    ? await import("./lamp.js")
    : await import(`./lamps/${NAME}.js`);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = TONE_EXPOSURE;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
/* **Frozen, as the scene freezes it, and refreshed by hand when the
   lamp moves.** Nothing here casts a different shadow from one frame
   to the next: the moon is fixed, the fixture is static, and
   switching the lamp changes an *intensity* — a shadow map carries
   occlusion, not brightness, so the frozen map is as correct at level
   0 as at level 1. Left on, a 2048² VSM pass for the moon and a 1024²
   one for the lamp ran every frame, which on a software renderer put
   the whole 0.4s fade inside a single frame and made the switch look
   instant. `__aim()` is the one thing that invalidates it, and it is
   the one place below that sets the flag. */
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(VOID_COLOUR);

/* --- what the lamp stands on, and what its glow falls on ---
   A walnut slab at y = 0 (the lamp's origin sits on the surface it
   stands on, so that is the plane) and a wall behind it. The wall is
   not decoration: half of "does the shade glow" is what the light does
   to the surface behind the fixture, and against the void there is
   nothing there to answer it. */
const woodTex = new THREE.TextureLoader().load(
  "/textures/desk-wood-512.jpg",
  () => draw(),
);
woodTex.colorSpace = THREE.SRGBColorSpace;
woodTex.wrapS = woodTex.wrapT = THREE.RepeatWrapping;
woodTex.repeat.set(4, 4);
woodTex.anisotropy = 8;

const deskMat = new THREE.MeshStandardMaterial({
  map: woodTex,
  roughness: 0.52,
  metalness: 0,
});
const desk = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), deskMat);
desk.rotation.x = -Math.PI / 2;
desk.receiveShadow = true;
scene.add(desk);

const wall = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 20),
  new THREE.MeshStandardMaterial({ color: WALL_COLOUR, roughness: 0.95 }),
);
wall.position.set(0, 10, -5.5);
wall.receiveShadow = true;
scene.add(wall);

/* --- the rig --- */
const hemi = new THREE.HemisphereLight(HEMI_SKY, HEMI_GROUND, HEMI_INTENSITY);
scene.add(hemi);

/* The moon, aimed down and across the way it comes through the room's
   window — high (36.5 degrees in the room) and from behind-left. The
   box is sized to this lab's slab rather than to the room's. */
const moon = new THREE.DirectionalLight(MOON_COLOUR, MOON_INTENSITY);
moon.position.set(-9, 11, -8);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.bias = 0;
moon.shadow.normalBias = 0.035;
moon.shadow.radius = 4;
moon.shadow.blurSamples = 16;
Object.assign(moon.shadow.camera, {
  left: -12,
  right: 12,
  top: 14,
  bottom: -6,
  near: 1,
  far: 44,
});
scene.add(moon, moon.target);

/* --- the lamp under test --- */
const lamp = mod.buildLamp();
scene.add(lamp.root);
scene.updateMatrixWorld(true);

/* Its own box, which is what the camera is framed against and what the
   HUD reports. `Box3.setFromObject` is the conservative bound — for a
   rotated child it takes the AABB of a rotated AABB — so read the
   height as an upper bound, exactly as `_lampshots.mjs` does. */
const box = new THREE.Box3().setFromObject(lamp.root);
const size = box.getSize(new THREE.Vector3());
const centre = box.getCenter(new THREE.Vector3());

/* --- camera ---
   The room's own 20-degree vertical FOV and 20-degrees-down, three-
   quarters-round framing, so what the lab shows is the angle the
   fixture will actually be seen at. The distance is derived from the
   box rather than set, so every lamp arrives framed the same way
   however tall or wide it is. */
const FOV = 20;

/* **Three framings, chosen with `?view=`.** `home` is the room's own
   — 20 degrees down, 37 round — and is what the fixture has to hold
   up at. The other two are there because a lamp is an object with a
   front and a side and the home angle hides half of each: `front`
   looks straight down +Z at the mouth, which is the view the tilt and
   the lit lining have to be judged from, and `side` looks along the
   shade's own long axis, which is the only one that shows the arm's
   J and the end cap together. */
const VIEWS = {
  home: { elev: 20, azim: 37 },
  front: { elev: 12, azim: 0 },
  side: { elev: 12, azim: 90 },
  /* **From under the mouth, close in.** The other three are all at or
     above the shade's own tilt, so none of them can see what is
     inside it — which is where the bulb, the socket and the lit
     lining are. `focus` frames the shell instead of the whole
     fixture and `margin` crops in, because at the fixture's bounding
     sphere the interior is a few dozen pixels.

     It is deliberately the one framing the fixture is *not* designed
     for: the bulb is placed to be hidden from the home camera, so
     the only way to confirm it is there at all is to look from
     somewhere it was never meant to be seen from. */
  under: { elev: -16, azim: 14, focus: "lamp-shell", margin: 0.78 },
};
const VIEW = VIEWS[params.get("view")] ? params.get("view") : "home";
const ELEV = THREE.MathUtils.degToRad(VIEWS[VIEW].elev);
const AZIM = THREE.MathUtils.degToRad(VIEWS[VIEW].azim);
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

/* **The distance comes off the box's bounding sphere, not its
   height.** A sphere is the one bound that is the same from every
   azimuth, so every lamp — and every one of the three views — arrives
   framed the same way whatever shape it is. Fitting the height alone
   is what put the first pass's wide shade off both edges. */
const focusObj = VIEWS[VIEW].focus
  ? lamp.root.getObjectByName(VIEWS[VIEW].focus)
  : null;
const sphere = (focusObj ? new THREE.Box3().setFromObject(focusObj) : box)
  .getBoundingSphere(new THREE.Sphere());
const MARGIN = VIEWS[VIEW].margin ?? 1.25;
const dist =
  (sphere.radius * MARGIN) / Math.sin(THREE.MathUtils.degToRad(FOV / 2));

const target = sphere.center.clone();
function placeCamera() {
  camera.position.set(
    target.x + dist * Math.cos(ELEV) * Math.sin(AZIM),
    target.y + dist * Math.sin(ELEV),
    target.z + dist * Math.cos(ELEV) * Math.cos(AZIM),
  );
  camera.lookAt(target);
}
placeCamera();

const controls = new OrbitControls(camera, canvas);
controls.target.copy(target);
controls.enableDamping = true;
/* Never under the slab — except on the one view whose whole point is
   to be under the shade, where the clamp would snap the camera back
   above the mouth the moment anything called `update()`. */
if (VIEW !== "under") controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.update();

/* --- light helpers, with `&helpers=1` -------------------
   Off by default, because they draw over the thing being judged.
   Three of them, and the third is the one worth having: the spot's
   cone and the point's position are easy enough to infer from a lit
   render, but **the shadow camera's near plane is not** — and on
   this fixture that plane is load-bearing, since it is what keeps
   the shade out of its own depth pass. The CameraHelper draws where
   it actually sits.

   `shadow.updateMatrices` has to be called by hand before the helper
   is built: the shadow camera's matrices are normally only written
   during the shadow pass, and this renderer freezes that pass, so
   the first one has not necessarily happened yet. */
let helpers = [];
if (params.get("helpers") === "1") {
  lamp.spot.shadow.updateMatrices(lamp.spot);
  helpers = [
    new THREE.SpotLightHelper(lamp.spot, 0xffc070),
    new THREE.PointLightHelper(lamp.point, 0.22, 0x70c0ff),
    new THREE.CameraHelper(lamp.spot.shadow.camera),
  ];
  for (const h of helpers) scene.add(h);
}

/* --- the switch ---------------------------------------
   Same two eases and the same 0.4s as the scene's, so what the lab
   shows is the fade the site would give. The lab keeps the fade a
   plain clock rather than borrowing scene.js's loop. */
let on = true;
let p = 1;
mod.setLamp(1);

function setOn(next) {
  on = !!next;
}
addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    setOn(!on);
  }
});
document.getElementById("toggle").addEventListener("click", () => setOn(!on));

/* --- loop ---------------------------------------------- */
let last = performance.now();
let needsDraw = true;

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width === w && canvas.height === h) return;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  needsDraw = true;
}

function draw() {
  for (const h of helpers) h.update?.();
  renderer.render(scene, camera);
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  resize();

  const step = dt / LAMP_FADE_S;
  const wasP = p;
  p = THREE.MathUtils.clamp(p + (on ? step : -step), 0, 1);
  if (p !== wasP || needsDraw) {
    mod.setLamp(on ? easeOn(p) : easeOff(p));
    needsDraw = false;
  }
  controls.update();
  draw();
  hudText();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* --- readouts ------------------------------------------
   The HUD is the cheap half. The two handles below are the half that
   answers a question a screenshot cannot: whether the fixture reads as
   a *light source*, which is a statement about the difference between
   two framebuffers rather than about either one of them. */
function hudText() {
  const L = mod.lampLevels();
  hud.textContent = [
    `lamp      ${NAME}${NAME === "lamp" ? "  (the shipping default)" : ""}`,
    `scale     ${mod.LAMP_SCALE}   view ${VIEW}`,
    `state     ${on ? "on" : "off"}   level ${(on ? easeOn(p) : easeOff(p)).toFixed(2)}`,
    `box       w ${size.x.toFixed(2)}  h ${size.y.toFixed(2)}  d ${size.z.toFixed(2)}`,
    `height    ${size.y.toFixed(2)} above the surface (conservative)`,
    `lights    point ${L.point.toFixed(1)}  spot ${L.spot.toFixed(1)}`,
    `cone      ${(THREE.MathUtils.radToDeg(lamp.spot.angle) * 2).toFixed(1)}deg full  penumbra ${lamp.spot.penumbra}  shadow near ${lamp.spot.shadow.camera.near.toFixed(2)}`,
    `emissive  bulb ${L.emissive.bulb.toFixed(2)}  inner ${L.emissive.inner.toFixed(2)}  outer ${L.emissive.outer.toFixed(2)}`,
    ``,
    `space / the button toggles · drag to orbit · wheel to zoom`,
    `__pool()  on/off luma transect   __fit()  NDC box   __aim(t,s)`,
  ].join("\n");
}

/* Reads one row of the framebuffer back and returns its luma. The
   framebuffer rather than a world-space calculation, because the
   question is about the *picture* — the operator, the exposure and the
   emissives are all between a light's intensity and what a visitor
   sees, and a world-space figure would be true about none of it. */
function lumaRow(y01, n) {
  const w = renderer.domElement.width;
  const h = renderer.domElement.height;
  /* **Flipped**, because `readPixels` counts rows from the bottom and
     every other y in this file is a CSS-style fraction from the top.
     Unflipped the two probes below silently swap: "the slab in front
     of the fixture" samples the wall and reports a lamp that lights
     nothing. */
  const y = Math.round((h - 1) * (1 - y01));
  const buf = new Uint8Array(w * 4);
  const gl = renderer.getContext();
  renderer.render(scene, camera);
  gl.readPixels(0, y, w, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round(((i + 0.5) / n) * (w - 1));
    const o = x * 4;
    out.push(
      Math.round(0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2]),
    );
  }
  return out;
}

/* **The on/off delta along a row, which is the only honest way to ask
   whether a lamp lights anything.** A single lit frame says nothing —
   a dark room with the exposure up looks lit — so this shoots the same
   row twice, once at level 1 and once at 0, and reports the
   difference. `y01` picks the row: 0.78 is the slab in front of the
   fixture, 0.35 is the wall behind it. */
window.__pool = (y01 = 0.78, n = 24) => {
  const wasOn = on;
  const wasP = p;
  mod.setLamp(1);
  const lit = lumaRow(y01, n);
  mod.setLamp(0);
  const dark = lumaRow(y01, n);
  on = wasOn;
  p = wasP;
  mod.setLamp(on ? easeOn(p) : easeOff(p));
  const delta = lit.map((v, i) => v - dark[i]);
  return {
    row: y01,
    lit,
    dark,
    delta,
    peak: Math.max(...delta),
    mean: Number((delta.reduce((a, b) => a + b, 0) / n).toFixed(1)),
    /* How many of the sampled columns the lamp actually reaches. The
       brief's "spreads all around" is this number, not the peak. */
    reach: delta.filter((d) => d >= 4).length,
  };
};

/* **The pool's width in world units**, which `__pool` cannot give:
   that one samples a fixed row of the *framebuffer*, so its numbers
   move when the camera reframes and it cannot say how far across the
   slab the light actually reaches. This walks a world line on the
   slab through the beam's own aim point, reads the lit and unlit
   luma at each step, and reports the span over which the lamp lifts
   the surface by `thresh` levels or more.

   Through the aim point rather than through the origin, because the
   beam moves when the shade is re-tilted and a fixed line then
   measures two different places at two tilts — the same trap
   `_pool.mjs` documents in the real scene.

   `axis` is "x" (along the shade's length) or "z" (across it), which
   together are the oval's two axes. **Read the "x" figure.** The "z"
   line runs through the aim point, and the aim point is almost
   directly in front of the fixture — so that line passes under the
   base and the column and its peak is the brightly lit *base*, not
   the pool. The along-shade figure is the one that is all slab. */
window.__poolWorld = (axis = "x", half = 10, step = 0.2, thresh = 4) => {
  const aim = mod.aimLamp();
  if (!aim || !aim.pool) return null;
  const [ax, , az] = aim.pool;
  const W = renderer.domElement.width;
  const H = renderer.domElement.height;
  const gl = renderer.getContext();
  const grab = () => {
    renderer.render(scene, camera);
    const buf = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  };
  const at = (buf, d) => {
    const v = new THREE.Vector3(
      axis === "x" ? ax + d : ax,
      0.02,
      axis === "z" ? az + d : az,
    ).project(camera);
    const px = Math.round(((v.x + 1) / 2) * (W - 1));
    /* readPixels counts rows from the bottom and NDC y already does
       too, so this one is *not* flipped — unlike `lumaRow` above,
       which starts from a CSS-style fraction from the top. */
    const py = Math.round(((v.y + 1) / 2) * (H - 1));
    if (px < 0 || px >= W || py < 0 || py >= H) return null;
    const o = (py * W + px) * 4;
    return 0.2126 * buf[o] + 0.7152 * buf[o + 1] + 0.0722 * buf[o + 2];
  };
  const wasOn = on;
  const wasP = p;
  const ds = [];
  for (let d = -half; d <= half + 1e-9; d += step) ds.push(d);
  mod.setLamp(1);
  const lit = grab();
  mod.setLamp(0);
  const dark = grab();
  on = wasOn;
  p = wasP;
  mod.setLamp(on ? easeOn(p) : easeOff(p));
  let lo = null;
  let hi = null;
  let peak = 0;
  for (const d of ds) {
    const a = at(lit, d);
    const c = at(dark, d);
    if (a === null || c === null) continue;
    const delta = a - c;
    if (delta > peak) peak = delta;
    if (delta >= thresh) {
      if (lo === null) lo = d;
      hi = d;
    }
  }
  return {
    axis,
    aim: [Number(ax.toFixed(2)), Number(az.toFixed(2))],
    from: lo,
    to: hi,
    width: lo === null ? 0 : Number((hi - lo).toFixed(2)),
    peak: Math.round(peak),
  };
};

/* The fixture's eight projected corners, where ±1 is the frame edge —
   the same question `window.__fit` answers in the scene. */
window.__fit = () => {
  const b = new THREE.Box3().setFromObject(lamp.root);
  const v = new THREE.Vector3();
  let x0 = 1e9,
    x1 = -1e9,
    y0 = 1e9,
    y1 = -1e9;
  for (let i = 0; i < 8; i++) {
    v.set(
      i & 1 ? b.max.x : b.min.x,
      i & 2 ? b.max.y : b.min.y,
      i & 4 ? b.max.z : b.min.z,
    ).project(camera);
    x0 = Math.min(x0, v.x);
    x1 = Math.max(x1, v.x);
    y0 = Math.min(y0, v.y);
    y1 = Math.max(y1, v.y);
  }
  return {
    ndc: [x0, y0, x1, y1].map((n) => Number(n.toFixed(2))),
    world: {
      w: Number((b.max.x - b.min.x).toFixed(2)),
      h: Number((b.max.y - b.min.y).toFixed(2)),
      d: Number((b.max.z - b.min.z).toFixed(2)),
    },
  };
};

/* Re-aims the shade and re-renders the frozen shadow map — moving a
   light is the one change that invalidates it, and the lamp modules
   deliberately leave that to their caller. */
window.__aim = (t, s) => {
  const r = mod.aimLamp(t, s);
  renderer.shadowMap.needsUpdate = true;
  return r;
};
window.__lamp = (next) => mod.lampLevels(next || {});
window.__scene = scene;
window.__camera = camera;
window.__renderer = renderer;
