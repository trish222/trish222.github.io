import { createInteraction } from "./scene/interaction.js";
import { createAnimationLoop } from "./scene/animation.js";
import { createRoomScene } from "./scene/createScene.js";
import { createNavigation } from "./scene/navigation.js";
import { createCameraRig } from "./scene/camera.js";
import { isDesktopFullscreen } from "./config/experience.js";
import { createParallax } from "./scene/parallax.js";
import { createScreenProjection } from "./overlay/screenOverlay.js";
import { installScreenFx, disposeScreenFx } from "./overlay/crtFx.js";
import { createDesktopSnapshot } from "./overlay/desktopSnapshot.js";
import { createLampState } from "./lamp.js";
import * as THREE from "three";
import { gsap } from "gsap/gsap-core";
import { createPost } from "./scene/post.js";
import { FLOPPIES } from "./content/content.js";
import { createDeskObjects } from "./ui/deskObjects.js";
import { createIntro } from "./scene/intro.js";

let interaction = null;

const diagnosticNames = new Set(["__cam", "__camera", "__diveTo", "__enter", "__flyFrom", "__flyTo", "__fov", "__lamp", "__orbit", "__pick", "__scene", "__stillReady"]);
let sceneGeneration = 0;

// Experience state and rendering configuration

// The GLB camera's field of view, unless a diagnostic overrides it.
let fovOverride = null;
function currentFov() {
  return fovOverride ?? (isMobile() ? stage.cams.mobile : stage.cams.overview).fov;
}
function tanHalfFov() {
  return Math.tan(THREE.MathUtils.degToRad(currentFov()) / 2);
}

function distFor(frustum) {
  return frustum / (2 * tanHalfFov());
}

const MOBILE_BP = 760;

const LAMP_START_ON = true;

const LAMP_FADE_S = 0.3; // P4 done-when: the crossfade lands in under 400 ms

const BACKGROUND = "#1c1a2a";

const HOVER_RATE = 7; // hover easing, per second

const MAX_DPR = 2;
const MOBILE_MAX_DPR = 2;

function scenePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, isMobile() ? MOBILE_MAX_DPR : MAX_DPR);
}

// Keep drawing buffers allocated across camera motion: even a single canvas
// resize can synchronize with the GPU (100ms+ on the measured Metal path).
// Only a real DPR or viewport breakpoint change resizes the canvas.
function syncRenderQuality() {
  const ratio = scenePixelRatio();
  if (renderer.getPixelRatio() === ratio) return;
  renderer.setPixelRatio(ratio);
  post?.resize();
}

// LOOKING AROUND

const FLY_FROM = "current";

const FACE_MIN = 0.17; // ~80° off the normal

// FLYING INTO THE SCREEN

const FLY_S = 1.6; // seconds, the whole camera move

const FADE_S = 0.3;
const FLY_EASE = "power3.inOut";
const FADE_EASE = "power1.inOut";

const FADE_SCALE = 0.015;

// THE SECOND MOVE — the bezel framing in to a full viewport

const DIVE_S = 0.9; // seconds; the flight's 1.6s would drag over a dolly this short
const DIVE_EASE = FLY_EASE;

export const SCREEN_BASE_W = 900;
// Follows screen_plane's aspect once the GLB is loaded.
let screenBaseH = 0;

const BLUR_STEP = 0.5;

let renderer = null;
let canvasEl = null;
let scene = null;
let screenEl = null;

let fly = { value: 0, dir: 0 };

let dive = { value: 0, dir: 0 };
let camera = null;
let post = null;
let stage = null;

let lampLevel = LAMP_START_ON ? 1 : 0;
let lampBtn = null;
let deskObjects = null;
let intro = null;

let hover = { target: 0, value: 0 };

// World units at the viewport edges, with a radial cap for diagonals.
// Smoothness is a time constant in seconds: smaller values respond faster.
// Controls and GSAP retain the base pose throughout the presentation pass.
const parallax = createParallax();
let parallaxPresented = false;

function parallaxAllowed() {
  return navigation.allowed() && !navigation.dragging && !navigation.returning &&
    !navigation.offHome() && !prefersReducedMotion() &&
    navigator.maxTouchPoints === 0 && !!interaction?.finePointer;
}

function tickParallax(dt) { parallax.tick(dt, parallaxAllowed()); }
function beginParallax() { return parallax.begin(camera, homeTarget(), parallaxAllowed()); }
function endParallax() { parallax.end(camera); }
let animation = null;
let onResize = null;

let onScreenInput = null;

let sceneFade = -1;

let flyFrom = FLY_FROM;

let flyStart = null;

let stillHidden = false;
let screenAway = false;
let screenHidden = ""; // last value written to the overlay's visibility

let perf = null;
let disposeDiagnostics = null;

function perfWanted() {
  try {
    if (new URLSearchParams(location.search).has("perf")) return true;
    return localStorage.getItem("perf") === "1";
  } catch {
    return false; // a sandboxed iframe can throw on either
  }
}

let reducedMotionMedia = null;
function prefersReducedMotion() {
  reducedMotionMedia ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reducedMotionMedia.matches;
}

function isMobile() {
  return window.innerWidth <= MOBILE_BP;
}

// Framing and desktop handover agree at 760px; short touch screens also break out.
const isHandheld = isDesktopFullscreen;

function applyLampLevel(level) {
  lampLevel = level;
  stage?.setLampMix(level);
}

const lampState = createLampState({ startOn: LAMP_START_ON, fadeS: LAMP_FADE_S, onLevel: applyLampLevel });

function setLampOn(on, jump = !animation?.running) {
  lampState.set(on, jump);
  if (jump && renderer) render();
  lampBtn?.setAttribute("aria-pressed", String(lampState.on));
  return lampState.on;
}

function initDeskObjects() {
  deskObjects = createDeskObjects({ proxies: stage.proxies, camera, canvas: canvasEl, actions: {
    machine: enterScreen, lamp: () => setLampOn(!lampState.on),
    ...Object.fromEntries(FLOPPIES.map((_, i) => [`project:${i}`, () => openProject(i)])),
  } });
  lampBtn = document.getElementById("lamp-toggle");
  lampBtn?.setAttribute("aria-pressed", String(lampState.on));
}

function onHoverTarget(target) {
  hover.target = target === "machine" ? 1 : 0;
  deskObjects?.show(target);
  if (animation?.running || !stage) return;
  // Reduced motion runs no loop: the screen's glow steps instead of easing.
  hover.value = hover.target;
  stage.crt.setHover(hover.value);
  render();
}

function applyVoidColor() {
  if (!scene || !renderer) return;
  renderer.setClearColor(BACKGROUND, 0); // alpha 0: the post chain leaves the void exact (filmEffect.js)
}

// CAMERA

const SCREEN_TARGET = new THREE.Vector3();
const flyOffset = new THREE.Vector3();
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const navigation = createNavigation({ orbitPivot: () => rig.orbitPivot(),
  isAtDesk: () => fly.value === 0, isHandheld, reducedMotion: prefersReducedMotion,
  hasFrame: () => !!animation?.running, onChange: () => updateScreenOverlay(), render: () => render(),
  resetParallax: () => parallax.reset(), onDisable: () => interaction?.cancel() });
const rig = createCameraRig({ getStage: () => stage, getCamera: () => camera,
  getFov: currentFov, getFlightStart: () => flyStart,
  getOrbitRadius: () => navigation.home.radius, distFor, isMobile });
const { homeTarget, orbitPivot, screenFrustum, coverFrustum, buildFlyPath, applyFly, applyDive,
  target: flyTarget, pose: flyPose } = rig;
function applyPose(width, height) {
  return dive.value > 0
    ? applyDive(dive.value, width, height)
    : applyFly(fly.value, width, height);
}

// Metres: the arrival sits ~0.4 m from the glass inside a few-metre room.
const CAM_NEAR = 0.01;
const CAM_FAR = 30;

function buildCamera() {
  return new THREE.PerspectiveCamera(currentFov(), 1, CAM_NEAR, CAM_FAR);
}

// LOOKING AROUND — the implementation

function cameraMoving() {
  return (
    fly.dir !== 0 ||
    dive.dir !== 0 ||
    navigation.moving
  );
}

function overScreen(x, y) {
  if (!screenEl) return false;
  const r = screenEl.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function canLeaveScreen() {
  return (
    !!screenEl &&
    fly.value === 1 &&
    fly.dir === 0 &&
    dive.value === 0 &&
    dive.dir === 0 &&
    !screenBrokenOut() &&
    !document.body.classList.contains("menu-open")
  );
}

// A floppy flies in like the CRT, then asks the desktop for its window on arrival.
let pendingProject = null;
function openProject(i) {
  pendingProject = FLOPPIES[i];
  enterScreen();
}

// The corner menu and the credits link: zoom in and open a desktop window.
export function openWindow(id) {
  pendingProject = { window: id };
  enterScreen();
}

function enterScreen() {
  if (flyFrom === "home" && navigation.offHome()) {
    navigation.setEnabled(false);
    navigation.returnHome(0.45, flyToScreen);
    return;
  }
  flyToScreen();
}

// RE-FRAMING THE ESTABLISHING SHOT

function setFov(deg) {
  if (!camera || !canvasEl) return;
  fovOverride = deg === null ? null : THREE.MathUtils.clamp(Number(deg) || currentFov(), 5, 80);
  reframeHome();
}

function reframeHome() {
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  flyStart = null;
  buildFlyPath(width, height);
  applyPose(width, height);

  if (navigation.controls) {
    navigation.killReturn();
    navigation.cancelIdle();
    navigation.controls.target.copy(orbitPivot());

    navigation.controls.minPolarAngle = 0;
    navigation.controls.maxPolarAngle = Math.PI;
    navigation.controls.minAzimuthAngle = -Infinity;
    navigation.controls.maxAzimuthAngle = Infinity;
    navigation.spendGlide();
    navigation.home.theta = navigation.controls.getAzimuthalAngle();
    navigation.home.phi = navigation.controls.getPolarAngle();
    navigation.home.radius = camera.position.distanceTo(navigation.controls.target);

    navigation.applyLimits();
  }
  updateScreenOverlay();
  render();
}

// THE LIVE PAGE ON THE GLASS

const projection = createScreenProjection();
function screenFacing() { return projection.facing(stage.projectionSurface, camera, SCREEN_TARGET); }

let screenTransform = "";

function setScreenTransform(t) {
  if (t === screenTransform) return;
  screenTransform = t;
  screenEl.style.transform = t;
}

function syncScreenVisibility() {
  if (!screenEl) return;
  // Only parked at or flying to the screen: from the room the CRT shader shows the same picture.
  const onGlass = document.body.classList.contains("screen-active");
  const v = stillHidden || screenAway || !onGlass ? "hidden" : "";
  if (v === screenHidden) return; // don't invalidate style for a repeat
  screenHidden = v;
  screenEl.style.visibility = v;
}

function updateScreenOverlay(transformOnly = false) {
  if (!screenEl || !camera || !stage) return;
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  if (!width || !height) return;

  if (screenBrokenOut()) {
    setBrokenOut(true);
    setScreenTransform("none");
    screenAway = false;
    syncScreenVisibility();
    return;
  }
  setBrokenOut(false);

  screenAway = screenFacing() < FACE_MIN;
  syncScreenVisibility();
  if (screenAway) return;

  const { transform, scale } = projection.project(stage.projectionSurface, camera,
    width, height, SCREEN_BASE_W, screenBaseH);
  if (!transform) {

    screenAway = true;
    syncScreenVisibility();
    return;
  }
  setScreenTransform(transform);
  // Passive head movement changes the quad by a fraction of a pixel;
  // retain the CRT raster settings instead of repeatedly repainting it.
  if (transformOnly) return;

  const set = (k, v) => screenEl.style.setProperty(k, v);
  set("--zoom", fly.value.toFixed(4));

  const snap = (v, step) => Math.round(v / step) * step;
  let blur = (0.9 / scale) * (1 - fly.value);
  if (cameraMoving()) blur = snap(blur, BLUR_STEP);
  set("--blur", `${blur.toFixed(2)}px`);
}

function render(grainSeed) {
  syncRenderQuality();
  if (!prefersReducedMotion()) stage.setTime(performance.now() / 1000);
  const shifted = beginParallax();
  // HTML and WebGL share the same presentation pose, never the base pose.
  if (shifted || parallaxPresented) updateScreenOverlay(true);
  parallaxPresented = shifted;
  try {
    post.render(grainSeed ?? (prefersReducedMotion() ? 0 : performance.now() / 1000));
    deskObjects?.place();
  } finally {
    if (shifted) endParallax();
  }
}

function setFly(p) {
  fly.value = p;
  stage.setZoom(p);
  post?.setZoom(p);
  applyFly(p, canvasEl.clientWidth, canvasEl.clientHeight);
  updateScreenOverlay();

  const step = Math.round(clamp01((p - 0.7) / 0.25) * 20) / 20;
  if (step !== sceneFade) {
    sceneFade = step;
    document.body.style.setProperty("--scene-fade", step.toFixed(2));
  }
}

function setDive(q) {
  dive.value = q;
  applyDive(q, canvasEl.clientWidth, canvasEl.clientHeight);
  updateScreenOverlay();
}

function logArrival() {
  const round = (v) => Math.round(v * 1000) / 1000;
  console.log("[scene] arrived at the screen", {
    position: camera.position.toArray().map(round),
    target: flyTarget.toArray().map(round),
    frustumHeight: round(flyPose.frustum),
    fov: currentFov(),
    dist: round(flyPose.dist),
  });
}

function arrive() {
  fly.dir = 0;
  intro?.at("screen");

  navigation.setEnabled(false);
  document.body.classList.remove("screen-zooming");
  document.body.classList.add("screen-focused");

  applyFade(1);
  onHoverTarget(null);

  updateScreenOverlay();
  if (pendingProject) document.dispatchEvent(new CustomEvent("desk:open", { detail: pendingProject }));
  pendingProject = null;

  if (!document.body.classList.contains("signed-in")) {
    document.getElementById("login-user")?.focus({ preventScroll: true });
  }
  logArrival();
}

function depart() {
  fly.dir = 0;
  pendingProject = null;
  document.body.classList.remove("screen-active", "screen-zooming");
  applyFade(0);

  if (flyStart) {
    flyStart = null;
    if (canvasEl) buildFlyPath(canvasEl.clientWidth, canvasEl.clientHeight);
  }

  navigation.setEnabled(true);

  snapshot?.invalidate();
  intro?.at("desk");
}

// THE CROSSFADE

function applyFade(v) {
  document.body.style.setProperty("--page-fade", v.toFixed(4));
  if (!screenEl) return;
  screenEl.style.setProperty("--settle", (1 - FADE_SCALE * (1 - v)).toFixed(5));

  const flying = document.body.classList.contains("screen-active");
  stillHidden = v === 0 && flying;
  syncScreenVisibility();
}

// THE STILL

let snapshot = null;

// THE TIMELINE

let flyTl = null;
const flyState = { p: 0, fade: 0 };

function buildFlyTimeline() {

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

function jumpFly(to) {
  flyTl?.pause().progress(to, true); // so a later reverse() starts from here
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

// THE SIGN-IN — a hand-over with no camera move in it

function screenBrokenOut() {
  return (
    fly.value === 1 &&
    fly.dir === 0 &&
    dive.dir === 0 &&
    (dive.value === 1 ||
      (isHandheld() && document.body.classList.contains("signed-in")))
  );
}

let brokenOut = false;

function setBrokenOut(v) {
  if (v === brokenOut) return;
  brokenOut = v;
  document.body.classList.toggle("glass-fullscreen", v);
}

// THE SECOND MOVE — the timeline and the hand-over

let diveTl = null;
const diveState = { q: 0 };

let onDiveLanded = null;

function buildDiveTimeline() {
  diveTl = gsap
    .timeline({
      paused: true,
      onComplete: diveLanded,
      onReverseComplete: diveLifted,
    })
    .to(
      diveState,
      {
        q: 1,
        duration: DIVE_S,
        ease: DIVE_EASE,
        onUpdate: () => setDive(diveState.q),
      },
      0,
    );
}

function diveSettled() {
  dive.dir = 0;
  document.body.classList.remove("screen-zooming");
  document.body.classList.add("screen-focused");

  setDive(dive.value);
  applyFade(1);

  render();
}

function diveLanded() {
  diveState.q = 1;
  diveSettled();
  const done = onDiveLanded;
  onDiveLanded = null;
  done?.();
}

function diveLifted() {
  diveState.q = 0;
  onDiveLanded = null;
  diveSettled();

  if (!document.body.classList.contains("signed-in")) {
    document.getElementById("login-user")?.focus({ preventScroll: true });
  }
}

export function diveToDesktop(onLanded) {
  if (!screenEl || !diveTl || !isHandheld() || fly.value !== 1 || dive.value === 1) {
    onLanded?.();
    return;
  }
  onDiveLanded = onLanded ?? null;
  document.body.classList.remove("screen-focused");

  applyFade(0);
  if (prefersReducedMotion()) return jumpDive(1);
  document.body.classList.add("screen-zooming");
  dive.dir = 1;
  diveTl.play();
}

export function riseFromDesktop() {
  if (!screenEl || !diveTl || dive.value === 0) return;
  onDiveLanded = null;
  document.body.classList.remove("screen-focused");
  applyFade(0);
  if (prefersReducedMotion()) return jumpDive(0);
  document.body.classList.add("screen-zooming");
  dive.dir = -1;
  diveTl.reverse();
}

function jumpDive(to) {
  diveTl?.pause();
  diveState.q = to;
  dive.dir = 0;
  dive.value = to;
  document.body.classList.remove("screen-zooming");
  if (to === 1) diveLanded();
  else diveLifted();
}

export function refreshLoginStill() {
  snapshot?.invalidate();
}

export function syncDesktopOverlay() {
  if (!screenEl) return;
  snapshot?.invalidate();
  updateScreenOverlay();
  render();
}

export function flyToScreen() {
  if (!screenEl || fly.value === 1 || (flyTl && flyTl.isActive() && flyTl.reversed() === false)) return;

  navigation.setEnabled(false);

  if (navigation.controls && flyFrom === "current" && navigation.offHome()) {
    flyStart = {
      theta: navigation.controls.getAzimuthalAngle(),
      phi: navigation.controls.getPolarAngle(),
    };
    buildFlyPath(canvasEl.clientWidth, canvasEl.clientHeight);
  }
  document.body.classList.add("screen-active", "screen-zooming");
  if (prefersReducedMotion()) return jumpFly(1);
  fly.dir = 1;
  flyTl.play();
}

export function flyFromScreen() {
  if (!screenEl || fly.value === 0 || dive.value > 0 ||
      (flyTl && flyTl.isActive() && flyTl.reversed())) return;
  // At the shared screen endpoint both paths coincide, so rebuilding here
  // preserves the reverse GSAP transition without a camera jump.
  if (fly.value === 1) {
    flyStart = null;
    buildFlyPath(canvasEl.clientWidth, canvasEl.clientHeight);
  }
  document.body.classList.remove("screen-focused");
  if (prefersReducedMotion()) return jumpFly(0);
  document.body.classList.add("screen-zooming");
  fly.dir = -1;
  flyTl.reverse();
}

function onScreenClick(e) {
  if (fly.value > 0) return;
  e.preventDefault();
  if (!interaction?.firstTap(e, "machine")) flyToScreen();
}

function initScreenOverlay() {
  screenEl = document.getElementById("screen");
  if (!screenEl) return;

  screenEl.style.width = `${SCREEN_BASE_W}px`;
  screenEl.style.height = `${screenBaseH}px`;
  installScreenFx(screenEl, SCREEN_BASE_W, screenBaseH);
  screenEl.hidden = false;
  screenEl.addEventListener("click", onScreenClick);

  onScreenInput = () => {
    snapshot.invalidate();
  };
  screenEl.addEventListener("input", onScreenInput);
  snapshot.watch();
  snapshot.refresh();

  updateScreenOverlay();
}

// LIFECYCLE

export async function initScene(canvas) {
  if (renderer) disposeScene();
  const generation = ++sceneGeneration;
  performance.mark('room:start');
  if (!canvas) return false;

  canvasEl = canvas;
  const { clientWidth: w, clientHeight: h } = canvas;

  // Construct the actual renderer once; a throwaway capability probe
  // initializes a second graphics context and cannot test this canvas.
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
  } catch {
    return false;
  }
  // Shader diagnostics force synchronous driver queries on first use.
  // Keep them in development; production uses the same compiled shaders.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Materials write linear light; AgX (exposure 1, as preview_baked.py and the Cycles references) runs once, in post.js.
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setPixelRatio(scenePixelRatio());
  renderer.setSize(w, h, false);

  performance.mark('room:renderer-ready');
  intro = createIntro({ boxWidth: SCREEN_BASE_W, mobile: isMobile, reducedMotion: prefersReducedMotion, enter: enterScreen,
    onFill: (rect, options) => { stage?.crt.setFill(rect, options); if (stage && !animation?.running) render(); } });
  const loaded = await createRoomScene({ renderer, boxWidth: SCREEN_BASE_W, animated: !prefersReducedMotion(),
    onProgress: (e) => intro?.onProgress(e) });
  if (generation !== sceneGeneration) { loaded.dispose(); return false; }
  stage = loaded;
  scene = stage.scene;
  performance.mark('room:assets-ready');
  rig.resetPath();
  applyLampLevel(lampLevel);
  performance.mark('room:geometry-ready');
  camera = buildCamera();
  post = createPost(renderer, scene, camera);

  scene.updateMatrixWorld(true);
  SCREEN_TARGET.copy(stage.projectionSurface.center);
  const { width: screenW, height: screenH, normal: screenNormal } = stage.projectionSurface;
  screenBaseH = (SCREEN_BASE_W * screenH) / screenW;
  snapshot = createDesktopSnapshot({ width: SCREEN_BASE_W, height: screenBaseH, onDraw: (canvas) => { stage?.setStill(canvas); render(); } });
  const facingAngle = Math.atan2(screenNormal.x, screenNormal.z);
  applyFly(0, w, h);

  applyVoidColor();

  // Diagnostics load only for development or an explicit review URL.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('diagnostics')) {
    const [{ installGeometryDiagnostics }, { installExperienceDiagnostics }] = await Promise.all([
      import('./debug/geometry.js'), import('./debug/experience.js'),
    ]);
    if (generation !== sceneGeneration) return false;
    disposeDiagnostics = installGeometryDiagnostics({ scene, camera, renderer, render: () => render(0), // pixel reads see still grain
      renderBare: () => { post.setZoom(1); render(0); post.setZoom(fly.value); } }); // film strength 0
    const diagnostics = {
      get FACING() { return facingAngle; },
      get LAMP_FADE_S() { return LAMP_FADE_S; },
      get applyFade() { return applyFade; },
      get applyVoidColor() { return applyVoidColor; },
      get background() { return BACKGROUND; },
      get camera() { return camera; },
      get canvasEl() { return canvasEl; },
      get clamp01() { return clamp01; },
      get dive() { return dive; },
      get diveState() { return diveState; },
      get diveTl() { return diveTl; },
      get enterScreen() { return enterScreen; },
      get fly() { return fly; },
      get flyFrom() { return flyFrom; },
      set flyFrom(value) { flyFrom = value; },
      get flyOffset() { return flyOffset; },
      get flyTarget() { return flyTarget; },
      get screenFrustum() { return screenFrustum; },
      get coverFrustum() { return coverFrustum; },
      get flyState() { return flyState; },
      get flyTl() { return flyTl; },
      get fov() { return currentFov(); },
      get lampBtn() { return lampBtn; },
      get lampLevel() { return lampLevel; },
      get lampMix() { return stage.lampMix; },
      get lampOn() { return lampState.on; },
      get lampP() { return lampState.progress; },
      get navigation() { return navigation; },
      get pickTarget() { return e => interaction?.pick(e); },
      get render() { return render; },
      get renderer() { return renderer; },
      get scene() { return scene; },
      get screenFacing() { return screenFacing; },
      get setDive() { return setDive; },
      get setFov() { return setFov; },
      get setLampOn() { return setLampOn; },
      get snapshot() { return snapshot; },
      get tanHalfFov() { return tanHalfFov(); },
      get post() { return post; },
      get updateScreenOverlay() { return updateScreenOverlay; },
    };
    installExperienceDiagnostics(diagnostics);
    if (import.meta.env.DEV && new URLSearchParams(location.search).has('debug')) {
      try {
        const { installLampTuning } = await import('./debug/lampTuning.js');
        if (generation !== sceneGeneration) return false;
        const disposeGeometry = disposeDiagnostics;
        const disposeTuning = installLampTuning(diagnostics, stage);
        disposeDiagnostics = () => { disposeTuning(); disposeGeometry?.(); };
      } catch (error) {
        console.error('Debug panel failed; continuing without it.', error);
      }
    }
  }

  onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    syncRenderQuality();
    renderer.setSize(width, height, false);
    post.resize();

    buildFlyPath(width, height);

    if (dive.value > 0 && dive.dir === 0 && !isHandheld()) jumpDive(0);

    const keep = navigation.allowed()
      ? { theta: navigation.controls.getAzimuthalAngle(), phi: navigation.controls.getPolarAngle() }
      : null;
    applyPose(width, height);

    if (keep) navigation.setAngles(keep.theta, keep.phi);
      updateScreenOverlay();

    if (!animation?.running || fly.value >= 1) render();
  };
  window.addEventListener("resize", onResize);

  performance.mark('room:before-first-frame');
  renderer.compile(scene, camera);
  performance.mark('room:environment-ready');
  // Draw unculled once so props outside the opening frame upload now, not mid-drag.
  const culled = [];
  scene.traverse((o) => { if (o.frustumCulled) { culled.push(o); o.frustumCulled = false; } });
  render();
  for (const o of culled) o.frustumCulled = true;
  performance.mark('room:first-frame');
  initScreenOverlay();
  buildFlyTimeline();
  buildDiveTimeline();

  navigation.init(camera, canvasEl);
  interaction = createInteraction({ canvas, camera, proxies: stage.proxies, parallax,
    canOrbit: () => navigation.allowed(), isDragging: () => navigation.dragging,
    canLeaveScreen, overScreen, beginParallax, endParallax,
    onHoverTarget, onLamp: () => setLampOn(!lampState.on),
    onEnter: enterScreen, onProject: openProject, onExit: flyFromScreen });

  initDeskObjects();
  // Review URLs (?diagnostics) start at the desk unless they ask for the intro.
  const query = new URLSearchParams(location.search);
  const wait = !query.has('diagnostics') || query.has('intro');
  if (wait) jumpFly(1);
  intro.start({ wait, still: snapshot, flyOut: flyFromScreen });
  performance.mark('room:interactive');
  if (prefersReducedMotion()) return true;

  if (import.meta.env.DEV && perfWanted()) {
    try {
      const { createPerfMeter } = await import("./perf.js");
      if (generation !== sceneGeneration) return false;
      perf = createPerfMeter();
    } catch {
      perf = null; // the meter is never load-bearing
    }
  }

  animation = createAnimationLoop((dt) => {
    perf?.begin();

    // The canvas is frozen behind the live desktop. Leave native scrolling
    // alone instead of updating invisible textures and inherited CSS.
    // Keep the lamp ramp live for its keyboard control.
    if (fly.value === 1 && fly.dir === 0 && dive.dir === 0) {
      const lampMoving = lampState.moving;
      lampState.tick(dt);
      if (lampMoving) render();
      perf?.end(1 - dive.value);
      return;
    }

    navigation.tick(dt);
    tickParallax(dt);

    lampState.tick(dt);
    const k = 1 - Math.exp(-HOVER_RATE * dt);
    hover.value += (hover.target - hover.value) * k;
    stage.crt.setHover(hover.value);

    if (fly.value < 1 || dive.dir !== 0) render();

    perf?.end(fly.value < 1 ? fly.value : 1 - dive.value);
  });
  animation.start();

  return true;
}

export function disposeScene() {
  sceneGeneration++;
  disposeDiagnostics?.();
  disposeDiagnostics = null;
  for (const name of Object.keys(window)) {
    if (name.startsWith("__") && diagnosticNames.has(name)) delete window[name];
  }
  animation?.dispose();
  animation = null;
  if (onResize) window.removeEventListener("resize", onResize);
  interaction?.dispose();
  interaction = null;
  parallaxPresented = false;
  navigation.killReturn();
  navigation.dispose();
  flyStart = null;
  flyFrom = FLY_FROM;
  fovOverride = null;
  deskObjects?.dispose();
  intro?.dispose();
  deskObjects = lampBtn = intro = null;
  lampState.reset();
  lampLevel = LAMP_START_ON ? 1 : 0;
  perf?.dispose();
  perf = null;
  stage?.dispose();
  stage = null;
  flyTl?.kill();
  flyTl = null;
  flyState.p = flyState.fade = 0;
  rig.resetPath();
  diveTl?.kill();
  diveTl = null;
  diveState.q = 0;
  onDiveLanded = null;
  if (screenEl) {
    screenEl.removeEventListener("click", onScreenClick);
    if (onScreenInput) screenEl.removeEventListener("input", onScreenInput);
    screenEl.hidden = true;
    screenEl.style.transform = "";
    screenEl.style.visibility = "";
    screenTransform = "";
  }
  disposeScreenFx();
  snapshot?.dispose();
  snapshot = null;
  stillHidden = false;
  screenAway = false;
  brokenOut = false;
  screenHidden = "";
  sceneFade = -1;
  document.body.style.removeProperty("--scene-fade");
  if (canvasEl) canvasEl.style.cursor = "";
  document.body.style.removeProperty("--page-fade");
  document.body.classList.remove(
    "screen-active",
    "screen-zooming",
    "screen-focused",
    "glass-fullscreen",
    "orbit-live",
    "orbit-used",
  );
  fly = { value: 0, dir: 0 };
  dive = { value: 0, dir: 0 };
  screenEl = null;
  canvasEl = null;
  post?.dispose();
  renderer?.dispose();
  hover = { target: 0, value: 0 };
  renderer = scene = camera = post = null;
  onResize = onScreenInput = null;
}
