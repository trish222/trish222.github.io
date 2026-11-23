import * as THREE from 'three';

// Whether a camera's whole frame lands on the room's shell (floor, walls, desk, window), so no void shows.
// Rays through a ring just outside the frame's edge and a few points inside must all hit something.
const PER_SIDE = 16;
const EDGE = 1.03;
const POINTS = [];
for (let i = 0; i <= PER_SIDE; i++) {
  const t = (i / PER_SIDE) * 2 - 1;
  for (const [x, y] of [[t, 1], [t, -1], [1, t], [-1, t]]) POINTS.push(new THREE.Vector2(x * EDGE, y * EDGE));
}
POINTS.push(new THREE.Vector2(0, 0), new THREE.Vector2(0.5, 0.5), new THREE.Vector2(-0.5, -0.5));

export function createRoomFit(nodes) {
  const shell = [];
  for (const node of nodes) {
    node.traverse((o) => {
      if (!o.isMesh) return;
      // The render's own material: a wall seen from behind is culled there, so the ray must miss it too.
      const probe = new THREE.Mesh(o.geometry, o.material);
      probe.matrixAutoUpdate = false;
      probe.matrixWorld.copy(o.matrixWorld);
      shell.push(probe);
    });
  }
  if (!shell.length) throw new Error('roomFit: no shell meshes');
  const raycaster = new THREE.Raycaster();
  return (camera) => {
    camera.updateMatrixWorld();
    return POINTS.every((p) => {
      raycaster.setFromCamera(p, camera);
      return raycaster.intersectObjects(shell, false).length > 0;
    });
  };
}

// The drag limits stop where the frame would leave the room: bisected along each axis, then the four corners.
// This many halvings of the configured limit (~0.2 degrees of a 30 degree limit).
const REACH_STEPS = 7;

// The furthest of [0, max] degrees for which `ok(angle)` holds, assuming it fails past some angle.
function reach(max, ok) {
  if (ok(max)) return max;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < REACH_STEPS; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid; else hi = mid;
  }
  return ok(lo) ? lo : 0;
}

// [minus swing, plus swing, up, down] in degrees from `want`, rectangular and void-free at every corner.
// `inRoom(swing, drop)` says whether the frame still lands on the room that many degrees from home.
export function roomLimits(want, inRoom) {
  const [minus, plus, up, down] = [
    reach(want[0], (a) => inRoom(-a, 0)), reach(want[1], (a) => inRoom(a, 0)),
    reach(want[2], (a) => inRoom(0, -a)), reach(want[3], (a) => inRoom(0, a))];
  const corners = (t) => [[-minus, -up], [-minus, down], [plus, -up], [plus, down]]
    .every(([s, d]) => inRoom(s * t, d * t));
  const t = reach(1, corners);
  return [minus * t, plus * t, up * t, down * t];
}
