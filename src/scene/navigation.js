import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap/gsap-core';
import { LOOK } from '../config/look.js';
const rad = THREE.MathUtils.degToRad;
const ORBIT_DAMPING = 0.075;
const ORBIT_SPEED = 0.16;
const IDLE_MS = 0;
const RETURN_S = 0.8;
const RETURN_EASE = "power2.out";
const RETURN_FAST_S = 0.45;
const ORBIT_EPS = THREE.MathUtils.degToRad(0.2);
const ORBIT_SETTLE_MS = 120;
// Where the yaw limit would show the void past the side walls (measured at the pitch limits): turning in place,
// the frame's edge sits yaw + half the horizontal FOV off the overview's sight line, and the walls end 49.4-50.6°
// out (tests/debug.mjs); orbiting, a landscape phone's wide frame runs out at about 30.5 × 1.79 / aspect
// (tests/lookaround.mjs).
const TURN_WALL = 48.5;
const LANDSCAPE_ASPECT = 1.7;

export function createNavigation({ orbitPivot, isAtDesk, isHandheld, reducedMotion, hasFrame,
  onChange, render, resetParallax, onDisable }) {
  let camera = null;
  let canvasEl = null;
  let controls = null;
  const orbitHome = { theta: 0, phi: 0, radius: 0 };
  const orbitSpherical = new THREE.Spherical();
  const flyOffset = new THREE.Vector3();
  let orbitTween = null;
  let orbitDragging = false;
  let orbitIdleAt = 0;
  let orbitChangedAt = -Infinity;
  let orbitDirty = false;
  function setOrbitAngles(theta, phi) {
    orbitSpherical.set(orbitHome.radius, phi, theta);
    camera.position.setFromSpherical(orbitSpherical).add(controls.target);
    camera.lookAt(controls.target);
    camera.updateMatrixWorld();
    orbitDirty = true;
  }

  const orbitLeash = { min: 0, max: 0, softMin: 0, softMax: 0 };

  function yawLimit() {
    if (LOOK.lookMode === 'turn') {
      const halfWidth = THREE.MathUtils.radToDeg(Math.atan(Math.tan(rad(camera.fov) / 2) * camera.aspect));
      return Math.min(LOOK.yawLimit, TURN_WALL - halfWidth);
    }
    return isHandheld() ? LOOK.yawLimit * Math.min(1, LANDSCAPE_ASPECT / camera.aspect) : LOOK.yawLimit;
  }

  function applyOrbitLimits() {
    const yaw = rad(yawLimit());
    orbitLeash.softMin = orbitHome.theta - yaw;
    orbitLeash.softMax = orbitHome.theta + yaw;
    if (orbitLeash.softMin > orbitHome.theta || orbitLeash.softMax < orbitHome.theta) {
      orbitLeash.softMin = orbitLeash.softMax = orbitHome.theta;
    }
    orbitLeash.min = orbitLeash.softMin;
    orbitLeash.max = orbitLeash.softMax;
    controls.minAzimuthAngle = orbitLeash.min;
    controls.maxAzimuthAngle = orbitLeash.max;
    controls.minPolarAngle = orbitHome.phi - rad(LOOK.pitchUpLimit);
    controls.maxPolarAngle = orbitHome.phi + rad(LOOK.pitchDownLimit);
  }

  function orbitOffHome() {
    if (!controls) return false;
    return (
      Math.abs(controls.getAzimuthalAngle() - orbitHome.theta) > ORBIT_EPS ||
      Math.abs(controls.getPolarAngle() - orbitHome.phi) > ORBIT_EPS
    );
  }

  function killReturn() {
    orbitTween?.kill();
    orbitTween = null;
  }

  function spendGlide() {
    const damped = controls.enableDamping;
    controls.enableDamping = false;
    controls.update();
    controls.enableDamping = damped;
  }

  function returnHome(duration = RETURN_S, onDone = null) {
    killReturn();
    // Clear the controls' pending inertia, then restore the visible release
    // pose so the return begins without applying the rest of a flick at once.
    orbitSpherical.setFromVector3(flyOffset.copy(camera.position).sub(controls.target));
    const from = {
      theta: orbitSpherical.theta,
      phi: orbitSpherical.phi,
    };
    spendGlide();
    setOrbitAngles(from.theta, from.phi);
    controls.update();
    orbitTween = gsap.to(from, {
      theta: orbitHome.theta,
      phi: orbitHome.phi,
      duration,
      ease: RETURN_EASE,
      onUpdate: () => setOrbitAngles(from.theta, from.phi),
      onComplete: () => {
        orbitTween = null;
        setOrbitAngles(orbitHome.theta, orbitHome.phi);
        controls.update();
        onDone?.();
      },
    });
  }

  function setOrbitEnabled(on) {
    if (!controls) return;
    controls.enabled = on;
    document.body.classList.toggle("orbit-live", on);
    if (on) {
      orbitIdleAt = 0;
    } else {
      const returning = !!orbitTween;
      killReturn();
      if (returning) controls.update();
      resetParallax();
      orbitDragging = false;
      orbitIdleAt = 0;
      onDisable();
      if (canvasEl) canvasEl.style.cursor = "";
    }
  }

  function tickOrbit(dt) {
    if (!orbitAllowed()) return;

    if (!orbitTween) {
      controls.update(dt);
    }

    if (!orbitDragging && !orbitTween && orbitIdleAt &&
        performance.now() - orbitIdleAt > IDLE_MS) {
      orbitIdleAt = 0;
      returnHome();
    }

    if (orbitDirty) {
      orbitDirty = false;
      camera.updateMatrixWorld();
      onChange();
    }
  }

  function initOrbit(cameraInstance, canvas) {
    camera = cameraInstance;
    canvasEl = canvas;
    controls = new OrbitControls(camera, canvasEl);
    controls.target.copy(orbitPivot());

    controls.update();
    controls.enablePan = false;

    controls.enableZoom = false;

    controls.enableDamping = !reducedMotion();
    controls.dampingFactor = ORBIT_DAMPING;

    orbitHome.theta = controls.getAzimuthalAngle();
    orbitHome.phi = controls.getPolarAngle();
    orbitHome.radius = camera.position.distanceTo(controls.target);

    applyOrbitLimits();

    controls.addEventListener("start", () => {
      // OrbitControls measures drags against the canvas height; on a portrait phone that made a full-width
      // swipe turn less than the look-around range, so drag speed follows the narrower side instead.
      controls.rotateSpeed = ORBIT_SPEED * Math.max(1, canvasEl.clientHeight / canvasEl.clientWidth);
      resetParallax();
      orbitDragging = true;
      const returning = !!orbitTween;
      killReturn();
      if (returning) controls.update();
      orbitIdleAt = 0;
    });
    controls.addEventListener("end", () => {
      orbitDragging = false;
      if (reducedMotion()) {
        // No animation loop for reduced motion; settle in the release event.
        setOrbitAngles(orbitHome.theta, orbitHome.phi);
        controls.update();
        onChange();
        render();
      } else {
        orbitIdleAt = performance.now();
      }
    });
    controls.addEventListener("change", () => {
      orbitChangedAt = performance.now();
      orbitDirty = true;

      document.body.classList.add("orbit-used");

      if (!hasFrame()) {
        orbitDirty = false;
        camera.updateMatrixWorld();
        onChange();
        render();
      }
    });

    setOrbitEnabled(true);
  }

  function orbitAllowed() {
    return !!controls && controls.enabled && isAtDesk();
  }


  return {
    init: initOrbit, tick: tickOrbit, allowed: orbitAllowed, offHome: orbitOffHome,
    setEnabled: setOrbitEnabled, setAngles: setOrbitAngles,
    applyLimits: applyOrbitLimits,
    killReturn, spendGlide, returnHome,
    home: orbitHome, spherical: orbitSpherical, leash: orbitLeash,
    get controls() { return controls; },
    get dragging() { return orbitDragging; },
    get returning() { return !!orbitTween; },
    get moving() { return orbitDragging || !!orbitTween || performance.now() - orbitChangedAt < ORBIT_SETTLE_MS; },
    cancelIdle() { orbitIdleAt = 0; },
    get riseLimits() { return [-LOOK.pitchDownLimit, LOOK.pitchUpLimit]; },
    dispose() {
      killReturn();
      controls?.disconnect();
      controls?.dispose();
      controls = null;
      camera = canvasEl = null;
      orbitDragging = orbitDirty = false;
      orbitIdleAt = 0;
      orbitChangedAt = -Infinity;
    },
  };
}
