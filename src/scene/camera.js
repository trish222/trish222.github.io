import * as THREE from 'three';

// Arrival fits the screen with a margin; the dive just covers the viewport.
const ARRIVE_PAD = 1.2;
const ARRIVE_PAD_MOBILE = 1.06;
const COVER_BLEED = 0.985;

// Poses come from the GLB: the flight starts at cam_overview (cam_mobile on
// narrow screens) and lands on cam_screen's axis, straight onto screen_plane.
export function createCameraRig({ getStage, getCamera, getFov, getFlightStart,
  getOrbitRadius, distFor, isMobile }) {
  const orbitSpherical = new THREE.Spherical();
  const cams = () => getStage().cams;
  const surface = () => getStage().projectionSurface;
  const home = () => (isMobile() ? cams().mobile : cams().overview);

  function applyCameraSize(cam, width, height) {
    cam.aspect = width / height;
    cam.fov = getFov();
    cam.updateProjectionMatrix();
  }

  // Orbit pivot: on the overview's line of sight, as far out as the screen.
  const seatedTarget = new THREE.Vector3();
  function homeTarget() {
    const { position, forward } = home();
    return seatedTarget.copy(position).addScaledVector(forward, position.distanceTo(surface().center));
  }

  function screenFrustum(aspect) {
    const { width, height } = surface();
    return isMobile() ? ARRIVE_PAD_MOBILE * height : ARRIVE_PAD * Math.max(height, width / aspect);
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
    const flyStart = getFlightStart();
    if (flyStart) fromOffset.setFromSpherical(orbitSpherical.set(getOrbitRadius(), flyStart.phi, flyStart.theta));
    const toDist = distFor(screenFrustum(width / height));
    flyPath = {
      fromTarget,
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
    applyCameraSize(camera, width, height);
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

  return { homeTarget, screenFrustum, coverFrustum, buildFlyPath, applyFly, applyDive,
    target: flyTarget, pose: flyPose, resetPath() { flyPath = null; } };
}
