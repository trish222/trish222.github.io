import * as THREE from 'three';
import { FACING, MON_W, MON_H, SCREEN_W, SCREEN_H, OVERSCAN } from '../computer.js';

// Keep the calibrated spline, logarithmic zoom, and screen fit together.
const TURN_END = 0.55;
const ZOOM_START = 0.45;
const MONITOR_FRAME = 1.12;
const ARRIVE_PAD = 1.2;
const ARRIVE_PAD_MOBILE = 1.06;
const COVER_BLEED = 0.985;
const FLY_KNOTS = [0, 0.3, 0.55, 1];
const FLY_TENSION = 0.42;

export function createCameraRig({ screenTarget: SCREEN_TARGET, getCamera, getFov,
  getFlightStart, getOrbitRadius, distFor, isMobile }) {
  const orbitSpherical = new THREE.Spherical();
  function applyCameraSize(cam, width, height) {
    cam.aspect = width / height;
    cam.fov = getFov();
    cam.updateProjectionMatrix();
  }

  // A seated eye line: enough downward pitch and lateral offset to reveal
  // the CRT casing and desk, without turning the opening into an overview.
  const SEATED_FRAME = 2.02;
  const SEATED_ELEVATION = THREE.MathUtils.degToRad(12);
  const SEATED_AZIMUTH = FACING + THREE.MathUtils.degToRad(10);
  // Aim below the glass so the keyboard and desk foreground share the
  // composition, with the monitor centered horizontally above them.
  const seatedTarget = new THREE.Vector3();
  function homeTarget() {
    return seatedTarget.copy(SCREEN_TARGET).addScaledVector(THREE.Object3D.DEFAULT_UP, -1.7);
  }

  const flyTarget = new THREE.Vector3();

  const flyPose = { frustum: 24, dist: 0 };

  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  const easeInOut = (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const lerp = THREE.MathUtils.lerp;

  function monitorFrustum(aspect) {
    return Math.max(MON_H * MONITOR_FRAME, (MON_W * MONITOR_FRAME) / aspect);
  }

  function screenFrustum(aspect) {
    const h = SCREEN_H * (1 - 2 * OVERSCAN);
    const w = SCREEN_W * (1 - 2 * OVERSCAN);
    return isMobile()
      ? ARRIVE_PAD_MOBILE * h
      : ARRIVE_PAD * Math.max(h, w / aspect);
  }

  function coverFrustum(aspect) {
    const h = SCREEN_H * (1 - 2 * OVERSCAN);
    const w = SCREEN_W * (1 - 2 * OVERSCAN);
    return COVER_BLEED * Math.min(h, w / aspect);
  }

  const legacyPose = { position: new THREE.Vector3(), target: new THREE.Vector3(), frustum: 0 };

  function samplePose(p, aspect) {
    const turn = easeInOut(clamp01(p / TURN_END));
    const zoom = easeInOut(clamp01((p - ZOOM_START) / (1 - ZOOM_START)));

    legacyPose.target.lerpVectors(homeTarget(), SCREEN_TARGET, turn);
    legacyPose.target.lerp(SCREEN_TARGET, zoom);
    const azimuth = SEATED_AZIMUTH * (1 - turn);
    const elevation = SEATED_ELEVATION * (1 - turn);
    legacyPose.frustum = Math.exp(
      lerp(
        lerp(Math.log(monitorFrustum(aspect) * SEATED_FRAME), Math.log(monitorFrustum(aspect)), turn),
        Math.log(screenFrustum(aspect)),
        zoom,
      ),
    );
    const dist = distFor(legacyPose.frustum);
    legacyPose.position.set(
      legacyPose.target.x + dist * Math.cos(elevation) * Math.sin(azimuth),
      legacyPose.target.y + dist * Math.sin(elevation),
      legacyPose.target.z + dist * Math.cos(elevation) * Math.cos(azimuth),
    );
    return legacyPose;
  }

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

    const flyStart = getFlightStart();
    if (flyStart) {
      orbitSpherical.set(getOrbitRadius(), flyStart.phi, flyStart.theta);
      positions[0].setFromSpherical(orbitSpherical).add(targets[0]);
    }
    const curve = (pts) =>
      new THREE.CatmullRomCurve3(pts, false, "catmullrom", FLY_TENSION);
    flyPath = {
      position: curve(positions),
      target: curve(targets),
      frustum: curve(frustums),

      fMin: Math.min(frustums[0].x, frustums[3].x),
      fMax: Math.max(frustums[0].x, frustums[3].x),
    };
  }

  const flyPoint = new THREE.Vector3();

  const flyOffset = new THREE.Vector3();
  const flyScratch = new THREE.Vector3();

  function applyFly(p, width, height) {
    const camera = getCamera();
    if (!flyPath) buildFlyPath(width, height);
    const u = clamp01(p);

    flyPath.position.getPoint(u, flyPoint);
    flyPath.target.getPoint(u, flyTarget);

    const f = Math.exp(
      THREE.MathUtils.clamp(
        flyPath.frustum.getPoint(u, flyScratch).x,
        flyPath.fMin,
        flyPath.fMax,
      ),
    );

    const dist = distFor(f);
    flyOffset.copy(flyPoint).sub(flyTarget);
    const len = flyOffset.length() || 1;
    camera.position.copy(flyTarget).addScaledVector(flyOffset, dist / len);
    camera.lookAt(flyTarget);
    camera.updateMatrixWorld();

    applyCameraSize(camera, width, height);
    flyPose.frustum = f;
    flyPose.dist = dist;

    return f;
  }

  function applyDive(q, width, height) {
    const camera = getCamera();
    const f0 = applyFly(1, width, height);
    const u = clamp01(q);
    if (u === 0) return f0;

    const f1 = Math.min(f0, coverFrustum(width / height));
    const f = Math.exp(lerp(Math.log(f0), Math.log(f1), u));
    const dist = distFor(f);
    flyOffset.copy(camera.position).sub(flyTarget);
    const len = flyOffset.length() || 1;
    camera.position.copy(flyTarget).addScaledVector(flyOffset, dist / len);
    camera.lookAt(flyTarget);
    camera.updateMatrixWorld();
    flyPose.frustum = f;
    flyPose.dist = dist;
    return f;
  }


  return { homeTarget, screenFrustum, coverFrustum, buildFlyPath, applyFly, applyDive,
    target: flyTarget, pose: flyPose, resetPath() { flyPath = null; } };
}
