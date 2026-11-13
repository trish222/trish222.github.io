import * as THREE from 'three';
import { loadScene } from './loadScene.js';

const REQUIRED = ['screen_plane', 'click_crt', 'click_lamp_chain', 'cam_overview', 'cam_screen', 'cam_mobile'];

// Flat albedo until the lightmaps land; keeps the GLB's map, tint, vertex colours and alpha.
function flatten(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const { map, color, vertexColors, transparent, opacity, alphaTest, side } = o.material;
    o.material.dispose();
    o.material = new THREE.MeshBasicMaterial({ map, color, vertexColors, transparent, opacity, alphaTest, side });
  });
}

// The DOM quad's corners are the plane's UV corners, TL TR BR BL; glTF UVs start top-left.
function screenSurface(mesh) {
  const { position, uv } = mesh.geometry.attributes;
  const corners = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => {
    let best = 0;
    for (let i = 1; i < uv.count; i++) {
      if (Math.hypot(uv.getX(i) - u, uv.getY(i) - v) < Math.hypot(uv.getX(best) - u, uv.getY(best) - v)) best = i;
    }
    return new THREE.Vector3().fromBufferAttribute(position, best);
  });
  // Measure in world space: meshopt quantization scales the node, not the vertices.
  const [tl, tr, br, bl] = corners.map((c) => c.clone().applyMatrix4(mesh.matrixWorld));
  const across = tr.clone().sub(tl);
  const up = tl.clone().sub(bl);
  const center = tl.clone().add(br).multiplyScalar(0.5);
  const normal = across.clone().cross(up).normalize();
  return { mesh, corners, center, normal, width: across.length(), height: up.length() };
}

// Camera nodes and Empties alike look down their local -Z.
function pose(node) {
  const position = node.getWorldPosition(new THREE.Vector3());
  const forward = new THREE.Vector3(0, 0, -1).transformDirection(node.matrixWorld);
  return { position, forward, fov: node.isCamera ? node.fov : null };
}

export async function createRoomScene({ renderer }) {
  const { scene, named } = await loadScene(renderer);
  for (const name of REQUIRED) if (!named.has(name)) throw new Error(`scene.glb is missing "${name}"`);
  for (const [name, node] of named) if (name.startsWith('baked_')) flatten(node);

  const screenPlane = named.get('screen_plane');
  const proxies = { crt: named.get('click_crt'), lampChain: named.get('click_lamp_chain') };
  for (const proxy of Object.values(proxies)) proxy.material.visible = false;

  scene.updateMatrixWorld(true);
  const cams = { overview: pose(named.get('cam_overview')), screen: pose(named.get('cam_screen')),
    mobile: pose(named.get('cam_mobile')) };

  // Unlit until P5's CRT shader: teal when idle, the still at full value in flight.
  const idle = screenPlane.material.color.clone();
  screenPlane.material.dispose();
  const screenMat = screenPlane.material = new THREE.MeshBasicMaterial({ color: idle });
  const setStill = (canvas) => {
    screenMat.map?.dispose();
    screenMat.color.set(0xffffff);
    screenMat.map = new THREE.CanvasTexture(canvas);
    screenMat.map.colorSpace = THREE.SRGBColorSpace;
    screenMat.map.flipY = false;
    screenMat.needsUpdate = true;
  };
  const clearStill = () => {
    screenMat.map?.dispose();
    screenMat.map = null;
    screenMat.color.copy(idle);
    screenMat.needsUpdate = true;
  };

  const dispose = () => {
    clearStill();
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  };

  return { scene, screenPlane, proxies, cams, setStill, clearStill, dispose,
    projectionSurface: screenSurface(screenPlane) };
}
