import * as THREE from 'three';
import { LOOK } from '../config/look.js';
import { fitFrame, frames } from './fitFrame.js';
import { lookFor, lookMode } from '../config/experience.js';

// Arrival fits the screen with a margin; the dive just covers the viewport.
const ARRIVE_PAD = 1.2;
const ARRIVE_PAD_MOBILE = 1.06;
const COVER_BLEED = 0.985;
// Handheld home view: the monitor and keyboard (createScene's fitBox), centred on the screen, with
// LOOK.mobileFitMargin all around, the eye at most FIT_MAX_DIST from their centre (inside the room), the
// lens widening past that up to LOOK.mobileFov. A landscape phone keeps the GLB pose when that shows the box.
const FIT_MAX_DIST = 2.2;

// The screen's height as a fraction of the viewport's at arrival (camera straight on, centred).
export function arrivalFill(screenAspect, viewAspect, mobile) {
  return mobile ? 1 / ARRIVE_PAD_MOBILE : 1 / (ARRIVE_PAD * Math.max(1, screenAspect / viewAspect));
}

// Poses come from the GLB: the flight starts at cam_overview (cam_mobile on
// narrow screens) and lands on cam_screen's axis, straight onto screen_plane.
export function createCameraRig({ getStage, getCamera, getFov, getFlightStart,
  getOrbitRadius, distFor, isMobile, isHandheld, getAspect }) {
  const orbitSpherical = new THREE.Spherical();
  const cams = () => getStage().cams;
  const surface = () => getStage().projectionSurface;
  // The GLB pose orbited up by LOOK.overviewPitch (deg) around the point it looks at (as far out as
  // the screen), so it sees the desk more from above and stays centred, then dollied back along
  // its line of sight by LOOK.overviewZoom (wider, same lens) and raised by LOOK.overviewHeight (m).
  const UP = new THREE.Vector3(0, 1, 0);
  const homePose = { position: new THREE.Vector3(), forward: new THREE.Vector3(), fov: 0 };
  const right = new THREE.Vector3();
  const pivot = new THREE.Vector3();
  function home() {
    const cam = isMobile() ? cams().mobile : cams().overview;
    const dist = cam.position.distanceTo(surface().center);
    pivot.copy(cam.position).addScaledVector(cam.forward, dist);
    right.crossVectors(cam.forward, UP).normalize();
    const handheld = isHandheld();
    const pitch = LOOK.overviewPitch + (handheld ? LOOK.mobilePitch : 0);
    homePose.forward.copy(cam.forward).applyAxisAngle(right, -THREE.MathUtils.degToRad(pitch));
    if (handheld) homePose.forward.applyAxisAngle(UP, THREE.MathUtils.degToRad(LOOK.mobileYaw));
    homePose.position.copy(pivot).addScaledVector(homePose.forward, -LOOK.overviewZoom * dist)
      .addScaledVector(UP, LOOK.overviewHeight);
    homePose.fov = getFov();
    const fitBox = handheld && getStage().fitBox;
    const aspect = fitBox && getAspect();
    const margin = LOOK.mobileFitMargin;
    if (fitBox && (aspect < 1 || !frames(homePose.position, fitBox, homePose.forward, homePose.fov, aspect, margin))) {
      homePose.fov = fitFrame(homePose.position, fitBox, homePose.forward, {
        fov: homePose.fov, aspect, margin, maxDist: FIT_MAX_DIST, maxFov: LOOK.mobileFov, centerX: surface().center,
        shiftX: LOOK.mobileOffsetX, shiftY: LOOK.mobileOffsetY });
    }
    if (handheld) homePose.position.y += LOOK.mobileHeight;
    return homePose;
  }

  function applyCameraSize(cam, width, height, fov = getFov()) {
    cam.aspect = width / height;
    cam.fov = fov;
    cam.updateProjectionMatrix();
  }

  // A point on the overview's line of sight, `depth` times as far out as the screen.
  function alongSight(out, depth) {
    const { position, forward } = home();
    return out.copy(position).addScaledVector(forward, depth * position.distanceTo(surface().center));
  }
  const seatedTarget = new THREE.Vector3();
  const homeTarget = () => alongSight(seatedTarget, 1);
  // Look-around pivot (lookMode()): "orbit" swings the camera around pivotDepth; "turn" puts the
  // pivot a hair in front of the eye, so the camera rotates in place (OrbitControls needs a radius above 0).
  const TURN_DEPTH = 0.001;
  const orbitTarget = new THREE.Vector3();
  const orbitPivot = () => alongSight(orbitTarget, lookMode() === 'turn' ? TURN_DEPTH : lookFor('pivotDepth'));

  function screenFrustum(aspect) {
    const { width, height } = surface();
    return height / arrivalFill(width / height, aspect, isMobile());
  }

  function coverFrustum(aspect) {
    const { width, height } = surface();
    return COVER_BLEED * Math.min(height, width / aspect);
  }

  const flyTarget = new THREE.Vector3();
  const flyPose = { frustum: 0, dist: 0 };
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

  let flyPath = null;

  function buildFlyPath(width, height) {
    const fromTarget = homeTarget().clone();
    const fromOffset = home().position.clone().sub(fromTarget);
    const fromFov = homePose.fov;
    const flyStart = getFlightStart();
    if (flyStart) {
      // Start from the swung pose, aimed at a point as far out as the screen whatever the pivot is.
      const dist = fromOffset.length();
      fromOffset.setFromSpherical(orbitSpherical.set(1, flyStart.phi, flyStart.theta));
      fromTarget.copy(orbitPivot()).addScaledVector(fromOffset, getOrbitRadius() - dist);
      fromOffset.multiplyScalar(dist);
    }
    const toDist = distFor(screenFrustum(width / height));
    flyPath = {
      fromTarget,
      fromFov,
      fromDir: fromOffset.clone().normalize(),
      fromLog: Math.log(fromOffset.length()),
      toDir: cams().screen.forward.clone().negate(),
      toLog: Math.log(toDist),
    };
  }

  const flyDir = new THREE.Vector3();
  const flyQuat = new THREE.Quaternion();
  const noTurn = new THREE.Quaternion();

  // Linear in u: the GSAP timeline supplies the easing.
  function applyFly(p, width, height) {
    const camera = getCamera();
    if (!flyPath) buildFlyPath(width, height);
    const u = clamp01(p);
    flyTarget.lerpVectors(flyPath.fromTarget, surface().center, u);
    flyQuat.setFromUnitVectors(flyPath.fromDir, flyPath.toDir);
    flyDir.copy(flyPath.fromDir).applyQuaternion(flyQuat.slerp(noTurn, 1 - u));
    const dist = Math.exp(THREE.MathUtils.lerp(flyPath.fromLog, flyPath.toLog, u));
    camera.position.copy(flyTarget).addScaledVector(flyDir, dist);
    camera.lookAt(flyTarget);
    applyCameraSize(camera, width, height, THREE.MathUtils.lerp(flyPath.fromFov, getFov(), u));
    camera.updateMatrixWorld();
    flyPose.dist = dist;
    flyPose.frustum = 2 * dist * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    return flyPose.frustum;
  }

  const diveOffset = new THREE.Vector3();

  function applyDive(q, width, height) {
    const camera = getCamera();
    const f0 = applyFly(1, width, height);
    const u = clamp01(q);
    if (u === 0) return f0;

    const f1 = Math.min(f0, coverFrustum(width / height));
    const f = Math.exp(THREE.MathUtils.lerp(Math.log(f0), Math.log(f1), u));
    const dist = distFor(f);
    diveOffset.copy(camera.position).sub(flyTarget).setLength(dist);
    camera.position.copy(flyTarget).add(diveOffset);
    camera.updateMatrixWorld();
    flyPose.frustum = f;
    flyPose.dist = dist;
    return f;
  }

  return { homeTarget, orbitPivot, screenFrustum, coverFrustum, buildFlyPath, applyFly, applyDive,
    target: flyTarget, pose: flyPose, resetPath() { flyPath = null; } };
}
