import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const min = new THREE.Vector3();
const max = new THREE.Vector3();
const view = Array.from({ length: 8 }, () => new THREE.Vector3());

const corner = new THREE.Vector3();
const forEachCorner = (box, fn) => view.forEach((v, i) => fn(v.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z), i));

// Whether `box` already sits inside the frame, with the margin, for an eye at `eye` looking along `forward`.
export function frames(eye, box, forward, fov, aspect, margin) {
  right.crossVectors(forward, UP).normalize();
  up.crossVectors(right, forward);
  const tan = Math.tan(THREE.MathUtils.degToRad(fov) / 2);
  let inside = true;
  forEachCorner(box, (v) => {
    corner.copy(v).sub(eye);
    const depth = corner.dot(forward);
    inside &&= depth > 0 && Math.abs(corner.dot(right)) * margin <= depth * tan * aspect && Math.abs(corner.dot(up)) * margin <= depth * tan;
  });
  return inside;
}

// Frames `box` (world) looking along `forward`, centred on the box vertically and on `centerX` (a world
// point) sideways, with a margin (1 = edge to edge): the camera backs off along its line of sight until the
// box fits at `fov` (vertical, degrees). Past `maxDist` metres from the box's centre it stays put and widens
// the lens instead, up to `maxFov`, and only then backs off further. `shiftX` / `shiftY` (m) slide the
// framing right / up in the image. Writes the eye into `position` and returns the fov.
export function fitFrame(position, box, forward, { fov, aspect, margin, maxDist, maxFov, centerX, shiftX = 0, shiftY = 0 }) {
  right.crossVectors(forward, UP).normalize();
  up.crossVectors(right, forward);
  min.setScalar(Infinity);
  max.setScalar(-Infinity);
  forEachCorner(box, (v) => {
    v.set(v.dot(right), v.dot(up), v.dot(forward));
    min.min(v);
    max.max(v);
  });
  const cx = centerX.dot(right);
  const cy = (min.y + max.y) / 2;
  const cz = (min.z + max.z) / 2;
  // The depth of the eye (in view coordinates) at which every corner lands inside the frame at this lens.
  const eyeAt = (tan) => view.reduce((eye, p) => Math.min(eye,
    p.z - Math.abs(p.x - cx) * margin / (tan * aspect), p.z - Math.abs(p.y - cy) * margin / tan), Infinity);
  const tanOf = (deg) => Math.tan(THREE.MathUtils.degToRad(deg) / 2);
  let lens = Math.min(fov, maxFov);
  let eye = eyeAt(tanOf(lens));
  if (cz - eye > maxDist) {
    const atMax = cz - maxDist;
    const tan = view.reduce((wide, p) => Math.max(wide, Math.abs(p.x - cx) * margin / (p.z - atMax) / aspect,
      Math.abs(p.y - cy) * margin / (p.z - atMax)), tanOf(lens));
    lens = Math.min(THREE.MathUtils.radToDeg(2 * Math.atan(tan)), maxFov);
    eye = Math.min(atMax, eyeAt(tanOf(lens)));
  }
  position.copy(right).multiplyScalar(cx - shiftX).addScaledVector(up, cy - shiftY).addScaledVector(forward, eye);
  return lens;
}
