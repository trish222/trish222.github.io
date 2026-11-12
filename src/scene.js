import { createInteraction } from "./scene/interaction.js";
import { createAnimationLoop } from "./scene/animation.js";
import { createRoomScene } from "./scene/createScene.js";
import { SCENERY_PRESETS, WINDOW_SCENERY } from "./environment/presets.js";
import { createNavigation } from "./scene/navigation.js";
import { createLighting, NIGHT_LIGHTING } from "./scene/lighting.js";
import { createCameraRig } from "./scene/camera.js";
import { isDesktopFullscreen } from "./config/experience.js";
import { createComposer, createMotionComposer } from "./scene/renderer.js";
import { createParallax } from "./scene/parallax.js";
import { createScreenProjection } from "./overlay/screenOverlay.js";
import { createDesktopSnapshot } from "./overlay/desktopSnapshot.js";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { gsap } from "gsap/gsap-core";
import {
  disposeComputer,
  loadScreenFont,
  FACING,
  SCREEN_W,
  SCREEN_H,
} from "./computer.js";
import * as executiveDesk from "./desks/executive.js";
import { disposeTreehouse } from "./treehouse.js";
import { disposeNameplate } from "./nameplate.js";
import * as greenLamp from "./lamps/greenlamp.js";
import {
  disposeRoom,
  ROOM_PLAN,
  ROOM_RADIUS,
  setFogRange,
  VOID,
} from "./room.js";
import { rainState, tickRain } from "./nightwindow.js";
import { tonemapForward, tonemapPreimage, TONE_MAPPINGS } from "./tonemap.js";

let interaction = null;





const diagnosticNames = new Set(["__cam", "__camera", "__composer", "__diveTo", "__enter", "__flyFrom", "__flyTo", "__fov", "__gtao", "__lamp", "__lights", "__orbit", "__pick", "__probes", "__rain", "__room", "__scene", "__stillReady", "__tonemap", "__zoom"]);
let sceneGeneration = 0;













let deskMod = executiveDesk;

async function resolveDesk() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get("desk") === "classic") {
    return import("./desks/classic.js");
  }
  return executiveDesk;
}

let DESK_TOP_Y = executiveDesk.DESK_TOP_Y;







let lampMod = greenLamp;

async function resolveLamp() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get("lamp") === "lamp") {
    return import("./lamp.js");
  }
  return greenLamp;
}







// Experience state and rendering configuration

const FOV_DEFAULT = 28;
let fov = FOV_DEFAULT;
let tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);

function distFor(frustum) {
  return frustum / (2 * tanHalfFov);
}

const FRUSTUM = 24;

const FRUSTUM_MOBILE = 37;

const HOME_ZOOM = 1.1;
const MOBILE_BP = 760;

     // the front of the keyboard's contact shadow

// Shift toward the window and slightly toward the lamp, leaving a gap
// in front of its base and keeping the whole wedge on the desktop.

const LAMP_START_ON = true;

const LAMP_FADE_S = 0.4;

const LAMP_EXPOSURE_LIFT = 0;
const EXPOSURE_STEP = 0.02;

// NIGHT LIGHTING

const HEMI_GROUND = NIGHT_LIGHTING.hemiGround;

const HEMI_INTENSITY = NIGHT_LIGHTING.hemiIntensity;

const OFF_DARKNESS = 0.52;
const HEMI_GROUND_OFF = 0x2a2a3e;

const ENV_INTENSITY = NIGHT_LIGHTING.environmentIntensity;

const TONE_EXPOSURE = 1.45;

const GTAO_BLEND = 1.0; // deep enough that the creases actually darken

const GTAO_BOX_MARGIN = 8;
const HOVER_RATE = 7; // hover easing, per second

const SCREEN_GLOW = 8.5;

const MAX_DPR = 1.5;
const MOBILE_MAX_DPR = 2;

function scenePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, isMobile() ? MOBILE_MAX_DPR : MAX_DPR);
}

// Keep drawing buffers allocated across camera motion. Even a single canvas
// resize can synchronize with the GPU (100ms+ on the measured Metal path),
// and damping / the return home used to bounce between two resolutions.
// Desktop keeps a second, small composer for the existing motion resolution,
// so switching quality does not dispose/reallocate render targets either.
let motionQuality = false;
function syncRenderQuality() {
  const moving = cameraMoving() && !prefersReducedMotion();
  const ratio = scenePixelRatio();
  if (moving === motionQuality && renderer.getPixelRatio() === ratio) return;
  motionQuality = moving;
  // setPixelRatio calls setSize even for an unchanged value. Only a real DPR
  // or viewport breakpoint change should resize the canvas and composer.
  if (renderer.getPixelRatio() !== ratio) {
    renderer.setPixelRatio(ratio);
    composer?.setPixelRatio(ratio);
    if (composer && ratio > 1 && !motionComposer) {
      motionComposer = buildMotionComposer();
      motionComposer.render(); // a real DPR change, before the next gesture
    }
    motionComposer?.setPixelRatio(Math.min(ratio, 1));
  }
  // AO redraws the entire room for its depth/normal pass. Keep the real
  // light/shadow rendering during motion and restore contact detail at rest.
  if (gtaoPass) gtaoPass.enabled = !moving;
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

 // of the legacy path: camera is head-on by here
 // ...and the push-in has already started

// THE SECOND MOVE — the bezel framing in to a full viewport

const DIVE_S = 0.9; // seconds; the flight's 1.6s would drag over a dolly this short
const DIVE_EASE = FLY_EASE;

export const SCREEN_BASE_W = 900;

const SCREEN_BASE_H = (SCREEN_BASE_W * SCREEN_H) / SCREEN_W;

const BLUR_STEP = 0.5;
const SCAN_STEP = 2;

let renderer = null;
let canvasEl = null;
let scene = null;
let gtaoPass = null;
let screenEl = null;

let fly = { value: 0, dir: 0 };

let dive = { value: 0, dir: 0 };
let camera = null;
let composer = null;
let motionComposer = null;
let computer = null;
let desk = null;
let treehouse = null;
let nameplate = null;

let lamp = null;
let lampOn = LAMP_START_ON;
let lampP = LAMP_START_ON ? 1 : 0;
let lampLevel = LAMP_START_ON ? 1 : 0;
let lampBtn = null;
let onLampBtn = null;

let toneBase = TONE_EXPOSURE;

let toneWritten = -1;

let hemiBase = HEMI_INTENSITY;

let offDarkness = OFF_DARKNESS;

const HEMI_GROUND_WARM = new THREE.Color(HEMI_GROUND);
const HEMI_GROUND_COOL = new THREE.Color(HEMI_GROUND_OFF);

let room = null;
let envMap = null;
let hover = { target: 0, value: 0 };

let lights = null;

let screenGlowBase = SCREEN_GLOW;

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
function beginParallax() { return parallax.begin(camera, navigation.controls?.target, parallaxAllowed()); }
function endParallax() { parallax.end(camera); }
let animation = null;
let onResize = null;

let onScreenInput = null;

let sceneFade = -1;

 // the walk home, while one is running

 // the camera moved and the overlay has not caught up

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

let homeZoom = HOME_ZOOM;

function frustumFor() {
  return (isMobile() ? FRUSTUM_MOBILE : FRUSTUM) * homeZoom;
}

function camDist() {
  return distFor(frustumFor());
}

function buildScene() {
  const built = createRoomScene({ renderer, deskMod, lampMod,
    reducedMotion: prefersReducedMotion(), fogDistance: camDist(), screenGlowBase,
    scenery: SCENERY_PRESETS[WINDOW_SCENERY] });
  ({ scene, room, desk, computer, treehouse, nameplate, lamp } = built);
  DESK_TOP_Y = built.deskTopY;
  lights = createLighting(scene, { from: MOON_FROM, at: MOON_AT });
  applyLampLevel(lampLevel);
  return scene;
}

// AIMING THE MOON

const MOON_AT = new THREE.Vector3(-2.0, 0, 11.0);
const MOON_DIST = 45;

function windowCentre() {
  const win = ROOM_PLAN.window;
  return new THREE.Vector3(ROOM_PLAN.X0, win.sillY + win.h / 2, win.z);
}

function moonDirection(at = MOON_AT) {
  return at.clone().sub(windowCentre()).normalize();
}

const MOON_FROM = MOON_AT.clone().addScaledVector(moonDirection(), -MOON_DIST);

function setMoonAt(x, y, z) {
  MOON_AT.set(x, y, z);
  lights.moon.target.position.copy(MOON_AT);
  lights.moon.position.copy(
    MOON_AT.clone().addScaledVector(moonDirection(), -MOON_DIST),
  );
  lights.moon.target.updateMatrixWorld();
  renderer.shadowMap.needsUpdate = true;
}

// THE DESK LAMP

function applyLampLevel(level) {
  lampLevel = level;
  lampMod.setLamp(level);

  nameplate?.setLight(level);

  if (lights) {
    const dim = offDarkness + (1 - offDarkness) * level;
    lights.hemi.intensity = hemiBase * dim;
    lights.hemi.groundColor
      .copy(HEMI_GROUND_COOL)
      .lerp(HEMI_GROUND_WARM, level);
  }
  if (!renderer) return;

  const want =
    Math.round(
      ((toneBase + LAMP_EXPOSURE_LIFT * (1 - level)) / EXPOSURE_STEP),
    ) * EXPOSURE_STEP;
  if (Math.abs(want - toneWritten) < 1e-6) return;
  toneWritten = want;
  renderer.toneMappingExposure = want;
  applyVoidColor();
}

function setLampOn(on, jump = !animation?.running) {
  lampOn = !!on;
  if (jump) {
    lampP = lampOn ? 1 : 0;
    applyLampLevel(lampP);
    if (renderer) render();
  }
  lampBtn?.setAttribute("aria-pressed", String(lampOn));
  return lampOn;
}

function tickLamp(dt) {
  if (!lamp) return;
  const target = lampOn ? 1 : 0;
  if (lampP === target) return;
  const step = dt / LAMP_FADE_S;
  lampP = lampOn
    ? Math.min(1, lampP + step)
    : Math.max(0, lampP - step);
  applyLampLevel(lampOn ? 1 - (1 - lampP) * (1 - lampP) : lampP * lampP);
}

function initLampButton() {
  lampBtn = document.getElementById("lamp-toggle");
  if (!lampBtn) return;
  lampBtn.hidden = false;
  lampBtn.setAttribute("aria-pressed", String(lampOn));
  onLampBtn = () => setLampOn(!lampOn);
  lampBtn.addEventListener("click", onLampBtn);
}

// THE VOID

function applyVoidColor() {
  if (!scene || !renderer) return;
  const target = new THREE.Color(VOID);
  scene.background = composer
    ? tonemapPreimage(target, renderer.toneMapping, renderer.toneMappingExposure)
    : target;

  scene.fog?.color.set(target);
}

// CAMERA

const SCREEN_TARGET = new THREE.Vector3();
const flyOffset = new THREE.Vector3();
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const navigation = createNavigation({ homeTarget: () => rig.homeTarget(),
  isAtDesk: () => fly.value === 0, reducedMotion: prefersReducedMotion,
  hasFrame: () => !!animation?.running, onChange: () => updateScreenOverlay(), render: () => render(),
  resetParallax: () => parallax.reset(), onDisable: () => interaction?.cancel(), roomPlan: ROOM_PLAN });
const rig = createCameraRig({ screenTarget: SCREEN_TARGET, getCamera: () => camera,
  getFov: () => fov, getFlightStart: () => flyStart,
  getOrbitRadius: () => navigation.home.radius, distFor, isMobile });
const { homeTarget, screenFrustum, coverFrustum, buildFlyPath, applyDive,
  target: flyTarget, pose: flyPose } = rig;
function applyFly(p, width, height) {
  const frustum = rig.applyFly(p, width, height);
  if (gtaoPass) gtaoPass.blendIntensity = GTAO_BLEND * (1 - clamp01(p / 0.3));
  return frustum;
}

function applyPose(width, height) {
  return dive.value > 0
    ? applyDive(dive.value, width, height)
    : applyFly(fly.value, width, height);
}

const CAM_NEAR = 0.5;

function camFar() {
  return ROOM_RADIUS + distFor(FRUSTUM_MOBILE * homeZoom) + 20;
}

function buildCamera() {
  return new THREE.PerspectiveCamera(fov, 1, CAM_NEAR, camFar());
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
  fov = THREE.MathUtils.clamp(Number(deg) || FOV_DEFAULT, 5, 80);
  tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  reframeHome();
}

function setHomeZoom(f) {
  if (!camera || !canvasEl) return;
  homeZoom = THREE.MathUtils.clamp(Number(f) || HOME_ZOOM, 0.5, 3);
  reframeHome();
}

function reframeHome() {
  const width = canvasEl.clientWidth;
  const height = canvasEl.clientHeight;
  camera.near = CAM_NEAR;
  camera.far = camFar();
  setFogRange(scene.fog, camDist());

  flyStart = null;
  buildFlyPath(width, height);
  applyPose(width, height);

  if (navigation.controls) {
    navigation.killReturn();
    navigation.cancelIdle();
    navigation.controls.target.copy(homeTarget());

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
function screenFacing() { return projection.facing(computer.projectionSurface, camera, SCREEN_TARGET); }

let screenTransform = "";

function setScreenTransform(t) {
  if (t === screenTransform) return;
  screenTransform = t;
  screenEl.style.transform = t;
}

function syncScreenVisibility() {
  if (!screenEl) return;
  const v = stillHidden || screenAway ? "hidden" : "";
  if (v === screenHidden) return; // don't invalidate style for a repeat
  screenHidden = v;
  screenEl.style.visibility = v;
}

function updateScreenOverlay(transformOnly = false) {
  if (!screenEl || !camera || !computer) return;
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

  const { transform, scale } = projection.project(computer.projectionSurface, camera,
    width, height, SCREEN_BASE_W, SCREEN_BASE_H);
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
  let scan = Math.max(8, 3 / scale);
  let blur = (0.9 / scale) * (1 - fly.value);
  if (cameraMoving()) {
    scan = snap(scan, SCAN_STEP);
    blur = snap(blur, BLUR_STEP);
  }
  set("--scan", `${scan.toFixed(2)}px`);
  set("--blur", `${blur.toFixed(2)}px`);
}

// ENVIRONMENT MAP

async function loadEnvironment() {
  const generation = sceneGeneration;
  const activeRenderer = renderer;
  const activeScene = scene;

  if (!ENV_INTENSITY) return false;
  try {
    const url = `${import.meta.env.BASE_URL}env/studio-small-09-256.hdr`;
    const hdr = await new HDRLoader().loadAsync(url);
    if (generation !== sceneGeneration) { hdr.dispose(); return false; }
    const pmrem = new THREE.PMREMGenerator(activeRenderer);
    envMap = pmrem.fromEquirectangular(hdr).texture;
    activeScene.environment = envMap;

    scene.environmentIntensity = ENV_INTENSITY;
    hdr.dispose();
    pmrem.dispose();
    return true;
  } catch (e) {
    console.warn("env map failed:", e);
    return false; // plain lighting; the scene still reads
  }
}

// AMBIENT OCCLUSION

function buildComposer(width, height) {
  const result = createComposer({ renderer, scene, camera, width, height,
    objects: [desk.root, computer.root, treehouse.root, lamp?.root],
    blend: GTAO_BLEND, margin: GTAO_BOX_MARGIN });
  gtaoPass = result.gtao;
  return result.composer;
}
function buildMotionComposer() {
  return createMotionComposer(renderer, scene, camera, scenePixelRatio());
}

// HOVER, AND THE CURSOR

// THE FLY-IN

function render() {
  syncRenderQuality();
  const shifted = beginParallax();
  // HTML and WebGL share the same presentation pose, never the base pose.
  if (shifted || parallaxPresented) updateScreenOverlay(true);
  parallaxPresented = shifted;
  const activeComposer = motionQuality && motionComposer ? motionComposer : composer;
  try {
    if (activeComposer) activeComposer.render();
    else renderer.render(scene, camera);
  } finally {
    if (shifted) endParallax();
  }
}

function setFly(p) {
  fly.value = p;
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
    fov,
    dist: round(flyPose.dist),
  });
}

function arrive() {
  fly.dir = 0;

  navigation.setEnabled(false);
  document.body.classList.remove("screen-zooming");
  document.body.classList.add("screen-focused");

  applyFade(1);
  showStill(false);
  hover.target = 0;

  updateScreenOverlay();

  if (!document.body.classList.contains("signed-in")) {
    document.getElementById("login-user")?.focus({ preventScroll: true });
  }
  logArrival();
}

function depart() {
  fly.dir = 0;
  document.body.classList.remove("screen-active", "screen-zooming");
  applyFade(0);
  showStill(false);

  if (flyStart) {
    flyStart = null;
    if (canvasEl) buildFlyPath(canvasEl.clientWidth, canvasEl.clientHeight);
  }

  navigation.setEnabled(true);

  snapshot.invalidate();
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

const snapshot = createDesktopSnapshot({ width: SCREEN_BASE_W, height: SCREEN_BASE_H });

function showStill(on) {
  if (!computer) return;
  if (on) {
    if (snapshot.canvas) computer.setStill(snapshot.canvas);
  } else {
    computer.clearStill();
  }
}

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
  showStill(false);

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

  showStill(true);
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
  showStill(true);
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
  snapshot.invalidate();
}

export function syncDesktopOverlay() {
  if (!screenEl) return;
  snapshot.invalidate();
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
  showStill(true);
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
  showStill(true);
  fly.dir = -1;
  flyTl.reverse();
}

function onScreenClick(e) {

  if (fly.value > 0) return;
  e.preventDefault();
  flyToScreen();
}

function initScreenOverlay() {
  screenEl = document.getElementById("screen");
  if (!screenEl) return;

  screenEl.style.width = `${SCREEN_BASE_W}px`;
  screenEl.style.height = `${SCREEN_BASE_H}px`;
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
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return false;
  }
  // Shader diagnostics force synchronous driver queries on first use.
  // Keep them in development; production uses the same compiled shaders.
  renderer.debug.checkShaderErrors = import.meta.env.DEV;

  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = TONE_EXPOSURE;
  renderer.setPixelRatio(scenePixelRatio());
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;

  renderer.shadowMap.type = THREE.VSMShadowMap;

  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  performance.mark('room:renderer-ready');
  const [, nextDesk, nextLamp] = await Promise.all([loadScreenFont(), resolveDesk(), resolveLamp()]);
  if (generation !== sceneGeneration) return false;
  deskMod = nextDesk;
  lampMod = nextLamp;
  performance.mark('room:assets-ready');
  rig.resetPath();
  scene = buildScene();
  performance.mark('room:geometry-ready');
  camera = buildCamera();

  scene.updateMatrixWorld(true);
  computer.screenAnchor.getWorldPosition(SCREEN_TARGET);
  applyFly(0, w, h);

  renderer.shadowMap.needsUpdate = true;

  if (!isMobile() && !prefersReducedMotion()) {
    try {
      composer = buildComposer(w, h);
      if (scenePixelRatio() > 1) motionComposer = buildMotionComposer();
    } catch {
      composer?.dispose();
      motionComposer?.dispose();
      composer = motionComposer = null; // fall back to a straight render
    }
  }

  applyVoidColor();

  // Diagnostics load only for development or an explicit review URL.
  if (import.meta.env.DEV || new URLSearchParams(location.search).has('diagnostics')) {
    const [{ installGeometryDiagnostics }, { installExperienceDiagnostics }] = await Promise.all([
      import('./debug/geometry.js'), import('./debug/experience.js'),
    ]);
    if (generation !== sceneGeneration) return false;
    disposeDiagnostics = installGeometryDiagnostics({ scene, camera, renderer, composer, lights, render });
    installExperienceDiagnostics({
      get DESK_TOP_Y() { return DESK_TOP_Y; },
      get FACING() { return FACING; },
      get LAMP_EXPOSURE_LIFT() { return LAMP_EXPOSURE_LIFT; },
      get LAMP_FADE_S() { return LAMP_FADE_S; },
      get MOON_AT() { return MOON_AT; },
      get ROOM_PLAN() { return ROOM_PLAN; },
      get TONE_MAPPINGS() { return TONE_MAPPINGS; },
      get VOID() { return VOID; },
      get applyFade() { return applyFade; },
      get applyLampLevel() { return applyLampLevel; },
      get applyVoidColor() { return applyVoidColor; },
      get camDist() { return camDist; },
      get camera() { return camera; },
      get canvasEl() { return canvasEl; },
      get clamp01() { return clamp01; },
      get composer() { return composer; },
      get computer() { return computer; },
      get dive() { return dive; },
      get diveState() { return diveState; },
      get diveTl() { return diveTl; },
      get enterScreen() { return enterScreen; },
      get envMap() { return envMap; },
      get fly() { return fly; },
      get flyFrom() { return flyFrom; },
      set flyFrom(value) { flyFrom = value; },
      get flyOffset() { return flyOffset; },
      get flyTarget() { return flyTarget; },
      get screenFrustum() { return screenFrustum; },
      get coverFrustum() { return coverFrustum; },
      get flyState() { return flyState; },
      get flyTl() { return flyTl; },
      get fov() { return fov; },
      get frustumFor() { return frustumFor; },
      get gtaoPass() { return gtaoPass; },
      get hemiBase() { return hemiBase; },
      set hemiBase(value) { hemiBase = value; },
      get homeZoom() { return homeZoom; },
      get lamp() { return lamp; },
      get lampBtn() { return lampBtn; },
      get lampLevel() { return lampLevel; },
      get lampMod() { return lampMod; },
      get lampOn() { return lampOn; },
      get lampP() { return lampP; },
      get lights() { return lights; },
      get moonDirection() { return moonDirection; },
      get navigation() { return navigation; },
      get offDarkness() { return offDarkness; },
      set offDarkness(value) { offDarkness = value; },
      get pickTarget() { return e => interaction?.pick(e); },
      get rainState() { return rainState; },
      get render() { return render; },
      get renderer() { return renderer; },
      get scene() { return scene; },
      get screenFacing() { return screenFacing; },
      get screenGlowBase() { return screenGlowBase; },
      set screenGlowBase(value) { screenGlowBase = value; },
      get setDive() { return setDive; },
      get setFov() { return setFov; },
      get setHomeZoom() { return setHomeZoom; },
      get setLampOn() { return setLampOn; },
      get setMoonAt() { return setMoonAt; },
      get showStill() { return showStill; },
      get snapshot() { return snapshot; },
      get tanHalfFov() { return tanHalfFov; },
      get toneBase() { return toneBase; },
      set toneBase(value) { toneBase = value; },
      get toneWritten() { return toneWritten; },
      set toneWritten(value) { toneWritten = value; },
      get tonemapForward() { return tonemapForward; },
      get updateScreenOverlay() { return updateScreenOverlay; },
    });
  }

  onResize = () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (!width || !height) return;
    syncRenderQuality();
    renderer.setSize(width, height, false);
    composer?.setSize(width, height);
    motionComposer?.setSize(width, height);

    setFogRange(scene.fog, camDist());

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
  // Allocate/upload the small motion targets before interaction, not on the
  // first drag. The following full-resolution draw reuses programs/shadows.
  // The close opening view culls furniture that a first drag can reveal.
  // Warm those static buffers too, then restore culling before the visible
  // frame. Both draws are synchronous, so only the seated view is presented.
  const culled = [];
  scene.traverse((object) => {
    if (object.isMesh && object.frustumCulled) {
      culled.push(object);
      object.frustumCulled = false;
    }
  });
  renderer.compile(scene, camera);
  if (motionComposer) motionComposer.render();
  else renderer.render(scene, camera);
  for (const object of culled) object.frustumCulled = true;
  render();
  performance.mark('room:first-frame');
  initScreenOverlay();
  buildFlyTimeline();
  buildDiveTimeline();

  navigation.init(camera, canvasEl);
  interaction = createInteraction({ canvas, camera, computer, lamp, parallax,
    canOrbit: () => navigation.allowed(), isDragging: () => navigation.dragging,
    canLeaveScreen, overScreen, beginParallax, endParallax,
    setHover: value => { hover.target = value; }, onLamp: () => setLampOn(!lampOn),
    onEnter: enterScreen, onExit: flyFromScreen });

  initLampButton();
  performance.mark('room:interactive');
  loadEnvironment().then((ok) => {
    if (generation !== sceneGeneration) return;
    if (ok && !animation?.running) render();
  });

  desk.ready.then(() => {
    if (generation !== sceneGeneration) return;
    if (!animation?.running) render();
  });

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

  const screenMat = computer.screenMat;
  const screenGlow = computer.screenGlow;
  let elapsed = 0;
  let hoverStyle = "";
  animation = createAnimationLoop((dt) => {
    perf?.begin();

    // The canvas is frozen behind the live desktop. Leave native scrolling
    // alone instead of updating invisible rain, textures and inherited CSS.
    // Keep the lamp ramp live for its keyboard control.
    if (fly.value === 1 && fly.dir === 0 && dive.dir === 0) {
      const lampMoving = lamp && lampP !== (lampOn ? 1 : 0);
      tickLamp(dt);
      if (lampMoving || motionQuality) render();
      perf?.end(1 - dive.value);
      return;
    }
    elapsed += dt;

    tickRain(dt);

    navigation.tick(dt);
    tickParallax(dt);

    tickLamp(dt);
    const k = 1 - Math.exp(-HOVER_RATE * dt);
    hover.value += (hover.target - hover.value) * k;
    computer.setScreen(hover.value);
    const nextHoverStyle = hover.value.toFixed(3);
    if (nextHoverStyle !== hoverStyle) {
      hoverStyle = nextHoverStyle;
      screenEl?.style.setProperty("--hover", hoverStyle);
    }

    const flicker =
      1 + 0.018 * Math.sin(elapsed * 11.3) * Math.sin(elapsed * 2.7);
    const bright = (1 + hover.value * 0.45) * flicker;
    screenMat.emissiveIntensity = bright;
    screenGlow.intensity = screenGlowBase * bright;

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
  fov = FOV_DEFAULT;
  tanHalfFov = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  homeZoom = HOME_ZOOM;
  screenGlowBase = SCREEN_GLOW;
  lights = null;
  if (lampBtn && onLampBtn) lampBtn.removeEventListener("click", onLampBtn);
  if (lampBtn) {
    lampBtn.hidden = true;
    lampBtn.setAttribute("aria-pressed", String(LAMP_START_ON));
  }
  lampBtn = onLampBtn = null;
  lamp = null;
  lampOn = LAMP_START_ON;
  lampP = lampLevel = LAMP_START_ON ? 1 : 0;
  toneBase = TONE_EXPOSURE;
  toneWritten = -1;

  hemiBase = HEMI_INTENSITY;
  offDarkness = OFF_DARKNESS;
  document.getElementById("orbit-hint")?.setAttribute("hidden", "");
  perf?.dispose();
  perf = null;
  disposeComputer();
  deskMod.disposeDesk();
  disposeTreehouse();
  disposeNameplate();
  lampMod.disposeLamp();
  computer = null;
  nameplate = null;
  desk = null;
  treehouse = null;
  disposeRoom();
  room = null;
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
  snapshot.dispose();
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
  gtaoPass = null;
  canvasEl = null;
  envMap?.dispose();
  motionComposer?.passes.forEach((pass) => pass.dispose());
  composer?.passes.forEach((pass) => pass.dispose());
  motionComposer?.dispose();
  motionComposer = null;
  composer?.dispose();
  renderer?.dispose();
  hover = { target: 0, value: 0 };
  renderer = scene = camera = composer = computer = envMap = null;
  motionQuality = false;
  onResize = onScreenInput = null;
}
