import * as THREE from "three";

export function createParallax() {
const parallaxStrengthX = 0.36;
const parallaxStrengthY = 0.30;
const parallaxSmoothness = 0.09;
const maxParallaxOffset = 0.42;
const parallaxPointer = new THREE.Vector2();
const parallaxOffset = new THREE.Vector2();
const parallaxPosition = new THREE.Vector3();
const parallaxQuaternion = new THREE.Quaternion();
const parallaxRight = new THREE.Vector3();
const parallaxUp = new THREE.Vector3();


function tick(dt, active) {
  let targetX = active ? -parallaxPointer.x * parallaxStrengthX : 0;
  let targetY = active ? -parallaxPointer.y * parallaxStrengthY : 0;
  const distance = Math.hypot(targetX, targetY);
  if (distance > maxParallaxOffset) {
    const scale = maxParallaxOffset / distance;
    targetX *= scale;
    targetY *= scale;
  }
  const k = 1 - Math.exp(-dt / parallaxSmoothness);
  parallaxOffset.x += (targetX - parallaxOffset.x) * k;
  parallaxOffset.y += (targetY - parallaxOffset.y) * k;
  if (Math.abs(parallaxOffset.x) < 0.00001) parallaxOffset.x = 0;
  if (Math.abs(parallaxOffset.y) < 0.00001) parallaxOffset.y = 0;
}

function begin(camera, target, active) {
  if (!active || parallaxOffset.lengthSq() === 0) return false;
  parallaxPosition.copy(camera.position);
  parallaxQuaternion.copy(camera.quaternion);
  parallaxRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  parallaxUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
  camera.position.addScaledVector(parallaxRight, parallaxOffset.x)
    .addScaledVector(parallaxUp, parallaxOffset.y);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return true;
}

function end(camera) {
  camera.position.copy(parallaxPosition);
  camera.quaternion.copy(parallaxQuaternion);
  camera.updateMatrixWorld();
}
return { pointer: parallaxPointer, offset: parallaxOffset, tick, begin, end,
  reset() { parallaxPointer.set(0, 0); parallaxOffset.set(0, 0); },
};
}
