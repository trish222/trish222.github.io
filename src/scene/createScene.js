import * as THREE from 'three';
import { loadScene } from './loadScene.js';
import { SCREEN_W, SCREEN_H, OVERSCAN } from './screenSpec.js';

const REQUIRED = ['screen_plane', 'click_crt', 'click_lamp_chain', 'cam_overview', 'cam_screen', 'cam_mobile'];

export async function createRoomScene({ renderer }) {
  const { scene, named } = await loadScene(renderer);
  for (const name of REQUIRED) if (!named.has(name)) throw new Error(`scene.glb is missing "${name}"`);

  const screenPlane = named.get('screen_plane');
  const proxies = { crt: named.get('click_crt'), lampChain: named.get('click_lamp_chain') };
  for (const proxy of Object.values(proxies)) proxy.material.visible = false;

  scene.updateMatrixWorld(true);

  const screenMat = screenPlane.material;
  const setStill = (canvas) => {
    screenMat.map?.dispose();
    screenMat.map = new THREE.CanvasTexture(canvas);
    screenMat.map.colorSpace = THREE.SRGBColorSpace;
    screenMat.needsUpdate = true;
  };
  const clearStill = () => {
    screenMat.map?.dispose();
    screenMat.map = null;
    screenMat.needsUpdate = true;
  };

  const dispose = () => {
    clearStill();
    scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  };

  return { scene, screenPlane, proxies, cams: named, setStill, clearStill, dispose,
    projectionSurface: { mesh: screenPlane, width: SCREEN_W, height: SCREEN_H, overscan: OVERSCAN } };
}
