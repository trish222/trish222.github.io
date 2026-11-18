import * as THREE from 'three';
import { loadScene } from './loadScene.js';
import { createBakedLighting } from './bakedMaterial.js';
import { labelFloppies } from './floppyLabels.js';
import { createWindowView } from './windowView.js';
import { createCrtMaterial } from './crtMaterial.js';
import { createReflections } from './reflections.js';
import { LOOK } from '../config/look.js';
import { FLOPPIES } from '../content/content.js';

const REQUIRED = ['screen_plane', 'screen_glass', 'window_view', 'lamp_bulb', 'baked_floppy_labels',
  'click_crt', 'click_lamp_chain', 'cam_overview', 'cam_screen', 'cam_mobile',
  ...FLOPPIES.map((_, i) => `click_project_0${i + 1}`)];

// The DOM quad's corners are the plane's UV corners, TL TR BR BL; glTF UVs start top-left.
function averageColor(canvas) {
  const small = Object.assign(document.createElement('canvas'), { width: 8, height: 8 });
  const ctx = small.getContext('2d');
  ctx.drawImage(canvas, 0, 0, 8, 8);
  const { data } = ctx.getImageData(0, 0, 8, 8);
  const sum = new THREE.Color(0, 0, 0);
  for (let i = 0; i < data.length; i += 4) sum.add(new THREE.Color().setRGB(data[i] / 255, data[i + 1] / 255, data[i + 2] / 255, THREE.SRGBColorSpace));
  return sum.multiplyScalar(4 / data.length);
}

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

export async function createRoomScene({ renderer, boxWidth, animated }) {
  const { scene, named, lightmaps, extras } = await loadScene(renderer);
  for (const name of REQUIRED) if (!named.has(name)) throw new Error(`scene.glb is missing "${name}"`);
  const lighting = createBakedLighting(lightmaps, extras);
  // crt_glass exports opaque (BLEND, alpha 1); the glass is for reflections only, so the picture shows through.
  const glass = named.get('screen_glass').material;
  glass.opacity = 0;
  const lit = [lighting.litMaterial(glass)];
  for (const [name, node] of named) {
    if (!name.startsWith('baked_') || !('lightmap_uv' in node.userData)) continue;
    node.traverse((o) => {
      if (!o.isMesh) return;
      const material = lighting.bake(o, node.userData.lightmap_uv);
      if (!material.isMeshBasicMaterial) lit.push(material);
    });
  }
  const windowView = createWindowView(named.get('window_view'), animated);
  windowView.applyLook();
  await labelFloppies(named.get('baked_floppy_labels').material);

  const screenPlane = named.get('screen_plane');
  const projects = FLOPPIES.map((_, i) => named.get(`click_project_0${i + 1}`));
  const proxies = { crt: named.get('click_crt'), lampChain: named.get('click_lamp_chain'), projects };
  for (const proxy of [proxies.crt, proxies.lampChain, ...projects]) proxy.material.visible = false;

  scene.updateMatrixWorld(true);
  const reflections = createReflections({ renderer, scene, bulb: named.get('lamp_bulb'), materials: lit, lighting });
  const applyLook = () => { windowView.applyLook(); crt.applyLook(); reflections.applyLook(); };
  const setTime = (t) => { crt.setTime(t); windowView.setTime(t); };
  const cams = { overview: pose(named.get('cam_overview')), screen: pose(named.get('cam_screen')),
    mobile: pose(named.get('cam_mobile')) };

  // The desktop snapshot on the tube; the average colour of what it shows tints the desk's screen light.
  const projectionSurface = screenSurface(screenPlane);
  const crt = createCrtMaterial(screenPlane.material.color.clone(), boxWidth * projectionSurface.height / projectionSurface.width);
  screenPlane.material.dispose();
  screenPlane.material = crt.material;
  const setStill = (canvas) => {
    crt.material.uniforms.map.value?.dispose();
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = false;
    crt.setMap(map);
    lighting.setScreenColor(averageColor(canvas));
  };

  const dispose = () => {
    crt.material.uniforms.map.value?.dispose();
    reflections.dispose();
    lighting.dispose();
    named.get('baked_floppy_labels').material.userData.labelText.dispose();
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  };

  return { scene, screenPlane, proxies, cams, setStill, crt, setTime, dispose,
    setLampMix: reflections.setLampMix, applyLook, lampMix: () => lighting.uniforms.lampMix.value,
    projectionSurface };
}
