import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { gsap } from 'gsap/gsap-core';
const AZ_WALL_MARGIN = THREE.MathUtils.degToRad(9);
const ORBIT_HORIZONTAL = THREE.MathUtils.degToRad(7);
const ORBIT_DOWN = THREE.MathUtils.degToRad(4);
const ORBIT_UP = THREE.MathUtils.degToRad(4);
const ORBIT_DAMPING = 0.075;
const ORBIT_SPEED = 0.16;
const IDLE_MS = 0;
const RETURN_S = 0.8;
const RETURN_EASE = "power2.out";
const RETURN_FAST_S = 0.45;
const ORBIT_EPS = THREE.MathUtils.degToRad(0.2);
const ORBIT_SETTLE_MS = 120;

export function createNavigation({ homeTarget, isAtDesk, reducedMotion, hasFrame,
  onChange, render, resetParallax, onDisable, roomPlan }) {
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

  function wallAzimuthRange(radius, phi) {
    const R = radius * Math.sin(phi);
    let lo = -Math.PI;
    let hi = Math.PI;

    const sx = (roomPlan.X0 - homeTarget().x) / R;
    if (sx > -1) {
      const a = Math.asin(Math.min(1, sx));
      lo = Math.max(lo, a);
      hi = Math.min(hi, Math.PI - a);
    }

    const sz = (roomPlan.Z0 - homeTarget().z) / R;
    if (sz > -1) {
      const a = Math.acos(Math.min(1, sz));
      lo = Math.max(lo, -a);
      hi = Math.min(hi, a);
    }
    return { lo, hi };
  }

  const orbitLeash = { min: 0, max: 0, softMin: 0, softMax: 0 };

  function applyOrbitLimits() {
    const wall = wallAzimuthRange(orbitHome.radius, orbitHome.phi + ORBIT_DOWN);
    orbitLeash.softMin = Math.max(orbitHome.theta - ORBIT_HORIZONTAL, wall.lo + AZ_WALL_MARGIN);
    orbitLeash.softMax = Math.min(orbitHome.theta + ORBIT_HORIZONTAL, wall.hi - AZ_WALL_MARGIN);
    if (orbitLeash.softMin > orbitHome.theta || orbitLeash.softMax < orbitHome.theta) {
      orbitLeash.softMin = orbitLeash.softMax = orbitHome.theta;
    }
    orbitLeash.min = orbitLeash.softMin;
    orbitLeash.max = orbitLeash.softMax;
    controls.minAzimuthAngle = orbitLeash.min;
    controls.maxAzimuthAngle = orbitLeash.max;
    controls.minPolarAngle = orbitHome.phi - ORBIT_UP;
    controls.maxPolarAngle = orbitHome.phi + ORBIT_DOWN;
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
    controls.target.copy(homeTarget());

    controls.update();
    controls.enablePan = false;

    controls.enableZoom = false;
    controls.rotateSpeed = ORBIT_SPEED;

    controls.enableDamping = !reducedMotion();
    controls.dampingFactor = ORBIT_DAMPING;

    orbitHome.theta = controls.getAzimuthalAngle();
    orbitHome.phi = controls.getPolarAngle();
    orbitHome.radius = camera.position.distanceTo(controls.target);

    applyOrbitLimits();

    controls.addEventListener("start", () => {
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

    document.getElementById("orbit-hint")?.removeAttribute("hidden");
    setOrbitEnabled(true);
  }

  function orbitAllowed() {
    return !!controls && controls.enabled && isAtDesk();
  }


  return {
    init: initOrbit, tick: tickOrbit, allowed: orbitAllowed, offHome: orbitOffHome,
    setEnabled: setOrbitEnabled, setAngles: setOrbitAngles,
    applyLimits: applyOrbitLimits, wallRange: wallAzimuthRange,
    killReturn, spendGlide, returnHome,
    home: orbitHome, spherical: orbitSpherical, leash: orbitLeash,
    get controls() { return controls; },
    get dragging() { return orbitDragging; },
    get returning() { return !!orbitTween; },
    get moving() { return orbitDragging || !!orbitTween || performance.now() - orbitChangedAt < ORBIT_SETTLE_MS; },
    cancelIdle() { orbitIdleAt = 0; },
    get riseLimits() { return [-THREE.MathUtils.radToDeg(ORBIT_DOWN), THREE.MathUtils.radToDeg(ORBIT_UP)]; },
    get downAngle() { return ORBIT_DOWN; },
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
