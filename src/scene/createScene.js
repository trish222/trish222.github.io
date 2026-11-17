import * as THREE from 'three';
import { loadScene } from './loadScene.js';
import { createBakedLighting } from './bakedMaterial.js';
import { labelFloppies } from './floppyLabels.js';
import { createReflections } from './reflections.js';
import { LOOK } from '../config/look.js';
import { PROJECTS } from '../config/projects.js';

const REQUIRED = ['screen_plane', 'screen_glass', 'window_view', 'lamp_bulb', 'baked_floppy_labels',
  'click_crt', 'click_lamp_chain', 'cam_overview', 'cam_screen', 'cam_mobile',
  ...PROJECTS.map((_, i) => `click_project_0${i + 1}`)];

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

// Already graded and AgX-mapped in the bake, so it must bypass lighting and tone mapping.
// The look adds saturation and a contrast curve pivoting on mid-grey.
function unlitView(mesh) {
  const map = mesh.material.emissiveMap;
  mesh.material.dispose();
  const material = mesh.material = new THREE.MeshBasicMaterial({ map, toneMapped: false });
  const grade = { windowSaturation: { value: 1 }, windowContrast: { value: 1 } };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, grade);
    shader.fragmentShader = `uniform float windowSaturation, windowContrast;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722))), diffuseColor.rgb, windowSaturation), 0.0);
  diffuseColor.rgb = 0.18 * pow(diffuseColor.rgb / 0.18, vec3(windowContrast));`);
  };
  return () => {
    material.color.setScalar(LOOK.windowGain);
    grade.windowSaturation.value = LOOK.windowSaturation;
    grade.windowContrast.value = LOOK.windowContrast;
  };
}

export async function createRoomScene({ renderer }) {
  const { scene, named, lightmaps, extras } = await loadScene(renderer);
  for (const name of REQUIRED) if (!named.has(name)) throw new Error(`scene.glb is missing "${name}"`);
  const lighting = createBakedLighting(lightmaps, extras);
  const lit = [lighting.litMaterial(named.get('screen_glass').material)];
  for (const [name, node] of named) {
    if (!name.startsWith('baked_') || !('lightmap_uv' in node.userData)) continue;
    node.traverse((o) => {
      if (!o.isMesh) return;
      const material = lighting.bake(o, node.userData.lightmap_uv);
      if (!material.isMeshBasicMaterial) lit.push(material);
    });
  }
  const gradeWindow = unlitView(named.get('window_view'));
  gradeWindow();
  await labelFloppies(named.get('baked_floppy_labels').material);

  const screenPlane = named.get('screen_plane');
  const projects = PROJECTS.map((_, i) => named.get(`click_project_0${i + 1}`));
  const proxies = { crt: named.get('click_crt'), lampChain: named.get('click_lamp_chain'), projects };
  for (const proxy of [proxies.crt, proxies.lampChain, ...projects]) proxy.material.visible = false;

  scene.updateMatrixWorld(true);
  const reflections = createReflections({ renderer, scene, bulb: named.get('lamp_bulb'), materials: lit, lighting });
  const applyLook = () => { gradeWindow(); reflections.applyLook(); };
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
    reflections.dispose();
    lighting.dispose();
    named.get('baked_floppy_labels').material.userData.labelText.dispose();
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  };

  return { scene, screenPlane, proxies, cams, setStill, clearStill, dispose,
    setLampMix: reflections.setLampMix, applyLook, lampMix: () => lighting.uniforms.lampMix.value,
    projectionSurface: screenSurface(screenPlane) };
}
