import * as THREE from 'three';
import { quadTransform } from './projection.js';

export function createScreenProjection() {
  const screenCorner = new THREE.Vector3();
  const cornerView = new THREE.Vector3();
  /* Four corners now, not three: top-left, top-right, bottom-right,
     bottom-left, which is the winding `quadTransform` expects. */
  const QUAD = [
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0],
  ];

  function projectCorner(surface, camera, corner, width, height, out) {
    screenCorner.copy(corner).applyMatrix4(surface.mesh.matrixWorld);
    /* View-space depth, before the projection divides by it. */
    cornerView.copy(screenCorner).applyMatrix4(camera.matrixWorldInverse);
    if (-cornerView.z <= camera.near) return false;
    screenCorner.project(camera);
    out[0] = (screenCorner.x * 0.5 + 0.5) * width;
    out[1] = (-screenCorner.y * 0.5 + 0.5) * height;
    return true;
  }

  const viewDir = new THREE.Vector3();

  function facing(surface, camera, target) {
    viewDir.copy(target).sub(camera.position).normalize();
    return -surface.normal.dot(viewDir);
  }

  return {
    facing,
    project(surface, camera, width, height, boxWidth, boxHeight) {
      const front = surface.corners.every((corner, i) => projectCorner(surface, camera, corner, width, height, QUAD[i]));
      const transform = front ? quadTransform(QUAD, boxWidth, boxHeight) : null;
      return { transform, scale: Math.hypot(QUAD[1][0] - QUAD[0][0], QUAD[1][1] - QUAD[0][1]) / boxWidth || 1 };
    },
  };
}
